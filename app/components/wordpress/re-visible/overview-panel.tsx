import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CalendarClock,
  Coins,
  ListChecks,
  Play,
  TrendingUp,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import {
  CardBody,
  CardHeader,
  InfoNote,
  SectionCard,
  StatTile,
} from "~/components/wordpress/fields";
import type {
  TrendPoint,
  VisibilityOverview,
} from "~/lib/api/re-visible";
import type { RunProgress } from "~/lib/api/re-visible-stream";
import {
  engineColor,
  engineLabel,
  formatMicroUsd,
  formatPercent,
  intentLabel,
} from "./constants";

/**
 * The tab that answers "how are we doing".
 *
 * Ordered by what a client can act on: the per-engine cards say where they
 * stand, the trend says whether it is moving, and the losing-prompts list is the
 * only thing on the page that is a to-do.
 */
export function OverviewPanel({
  overview,
  trend,
  trendLoading,
  onRunNow,
  running,
  progress,
  canRun,
  onOpenPrompt,
  onGoToSources,
  children,
}: {
  overview: VisibilityOverview;
  trend: TrendPoint[];
  trendLoading: boolean;
  onRunNow: () => void;
  running: boolean;
  /** Live batch progress while a run is in flight, else null. */
  progress?: RunProgress | null;
  canRun: boolean;
  onOpenPrompt: (promptId: string) => void;
  onGoToSources: () => void;
  /** The per-engine cards, rendered by the page so it owns the grid. */
  children: React.ReactNode;
}) {
  const { t } = useTranslation();

  const nextRun = overview.project.next_run_at
    ? new Date(overview.project.next_run_at)
    : null;
  const lastRun = overview.project.last_run_at
    ? new Date(overview.project.last_run_at)
    : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<ListChecks className="size-3.5" aria-hidden />}
          label={t("wordpress.reVisible.promptsTracked", "Questions tracked")}
          value={overview.prompts_active}
        />
        <StatTile
          icon={<Play className="size-3.5" aria-hidden />}
          label={t("wordpress.reVisible.runsThisWeek", "Answers this week")}
          value={`${overview.runs_this_week} / ${overview.weekly_run_cap}`}
          // Muted once the allowance is spent: the number stops being
          // something to act on until the week rolls over.
          tone={
            overview.runs_this_week >= overview.weekly_run_cap
              ? "muted"
              : "neutral"
          }
        />
        <StatTile
          icon={<Coins className="size-3.5" aria-hidden />}
          label={t("wordpress.reVisible.costThisMonth", "Cost this month")}
          value={formatMicroUsd(overview.cost_this_month_micro_usd)}
        />
        <StatTile
          icon={<CalendarClock className="size-3.5" aria-hidden />}
          label={t("wordpress.reVisible.nextRun", "Next check")}
          value={
            overview.project.status === "paused"
              ? t("wordpress.reVisible.paused", "Paused")
              : nextRun
                ? nextRun.toLocaleDateString()
                : "—"
          }
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {lastRun
              ? t("wordpress.reVisible.lastRunAt", "Last checked {{date}}", {
                  date: lastRun.toLocaleString(),
                })
              : t(
                  "wordpress.reVisible.neverRun",
                  "The engines have not been asked yet.",
                )}
          </p>
          <Button onClick={onRunNow} disabled={running || !canRun} size="sm">
            {running ? (
              <>
                <Spinner className="size-3.5" />
                {t("wordpress.reVisible.running", "Asking the engines…")}
              </>
            ) : (
              <>
                <Play className="size-3.5" aria-hidden />
                {t("wordpress.reVisible.runNow", "Check now")}
              </>
            )}
          </Button>
        </div>

        {progress && !progress.finished ? (
          <RunProgressBar progress={progress} />
        ) : null}
      </div>

      {children}

      <SectionCard>
        <CardHeader
          icon={<TrendingUp className="size-4" aria-hidden />}
          title={t("wordpress.reVisible.trendTitle", "Citations over time")}
          subtitle={t(
            "wordpress.reVisible.trendSubtitle",
            "How often each engine cited one of your pages, by week.",
          )}
        />
        <CardBody>
          <TrendChart points={trend} loading={trendLoading} />
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<AlertTriangle className="size-4" aria-hidden />}
          title={t("wordpress.reVisible.losingTitle", "Questions you lose")}
          subtitle={t(
            "wordpress.reVisible.losingSubtitle",
            "A competitor was named and you were not. This is the list worth working through.",
          )}
        />
        <CardBody>
          {overview.losing_prompts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {overview.prompts_active === 0
                ? t(
                    "wordpress.reVisible.losingNoPrompts",
                    "Add some questions and run a check to see where you stand.",
                  )
                : t(
                    "wordpress.reVisible.losingNone",
                    "Nothing here — you were named on every question a competitor was.",
                  )}
            </p>
          ) : (
            <>
              <ul className="divide-y">
                {overview.losing_prompts.slice(0, 12).map((prompt) => (
                  <li
                    key={prompt.prompt_id}
                    className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenPrompt(prompt.prompt_id)}
                        className="text-left text-sm font-medium hover:underline"
                      >
                        {prompt.text}
                      </button>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {intentLabel(prompt.intent)}
                        </Badge>
                        {prompt.engines.map((engine) => (
                          <Badge
                            key={engine}
                            variant="outline"
                            className="text-[10px]"
                            style={{ borderColor: engineColor(engine) }}
                          >
                            {engineLabel(engine)}
                          </Badge>
                        ))}
                      </div>
                      {prompt.competitors.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t("wordpress.reVisible.wonBy", "Named instead:")}{" "}
                          {prompt.competitors.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>

              <InfoNote>
                {t(
                  "wordpress.reVisible.losingAdvice",
                  "Being named in an AI answer is mostly decided off your own site: third-party mentions correlate with citations roughly three times more strongly than backlinks do. Check the Sources tab for the pages these engines actually trust.",
                )}{" "}
                <button
                  type="button"
                  onClick={onGoToSources}
                  className="font-medium text-foreground underline"
                >
                  {t("wordpress.reVisible.openSources", "Open Sources")}
                </button>
              </InfoNote>
            </>
          )}
        </CardBody>
      </SectionCard>
    </div>
  );
}

