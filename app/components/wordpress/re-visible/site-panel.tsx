import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bot,
  CheckCircle2,
  CircleSlash,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import {
  CardBody,
  CardHeader,
  InfoNote,
  SectionCard,
  StatTile,
} from "~/components/wordpress/fields";
import type { AuditCheck, SiteResponse } from "~/lib/api/re-visible";
import { cn } from "~/lib/utils";

/**
 * The plugin's own readiness audit, plus what the crawlers actually did.
 *
 * Every check that can be fixed from here gets a button that asks the PLUGIN to
 * do it — Repraesent never writes robots.txt or flushes rewrites itself. Checks
 * that cannot be automated (Bing, Brave) are still listed, because "we cannot
 * do this for you, here is the link" is more useful than silence.
 */
export function SitePanel({
  data,
  loading,
  onRefresh,
  refreshing,
  onFix,
  fixing,
  onOpenWordPress,
}: {
  data: SiteResponse | undefined;
  loading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  onFix: (checkId: string) => void;
  fixing: string | null;
  onOpenWordPress: () => void;
}) {
  const { t } = useTranslation();

  const bots = useMemo(() => totals(data, "bot"), [data]);
  const referrals = useMemo(() => totals(data, "referral"), [data]);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  }

  const audit = data?.audit ?? null;
  const failing = (audit?.checks ?? []).filter(
    (check) => check.status === "fail",
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={<ShieldCheck className="size-3.5" aria-hidden />}
          label={t("wordpress.reVisible.readiness", "Readiness")}
          value={audit ? `${audit.score}/100` : "—"}
          tone={audit && audit.score >= 80 ? "positive" : "neutral"}
        />
        <StatTile
          icon={<Bot className="size-3.5" aria-hidden />}
          label={t("wordpress.reVisible.crawlerHits", "AI crawler visits, 30 days")}
          value={bots.reduce((sum, row) => sum + row.count, 0)}
        />
        <StatTile
          icon={<Users className="size-3.5" aria-hidden />}
          label={t("wordpress.reVisible.aiVisits", "Visits from AI, 30 days")}
          value={referrals.reduce((sum, row) => sum + row.count, 0)}
        />
      </div>

      <SectionCard>
        <CardHeader
          title={t("wordpress.reVisible.checklistTitle", "Checklist")}
          subtitle={
            audit
              ? t(
                  "wordpress.reVisible.checklistSubtitle",
                  "Checked {{when}}. {{failing}} item(s) need attention.",
                  {
                    when: new Date(audit.ran_at).toLocaleString(),
                    failing,
                  },
                )
              : t(
                  "wordpress.reVisible.checklistNever",
                  "The site has not been checked yet.",
                )
          }
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Spinner className="size-3.5" />
              ) : (
                <RefreshCw className="size-3.5" aria-hidden />
              )}
              {t("wordpress.reVisible.recheck", "Re-check")}
            </Button>
          }
        />
        <CardBody>
          {!audit ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "wordpress.reVisible.auditEmpty",
                "Re-check to run the audit on the site now.",
              )}
            </p>
          ) : (
            <ul className="divide-y">
              {audit.checks.map((check) => (
                <CheckRow
                  key={check.id}
                  check={check}
                  onFix={onFix}
                  fixing={fixing === check.id}
                />
              ))}
            </ul>
          )}

          <InfoNote>
            {t(
              "wordpress.reVisible.manualTasks",
              "Two things cannot be done from here: claim the site in Bing Webmaster Tools, because ChatGPT search retrieves from Bing, and submit it to Brave, because Claude retrieves from Brave.",
            )}{" "}
            <a
              href="https://www.bing.com/webmasters"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline"
            >
              Bing Webmaster Tools
            </a>
            {" · "}
            <a
              href="https://search.brave.com/submit-url"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline"
            >
              Brave
            </a>
          </InfoNote>
        </CardBody>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard>
          <CardHeader
            icon={<Bot className="size-4" aria-hidden />}
            title={t("wordpress.reVisible.crawlersTitle", "Which AI crawlers came")}
            subtitle={t(
              "wordpress.reVisible.crawlersSubtitle",
              "Proof the engines can read the site, independent of whether they cited it.",
            )}
          />
          <CardBody>
            <TelemetryChart rows={bots} emptyLabel={t(
              "wordpress.reVisible.noCrawlers",
              "No AI crawler has fetched a page in the last 30 days.",
            )} />
          </CardBody>
        </SectionCard>

        <SectionCard>
          <CardHeader
            icon={<Users className="size-4" aria-hidden />}
            title={t("wordpress.reVisible.referralsTitle", "Visits from AI surfaces")}
            subtitle={t(
              "wordpress.reVisible.referralsSubtitle",
              "People who clicked through from an AI answer.",
            )}
          />
          <CardBody>
            <TelemetryChart rows={referrals} emptyLabel={t(
              "wordpress.reVisible.noReferrals",
              "No visits from an AI surface yet.",
            )} />
          </CardBody>
        </SectionCard>
      </div>

      <div>
        <Button variant="outline" size="sm" onClick={onOpenWordPress}>
          <ExternalLink className="size-3.5" aria-hidden />
          {t("wordpress.reVisible.openInWordPress", "Open AI Analytics in WordPress")}
        </Button>
      </div>
    </div>
  );
}

