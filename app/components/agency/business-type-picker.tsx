import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, PenLine } from "lucide-react";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { useIsPhone } from "~/lib/hooks/use-is-phone";
import { CLIENT_TYPES } from "~/lib/client-types";
import { cn } from "~/lib/utils";

/** "Other": the type isn't in the list; the wizard asks for it in words. */
export const OTHER_TYPE = "other";

/** Case, accent and umlaut blind: "fris" finds "Friseursalon", "cafe" finds "Café". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();

/**
 * Add a business → "Type of business". A searchable list in the reader's
 * language, "Other …" always last, and — when nothing matches what was typed —
 * "Use “…”", which picks Other and keeps the words. A popover on desktop; on
 * a phone the list opens in place under the button (the wizard is a sheet,
 * where a floating popover fights the sheet's scroll lock), with 44 px rows
 * and 16 px search text so iOS never zooms in.
 */
export function BusinessTypePicker({
  value,
  otherText,
  onChange,
  invalid,
}: {
  value: string;
  otherText: string;
  /** `type` is a CLIENT_TYPES key, OTHER_TYPE, or "" (none). `typed` fills the Other field. */
  onChange: (type: string, typed?: string) => void;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);

  // partner_house is a brand's word for its retailers, not a business type.
  const types = useMemo(
    () =>
      CLIENT_TYPES.filter((k) => k !== "partner_house")
        .map((k) => {
          const label = t(`clientTypes.${k}`, { count: 1 });
          return { k, label: label.charAt(0).toUpperCase() + label.slice(1) };
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    [t],
  );

  const shown =
    value === OTHER_TYPE
      ? otherText.trim() || t("agency.add.fields.otherType")
      : (types.find((x) => x.k === value)?.label ?? t("agency.add.fields.choose"));

  const pick = (type: string, typed?: string) => {
    onChange(type, typed);
    setOpen(false);
  };

  const trigger = (
    <button
      type="button"
      aria-label={`${t("agency.add.fields.industry")}: ${shown}`}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-invalid={invalid || undefined}
      onClick={phone ? () => setOpen((v) => !v) : undefined}
      className={cn(
        "press flex h-10 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs transition-colors max-sm:h-11",
        "touch-manipulation select-none hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        open && "border-foreground/40",
        invalid && "border-destructive",
      )}
    >
      <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>{shown}</span>
      <ChevronDown className={cn("size-4 shrink-0 opacity-50 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
    </button>
  );

  const list = <TypeList value={value} types={types} onPick={pick} touch={phone} />;

  if (phone) {
    return (
      <div className="w-full space-y-2">
        {trigger}
        {open ? (
          <div
            ref={(el) => {
              // The list opens below the button; bring it into view above the sheet's footer.
              if (!el) return;
              const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              requestAnimationFrame(() => el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }));
            }}
            className="scroll-mb-24 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            {list}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      {/* Portaled to <body>: inside the dialog its scroll lock would swallow wheel/touch scrolls here. */}
      <PopoverContent
        align="start"
        sideOffset={6}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        className="w-[clamp(260px,var(--radix-popover-trigger-width),360px)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl p-0"
      >
        {list}
      </PopoverContent>
    </Popover>
  );
}

function TypeList({
  value,
  types,
  onPick,
  touch,
}: {
  value: string;
  types: Array<{ k: string; label: string }>;
  onPick: (type: string, typed?: string) => void;
  touch: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const q = fold(query.trim());
  const matches = q ? types.filter((x) => fold(x.label).includes(q) || x.k.includes(q)) : types;
  const row = cn("touch-manipulation select-none", touch ? "min-h-11 text-[15px]" : "min-h-9");

  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("agency.add.fields.searchType")}
        // 16 px on touch: iOS zooms into anything smaller and never zooms back.
        className={cn(touch && "text-base")}
        enterKeyHint="search"
        autoCapitalize="none"
        autoCorrect="off"
      />
      <CommandList className={touch ? "max-h-[min(320px,45dvh)]" : "max-h-[min(300px,50vh)]"}>
        {matches.length ? (
          <CommandGroup>
            {matches.map((x) => (
              <CommandItem key={x.k} value={x.k} onSelect={() => onPick(x.k)} className={row}>
                <span className="min-w-0 flex-1 truncate">{x.label}</span>
                {value === x.k ? <Check className="size-4" aria-hidden /> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        <CommandSeparator />
        <CommandGroup>
          {q && !matches.length ? (
            // Nothing fits: take the words as they are.
            <CommandItem value="__use" onSelect={() => onPick(OTHER_TYPE, query.trim().slice(0, 60))} className={row}>
              <PenLine className="size-4 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                {t("agency.add.fields.useTyped", { typed: query.trim() })}
              </span>
            </CommandItem>
          ) : null}
          <CommandItem value="__other" onSelect={() => onPick(OTHER_TYPE)} className={row}>
            <PenLine className="size-4 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{t("agency.add.fields.otherType")}</span>
            {value === OTHER_TYPE ? <Check className="size-4" aria-hidden /> : null}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
