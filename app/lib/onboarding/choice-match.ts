import type { TFunction } from "i18next";
import { optionLabel } from "./option-labels";

/**
 * The customer typed instead of tapping a chip ("the same day" while "Same day" is on screen).
 * Match the words to the open chip(s) in any of the four languages, so the answer is saved
 * exactly like a tap — no model guessing. Returns null when unsure; the model then decides.
 */

const ALIASES: Record<string, string[]> = {
  handler_owner: ["me", "myself", "i do", "i answer", "ich", "ich selbst", "mache ich", "moi", "moi meme", "ik", "ikzelf", "owner", "inhaber", "inhaberin"],
  handler_team: ["team", "my team", "unser team", "mein team", "equipe", "mijn team"],
  unknown: ["not sure", "dont know", "don t know", "no idea", "idk", "weiss nicht", "weiss ich nicht", "keine ahnung", "unsicher", "je ne sais pas", "aucune idee", "weet ik niet", "geen idee", "weet niet"],
  has: ["yes", "yep", "yeah", "ja", "oui", "jawohl", "klar"],
  none: ["no", "nope", "nein", "non", "nee"],
  yes: ["yes", "yep", "yeah", "ja", "oui", "gerne", "sure"],
  no: ["no", "nope", "nein", "non", "nee"],
};

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9€$£ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchChoice(
  text: string,
  field: string,
  options: readonly string[],
  translators: TFunction[],
  multi: boolean,
): string[] | null {
  const said = normalize(text);
  if (!said) return null;
  const scored: Array<{ value: string; exact: boolean }> = [];
  for (const value of options) {
    const candidates = new Set<string>([normalize(value.replace(/_/g, " ")), ...(ALIASES[value] ?? []).map(normalize)]);
    for (const t of translators) candidates.add(normalize(optionLabel(t, field, value)));
    let exact = false;
    let partial = false;
    for (const c of candidates) {
      if (!c) continue;
      if (said === c) exact = true;
      // Longer labels may sit inside a sentence ("the same day"), short words only on their own.
      else if (c.length >= 4 && ` ${said} `.includes(` ${c} `)) partial = true;
      else if (said.length >= 5 && c.length >= 5 && c.includes(said)) partial = true;
    }
    if (exact || partial) scored.push({ value, exact });
  }
  if (!scored.length) return null;
  if (multi) return scored.map((s) => s.value);
  const exact = scored.filter((s) => s.exact);
  if (exact.length === 1) return [exact[0].value];
  return scored.length === 1 ? [scored[0].value] : null;
}
