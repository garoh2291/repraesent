/**
 * The small rules the re:translate screens share, kept apart from React so
 * they are tested on their own (scripts/test-re-translate.ts). Where the
 * plugin has the same rule, it says which; the two must agree.
 */

/** A page runs about 45 s and four go at once (API: MAX_IN_FLIGHT_PER_RUN). */
export const minutesFor = (pages: number) => Math.max(1, Math.round((Math.ceil(Math.max(0, pages) / 4) * 45) / 60));

/** The flag shown for a language: the one chosen, none, or its region (plugin: Flags::default_for). */
export const flagOf = (l: { flag?: string; bcp47: string }) => (l.flag && l.flag !== "none" ? l.flag : l.flag === "none" ? undefined : l.bcp47.split("-")[1]?.toUpperCase());

export const baseOf = (tag: string) => tag.toLowerCase().split("-")[0] ?? tag;

/** "Deutsch (Deutschland)" → "Deutsch", for sentences that already have brackets. */
export const shortName = (name: string) => name.replace(/\s*\(.*\)\s*$/u, "") || name;

/** A language's name in a menu, as the plugin writes it (Switcher::name_for()). */
export function menuName(native: string | undefined, name: string | undefined, tag: string, all: string[]) {
  const full = native || name || baseOf(tag).toUpperCase();
  const same = all.filter((t) => baseOf(t) === baseOf(tag)).length;
  return same > 1 ? full : shortName(full);
}

/** A length setting in pixels; '' is the default. */
export function px(value: string, fallback: number) {
  return value === "" ? fallback : Number(value);
}
