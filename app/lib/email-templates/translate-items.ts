import type {
  Block,
  TemplateDocument,
  TemplateLocaleContent,
} from "~/lib/api/email-templates";

/**
 * Collect/merge the translatable strings of a template locale, for the AI
 * translate endpoint (mirrors lib/forms/content.ts's role for forms).
 *
 * Keys are stable across locales because a non-default locale is created as a
 * structural clone of the default one — SAME block ids, translated text. That
 * parallel structure is what makes `block.<id>.html` addressable in every
 * language.
 */

export interface TranslateEntry {
  key: string;
  value: string;
  format?: "text" | "html";
}

/**
 * The block attributes that hold READING MATTER, per block type.
 *
 * One definition, used by three things that must never disagree: what gets
 * sent to the translator, what an edit writes to a single language, and what
 * counts as "still untranslated". A second copy of this list somewhere else is
 * how a field ends up translated but not editable per-language, or restyled in
 * one language only.
 *
 * Everything absent here is structure or styling — colours, alignment, `href`,
 * `src`, corner radius, heading level, column ratio — and is shared by every
 * language.
 */
export const TRANSLATABLE_ATTRS: Record<string, readonly string[]> = {
  heading: ["html"],
  text: ["html"],
  html: ["html"],
  button: ["label"],
  image: ["alt"],
};

/** Is this attribute of this block type text that differs per language? */
export function isTranslatableAttr(blockType: string, attr: string): boolean {
  return (TRANSLATABLE_ATTRS[blockType] ?? []).includes(attr);
}

function blockEntries(block: Block): TranslateEntry[] {
  const attrs = block.attrs as Record<string, unknown>;
  const entries: TranslateEntry[] = [];

  // Driven by TRANSLATABLE_ATTRS rather than its own switch, so the translator
  // and the per-language edit rule cannot drift apart.
  for (const attr of TRANSLATABLE_ATTRS[block.type] ?? []) {
    const value = attrs[attr];
    if (typeof value === "string" && value.trim() !== "") {
      entries.push({
        key: `block.${block.id}.${attr}`,
        value,
        // `html` is the only rich field; labels and alt text are plain.
        format: attr === "html" ? "html" : undefined,
      });
    }
  }

  for (const column of block.columns ?? []) {
    for (const child of column) entries.push(...blockEntries(child));
  }
  return entries;
}

/** Every translatable string of one locale, in render order. */
export function collectEntries(
  content: TemplateLocaleContent,
): TranslateEntry[] {
  const entries: TranslateEntry[] = [];
  if (content.subject.trim()) {
    entries.push({ key: "subject", value: content.subject });
  }
  if (content.preheader?.trim()) {
    entries.push({ key: "preheader", value: content.preheader });
  }
  for (const block of content.blocks) entries.push(...blockEntries(block));
  return entries;
}

/**
 * Build the request payload for translating `target` from `source`.
 *
 * mode "all" sends every source string; mode "copies" sends only the keys
 * whose target value is still byte-identical to the source (i.e. untranslated
 * copies from when the locale was added) or missing.
 */
export function buildTranslateRequest(
  doc: TemplateDocument,
  sourceLocale: string,
  targetLocale: string,
  mode: "all" | "copies",
): {
  source_locale: string;
  items: Record<string, { value: string; format?: "text" | "html" }>;
  targets: { locale: string; keys: string[] }[];
} | null {
  const source = doc.locales[sourceLocale];
  if (!source) return null;
  const sourceEntries = collectEntries(source);
  if (sourceEntries.length === 0) return null;

  let keys = sourceEntries.map((entry) => entry.key);
  if (mode === "copies") {
    const target = doc.locales[targetLocale];
    const targetValues = new Map(
      target ? collectEntries(target).map((e) => [e.key, e.value]) : [],
    );
    keys = sourceEntries
      .filter((entry) => {
        const current = targetValues.get(entry.key);
        return current === undefined || current === entry.value;
      })
      .map((entry) => entry.key);
  }
  if (keys.length === 0) return null;

  return {
    source_locale: sourceLocale,
    items: Object.fromEntries(
      sourceEntries.map((entry) => [
        entry.key,
        { value: entry.value, format: entry.format },
      ]),
    ),
    targets: [{ locale: targetLocale, keys }],
  };
}

/**
 * How many strings in `targetLocale` are still verbatim copies of the source —
 * i.e. text that arrived structurally but was never translated.
 *
 * Same predicate as `buildTranslateRequest(mode: "copies")`, by construction:
 * this is the count of exactly what that request would send.
 */
export function countUntranslatedCopies(
  doc: TemplateDocument,
  sourceLocale: string,
  targetLocale: string,
): number {
  if (targetLocale === sourceLocale) return 0;
  const request = buildTranslateRequest(
    doc,
    sourceLocale,
    targetLocale,
    "copies",
  );
  return request?.targets[0]?.keys.length ?? 0;
}

function applyToBlock(block: Block, values: Record<string, string>): Block {
  const attrs = { ...(block.attrs as Record<string, unknown>) };
  const html = values[`block.${block.id}.html`];
  const label = values[`block.${block.id}.label`];
  const alt = values[`block.${block.id}.alt`];
  if (html !== undefined) attrs.html = html;
  if (label !== undefined) attrs.label = label;
  if (alt !== undefined) attrs.alt = alt;
  return {
    ...block,
    attrs,
    columns: block.columns?.map((column) =>
      column.map((child) => applyToBlock(child, values)),
    ),
  };
}

/** Clone-and-apply translated values onto a locale's content. */
export function mergeTranslations(
  content: TemplateLocaleContent,
  values: Record<string, string>,
): TemplateLocaleContent {
  return {
    ...content,
    subject: values.subject ?? content.subject,
    preheader:
      values.preheader !== undefined ? values.preheader : content.preheader,
    blocks: content.blocks.map((block) => applyToBlock(block, values)),
  };
}

/** Structural clone of a locale's content that KEEPS block ids — how a new
 * language starts (parallel structure; text gets translated on top). */
export function cloneLocaleContent(
  content: TemplateLocaleContent,
): TemplateLocaleContent {
  return JSON.parse(JSON.stringify(content)) as TemplateLocaleContent;
}
