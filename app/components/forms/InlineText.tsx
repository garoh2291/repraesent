/**
 * Renders a label's inline markup as React elements.
 *
 * No dangerouslySetInnerHTML anywhere: every span's text goes through JSX, so
 * React escapes it. See app/lib/forms/rich-text.ts for why labels never carry
 * HTML in the first place.
 */

import { Fragment, type ReactNode } from "react";
import { parseInline } from "~/lib/forms/rich-text";

export function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((span, i) => {
        // One element per mark that is on, innermost first, so a bold italic
        // link comes out as <a><em><strong>…. Order is fixed rather than
        // clever: the nesting is invisible, only the combination shows.
        let node: ReactNode = span.text;
        if (span.bold) node = <strong>{node}</strong>;
        if (span.italic) node = <em>{node}</em>;
        if (span.href) {
          node = (
            <a
              href={span.href}
              target="_blank"
              // noopener is the load-bearing half: without it the opened page
              // gets a handle on this window via window.opener.
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {node}
            </a>
          );
        }
        return <Fragment key={i}>{node}</Fragment>;
      })}
    </>
  );
}
