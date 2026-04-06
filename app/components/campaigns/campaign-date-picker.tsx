import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  isAfter,
  isBefore,
  isSameDay,
  addMonths,
  startOfDay,
} from "date-fns";
import type { Locale } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import type { DateRange } from "~/lib/api/campaigns";

function toYMD(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function getLocale(lang: string) {
  return lang === "de" ? de : enUS;
}

interface Preset {
  key: string;
  labelKey: string;
  getRange: () => { start: Date; end: Date };
}

function usePresets(): Preset[] {
  const today = startOfDay(new Date());
  const yesterday = subDays(today, 1);

  return useMemo(
    () => [
      {
        key: "today",
        labelKey: "datePicker.today",
        getRange: () => ({ start: today, end: today }),
      },
      {
        key: "yesterday",
        labelKey: "datePicker.yesterday",
        getRange: () => ({ start: yesterday, end: yesterday }),
      },
      {
        key: "this_week",
        labelKey: "datePicker.thisWeek",
        getRange: () => ({
          start: startOfWeek(today, { weekStartsOn: 1 }),
          end: today,
        }),
      },
      {
        key: "last_7",
        labelKey: "datePicker.last7",
        getRange: () => ({ start: subDays(today, 6), end: today }),
      },
      {
        key: "last_week",
        labelKey: "datePicker.lastWeek",
        getRange: () => {
          const end = subDays(startOfWeek(today, { weekStartsOn: 1 }), 1);
          return { start: startOfWeek(end, { weekStartsOn: 1 }), end };
        },
      },
      {
        key: "last_14",
        labelKey: "datePicker.last14",
        getRange: () => ({ start: subDays(today, 13), end: today }),
      },
      {
        key: "this_month",
        labelKey: "datePicker.thisMonth",
        getRange: () => ({ start: startOfMonth(today), end: today }),
      },
      {
        key: "last_30",
        labelKey: "datePicker.last30",
        getRange: () => ({ start: subDays(today, 29), end: today }),
      },
      {
        key: "last_month",
        labelKey: "datePicker.lastMonth",
        getRange: () => {
          const prev = subMonths(today, 1);
          return { start: startOfMonth(prev), end: endOfMonth(prev) };
        },
      },
      {
        key: "all_time",
        labelKey: "datePicker.allTime",
        getRange: () => ({ start: new Date(2020, 0, 1), end: today }),
      },
    ],
    [today, yesterday]
  );
}

function MiniCalendar({
  month,
  onMonthChange,
  rangeStart,
  rangeEnd,
  hoverDate,
  onDateClick,
  onDateHover,
  locale,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  hoverDate: Date | null;
  onDateClick: (d: Date) => void;
  onDateHover: (d: Date | null) => void;
  locale: Locale;
}) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const today = startOfDay(new Date());

  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = Array(startDow).fill(null);

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(new Date(year, m, d));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const effectiveEnd = rangeEnd ?? hoverDate;

  function isInRange(d: Date): boolean {
    if (!rangeStart || !effectiveEnd) return false;
    const s = isBefore(rangeStart, effectiveEnd) ? rangeStart : effectiveEnd;
    const e = isAfter(rangeStart, effectiveEnd) ? rangeStart : effectiveEnd;
    return (isAfter(d, s) || isSameDay(d, s)) && (isBefore(d, e) || isSameDay(d, e));
  }

  function isRangeStart(d: Date): boolean {
    if (!rangeStart || !effectiveEnd) return false;
    const s = isBefore(rangeStart, effectiveEnd) ? rangeStart : effectiveEnd;
    return isSameDay(d, s);
  }

  function isRangeEnd(d: Date): boolean {
    if (!rangeStart || !effectiveEnd) return false;
    const e = isAfter(rangeStart, effectiveEnd) ? rangeStart : effectiveEnd;
    return isSameDay(d, e);
  }

  const dayHeaders = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-semibold text-foreground">
          {format(month, "MMM yyyy", { locale })}
        </span>
        <button
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {dayHeaders.map((d, i) => (
          <div
            key={i}
            className="text-[10px] font-medium text-muted-foreground text-center py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      {weeks.map((wk, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {wk.map((day, di) => {
            if (!day) {
              return <div key={di} className="h-7" />;
            }
            const isToday = isSameDay(day, today);
            const isFuture = isAfter(day, today);
            const inRange = isInRange(day);
            const isStart = isRangeStart(day);
            const isEnd = isRangeEnd(day);
            const isSingle = isStart && isEnd;

            return (
              <button
                key={di}
                disabled={isFuture}
                onClick={() => onDateClick(day)}
                onMouseEnter={() => onDateHover(day)}
                className={cn(
                  "h-7 text-[11px] font-medium relative transition-colors",
                  isFuture && "text-muted-foreground/30 cursor-not-allowed",
                  !isFuture && !inRange && "hover:bg-muted text-foreground",
                  inRange && !isStart && !isEnd && "bg-primary/10",
                  (isStart || isEnd) && !isSingle && "bg-primary text-primary-foreground",
                  isSingle && "bg-primary text-primary-foreground rounded-md",
                  isStart && !isSingle && "rounded-l-md",
                  isEnd && !isSingle && "rounded-r-md",
                  isToday && !inRange && "font-bold",
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function CampaignDatePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = getLocale(i18n.language);
  const presets = usePresets();
  const [open, setOpen] = useState(false);

  // Internal selection state
  const [selStart, setSelStart] = useState<Date | null>(null);
  const [selEnd, setSelEnd] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const [activePreset, setActivePreset] = useState<string | null>("all_time");

  // Custom inputs
  const [customStartInput, setCustomStartInput] = useState("");
  const [customEndInput, setCustomEndInput] = useState("");

  const handleOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        // Init from current value
        const s = new Date(value.startDate + "T00:00:00");
        const e = new Date(value.endDate + "T00:00:00");
        setSelStart(s);
        setSelEnd(e);
        setCalMonth(new Date(e.getFullYear(), e.getMonth(), 1));
        setCustomStartInput(format(s, "M/d/yyyy"));
        setCustomEndInput(format(e, "M/d/yyyy"));
        setHoverDate(null);
      }
      setOpen(isOpen);
    },
    [value]
  );

  const applyRange = useCallback(
    (start: Date, end: Date, presetKey?: string) => {
      const sorted =
        isBefore(start, end) || isSameDay(start, end)
          ? { start, end }
          : { start: end, end: start };
      onChange({
        startDate: toYMD(sorted.start),
        endDate: toYMD(sorted.end),
      });
      setActivePreset(presetKey ?? null);
      setOpen(false);
    },
    [onChange]
  );

  const handlePresetClick = useCallback(
    (preset: Preset) => {
      const { start, end } = preset.getRange();
      setSelStart(start);
      setSelEnd(end);
      setCustomStartInput(format(start, "M/d/yyyy"));
      setCustomEndInput(format(end, "M/d/yyyy"));
      applyRange(start, end, preset.key);
    },
    [applyRange]
  );

  const handleDateClick = useCallback(
    (d: Date) => {
      if (!selStart || selEnd) {
        // Start new selection
        setSelStart(d);
        setSelEnd(null);
        setCustomStartInput(format(d, "M/d/yyyy"));
        setCustomEndInput("");
        setActivePreset(null);
      } else {
        // Complete selection
        setSelEnd(d);
        const sorted =
          isBefore(selStart, d) || isSameDay(selStart, d)
            ? { start: selStart, end: d }
            : { start: d, end: selStart };
        setCustomStartInput(format(sorted.start, "M/d/yyyy"));
        setCustomEndInput(format(sorted.end, "M/d/yyyy"));
        applyRange(sorted.start, sorted.end);
      }
    },
    [selStart, selEnd, applyRange]
  );

  // Format display label
  const displayLabel = useMemo(() => {
    const s = new Date(value.startDate + "T00:00:00");
    const e = new Date(value.endDate + "T00:00:00");
    if (isSameDay(s, e)) {
      return format(s, "MMM d, yyyy", { locale });
    }
    return `${format(s, "MMM d", { locale })} – ${format(e, "MMM d, yyyy", { locale })}`;
  }, [value, locale]);

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5",
            "text-xs font-medium text-foreground hover:bg-muted/50 transition-colors",
            "shadow-sm"
          )}
        >
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{displayLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-auto p-0 border-border shadow-xl rounded-xl overflow-hidden"
      >
        <div className="flex">
          {/* Left panel — presets */}
          <div className="w-[170px] border-r border-border py-2 shrink-0">
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => handlePresetClick(p)}
                className={cn(
                  "w-full text-left px-4 py-1.5 text-xs transition-colors",
                  activePreset === p.key
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-muted/50"
                )}
              >
                {t(p.labelKey)}
              </button>
            ))}

            {/* Custom date inputs */}
            <div className="border-t border-border mt-2 pt-2 px-3 space-y-1.5">
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">
                  {t("datePicker.startDate")}
                </label>
                <input
                  type="text"
                  value={customStartInput}
                  onChange={(e) => setCustomStartInput(e.target.value)}
                  placeholder="M/D/YYYY"
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const parsed = new Date(customStartInput);
                      if (!isNaN(parsed.getTime()) && selEnd) {
                        applyRange(parsed, selEnd);
                      }
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">
                  {t("datePicker.endDate")}
                </label>
                <input
                  type="text"
                  value={customEndInput}
                  onChange={(e) => setCustomEndInput(e.target.value)}
                  placeholder="M/D/YYYY"
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const parsed = new Date(customEndInput);
                      if (!isNaN(parsed.getTime()) && selStart) {
                        applyRange(selStart, parsed);
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right panel — calendar */}
          <div className="p-3 w-[240px]">
            <MiniCalendar
              month={calMonth}
              onMonthChange={setCalMonth}
              rangeStart={selStart}
              rangeEnd={selEnd}
              hoverDate={hoverDate}
              onDateClick={handleDateClick}
              onDateHover={(d) => {
                if (selStart && !selEnd) setHoverDate(d);
              }}
              locale={locale}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
