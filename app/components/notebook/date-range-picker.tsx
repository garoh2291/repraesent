import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import type { Locale } from "date-fns";
import { de, enUS, fr, nl } from "date-fns/locale";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { useIsPhone } from "~/lib/hooks/use-is-phone";
import { DATA_CUTOFF, clampDate } from "~/lib/constants/data-cutoff";
import { cn } from "~/lib/utils";

/**
 * Google Analytics–style range picker: presets on the left, a calendar
 * (two months on desktop), typed dates, and "compare with". Presets apply at
 * once; a hand-picked range or a new comparison applies with the button.
 * A bottom sheet on phones.
 */

export const RANGE_PRESETS = [
  "today",
  "yesterday",
  "last_7",
  "last_28",
  "last_30",
  "last_90",
  "this_month",
  "last_month",
  "this_year",
  "last_12_months",
  "all_time",
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export type CompareMode = "off" | "previous" | "year";

export interface RangeValue {
  from: string;
  to: string;
  /** Set when the range came from a preset, so it stays relative ("last 30 days"). */
  preset: RangePreset | null;
}

const PRESET_LABEL: Record<RangePreset, [string, string]> = {
  today: ["datePicker.today", "Today"],
  yesterday: ["datePicker.yesterday", "Yesterday"],
  last_7: ["datePicker.last7", "Last 7 days"],
  last_28: ["datePicker.last28", "Last 28 days"],
  last_30: ["datePicker.last30", "Last 30 days"],
  last_90: ["datePicker.last90", "Last 90 days"],
  this_month: ["datePicker.thisMonth", "This month"],
  last_month: ["datePicker.lastMonth", "Last month"],
  this_year: ["datePicker.thisYear", "This year"],
  last_12_months: ["datePicker.last12Months", "Last 12 months"],
  all_time: ["datePicker.allTime", "All time"],
};

export const toYMD = (d: Date) => format(d, "yyyy-MM-dd");
const fromYMD = (s: string) => new Date(`${s}T00:00:00`);

/** The days a preset stands for today (local calendar days). */
export function presetRange(key: RangePreset, now = new Date()): { from: string; to: string } {
  const today = startOfDay(now);
  const range = (start: Date, end: Date) => ({ from: toYMD(clampDate(start)), to: toYMD(end) });
  switch (key) {
    case "today":
      return range(today, today);
    case "yesterday":
      return range(subDays(today, 1), subDays(today, 1));
    case "last_7":
      return range(subDays(today, 6), today);
    case "last_28":
      return range(subDays(today, 27), today);
    case "last_30":
      return range(subDays(today, 29), today);
    case "last_90":
      return range(subDays(today, 89), today);
    case "this_month":
      return range(startOfMonth(today), today);
    case "last_month": {
      const prev = subMonths(today, 1);
      return range(startOfMonth(prev), endOfMonth(prev));
    }
    case "this_year":
      return range(startOfYear(today), today);
    case "last_12_months":
      return range(subDays(subMonths(today, 12), -1), today);
    case "all_time":
      return range(DATA_CUTOFF, today);
  }
}

function dateLocale(lang: string): Locale {
  const base = lang.split("-")[0];
  if (base === "de") return de;
  if (base === "fr") return fr;
  if (base === "nl") return nl;
  return enUS;
}

export function rangeLabel(value: RangeValue, lang: string): string {
  const locale = dateLocale(lang);
  const s = fromYMD(value.from);
  const e = fromYMD(value.to);
  if (isSameDay(s, e)) return format(s, "d MMM yyyy", { locale });
  const sameYear = s.getFullYear() === e.getFullYear();
  return `${format(s, sameYear ? "d MMM" : "d MMM yyyy", { locale })} – ${format(e, "d MMM yyyy", { locale })}`;
}

function Month({
  month,
  start,
  end,
  hover,
  onPick,
  onHover,
  locale,
}: {
  month: Date;
  start: Date | null;
  end: Date | null;
  hover: Date | null;
  onPick: (d: Date) => void;
  onHover: (d: Date | null) => void;
  locale: Locale;
}) {
  const today = startOfDay(new Date());
  const lead = (startOfMonth(month).getDay() + 6) % 7;
  const count = endOfMonth(month).getDate();
  const cells: (Date | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  const last = end ?? hover;
  const lo = start && last ? (isBefore(last, start) ? last : start) : start;
  const hi = start && last ? (isBefore(last, start) ? start : last) : start;
  // Monday-first weekday initials in the reader's language.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format(new Date(2024, 0, 1 + i), "EEEEEE", { locale }),
  );

  return (
    <div className="w-[252px] select-none">
      <p className="mb-2 text-center text-[13.5px] font-semibold capitalize text-foreground">
        {format(month, "LLLL yyyy", { locale })}
      </p>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted-foreground">
        {weekdays.map((w, i) => (
          <span key={i} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5" onMouseLeave={() => onHover(null)}>
        {cells.map((day, i) => {
          if (!day) return <span key={i} className="h-9" />;
          const off = isAfter(day, today) || isBefore(day, DATA_CUTOFF);
          const edge = (lo && isSameDay(day, lo)) || (hi && isSameDay(day, hi));
          const mid = lo && hi && isAfter(day, lo) && isBefore(day, hi);
          return (
            <button
              key={i}
              type="button"
              disabled={off}
              onClick={() => onPick(day)}
              onMouseEnter={() => onHover(day)}
              aria-pressed={!!edge}
              className={cn(
                "num h-9 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30",
                off && "cursor-not-allowed text-muted-foreground/35",
                !off && !edge && !mid && "rounded-md text-foreground hover:bg-muted",
                mid && "bg-foreground/[0.07] text-foreground",
                edge && "rounded-md bg-foreground font-semibold text-background",
                isSameDay(day, today) && !edge && "font-bold underline underline-offset-4",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PickerBody({
  value,
  compare,
  onApply,
  onCancel,
  phone,
}: {
  value: RangeValue;
  compare: CompareMode;
  onApply: (value: RangeValue, compare: CompareMode) => void;
  onCancel: () => void;
  phone: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const [start, setStart] = useState<Date | null>(fromYMD(value.from));
  const [end, setEnd] = useState<Date | null>(fromYMD(value.to));
  const [hover, setHover] = useState<Date | null>(null);
  const [cmp, setCmp] = useState<CompareMode>(compare);
  const [month, setMonth] = useState(() => startOfMonth(fromYMD(value.to)));
  const months = phone ? [month] : [subMonths(month, 1), month];
  const today = toYMD(new Date());
  const minDay = toYMD(DATA_CUTOFF);

  const pick = (d: Date) => {
    if (!start || end) {
      setStart(d);
      setEnd(null);
    } else if (isBefore(d, start)) {
      setEnd(start);
      setStart(d);
    } else {
      setEnd(d);
    }
  };

  const typed = (which: "start" | "end", text: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return;
    const d = clampDate(fromYMD(text));
    if (which === "start") setStart(d);
    else setEnd(d);
    setMonth(startOfMonth(d));
  };

  const canApply = !!start && !!end;
  const apply = () => {
    if (!start || !end) return;
    const [lo, hi] = isBefore(end, start) ? [end, start] : [start, end];
    onApply({ from: toYMD(lo), to: toYMD(hi), preset: null }, cmp);
  };

  return (
    <div className={cn("flex", phone ? "flex-col" : "flex-row")}>
      <div
        className={cn(
          "flex gap-1 p-2",
          phone
            ? "overflow-x-auto border-b border-border"
            : "w-[184px] shrink-0 flex-col border-r border-border",
        )}
      >
        {RANGE_PRESETS.map((key) => {
          const [k, fallback] = PRESET_LABEL[key];
          const on = value.preset === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onApply({ ...presetRange(key), preset: key }, cmp)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-lg px-3 text-left text-[13.5px] transition-colors max-sm:min-h-11 sm:py-2",
                on
                  ? "bg-foreground font-semibold text-background"
                  : "text-foreground hover:bg-muted max-sm:border max-sm:border-border",
              )}
            >
              {t(k, fallback)}
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3">
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted-foreground">
            {t("datePicker.startDate", "Start date")}
            <input
              type="date"
              min={minDay}
              max={today}
              value={start ? toYMD(start) : ""}
              onChange={(e) => typed("start", e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-2.5 text-[14px] text-foreground max-sm:text-[16px]"
            />
          </label>
          <span className="pb-2.5 text-muted-foreground" aria-hidden>
            –
          </span>
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted-foreground">
            {t("datePicker.endDate", "End date")}
            <input
              type="date"
              min={minDay}
              max={today}
              value={end ? toYMD(end) : ""}
              onChange={(e) => typed("end", e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-2.5 text-[14px] text-foreground max-sm:text-[16px]"
            />
          </label>
        </div>

        <div className="relative flex justify-center gap-6 px-4 py-3">
          <button
            type="button"
            aria-label={t("datePicker.earlierMonth", "Earlier month")}
            onClick={() => setMonth(addMonths(month, -1))}
            disabled={!isAfter(startOfMonth(months[0]), startOfMonth(DATA_CUTOFF))}
            className="absolute left-2 top-2.5 inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("datePicker.laterMonth", "Later month")}
            onClick={() => setMonth(addMonths(month, 1))}
            disabled={!isBefore(month, startOfMonth(new Date()))}
            className="absolute right-2 top-2.5 inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
          {months.map((m) => (
            <Month
              key={m.toISOString()}
              month={m}
              start={start}
              end={end}
              hover={start && !end ? hover : null}
              onPick={pick}
              onHover={setHover}
              locale={locale}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
          <span className="mr-1 text-[13px] font-semibold text-foreground">
            {t("datePicker.compareWith", "Compare with")}
          </span>
          {(
            [
              ["off", "datePicker.compareOff", "Nothing"],
              ["previous", "datePicker.comparePrevious", "Previous period"],
              ["year", "datePicker.compareYear", "Same dates last year"],
            ] as const
          ).map(([mode, k, fallback]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setCmp(mode)}
              aria-pressed={cmp === mode}
              className={cn(
                "rounded-full border px-3 text-[13px] font-medium transition-colors max-sm:min-h-10 sm:py-1.5",
                cmp === mode
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {t(k, fallback)}
            </button>
          ))}
          <span className="flex-1" />
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-lg border border-border bg-card px-3.5 text-[13.5px] font-medium text-foreground hover:bg-muted"
          >
            {t("datePicker.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!canApply}
            className="h-10 rounded-lg bg-foreground px-4 text-[13.5px] font-semibold text-background disabled:opacity-40"
          >
            {t("datePicker.apply", "Show these dates")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DateRangePicker({
  value,
  compare,
  onChange,
  className,
}: {
  value: RangeValue;
  compare: CompareMode;
  onChange: (value: RangeValue, compare: CompareMode) => void;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const title = value.preset
    ? t(PRESET_LABEL[value.preset][0], PRESET_LABEL[value.preset][1])
    : t("datePicker.custom", "Custom range");
  const sub = useMemo(() => rangeLabel(value, i18n.language), [value, i18n.language]);
  const compareText =
    compare === "previous"
      ? t("datePicker.vsPrevious", "vs previous period")
      : compare === "year"
        ? t("datePicker.vsYear", "vs last year")
        : null;

  const apply = (v: RangeValue, c: CompareMode) => {
    onChange(v, c);
    setOpen(false);
  };

  const trigger = (
    <button
      type="button"
      onClick={phone ? () => setOpen(true) : undefined}
      className={cn(
        "inline-flex min-h-10 items-center gap-2.5 rounded-xl border border-border bg-card px-3 text-left text-foreground transition-colors hover:bg-muted/60 max-sm:min-h-11",
        className,
      )}
    >
      <CalendarDays className="size-4 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-col leading-tight sm:flex-row sm:items-baseline sm:gap-2">
        <span className="truncate text-[14px] font-semibold">{title}</span>
        <span className="truncate text-[12.5px] text-muted-foreground">
          {sub}
          {compareText ? ` · ${compareText}` : ""}
        </span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );

  if (phone) {
    return (
      <>
        {trigger}
        <BottomSheet open={open} onOpenChange={setOpen} title={t("datePicker.title", "Dates")}>
          <PickerBody
            value={value}
            compare={compare}
            onApply={apply}
            onCancel={() => setOpen(false)}
            phone
          />
        </BottomSheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-auto overflow-hidden rounded-xl border-border p-0 shadow-xl"
      >
        {open ? (
          <PickerBody
            value={value}
            compare={compare}
            onApply={apply}
            onCancel={() => setOpen(false)}
            phone={false}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