function CheckRow({
  check,
  onFix,
  fixing,
}: {
  check: AuditCheck;
  onFix: (checkId: string) => void;
  fixing: boolean;
}) {
  const { t } = useTranslation();
  const Icon =
    check.status === "pass"
      ? CheckCircle2
      : check.status === "fail"
        ? XCircle
        : check.status === "warn"
          ? TriangleAlert
          : CircleSlash;

  return (
    <li className="flex items-start gap-3 py-3 first:pt-0">
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0",
          check.status === "pass" && "text-emerald-600 dark:text-emerald-400",
          check.status === "fail" && "text-destructive",
          check.status === "warn" && "text-amber-600 dark:text-amber-400",
          check.status === "info" && "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{checkLabel(check.id, t)}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {check.detail}
        </p>
      </div>
      {check.fix_available ? (
        <Button
          variant="outline"
          size="sm"
          disabled={fixing}
          onClick={() => onFix(check.id)}
        >
          {fixing ? (
            <Spinner className="size-3.5" />
          ) : (
            t("wordpress.reVisible.fix", "Fix")
          )}
        </Button>
      ) : null}
    </li>
  );
}

/**
 * Human labels per check id.
 *
 * The ids come from the plugin's own audit and are stored verbatim, so an
 * unknown id (a site running a newer plugin than this build) falls back to the
 * id rather than rendering blank.
 */
function checkLabel(
  id: string,
  t: (key: string, fallback: string) => string,
): string {
  const labels: Record<string, string> = {
    robots_search_bots: t(
      "wordpress.reVisible.checkRobots",
      "AI search crawlers allowed",
    ),
    robots_physical_file: t(
      "wordpress.reVisible.checkRobotsFile",
      "robots.txt not overridden by a file",
    ),
    https: t("wordpress.reVisible.checkHttps", "HTTPS"),
    noindex_home: t("wordpress.reVisible.checkNoindex", "Homepage indexable"),
    sitemap: t("wordpress.reVisible.checkSitemap", "XML sitemap"),
    indexnow: t("wordpress.reVisible.checkIndexnow", "IndexNow submissions"),
    bing_verification: t(
      "wordpress.reVisible.checkBing",
      "Bing site verification",
    ),
    org_schema: t("wordpress.reVisible.checkOrg", "Business entity schema"),
    article_schema: t(
      "wordpress.reVisible.checkArticle",
      "Article schema on posts",
    ),
    faq_schema: t("wordpress.reVisible.checkFaq", "FAQ schema"),
    answer_blocks: t(
      "wordpress.reVisible.checkAnswers",
      "Pages that open with a direct answer",
    ),
    author_dates_visible: t(
      "wordpress.reVisible.checkAuthor",
      "Visible author and date",
    ),
    llms_txt: t("wordpress.reVisible.checkLlms", "llms.txt (agent readiness)"),
    ai_crawlers_seen: t(
      "wordpress.reVisible.checkCrawlersSeen",
      "AI crawlers seen recently",
    ),
  };

  return labels[id] ?? id;
}

function totals(
  data: SiteResponse | undefined,
  kind: "bot" | "referral",
): { key: string; count: number }[] {
  const map = new Map<string, number>();

  for (const row of data?.telemetry ?? []) {
    if (row.kind !== kind) continue;

    map.set(row.key, (map.get(row.key) ?? 0) + row.count);
  }

  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function TelemetryChart({
  rows,
  emptyLabel,
}: {
  rows: { key: string; count: number }[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="var(--border)"
          />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="key"
            width={130}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
