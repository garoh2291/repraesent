import { useTranslation } from "react-i18next";
import { format, isValid, parse } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { DatePickerPopover } from "~/components/molecule/date-picker-popover";
import { Field } from "~/components/wordpress/fields";
import { cn } from "~/lib/utils";

/* ── The stored form ─────────────────────────────────────────────────────
 *
 * The API speaks 'YYYY-MM-DD HH:MM' wall-clock in the SITE's timezone. The
 * date picker speaks 'yyyy-MM-dd' and the time input 'HH:mm', both equally
 * timezone-free. So these helpers are pure string splitting and joining on
 * purpose — going anywhere near `new Date()` for the stored value would
 * reinterpret the site's wall-clock time in the browser's timezone and move
 * every banner by however far apart the two are.
 * ------------------------------------------------------------------------ */

export function splitDateTime(stored: string): { date: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/.exec(stored.trim());
  if (!m) return { date: "", time: "" };
  return { date: m[1], time: m[2] ?? "" };
}

export function joinDateTime(date: string, time: string): string {
  if (!date) return "";
  return `${date} ${time || "00:00"}`;
}

/** Wall-clock order, which for this format is string order. */
export function isEndBeforeStart(startsAt: string, endsAt: string): boolean {
  return Boolean(startsAt) && Boolean(endsAt) && endsAt <= startsAt;
}

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** IANA names have a slash; the API's `UTC+2` fallback does not. */
function isIanaZone(zone: string): boolean {
  return zone.includes("/") || zone === "UTC";
}

function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * A wall-clock instant in the site's zone, rendered in the viewer's own — the
 * one line that turns "14:30" into something a person in another country can
 * check. Empty when either zone is unknown or they are the same.
 */
function localEquivalent(stored: string, siteZone: string): string {
  const here = browserZone();
  if (!stored || !isIanaZone(siteZone) || siteZone === here) return "";
  try {
    const instant = fromZonedTime(stored.replace(" ", "T") + ":00", siteZone);
    if (!isValid(instant)) return "";
    return formatInTimeZone(instant, here, "HH:mm");
  } catch {
    return "";
  }
}

/**
 * One 'YYYY-MM-DD HH:MM' value as a date picker + time input.
 *
 * Picking a date with no time yet fills in midnight; typing a time with no
 * date yet fills in today — a half-filled pair would otherwise post as
 * nothing and the person would not know why the banner never started.
 * Clearing the date clears the whole value.
 */
export function DateTimeField({
  id,
  label,
  value,
  onChange,
  timezone,
  minDate,
  error,
  disabled,
}: {
  id: string;
  label: string;
  /** 'YYYY-MM-DD HH:MM' or ''. */
  value: string;
  onChange: (stored: string) => void;
  /** The site's zone, for the "your time" line. */
  timezone: string;
  /** Grey out days before this 'yyyy-MM-dd'. */
  minDate?: string;
  error?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { date, time } = splitDateTime(value);
  const local = localEquivalent(value, timezone);

  const min = minDate ? parse(minDate, "yyyy-MM-dd", new Date()) : null;

  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
        <DatePickerPopover
          id={id}
          valueIso={date || undefined}
          onChange={(iso) => onChange(iso ? joinDateTime(iso, time) : "")}
          allowClear
          disabled={disabled}
          placeholder={t("wordpress.reBanner.scheduleDatePlaceholder", "Pick a date")}
          disabledDate={min && isValid(min) ? (d) => d < min : undefined}
          fromYear={new Date().getFullYear() - 1}
          className={cn(error && "border-destructive")}
        />
        <Input
          type="time"
          aria-label={t("wordpress.reBanner.scheduleTime", "Time")}
          value={time}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              e.target.value ? joinDateTime(date || todayIso(), e.target.value) : joinDateTime(date, ""),
            )
          }
          className={cn(error && "border-destructive")}
        />
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : local ? (
        <p className="text-xs text-muted-foreground">
          {t("wordpress.reBanner.yourTime", "{{time}} in your time zone", {
            time: local,
          })}
        </p>
      ) : null}
    </Field>
  );
}
