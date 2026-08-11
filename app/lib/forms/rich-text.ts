/**
 * The tiny inline markup field labels may carry: **bold**, *italic*, [text](url).
 *
 * WHY A TOKENISER AND NOT HTML.
 *
 * Labels are rendered on pages hosted on customers' own domains, in four
 * delivery modes, one of which pastes them straight into a WordPress post. If
 * labels stored HTML, every one of those renderers would have to sanitise it,
 * and the day one of them forgot would be a stored-XSS on somebody else's site.
 *
 * So nothing here ever produces or consumes HTML. Text is parsed into a flat
 * list of spans, and each renderer builds its own output from them:
 *
 *   - the builder and hosted page build React elements
 *   - the server-side renderer escapes each span's text itself
 *   - the browser runtime creates DOM nodes, so there is no string to escape
 *
 * A malformed or hostile label can therefore only ever come out as visible
 * text. The worst case is ugly, never dangerous.
 *
 * MIRROR of nestjs-monolith/src/modules/forms/form-rich-text.ts. Keep in step.
 */

/**
 * One run of text and every mark that applies to it.
 *
 * Marks are a SET, not a kind. The first version of this had one `kind` per
 * span, which made a bold link unrepresentable — the parser had to pick one,
 * and `**[terms](url)**` came out as bold text reading "[terms](url)". Flags
 * compose, so each renderer just nests one element per flag that is on.
 */
export type InlineSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Set, and already checked by isSafeHref, when this run is a link. */
  href?: string;
};

/**
 * `[text](url)` first — the delimiters are unambiguous, and its own text may
 * contain emphasis markers. Then longest-run-first among the asterisks, so
 * `***x***` is bold AND italic rather than a bold that swallowed a stray star.
 *
 * The inner groups are lazy and no longer exclude `*`: they have to be able to
 * hold the markers of whatever is nested inside them.
 */
const PATTERN_SOURCE =
  "\\[([^\\]\\n]+)\\]\\(([^)\\s]+)\\)|\\*\\*\\*([^\\n]+?)\\*\\*\\*|\\*\\*([^\\n]+?)\\*\\*|\\*([^\\n]+?)\\*|_([^_\\n]+?)_";

/**
 * Nesting is bounded so a label full of asterisks cannot recurse without end.
 * Four is past anything meaningful — bold, italic, link and one to spare.
 */
const MAX_DEPTH = 4;

/**
 * http and https only.
 *
 * `javascript:` is the obvious one, but `data:` is the quieter problem: a
 * data: URI can carry a whole HTML document, so allowing it would hand back
 * exactly the injection this module exists to prevent.
 */
export function isSafeHref(href: string): boolean {
  const value = href.trim().toLowerCase();
  if (value.startsWith("http://") || value.startsWith("https://")) return true;
  // Relative and anchor links stay on the host page and cannot carry a scheme.
  return value.startsWith("/") || value.startsWith("#");
}

export function parseInline(input: string): InlineSpan[] {
  return walk(input, {}, 0);
}

/**
 * Parse `input`, with `marks` already applied to everything it contains.
 *
 * A fresh RegExp per call rather than one module-level /g: this recurses, and
 * a shared `lastIndex` would have an inner call move the outer one's cursor.
 */
function walk(
  input: string,
  marks: Omit<InlineSpan, "text">,
  depth: number,
): InlineSpan[] {
  if (!input) return [];
  if (depth >= MAX_DEPTH) return [{ ...marks, text: input }];

  const spans: InlineSpan[] = [];
  const pattern = new RegExp(PATTERN_SOURCE, "g");
  let last = 0;

  for (let m = pattern.exec(input); m; m = pattern.exec(input)) {
    if (m.index > last) {
      spans.push({ ...marks, text: input.slice(last, m.index) });
    }

    const [, linkText, href, bothStars, bold, italicStar, italicUnderscore] = m;

    if (linkText != null && href != null) {
      // An unsafe scheme degrades to plain text rather than being dropped: the
      // author still sees what they typed, and can see that it did not link.
      if (isSafeHref(href)) {
        spans.push(
          ...walk(linkText, { ...marks, href: href.trim() }, depth + 1),
        );
      } else {
        spans.push({ ...marks, text: m[0] });
      }
    } else if (bothStars != null) {
      spans.push(
        ...walk(bothStars, { ...marks, bold: true, italic: true }, depth + 1),
      );
    } else if (bold != null) {
      spans.push(...walk(bold, { ...marks, bold: true }, depth + 1));
    } else {
      spans.push(
        ...walk(
          italicStar ?? italicUnderscore,
          { ...marks, italic: true },
          depth + 1,
        ),
      );
    }

    last = m.index + m[0].length;
  }

  if (last < input.length) {
    spans.push({ ...marks, text: input.slice(last) });
  }

  return spans;
}

/** True when the string carries markup worth rendering as anything but text. */
export function hasInlineMarkup(input: string): boolean {
  return new RegExp(PATTERN_SOURCE).test(input);
}

/**
 * How many of `char` sit immediately before `index`, or immediately at and
 * after it when `step` is 1. Used to read the marker run around a selection.
 */
function runLength(
  value: string,
  index: number,
  step: -1 | 1,
  char: string,
): number {
  let n = 0;
  let i = step === -1 ? index - 1 : index;
  while (i >= 0 && i < value.length && value[i] === char) {
    n++;
    i += step;
  }
  return n;
}

/**
 * Toggle a mark on the selection — what the floating toolbar applies.
 *
 * Toggle, not wrap. Clicking Bold twice used to give `****text****`, which
 * parses as nothing at all; the second click now takes the bold off. The marks
 * actually in force are read from the run of asterisks on BOTH sides — a
 * lopsided one is not a mark, just characters — where a run of one is italic,
 * two is bold and three is both. So Italic on `**x**` adds a star to each side
 * rather than downgrading the bold.
 */
export function applyMark(
  value: string,
  start: number,
  end: number,
  mark: "bold" | "italic" | "link",
  href?: string,
): { value: string; selectionStart: number; selectionEnd: number } {
  const selected = value.slice(start, end) || "";

  const at = (
    next: string,
    selectionStart: number,
  ): { value: string; selectionStart: number; selectionEnd: number } => ({
    value: next,
    // Keep the original words selected, so a second click is obviously acting
    // on the same text rather than on the markers.
    selectionStart,
    selectionEnd: selectionStart + selected.length,
  });

  if (mark === "link") {
    const closing = /^\]\(([^)\s]*)\)/.exec(value.slice(end));
    if (value.slice(start - 1, start) === "[" && closing) {
      return at(
        value.slice(0, start - 1) +
          selected +
          value.slice(end + closing[0].length),
        start - 1,
      );
    }
    return at(
      `${value.slice(0, start)}[${selected}](${href ?? "https://"})${value.slice(end)}`,
      start + 1,
    );
  }

  const run = Math.min(
    runLength(value, start, -1, "*"),
    runLength(value, end, 1, "*"),
  );
  const active = mark === "bold" ? run >= 2 : run === 1 || run >= 3;
  const width = mark === "bold" ? 2 : 1;

  if (active) {
    return at(
      value.slice(0, start - width) + selected + value.slice(end + width),
      start - width,
    );
  }

  const marker = "*".repeat(width);
  return at(
    value.slice(0, start) + marker + selected + marker + value.slice(end),
    start + width,
  );
}
