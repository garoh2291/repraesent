import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
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
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyPanelState } from "~/components/forms/chrome";
import { getWorkflowAnalytics, type WorkflowGraph } from "~/lib/api/workflows";
import { allSteps } from "~/lib/workflows/tree";

/**
 * What this workflow has actually been doing.
 *
 * Every number here is derived from `workflow_run_steps`, so the funnel is the
 * real execution trace rather than a separately-maintained counter that can
 * drift from it.
 */
export function AnalyticsPanel({
  workflowId,
  graph,
}: {
  workflowId: string;
  graph: WorkflowGraph;
}) {
  const { t } = useTranslation();

  const { data, isPending } = useQuery({
    queryKey: ["workflow-analytics", workflowId],
    queryFn: () => getWorkflowAnalytics(workflowId),
  });

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  const total = (data?.runs_by_status ?? []).reduce((sum, r) => sum + r.count, 0);

  if (!data || total === 0) {
    return (
      <EmptyPanelState
        icon={<BarChart3 className="h-5 w-5" />}
        title={t("workflows.analytics.emptyTitle")}
        hint={t("workflows.analytics.emptyHint")}
      />
    );
  }

  const count = (status: string) =>
    data.runs_by_status.find((r) => r.status === status)?.count ?? 0;

  // Node order comes from the graph, not from the data — a node that never ran
  // must still appear, because a zero is the most interesting number here.
  const funnel = allSteps(graph).map((node) => {
    const rows = data.nodes.filter((n) => n.node_id === node.id);
    const of = (status: string) =>
      rows.find((r) => r.status === status)?.count ?? 0;
    return {
      name: t(`workflows.node.${node.type}`),
      ok: of("ok"),
      skipped: of("skipped"),
      failed: of("failed"),
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("workflows.analytics.total")} value={total} />
        <Stat label={t("workflows.runStatus.completed")} value={count("completed")} tone="good" />
        <Stat label={t("workflows.runStatus.waiting")} value={count("waiting")} />
        <Stat label={t("workflows.runStatus.failed")} value={count("failed")} tone="bad" />
      </div>

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("workflows.analytics.perStep")}
        </h3>
        <div className="h-64 w-full overflow-x-auto rounded-xl border border-border bg-card p-3">
          <ResponsiveContainer width="100%" height="100%" minWidth={320}>
            <BarChart data={funnel}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
              <Tooltip />
              <Bar dataKey="ok" stackId="a" fill="#10b981" name={t("workflows.stepStatus.ok")} />
              <Bar dataKey="skipped" stackId="a" fill="#f59e0b" name={t("workflows.stepStatus.skipped")} />
              <Bar dataKey="failed" stackId="a" fill="#ef4444" name={t("workflows.stepStatus.failed")} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {data.daily.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("workflows.analytics.perDay")}
          </h3>
          <div className="h-48 w-full overflow-x-auto rounded-xl border border-border bg-card p-3">
            <ResponsiveContainer width="100%" height="100%" minWidth={320}>
              <BarChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip />
                <Bar dataKey="count" fill="#fbbf24" name={t("workflows.analytics.total")} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 text-xl font-semibold ${
          tone === "good"
            ? "text-emerald-600"
            : tone === "bad" && value > 0
              ? "text-destructive"
              : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
