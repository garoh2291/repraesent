import type {
  TemplateDocument,
  TemplateLocaleContent,
} from "~/lib/api/email-templates";
import {
  entriesByKey,
  hashText,
  mergeTranslations,
} from "./translate-items";

/**
 * Keeping every language's TEXT in step, without ever overwriting a human.
 *
 * Structure is shared (see locale-sync.ts); text is not. Editing the German
 * heading used to leave the French one saying the old thing. It now follows —
 * but only where the translation is still exactly what the translator produced.
 *
 * That distinction needs a record, because the text alone cannot answer it. A
 * French string that differs from the German might be a good translation or a
 * hand-written correction, and guessing wrong destroys someone's work. So each
 * translated string remembers two hashes: the source it came from, and what we
 * wrote. Source hash changed -> stale. Output hash changed -> a person has been
 * here, hands off.
 */

export interface TranslationRecord {
  /** Hash of the source string this translation was made from. */
  src: string;
  /** Hash of what we wrote, so a later hand-edit is detectable. */
  out: string;
}

export type TranslationProvenance = Record<string, TranslationRecord>;

export type SyncDecision =
  /** Send to the translator. */
  | "translate"
  /** Source went blank: write blank straight through, no AI call. */
  | "clear"
  /** Already matches the current source. */
  | "in-sync"
  /** Someone rewrote this language's copy; leave it and report it. */
  | "hand-edited"
  /** No record, and the text is not ours to assume. Needs linking once. */
  | "unlinked";

export function decideKey(
  sourceValue: string | undefined,
  targetValue: string | undefined,
  record: TranslationRecord | undefined,
): SyncDecision {
  const source = sourceValue ?? "";
  const target = targetValue ?? "";

  // Emptying a heading in one language must empty it in the others, or the
  // languages diverge again — and there is nothing to translate.
  if (source.trim() === "") return target.trim() === "" ? "in-sync" : "clear";

  if (record) {
    if (hashText(target) !== record.out) return "hand-edited";
    return hashText(source) === record.src ? "in-sync" : "translate";
  }

  // No record. Blank, or still a verbatim copy of the source, is safely ours.
  if (target.trim() === "" || target === source) return "translate";
  return "unlinked";
}

export interface SyncPlan {
  /** Keys to send to the translator, per language. */
  targets: { locale: string; keys: string[] }[];
  /** Keys to blank directly, per language — no AI call. */
  clears: { locale: string; keys: string[] }[];
  /** Languages where a hand-written string is now out of date, and by how much. */
  handEdited: Record<string, number>;
}

/**
 * What to do about `changedKeys`, for every language but the source.
 *
 * Scoped to the keys the author actually touched. Planning over the whole
 * document instead would mean the first edit to an existing template re-ran
 * every string in it.
 */
export function planSync(
  doc: TemplateDocument,
  sourceLocale: string,
  changedKeys: readonly string[],
): SyncPlan {
  const source = doc.locales[sourceLocale];
  const plan: SyncPlan = { targets: [], clears: [], handEdited: {} };
  if (!source || changedKeys.length === 0) return plan;

  const sourceValues = entriesByKey(source);

  for (const [locale, content] of Object.entries(doc.locales)) {
    if (locale === sourceLocale) continue;
    const targetValues = entriesByKey(content);
    const provenance = content.translated ?? {};

    const translate: string[] = [];
    const clear: string[] = [];
    let handEdited = 0;

    for (const key of changedKeys) {
      switch (
        decideKey(sourceValues.get(key), targetValues.get(key), provenance[key])
      ) {
        case "translate":
          translate.push(key);
          break;
        case "clear":
          clear.push(key);
          break;
        case "hand-edited":
          handEdited += 1;
          break;
        default:
          break;
      }
    }

    if (translate.length) plan.targets.push({ locale, keys: translate });
    if (clear.length) plan.clears.push({ locale, keys: clear });
    if (handEdited) plan.handEdited[locale] = handEdited;
  }

  return plan;
}

/**
 * Which text keys differ between two versions of one language's content.
 *
 * Callers hand this the before and after of an edit, so the sync works from
 * what actually changed rather than re-running the whole document.
 */
export function changedKeysBetween(
  before: TemplateLocaleContent | undefined,
  after: TemplateLocaleContent | undefined,
): string[] {
  const from = entriesByKey(before);
  const to = entriesByKey(after);
  const keys = new Set([...from.keys(), ...to.keys()]);
  return [...keys].filter((key) => from.get(key) !== to.get(key));
}

