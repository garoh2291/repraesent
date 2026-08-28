import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Clock } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { DatePickerPopover } from "~/components/molecule/date-picker-popover";

/**
 * Picking when a campaign goes out.
 *
 * Three controls for one decision, so they are laid out as one: the date and
 * time sit side by side because together they are a single timestamp, and the
 * zone sits under both because it qualifies them.
 *
 * The line underneath is the point of the whole component. A campaign is the
 * one place where "half past two" means different things to the person setting
 * it and the people receiving it, and a bare `datetime-local` silently used
 * whatever zone the author's laptop happened to be in. Resolving the three
 * fields back into a sentence — including the author's own local time when it
 * differs — is what turns a scheduling mistake into something you notice before
 * sending rather than after.
 */

/** Zones offered first: the ones this product's workspaces actually operate in. */
const COMMON_ZONES = [
  "Europe/Berlin",
  "Europe/Vienna",
  "Europe/Zurich",
  "Europe/Amsterdam",
  "Europe/Paris",
  "Europe/London",
  "UTC",
];

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Every zone the runtime knows, or the curated list where it cannot say. */
function allTimeZones(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    return supported?.length ? supported : COMMON_ZONES;
  } catch {
    return COMMON_ZONES;
  }
}

/**
 * The absolute instant a wall-clock date and time refer to in a given zone.
 * Returns null while the pair is incomplete.
 */
export function resolveScheduledInstant(
  date: string,
  time: string,
  timeZone: string,
): Date | null {
  if (!date || !time) return null;
  try {
    // `fromZonedTime` applies the zone's offset AT THAT DATE, so a summer
    // schedule gets CEST and a winter one CET without any special casing.
    const instant = fromZonedTime(`${date}T${time}:00`, timeZone);
    return Number.isNaN(instant.getTime()) ? null : instant;
  } catch {
    return null;
  }
}

export function ScheduleFields({
  date,
  time,
  timeZone,
  onChange,
  disabled,
}: {
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm */
  time: string;
  timeZone: string;
  onChange: (patch: {
    date?: string;
    time?: string;
    timeZone?: string;
  }) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const here = browserTimeZone();

  // The author's own zone first, then the ones we expect, then everything —
  // so the common answer is one click away and the rare one is still reachable.
  const zones = useMemo(() => {
    const rest = allTimeZones().filter(
      (z) => z !== here && !COMMON_ZONES.includes(z),
    );
    return {
      common: [here, ...COMMON_ZONES.filter((z) => z !== here)],
      rest,
    };
  }, [here]);

  const instant = resolveScheduledInstant(date, time, timeZone);
  const inPast = instant !== null && instant.getTime() <= Date.now();
  const showsLocalToo = instant !== null && timeZone !== here;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("emailCampaigns.wizard.scheduleDate", { defaultValue: "Date" })}
          </Label>
          <DatePickerPopover
            valueIso={date || undefined}
            onChange={(iso) => onChange({ date: iso ?? "" })}
            disabled={disabled}
            placeholder={t("emailCampaigns.wizard.scheduleDatePlaceholder", {
              defaultValue: "Pick a date",
            })}
            // A campaign cannot be scheduled into the past; saying so by
            // greying the days is quieter than an error after the fact.
            disabledDate={(d) => d < today}
            fromYear={today.getFullYear()}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("emailCampaigns.wizard.scheduleTime", { defaultValue: "Time" })}
          </Label>
          <Input
            type="time"
            value={time}
            disabled={disabled}
            onChange={(e) => onChange({ time: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("emailCampaigns.wizard.scheduleZone", {
            defaultValue: "Time zone",
          })}
        </Label>
        <Select
          value={timeZone}
          disabled={disabled}
          onValueChange={(next) => onChange({ timeZone: next })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectGroup>
              <SelectLabel>
                {t("emailCampaigns.wizard.zoneCommon", {
                  defaultValue: "Common",
                })}
              </SelectLabel>
              {zones.common.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone === here
                    ? t("emailCampaigns.wizard.zoneYours", {
                        zone,
                        defaultValue: `${zone} — your time zone`,
                      })
                    : zone}
                </SelectItem>
              ))}
            </SelectGroup>
            {zones.rest.length > 0 ? (
              <SelectGroup>
                <SelectLabel>
                  {t("emailCampaigns.wizard.zoneAll", {
                    defaultValue: "All time zones",
                  })}
                </SelectLabel>
                {zones.rest.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
          </SelectContent>
        </Select>
      </div>

      {/* The resolved sentence: what will actually happen, in the zone it was
          set for, plus the author's own clock when the two differ. */}
      {instant ? (
        <p
          className={`flex items-start gap-1.5 text-xs ${
            inPast ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          <Clock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>
            {inPast
              ? t("emailCampaigns.wizard.schedulePast", {
                  defaultValue:
                    "That time has already passed. Pick a later one.",
                })
              : t("emailCampaigns.wizard.scheduleResolved", {
                  when: formatInTimeZone(
                    instant,
                    timeZone,
                    "EEEE d MMMM yyyy, HH:mm",
                  ),
                  zone: timeZone,
                  defaultValue: `Sends {{when}} (${timeZone})`,
                })}
            {!inPast && showsLocalToo
              ? " · " +
                t("emailCampaigns.wizard.scheduleYourTime", {
                  time: formatInTimeZone(instant, here, "HH:mm"),
                  defaultValue: `{{time}} your time`,
                })
              : ""}
          </span>
        </p>
      ) : null}
    </div>
  );
}
