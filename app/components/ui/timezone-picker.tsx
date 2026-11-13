import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Globe } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { useIsPhone } from "~/lib/hooks/use-is-phone";
import { cn } from "~/lib/utils";
import {
  COMMON_ZONES,
  DEFAULT_ZONE,
  isValidZone,
  matchesZone,
  zoneClock,
  zoneEntry,
  zoneOffsetLabel,
  zoneOptions,
  type ZoneOption,
} from "~/lib/time/zones";

type Props = {
  /** IANA zone. Empty or unknown shows Berlin's neighbours but keeps the value untouched until a pick. */
  value: string | null | undefined;
  onChange: (zone: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
  /** Smaller trigger for dense panels (36 px instead of 40). */
  compact?: boolean;
};

/**
 * One time zone picker for the whole app: one compact line per zone — city,
 * country, today's offset (zone name + time there now on hover). Search by any
 * of them ("Deutschland", "Armenia", "GMT+1", "Pacific Time"). A popover the
 * width of the field on desktop (32 px rows); on a phone the list opens in
 * place under the button (44 px rows), so it also works inside sheets.
 */
export function TimezonePicker({ value, onChange, disabled, className, compact, ...rest }: Props) {
  const { t, i18n } = useTranslation();
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const zone = value && isValidZone(value) ? value : DEFAULT_ZONE;
  const entry = zoneEntry(zone);
  const label = rest["aria-label"] ?? t("timezonePicker.label", "Time zone");

  const pick = (z: string) => {
    onChange(z);
    setOpen(false);
  };

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label}: ${entry.city}`}
      aria-expanded={open}
      aria-haspopup="listbox"
      onClick={phone ? () => setOpen((v) => !v) : undefined}
      className={cn(
        "press flex w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm text-foreground transition-colors",
        "hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 disabled:cursor-not-allowed disabled:opacity-50",
        compact ? "h-9" : "h-10 max-sm:h-11",
        open && "border-foreground/40",
      )}
    >
      <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{entry.city}</span>
        <span className="text-muted-foreground"> · {zoneOffsetLabel(zone)}</span>
      </span>
      <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
    </button>
  );

  if (phone) {
    return (
      <div className={cn("w-full space-y-2", className)}>
        {trigger}
        {open ? (
          <div
            ref={(el) => {
              // Opens below the button; bring the whole list into view (it may sit under the sheet's footer).
              if (!el) return;
              const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              requestAnimationFrame(() => el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }));
            }}
            className="scroll-mb-24 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            <ZoneList value={zone} locale={i18n.language} onPick={pick} touch listClassName="max-h-[min(300px,42dvh)]" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        {/* The list is portaled to <body>. Inside a dialog, the dialog's scroll lock listens on
            document and cancels wheel/touch scrolls outside itself; stopping them here keeps
            this list scrollable everywhere. */}
        <PopoverContent
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          align="start"
          sideOffset={6} className="w-[clamp(260px,var(--radix-popover-trigger-width),440px)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl p-0">
          <ZoneList value={zone} locale={i18n.language} onPick={pick} listClassName="max-h-[min(288px,50vh)]" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ZoneList({
  value,
  locale,
  onPick,
  listClassName,
  touch,
}: {
  value: string;
  locale: string;
  onPick: (zone: string) => void;
  listClassName?: string;
  /** Phone: 44 px rows. Desktop rows are 32 px. */
  touch?: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  // One clock for the whole list: labels and "time there now" agree.
  const [now] = useState(() => new Date());
  const all = useMemo(() => zoneOptions(locale, value, now), [locale, value, now]);
  const q = query.trim();
  const matches = q ? all.filter((o) => matchesZone(o, q)) : all;
  const common = q
    ? []
    : [value, ...COMMON_ZONES.filter((z) => z !== value)]
        .map((z) => all.find((o) => o.zone === z))
        .filter((o): o is ZoneOption => !!o);

  const row = (o: ZoneOption, group: string) => {
    const picked = o.zone === value;
    return (
      <CommandItem
        key={`${group}:${o.zone}`}
        value={`${group}:${o.zone}`}
        onSelect={() => onPick(o.zone)}
        title={[o.name, zoneClock(o.zone, locale, now)].filter(Boolean).join(" · ")}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-0 data-[selected=true]:bg-muted data-[selected=true]:text-foreground",
          touch ? "min-h-11" : "min-h-8",
        )}
      >
        <span className="min-w-0 flex-1 truncate text-[13.5px] leading-none">
          <span className={cn("text-foreground", picked ? "font-semibold" : "font-medium")}>{o.city}</span>
          {o.countryLabel && o.countryLabel !== o.city ? (
            <span className="text-muted-foreground"> · {o.countryLabel}</span>
          ) : null}
        </span>
        <span className="num shrink-0 text-[12px] tabular-nums text-muted-foreground">{o.offset}</span>
        <span className="flex size-3.5 shrink-0 items-center justify-center">
          {picked ? <Check className="size-3.5 text-foreground" strokeWidth={2.5} aria-hidden /> : null}
        </span>
      </CommandItem>
    );
  };

  const groupClass =
    "p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em]";

  return (
    <Command shouldFilter={false} className="bg-card">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("timezonePicker.search", "City, country or zone…")}
        className="h-9 text-[16px] sm:text-[13.5px]"
      />
      <CommandList className={cn("overscroll-contain", listClassName)}>
        <CommandEmpty className="px-3 py-5 text-center text-[13px] text-muted-foreground">
          {t("timezonePicker.empty", "No time zone matches. Try a big city nearby.")}
        </CommandEmpty>
        {common.length ? (
          <CommandGroup className={groupClass} heading={t("timezonePicker.common", "Common")}>
            {common.map((o) => row(o, "common"))}
          </CommandGroup>
        ) : null}
        {matches.length ? (
          <CommandGroup className={groupClass} heading={q ? t("timezonePicker.results", "Matches") : t("timezonePicker.all", "All time zones")}>
            {matches.map((o) => row(o, "all"))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  );
}
