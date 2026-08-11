/**
 * A textarea that starts one line tall and grows with its content.
 *
 * Field labels are frequently longer than the single-line input they used to
 * get — consent copy and legal wording in particular run to two or three lines,
 * and editing them through a 40-character viewport meant scrubbing sideways to
 * find a typo.
 *
 * Height is measured, not guessed: reset to `auto` first so the browser reports
 * the real scrollHeight, then pin it. Doing this on every value change also
 * covers the cases a CSS-only trick misses — a locale switch, an AI translation
 * landing, or the panel being reopened on a different field.
 */

import { useEffect, useRef } from "react";
import { cn } from "~/lib/utils";

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Stop growing past this and scroll instead. */
  maxRows?: number;
  /** Fired on anything that can move the caret, for a selection-driven toolbar. */
  onSelectionChange?: () => void;
  className?: string;
}

export function AutoGrowTextarea({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  maxRows = 6,
  onSelectionChange,
  className,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.height = "auto";

    // line-height is often "normal", which parseFloat cannot use — fall back to
    // a ratio of the font size rather than collapsing the field to nothing.
    const styles = window.getComputedStyle(el);
    const lineHeight =
      Number.parseFloat(styles.lineHeight) ||
      Number.parseFloat(styles.fontSize) * 1.5;
    const chrome =
      Number.parseFloat(styles.paddingTop) +
      Number.parseFloat(styles.paddingBottom) +
      Number.parseFloat(styles.borderTopWidth) +
      Number.parseFloat(styles.borderBottomWidth);

    const max = lineHeight * maxRows + chrome;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value, maxRows]);

  return (
    <textarea
      id={id}
      ref={ref}
      rows={1}
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      // Every route to a new selection: dragging, shift-arrows, click-to-place,
      // and the blur that ends it.
      onSelect={onSelectionChange}
      onKeyUp={onSelectionChange}
      onMouseUp={onSelectionChange}
      onBlur={onSelectionChange}
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full resize-none rounded-md border bg-transparent px-3 py-1.5 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
    />
  );
}
