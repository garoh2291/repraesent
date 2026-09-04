/**
 * The model cites context items as `[n]` so the server can report which
 * sources it actually used; readers never see the markers. Mirrors
 * `stripCitations` in the widget (widgets/ai-assistant/src/markdown.ts) —
 * keep the two in step.
 *
 * `[n]` followed by `(` is a markdown link label, not a citation.
 * In streaming mode a trailing partial marker (`[`, `[1`, `[1,`) is hidden
 * until it completes so it never flashes on screen.
 */
export function stripCitations(src: string, streaming = false): string {
  let s = src.replace(/ ?\[\d{1,3}(?:\s*,\s*\d{1,3})*\](?!\()/g, "");
  if (streaming) s = s.replace(/ ?\[\d{0,3}(?:\s*,\s*\d{0,3})*$/, "");
  return s;
}
