import { Fragment } from "react";

/**
 * Sentences travel tokenised: <1>…</1> is a link or bold words, <2/> an icon or
 * line break, ⟦0⟧ a placeholder the site fills in. People edit them with the
 * markers shown as 〔1〕…〔/1〕 so every link keeps its place; the site refuses a
 * translation that loses or adds one, so the editor checks before saving.
 */

const TOKEN = /<\/?\d+\/?>|⟦\d+⟧/g;

export function toEditable(tokenised: string): string {
  return tokenised
    .replace(/<(\d+)\/>/g, "〔$1/〕")
    .replace(/<\/(\d+)>/g, "〔/$1〕")
    .replace(/<(\d+)>/g, "〔$1〕");
}

export function fromEditable(editable: string): string {
  return editable
    .replace(/〔(\d+)\/〕/g, "<$1/>")
    .replace(/〔\/(\d+)〕/g, "</$1>")
    .replace(/〔(\d+)〕/g, "<$1>");
}

export function tokensMatch(a: string, b: string): boolean {
  const count = (s: string) => {
    const m = new Map<string, number>();
    for (const t of s.match(TOKEN) ?? []) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  };
  const x = count(a);
  const y = count(b);
  if (x.size !== y.size) return false;
  for (const [k, v] of x) if (y.get(k) !== v) return false;
  return true;
}

export function hasMarkers(tokenised: string): boolean {
  return /<\/?\d+\/?>/.test(tokenised);
}

/** Plain words for lists and search: markers removed, entities decoded. */
export function plainText(tokenised: string | null | undefined): string {
  if (!tokenised) return "";
  return decode(tokenised.replace(TOKEN, " ")).replace(/\s+/g, " ").trim();
}

/** True when the words of a sentence contain the search, ignoring case and markers. */
export function matchesSearch(tokenised: string | null | undefined, query: string): boolean {
  const q = query.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  return !q || plainText(tokenised).toLocaleLowerCase().includes(q);
}

function searchPattern(query: string | undefined): RegExp | null {
  const q = query?.trim();
  if (!q) return null;
  return new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")})`, "giu");
}

/** Words with every hit of the search marked like a highlighter. */
function Marked({ text, query }: { text: string; query?: string }) {
  const re = searchPattern(query);
  if (!re) return <>{text}</>;
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-sm bg-secondary px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function decode(s: string): string {
  return s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

/** A sentence for reading: link / bold words underlined, icons as a dot, placeholders as a chip, search hits marked. */
export function SentenceText({ text, dir, highlight }: { text: string; dir?: "rtl" | "ltr"; highlight?: string }) {
  const parts = text.split(/(<\/?\d+\/?>|⟦\d+⟧)/g);
  let depth = 0;
  return (
    <span dir={dir} className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (/^<\d+>$/.test(part)) {
          depth++;
          return null;
        }
        if (/^<\/\d+>$/.test(part)) {
          depth = Math.max(0, depth - 1);
          return null;
        }
        if (/^<\d+\/>$/.test(part)) return <span key={i} aria-hidden className="mx-0.5 inline-block size-1.5 rounded-full bg-muted-foreground/50 align-middle" />;
        if (/^⟦\d+⟧$/.test(part)) return <code key={i} className="rounded bg-muted px-1 text-[0.85em]">{part}</code>;
        if (!part) return null;
        return depth > 0 ? (
          <span key={i} className="underline decoration-muted-foreground/60 underline-offset-2">
            <Marked text={decode(part)} query={highlight} />
          </span>
        ) : (
          <Fragment key={i}>
            <Marked text={decode(part)} query={highlight} />
          </Fragment>
        );
      })}
    </span>
  );
}
