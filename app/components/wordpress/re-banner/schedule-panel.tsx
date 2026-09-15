import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, CircleDot, Clock, PauseCircle } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import type { ReBannerConfig } from "~/lib/wordpress/plugin-settings-types";
import {
  CardBody,
  CardHeader,
  SectionCard,
} from "~/components/wordpress/fields";
import { SwitchRow } from "~/components/wordpress/re-cookie/fields";
import {
  DateTimeField,
  isEndBeforeStart,
  splitDateTime,
} from "~/components/wordpress/re-banner/banner-schedule-fields";
import type { SetConfig } from "~/components/wordpress/re-banner/constants";
import { cn } from "~/lib/utils";

/**
 * When the banner is on.
 *
 * The end date is the whole point of the plugin — anyone can put a notice up,
 * the work is remembering to take it down — so the panel leads with a plain
 * sentence saying what the dates currently mean, in the site's own clock.
 */
export function SchedulePanel({
  draft,
  set,
  timezone,
  saving,
}: {
  draft: ReBannerConfig;
  set: SetConfig;
  timezone: string;
  saving: boolean;
}) {
  const { t } = useTranslation();

  // The plugin rejects an end before its start with a 400; saying so here,
  // next to the field, beats a toast after the fact.
  const windowError = isEndBeforeStart(draft.starts_at, draft.ends_at)
    ? t("wordpress.reBanner.endBeforeStart", "The end has to be after the start.")
    : undefined;

  const summary = useMemo(
    () => describeWindow(draft, timezone),
    [draft, timezone],
  );

  return (
    <div className="space-y-4">
      <SectionCard>
        <CardHeader
          icon={<CalendarClock className="size-4" />}
          title={t("wordpress.reBanner.schedule", "Schedule")}
          subtitle={t(
            "wordpress.reBanner.scheduleSubtitle",
            "Times are in the site's timezone ({{timezone}}). Leave a field empty for open-ended.",
            { timezone },
          )}
        />
        <CardBody>
          <Summary kind={summary.kind}>
            {summary.kind === "paused"
              ? t("wordpress.reBanner.summaryPaused", "Paused — the dates are kept, but nothing shows until you switch it back on.")
              : summary.kind === "always"
                ? t("wordpress.reBanner.summaryAlways", "Always on. Add an end date and it takes itself down.")
                : summary.kind === "live"
                  ? summary.until
                    ? t("wordpress.reBanner.summaryLiveUntil", "Live now, until {{until}}.", { until: summary.until })
                    : t("wordpress.reBanner.summaryLive", "Live now, with no end date.")
                  : summary.kind === "scheduled"
                    ? summary.until
                      ? t("wordpress.reBanner.summaryScheduledUntil", "Goes live {{from}} and comes down {{until}}.", {
                          from: summary.from,
                          until: summary.until,
                        })
                      : t("wordpress.reBanner.summaryScheduled", "Goes live {{from}}.", { from: summary.from })
                    : t("wordpress.reBanner.summaryExpired", "Ended {{until}}. Move the end date to show it again.", {
                        until: summary.until,
                      })}
          </Summary>

          <div className="grid gap-4 sm:grid-cols-2">
            <DateTimeField
              id="rebnr-starts"
              label={t("wordpress.reBanner.startsAt", "Starts")}
              value={draft.starts_at}
              onChange={(v) => set("starts_at", v)}
              timezone={timezone}
              disabled={saving}
            />
            <DateTimeField
              id="rebnr-ends"
              label={t("wordpress.reBanner.endsAt", "Ends")}
              value={draft.ends_at}
              onChange={(v) => set("ends_at", v)}
              timezone={timezone}
              minDate={splitDateTime(draft.starts_at).date || undefined}
              error={windowError}
              disabled={saving}
            />
          </div>

          <SwitchRow
            id="rebnr-status"
            checked={draft.status === "active"}
            onChange={(v) => set("status", v ? "active" : "inactive")}
            label={t("wordpress.reBanner.active", "Active")}
            description={t(
              "wordpress.reBanner.activeHint",
              "Turn off to pause the banner without touching its dates.",
            )}
          />
        </CardBody>
      </SectionCard>
    </div>
  );
}

/* ── The sentence ────────────────────────────────────────────────────── */

type WindowKind = "paused" | "always" | "live" | "scheduled" | "expired";

/**
 * Where the draft stands against the site's clock right now.
 *
 * The API sends a `state` for saved banners, computed by the plugin; this is
 * the same comparison for the *draft*, so the sentence follows the dates as
 * they are typed. Wall-clock strings in one zone compare as strings, so the
 * only conversion is "now" into the site's zone.
 */
function describeWindow(
  draft: Pick<ReBannerConfig, "starts_at" | "ends_at" | "status">,
  timezone: string,
): { kind: WindowKind; from?: string; until?: string } {
  if (draft.status !== "active") return { kind: "paused" };

  const start = draft.starts_at.trim();
  const end = draft.ends_at.trim();
  if (!start && !end) return { kind: "always" };

  const now = nowInZone(timezone);
  const from = start ? humanDate(start) : undefined;
  const until = end ? humanDate(end) : undefined;

  if (start && now < start) return { kind: "scheduled", from, until };
  if (end && now >= end) return { kind: "expired", from, until };
  return { kind: "live", from, until };
}

function nowInZone(zone: string): string {
  try {
    return formatInTimeZone(new Date(), zone, "yyyy-MM-dd HH:mm");
  } catch {
    return formatInTimeZone(new Date(), "UTC", "yyyy-MM-dd HH:mm");
  }
}

/** '2026-09-20 18:00' → '20 Sep 2026, 18:00' — the stored value, readable. */
function humanDate(stored: string): string {
  const { date, time } = splitDateTime(stored);
  if (!date) return stored;
  const [y, m, d] = date.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[(m || 1) - 1]} ${y}${time ? `, ${time}` : ""}`;
}

function Summary({ kind, children }: { kind: WindowKind; children: React.ReactNode }) {
  const Icon = kind === "live" ? CircleDot : kind === "paused" ? PauseCircle : Clock;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
        kind === "live" && "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300",
        kind === "scheduled" && "border-primary/30 bg-primary/[0.05] text-foreground",
        kind === "always" && "border-border bg-muted/40 text-foreground",
        (kind === "paused" || kind === "expired") && "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}
