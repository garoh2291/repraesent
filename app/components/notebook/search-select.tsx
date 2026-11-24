import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "~/lib/utils";
import { desktopAutoFocus } from "~/lib/utils/touch";

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Small second line, e.g. a count. */
  hint?: ReactNode;
}

/**
 * The app's select. Never use a native `<select>` or `<datalist>`: the
 * browser draws its own arrow, can't search, and inside sheets on phones it
 * opens the OS wheel or nothing at all (see repraesent/CLAUDE.md).
 *
 * Opens INLINE (no floating popover), so it works inside BottomSheet /
 * dialogs on a phone: the list scrolls inside the sheet, the keyboard pushes
 * the sheet up, nothing is clipped by a portal. Search field is 16 px on
 * touch (no zoom), rows are 44 px, arrows/Enter/Escape work on desktop.
 */
export function SearchSelect({
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  ariaLabel,
  className,
}: {
  value: string | null;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () => (needle ? options.filter((o) => o.label.toLowerCase().includes(needle) || o.value.toLowerCase().includes(needle)) : options),
    [options, needle],
  );

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, shown.findIndex((o) => o.value === value)));
    if (desktopAutoFocus()) searchRef.current?.focus();
    // Only when opening.
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    setQ("");
    triggerRef.current?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = shown[active];
      if (o) choose(o.value);
    } else if (e.key === "Escape") {
      // Close the list, not the sheet around it.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setQ("");
      triggerRef.current?.focus();
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "press flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card pl-3 pr-3 text-left text-[14px] font-normal text-foreground max-sm:text-[16px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
          open && "border-foreground/40",
        )}
      >
        <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder ?? t("common.choose", "Choose…")}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <div className="mt-1.5 overflow-hidden rounded-lg border border-border bg-card" onKeyDown={onKey}>
          <label className="relative block border-b border-border">
            <span className="sr-only">{searchPlaceholder ?? t("common.search", "Search")}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              placeholder={searchPlaceholder ?? t("common.search", "Search")}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
              autoComplete="off"
              enterKeyHint="search"
              className="h-11 w-full bg-transparent pl-9 pr-3 text-[14px] font-normal outline-none max-sm:text-[16px]"
            />
          </label>
          <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto overscroll-contain py-1">
            {shown.length === 0 ? (
              <li className="px-3 py-3 text-[13.5px] font-normal text-muted-foreground">
                {t("common.noMatches", "Nothing matches.")}
              </li>
            ) : (
              shown.map((o, i) => {
                const isSel = o.value === value;
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o.value)}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2 px-3 text-[14px] font-normal text-foreground",
                      i === active && "bg-muted",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint ? <span className="shrink-0 text-[12.5px] text-muted-foreground">{o.hint}</span> : null}
                    {isSel ? <Check className="size-4 shrink-0" aria-hidden /> : <span className="size-4 shrink-0" aria-hidden />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
