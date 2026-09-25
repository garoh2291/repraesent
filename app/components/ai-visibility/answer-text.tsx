import { Fragment, type ReactNode } from "react";
import { cn } from "~/lib/utils";

/**
 * An AI answer as the owner would read it, with a highlighter taken to it:
 * their own name in marker yellow, each competitor underlined in its colour,
 * other brands with a faint dotted line. This is the page's one loud thing —
 * the proof behind every number.
 *
 * Renders a safe subset of markdown (paragraphs, headings, lists, bold, links)
 * into React nodes. Never `dangerouslySetInnerHTML`: the text is model output.
 */

export interface Highlight {
  name: string;
  kind: "own" | "competitor" | "other";
  color?: string | null;
}

function escapeRegExp(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMatcher(highlights: Highlight[]): { re: RegExp | null; byLower: Map<string, Highlight> } {
  const byLower = new Map<string, Highlight>();
  for (const h of highlights) {
    const k = h.name.trim().toLowerCase();
    if (!k || k.length < 2) continue;
    // First writer wins: own beats competitor beats other (caller orders them).
    if (!byLower.has(k)) byLower.set(k, h);
  }
  const names = [...byLower.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  if (!names.length) return { re: null, byLower };
  return { re: new RegExp(`(^|[^\\p{L}\\p{N}])(${names.join("|")})(?=[^\\p{L}\\p{N}]|$)`, "giu"), byLower };
}

function highlightText(text: string, m: ReturnType<typeof buildMatcher>, keyBase: string): ReactNode[] {
  if (!m.re) return [text];
  const out: ReactNode[] = [];
  let last = 0;
  m.re.lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = m.re.exec(text)) !== null) {
    const start = match.index + match[1].length;
    const word = match[2];
    if (start > last) out.push(text.slice(last, start));
    const h = m.byLower.get(word.toLowerCase());
    out.push(
      <mark
        key={`${keyBase}-${i++}`}
        data-kind={h?.kind}
        className={cn(
          "rounded-[2px] bg-transparent px-0 text-inherit",
          h?.kind === "own" && "marker font-semibold text-foreground",
          h?.kind === "competitor" && "font-medium underline decoration-2 underline-offset-[3px]",
          h?.kind === "other" && "underline decoration-foreground/30 decoration-dotted underline-offset-[3px]",
        )}
        style={h?.kind === "competitor" && h.color ? { textDecorationColor: h.color } : undefined}
      >
        {word}
      </mark>,
    );
    last = start + word.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Bold and links inside one line, then names inside every text run. */
function inline(line: string, m: ReturnType<typeof buildMatcher>, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0;
  let n = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    if (match.index > last) out.push(...highlightText(line.slice(last, match.index), m, `${key}-t${n}`));
    if (match[1] !== undefined) {
      out.push(
        <strong key={`${key}-b${n}`} className="font-semibold">
          {highlightText(match[1], m, `${key}-bb${n}`)}
        </strong>,
      );
    } else {
      out.push(
        <a
          key={`${key}-a${n}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-muted-foreground underline decoration-foreground/25 underline-offset-2 hover:text-foreground"
        >
          {highlightText(match[2], m, `${key}-aa${n}`)}
        </a>,
      );
    }
    last = match.index + match[0].length;
    n++;
  }
  if (last < line.length) out.push(...highlightText(line.slice(last), m, `${key}-t${n}`));
  return out;
}

export function AnswerText({ text, highlights, className, clampLines }: { text: string; highlights: Highlight[]; className?: string; clampLines?: number }) {
  const m = buildMatcher(highlights);
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: ReactNode[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`l${blocks.length}`} className={cn("space-y-1 pl-5", list.ordered ? "list-decimal" : "list-disc")}>
        {list.items}
      </Tag>,
    );
    list = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push(<li key={`i${idx}`}>{inline((bullet ?? numbered)![1], m, `i${idx}`)}</li>);
      return;
    }
    flush();
    if (!line.trim()) return;
    if (heading) {
      blocks.push(
        <p key={`h${idx}`} className="pt-1 font-semibold text-foreground">
          {inline(heading[1], m, `h${idx}`)}
        </p>,
      );
      return;
    }
    if (/^[-*_]{3,}$/.test(line.trim())) return;
    blocks.push(<p key={`p${idx}`}>{inline(line, m, `p${idx}`)}</p>);
  });
  flush();

  return (
    <div
      className={cn("space-y-2.5 text-[14.5px] leading-[1.65] text-foreground/85", className)}
      style={clampLines ? { display: "-webkit-box", WebkitLineClamp: clampLines, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}
    >
      {blocks.map((b, i) => (
        <Fragment key={i}>{b}</Fragment>
      ))}
    </div>
  );
}

/** Highlights for an answer: own name + aliases, tracked competitors, then every other brand named. */
export function highlightsFor(input: {
  brandName: string;
  brandAliases: string[];
  competitors: Array<{ id: string; name: string; aliases?: string[]; color: string | null }>;
  mentions?: Array<{ name: string; is_own: boolean; competitor_id: string | null }>;
}): Highlight[] {
  const out: Highlight[] = [];
  for (const n of [input.brandName, ...input.brandAliases]) out.push({ name: n, kind: "own" });
  for (const c of input.competitors) for (const n of [c.name, ...(c.aliases ?? [])]) out.push({ name: n, kind: "competitor", color: c.color });
  for (const m of input.mentions ?? []) if (!m.is_own && !m.competitor_id) out.push({ name: m.name, kind: "other" });
  return out;
}
