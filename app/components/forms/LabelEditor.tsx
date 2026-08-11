/**
 * The label input, with a formatting toolbar that appears over a selection.
 *
 * The toolbar is selection-driven rather than always-on because a label is
 * usually two plain words — a permanent row of buttons above every field would
 * be four times the chrome for something used on one label in twenty.
 *
 * It writes markers into the text (`**bold**`, `[text](url)`) rather than HTML.
 * app/lib/forms/rich-text.ts explains why that distinction matters.
 *
 * `multiline` is off by default: an ordinary field label is a couple of words,
 * and a box that can grow to six rows reads as an invitation to write a
 * paragraph into it. Only the consent checkbox turns it on — legal copy really
 * does run to three lines, and editing that through a one-line viewport means
 * scrubbing sideways to find a typo.
 */

import { Bold, Italic, Link2 } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AutoGrowTextarea } from "~/components/forms/AutoGrowTextarea";
import { applyMark } from "~/lib/forms/rich-text";
import { cn } from "~/lib/utils";

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Grow with the content instead of staying one line tall. */
  multiline?: boolean;
}

interface Sel {
  start: number;
  end: number;
  /** Offset of the selection's midpoint from the textarea's left edge, in px. */
  x: number;
  y: number;
}

export function LabelEditor({
  id,
  value,
  onChange,
  disabled,
  multiline = false,
}: Props) {
  const { t } = useTranslation();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  /** Set while a toolbar button runs, so the blur it causes is not treated as
   *  the user clicking away. */
  const applying = useRef(false);

  /** Either control, whichever `multiline` mounted. Both expose the selection
   *  API the toolbar needs, so nothing below has to care which it got. */
  const control = () =>
    wrapRef.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>(
      "textarea, input",
    ) ?? null;

  const readSelection = () => {
    if (applying.current) return;
    const el = control();
    if (!el) return;

    const { selectionStart: start, selectionEnd: end } = el;
    if (start == null || end == null || start === end) {
      setSel(null);
      return;
    }

    // Anchored to the textarea rather than to the selection's exact glyph box:
    // measuring a caret rect inside a textarea needs a mirror element, and the
    // toolbar only has to be near the text, not on it.
    setSel({ start, end, x: 8, y: -8 });
  };

  // Re-read after the value changes from a toolbar press, so the selection the
  // toolbar reports stays in step with the text it just rewrote.
  useLayoutEffect(() => {
    if (!applying.current) return;
    applying.current = false;
  }, [value]);

  const apply = (mark: "bold" | "italic" | "link") => {
    if (!sel) return;
    const el = control();
    if (!el) return;

    applying.current = true;
    const next = applyMark(value, sel.start, sel.end, mark);
    onChange(next.value);

    // Restore the selection once React has re-rendered with the new value,
    // otherwise setSelectionRange runs against the old string and lands in the
    // wrong place.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.selectionStart, next.selectionEnd);
      setSel((prev) =>
        prev
          ? { ...prev, start: next.selectionStart, end: next.selectionEnd }
          : null,
      );
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      {multiline ? (
        <AutoGrowTextarea
          id={id}
          value={value}
          disabled={disabled}
          onChange={onChange}
          onSelectionChange={readSelection}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          // The same four events AutoGrowTextarea listens on — every route to
          // a new selection: dragging, shift-arrows, click-to-place, and the
          // blur that ends it.
          onSelect={readSelection}
          onKeyUp={readSelection}
          onMouseUp={readSelection}
          onBlur={readSelection}
          className={cn(
            "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-1.5 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          )}
        />
      )}

      {sel && !disabled ? (
        <div
          className="absolute z-20 flex -translate-y-full items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
          style={{ left: sel.x, top: sel.y }}
          // mousedown, not click: the textarea loses its selection on blur, and
          // blur fires first. Preventing the default keeps the selection alive
          // long enough for the handler to read it.
          onMouseDown={(e) => e.preventDefault()}
        >
          <ToolbarButton
            label={t("forms.inspector.markBold")}
            onClick={() => apply("bold")}
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label={t("forms.inspector.markItalic")}
            onClick={() => apply("italic")}
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label={t("forms.inspector.markLink")}
            onClick={() => apply("link")}
          >
            <Link2 className="h-3.5 w-3.5" />
          </ToolbarButton>
        </div>
      ) : null}
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
