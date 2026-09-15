import { Fragment, type ReactNode } from "react";

/**
 * A deliberately tiny markdown renderer that emits React nodes, never HTML.
 *
 * `marked` is in the bundle but no sanitizer is, and the text this renders —
 * AI-assistant transcripts — contains whatever a visitor typed. Parsing that to
 * an HTML string and handing it to `dangerouslySetInnerHTML` would be an XSS
 * hole with a website chat widget as the injection point. Emitting React nodes
 * makes the whole class of problem impossible: text is text.
 *
 * Supported, because it is what the assistants actually emit: `**bold**`,
 * `` `code` ``, `- `/`* ` bullet lists, blank-line paragraphs, and bare http(s)
 * URLs. Everything else renders as the literal characters the author wrote.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s<>()]+)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const parts = text.split(INLINE);

  parts.forEach((part, i) => {
    if (!part) return;
    const key = `${keyPrefix}-${i}`;

    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      out.push(
        <strong key={key} className="font-semibold">
          {part.slice(2, -2)}
        </strong>,
      );
      return;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      out.push(
        <code
          key={key}
          className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10"
        >
          {part.slice(1, -1)}
        </code>,
      );
      return;
    }
    if (/^https?:\/\//.test(part)) {
      out.push(
        <a
          key={key}
          href={part}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="underline underline-offset-2 hover:opacity-80"
        >
          {part}
        </a>,
      );
      return;
    }
    out.push(<Fragment key={key}>{part}</Fragment>);
  });

  return out;
}

/** Render a markdown-ish string as React nodes. Safe for untrusted input. */
export function SafeMarkdown({ text }: { text: string }) {
  // Split into blocks on blank lines, then walk each block's lines so a run of
  // "- " items becomes one list instead of a paragraph full of hyphens.
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);

  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;

        const chunks: ReactNode[] = [];
        let bullets: string[] = [];
        let paragraph: string[] = [];

        const flushBullets = (at: number) => {
          if (bullets.length === 0) return;
          chunks.push(
            <ul
              key={`b-${bi}-${at}`}
              className="my-1 list-disc space-y-0.5 pl-4 marker:text-current/40"
            >
              {bullets.map((item, li) => (
                <li key={li}>{renderInline(item, `${bi}-${at}-${li}`)}</li>
              ))}
            </ul>,
          );
          bullets = [];
        };
        const flushParagraph = (at: number) => {
          if (paragraph.length === 0) return;
          chunks.push(
            <p key={`p-${bi}-${at}`} className="whitespace-pre-wrap">
              {renderInline(paragraph.join("\n"), `${bi}-${at}`)}
            </p>,
          );
          paragraph = [];
        };

        lines.forEach((line, li) => {
          const bullet = line.match(/^\s*[-*]\s+(.*)$/);
          if (bullet) {
            flushParagraph(li);
            bullets.push(bullet[1]);
          } else {
            flushBullets(li);
            paragraph.push(line);
          }
        });
        flushBullets(lines.length);
        flushParagraph(lines.length);

        return (
          <div key={bi} className="space-y-1 last:mb-0">
            {chunks}
          </div>
        );
      })}
    </>
  );
}