/** Record that `keys` in `content` are the current translation of `source`. */
export function stamp(
  content: TemplateLocaleContent,
  source: TemplateLocaleContent,
  keys: readonly string[],
): TemplateLocaleContent {
  if (keys.length === 0) return content;
  const sourceValues = entriesByKey(source);
  const targetValues = entriesByKey(content);
  const translated: TranslationProvenance = { ...(content.translated ?? {}) };

  for (const key of keys) {
    const sourceValue = sourceValues.get(key);
    if (sourceValue === undefined) {
      // The source no longer carries this string; a stale record would claim a
      // relationship that no longer exists.
      delete translated[key];
      continue;
    }
    translated[key] = {
      src: hashText(sourceValue),
      out: hashText(targetValues.get(key) ?? ""),
    };
  }

  return { ...content, translated };
}

/** Blank `keys` in one language and record that this is deliberate. */
export function applyClears(
  content: TemplateLocaleContent,
  source: TemplateLocaleContent,
  keys: readonly string[],
): TemplateLocaleContent {
  if (keys.length === 0) return content;
  const cleared = mergeTranslations(
    content,
    Object.fromEntries(keys.map((key) => [key, ""])),
  );
  return stamp(cleared, source, keys);
}

/**
 * Merge a translation result, re-checking the guard as it lands.
 *
 * The decision to overwrite was taken before the request went out. If the
 * author switched to this language and rewrote the string while it was in
 * flight, honouring the old decision would throw their work away — so every
 * value is re-tested against the record that was current when we asked.
 */
export function mergeSyncResult(
  content: TemplateLocaleContent,
  source: TemplateLocaleContent,
  values: Record<string, string>,
  guardAtRequest: TranslationProvenance,
): TemplateLocaleContent {
  const targetValues = entriesByKey(content);
  const sourceValues = entriesByKey(source);
  const accepted: Record<string, string> = {};

  for (const [key, value] of Object.entries(values)) {
    const before = guardAtRequest[key];
    const now = targetValues.get(key) ?? "";
    // Unchanged since we asked? Then it is still ours to replace. `before`
    // absent is the first-ever translation of that string, where the guard was
    // "blank or a verbatim copy" — re-test that same condition.
    const untouched = before
      ? hashText(now) === before.out
      : now.trim() === "" || now === (sourceValues.get(key) ?? "");
    if (untouched) accepted[key] = value;
  }

  if (Object.keys(accepted).length === 0) return content;
  return stamp(mergeTranslations(content, accepted), source, Object.keys(accepted));
}

/**
 * Adopt every language's current text as its translation of the source, without
 * changing a character or calling the translator.
 *
 * This is how a template written before any of this existed starts syncing: it
 * has real French that we cannot prove is ours, so nothing is auto-updated
 * until someone confirms the two correspond. Also the repair after a hand-edit —
 * fix the French, link it, and it is in step again.
 */
export function linkTranslations(
  doc: TemplateDocument,
  sourceLocale: string,
): TemplateDocument {
  const source = doc.locales[sourceLocale];
  if (!source) return doc;
  const keys = [...entriesByKey(source).keys()];

  const locales: TemplateDocument["locales"] = {};
  for (const [locale, content] of Object.entries(doc.locales)) {
    locales[locale] =
      locale === sourceLocale ? content : stamp(content, source, keys);
  }
  return { ...doc, locales };
}

/** Strings whose source moved on but whose translation a person owns. */
export function outOfDateCount(
  doc: TemplateDocument,
  sourceLocale: string,
  locale: string,
): number {
  if (locale === sourceLocale) return 0;
  const source = doc.locales[sourceLocale];
  const content = doc.locales[locale];
  if (!source || !content) return 0;

  const sourceValues = entriesByKey(source);
  const targetValues = entriesByKey(content);
  const provenance = content.translated ?? {};

  let count = 0;
  for (const [key, value] of sourceValues) {
    if (
      decideKey(value, targetValues.get(key), provenance[key]) === "hand-edited"
    ) {
      count += 1;
    }
  }
  return count;
}

/**
 * True when a language has text that is neither blank, a verbatim copy, nor
 * linked — i.e. the template predates this and needs linking once.
 */
export function needsLinking(
  doc: TemplateDocument,
  sourceLocale: string,
  locale: string,
): boolean {
  if (locale === sourceLocale) return false;
  const source = doc.locales[sourceLocale];
  const content = doc.locales[locale];
  if (!source || !content) return false;

  const targetValues = entriesByKey(content);
  const provenance = content.translated ?? {};

  for (const [key, value] of entriesByKey(source)) {
    if (decideKey(value, targetValues.get(key), provenance[key]) === "unlinked") {
      return true;
    }
  }
  return false;
}