/**
 * Live progress for a run in flight.
 *
 * Counts, not a spinner: a batch is hundreds of engine calls over several
 * minutes, and "asking the engines…" with no number reads as hung. Per-engine
 * counts also make a silently failing engine visible while the run is still
 * going, rather than at the end.
 */
function RunProgressBar({ progress }: { progress: RunProgress }) {
  const { t } = useTranslation();
  const pct =
    progress.planned > 0
      ? Math.min(100, Math.round((progress.done / progress.planned) * 100))
      : 0;

  return (
    <div className="rounded-xl border bg-card p-3.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">
          {t("wordpress.reVisible.runningProgress", "Asking the engines — {{done}} of {{planned}}", {
            done: progress.done,
            planned: progress.planned,
          })}
        </span>
        <span className="tabular-nums text-muted-foreground">{pct}%</span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {progress.engines.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
          {progress.engines.map((engine) => (
            <span
              key={engine.engine}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ background: engineColor(engine.engine) }}
              />
              {engineLabel(engine.engine)}
              <span className="tabular-nums">{engine.done}</span>
            </span>
          ))}
        </div>
      ) : null}

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {t(
          "wordpress.reVisible.runningNote",
          "This keeps running if you close the page — come back and the result will be here.",
        )}
      </p>
    </div>
  );
}

/**
 * Weekly citation rate per engine.
 *
 * Citation rate rather than mention rate, because it is the number the on-site
 * work moves: mentions depend on the whole web talking about the brand, while a
 * citation is the engine choosing the client's own page.
 */
function TrendChart({
  points,
  loading,
}: {
  points: TrendPoint[];
  loading: boolean;
}) {
  const { t } = useTranslation();

  const { data, engines } = useMemo(() => {
    const byWeek = new Map<string, Record<string, number | string>>();
    const seen = new Set<string>();

    for (const point of points) {
      seen.add(point.engine);

      const row = byWeek.get(point.week_start) ?? { week: point.week_start };
      row[point.engine] = Math.round(point.citation_rate * 100);
      byWeek.set(point.week_start, row);
    }

    return {
      data: [...byWeek.values()],
      engines: [...seen],
    };
  }, [points]);

  if (loading) {
    return <div className="h-56 animate-pulse rounded-lg bg-muted" />;
  }

  if (data.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        {t(
          "wordpress.reVisible.trendEmpty",
          "The trend appears once there are two weeks of checks to compare.",
        )}
      </p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(value: string) => value.slice(5)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(value: number) => `${value}%`}
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
            formatter={(value: number, name: string) => [
              `${value}%`,
              engineLabel(name),
            ]}
          />
          {engines.map((engine) => (
            <Line
              key={engine}
              type="monotone"
              dataKey={engine}
              stroke={engineColor(engine)}
              strokeWidth={2}
              dot={false}
              // A week an engine was unavailable is a gap, not a drop to zero.
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export { formatPercent };
