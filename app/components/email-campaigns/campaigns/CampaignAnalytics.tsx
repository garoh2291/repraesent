import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, PanelBody, PanelHeader } from "~/components/forms/chrome";
import {
  getCampaignStats,
  type CampaignSummary,
} from "~/lib/api/email-campaigns";

/**
 * Stat tiles + events-over-time + per-link clicks. The AnalyticsPanel
 * pattern: totals from the denormalised campaign row, the time series from
 * the event log.
 */
export function CampaignAnalytics({ campaign }: { campaign: CampaignSummary }) {
  const { t, i18n } = useTranslation();

  const { data } = useQuery({
    queryKey: ["email-campaign-stats", campaign.id],
    queryFn: () => getCampaignStats(campaign.id),
    refetchInterval: campaign.status === "sending" ? 15_000 : false,
  });

  const fmt = (value: number) => value.toLocaleString(i18n.language);
  const rate = (part: number) =>
    campaign.sent_count > 0
      ? `${Math.round((part / campaign.sent_count) * 100)}%`
      : "—";

  const series = buildSeries(data?.series ?? []);

  return (
    <div className="space-y-4">
      {/*
        Delivered / opened / clicked / unsubscribed now live in the page header,
        where they are readable from every tab. Repeating them here said the
        same thing twice on the one tab that needs the space least.
        What stays is what the header genuinely cannot carry: the sends that did
        NOT arrive, which is a different question from how the arrivals
        performed and is the reason to come to this tab.
      */}
      {campaign.failed_count > 0 || campaign.skipped_count > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <Stat
            label={t("emailCampaigns.analytics.failed", {
              defaultValue: "Failed",
            })}
            value={fmt(campaign.failed_count)}
          />
          <Stat
            label={t("emailCampaigns.analytics.skipped", {
              defaultValue: "Skipped",
            })}
            value={fmt(campaign.skipped_count)}
          />
        </div>
      ) : null}

      {series.length > 0 ? (
        <Panel>
          <PanelHeader
            title={t("emailCampaigns.analytics.overTime", {
              defaultValue: "Engagement over time",
            })}
          />
          <PanelBody>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="bucket" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} width={32} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="open"
                    name={t("emailCampaigns.analytics.opens", {
                      defaultValue: "Opens",
                    })}
                    fill="#10b981"
                    stackId="events"
                  />
                  <Bar
                    dataKey="click"
                    name={t("emailCampaigns.analytics.clicks", {
                      defaultValue: "Clicks",
                    })}
                    fill="#2563eb"
                    stackId="events"
                  />
                  <Bar
                    dataKey="unsubscribe"
                    name={t("emailCampaigns.analytics.unsubscribes", {
                      defaultValue: "Unsubscribes",
                    })}
                    fill="#ef4444"
                    stackId="events"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </PanelBody>
        </Panel>
      ) : null}

      {(data?.links.length ?? 0) > 0 ? (
        <Panel>
          <PanelHeader
            title={t("emailCampaigns.analytics.topLinks", {
              defaultValue: "Link clicks",
            })}
          />
          <PanelBody>
            <div className="space-y-1.5">
              {data!.links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {link.url}
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {fmt(link.click_count)}
                  </span>
                </div>
              ))}
            </div>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function buildSeries(
  raw: { bucket: string; type: string; count: number }[],
): Array<{ bucket: string; open: number; click: number; unsubscribe: number }> {
  const byBucket = new Map<
    string,
    { bucket: string; open: number; click: number; unsubscribe: number }
  >();
  for (const row of raw) {
    const key = row.bucket;
    const entry =
      byBucket.get(key) ??
      ({
        bucket: new Date(row.bucket).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
        }),
        open: 0,
        click: 0,
        unsubscribe: 0,
      } as const as {
        bucket: string;
        open: number;
        click: number;
        unsubscribe: number;
      });
    if (row.type === "open") entry.open += row.count;
    if (row.type === "click") entry.click += row.count;
    if (row.type === "unsubscribe") entry.unsubscribe += row.count;
    byBucket.set(key, entry);
  }
  return [...byBucket.values()];
}
