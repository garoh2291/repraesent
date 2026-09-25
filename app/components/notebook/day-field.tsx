import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addDays, format, isValid, nextMonday, parse, startOfDay } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "~/lib/utils";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

/** yyyy-MM-dd for the user's local day. */
export function isoDay(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Local 09:00 of a yyyy-MM-dd day, as an ISO instant (what tasks store). */
export function dayAtNine(iso: string): string {
  const d = parse(iso, "yyyy-MM-dd", new Date());
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

const FORMATS = [
  "yyyy-MM-dd",
  "d.M.yyyy",
  "d.M.yy",
  "d.M.",
  "d/M/yyyy",
  "d/M/yy",
  "M/d/yyyy",
  "d-M-yyyy",
  "d-M",
  "d/M",
  "M/d",
];

/** Parse what someone typed ("30.9.", "30/09/2026", "2026-09-30"). */
function parseTyped(text: string, locale: string): Date | null {
  const s = text.trim();
  if (!s) return null;
  // US order first for English, day-first everywhere else.
  const order = locale.startsWith("en")
    ? ["M/d/yyyy", "M/d/yy", "M/d", ...FORMATS.filter((f) => !f.startsWith("M/"))]
    : FORMATS;
  for (const f of order) {
    const d = parse(s, f, new Date());
    if (isValid(d) && d.getFullYear() > 1999 && d.getFullYear() < 2100) return d;
  }
  return null;
}

/**
 * A day you can pick three ways: a quick chip (Tomorrow / In 2 days / Next
 * week), typing it ("30.9."), or the calendar. Never in the past, never empty.
 */
export function DayField({
  value,
  onChange,
  label,
  className,
}: {
  /** yyyy-MM-dd */
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const today = startOfDay(new Date());
  const selected = parse(value, "yyyy-MM-dd", new Date());
  const shown = useMemo(
    () =>
      isValid(selected)
        ? selected.toLocaleDateString(i18n.language, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "",
    [value, i18n.language], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [text, setText] = useState(shown);
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!editing) setText(shown);
  }, [shown, editing]);

  const commit = () => {
    setEditing(false);
    const d = parseTyped(text, i18n.language);
    if (d && startOfDay(d) >= today) {
      setInvalid(false);
      onChange(isoDay(d));
    } else if (text.trim() && text !== shown) {
      setInvalid(true);
      setText(shown);
      window.setTimeout(() => setInvalid(false), 1800);
    } else {
      setText(shown);
    }
  };

  const chips: { key: string; label: string; day: Date }[] = [
    { key: "tomorrow", label: t("dayField.tomorrow", "Tomorrow"), day: addDays(today, 1) },
    { key: "in2", label: t("dayField.inTwoDays", "In 2 days"), day: addDays(today, 2) },
    { key: "nextWeek", label: t("dayField.nextWeek", "Next week"), day: nextMonday(today) },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => {
          const active = isoDay(c.day) === value;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onChange(isoDay(c.day))}
              aria-pressed={active}
              className={cn(
                "press h-8 rounded-full border px-3 text-[12.5px] font-medium transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground hover:border-foreground/30",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-lg border bg-card pl-3 pr-1 transition-colors focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-foreground/10",
          invalid ? "border-overdue" : "border-border",
        )}
      >
        <input
          value={text}
          onFocus={(e) => {
            setEditing(true);
            e.currentTarget.select();
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          placeholder={t("dayField.placeholder", "Type a date, e.g. 30.9.")}
          aria-label={label ?? t("dayField.aria", "Date")}
          aria-invalid={invalid}
          className="num min-w-0 flex-1 bg-transparent text-[14.5px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("dayField.openCalendar", "Open calendar")}
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <CalendarDays className="size-[18px]" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="z-[60] w-auto p-0" align="end" sideOffset={6}>
            <Calendar
              mode="single"
              selected={isValid(selected) ? selected : undefined}
              defaultMonth={isValid(selected) ? selected : today}
              disabled={(d) => d < today}
              onSelect={(d) => {
                if (d) {
                  onChange(isoDay(d));
                  setOpen(false);
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      {invalid ? (
        <p className="text-[12px] text-overdue">
          {t("dayField.invalid", "That isn't a date from today on.")}
        </p>
      ) : null}
    </div>
  );
}
