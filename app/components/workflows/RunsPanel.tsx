import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleSlash,
  Clock,
  History,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyPanelState } from "~/components/forms/chrome";
import {
  getWorkflowRun,
  listWorkflowRuns,
  type WorkflowRun,
  type WorkflowRunStep,
} from "~/lib/api/workflows";

const RUN_ICON = {
  completed: CheckCircle2,
  failed: XCircle,
  waiting: Clock,
  running: Clock,
  cancelled: CircleSlash,
} as const;

/**
 * Run history, and the per-node trace for whichever run is open.
 *
 * This is the only place a user can see *why* an automation did or didn't do
 * something, so a skipped step shows its reason rather than just a grey dot.
 */
export function RunsPanel({ workflowId }: { workflowId: string }) {
  const { t, i18n } = useTranslation();
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const { data: runs, isPending } = useQuery({
    queryKey: ["workflow-runs", workflowId],
    queryFn: () => listWorkflowRuns(workflowId),
    // Runs advance on a scheduler tick, so a stale list is the common case.
    refetchInterval: 15_000,
  });

  const { data: detail } = useQuery({
    queryKey: ["workflow-run", workflowId, openRunId],
    queryFn: () => getWorkflowRun(workflowId, openRunId!),
    enabled: !!openRunId,
  });

  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <EmptyPanelState
        icon={<History className="h-5 w-5" />}
        title={t("workflows.runs.emptyTitle")}
        hint={t("workflows.runs.emptyHint")}
      />
    );
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const Icon = RUN_ICON[run.status] ?? Clock;
        const open = openRunId === run.id;

        return (
          <div
            key={run.id}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <button
              type="button"
              onClick={() => setOpenRunId(open ? null : run.id)}
              className="flex w-full flex-wrap items-center gap-3 p-3 text-left transition-colors hover:bg-muted/30"
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  run.status === "failed"
                    ? "text-destructive"
                    : run.status === "completed"
                      ? "text-emerald-600"
                      : "text-muted-foreground"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {t(`workflows.runStatus.${run.status}`)}
                  {run.dry_run ? ` · ${t("workflows.runs.testBadge")}` : ""}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {fmt(run.started_at)}
                  {run.error_message ? ` · ${run.error_message}` : ""}
                </span>
              </span>
            </button>

            {open ? (
              <div className="border-t border-border bg-muted/20 p-3">
                <StepTrace steps={detail?.steps} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StepTrace({ steps }: { steps: WorkflowRunStep[] | undefined }) {
  const { t } = useTranslation();

  if (!steps) return <Skeleton className="h-16 w-full rounded-lg" />;
  if (steps.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">{t("workflows.runs.noSteps")}</p>
    );
  }

  return (
    <ol className="space-y-2">
      {steps.map((step) => (
        <li key={step.id} className="flex items-start gap-2.5">
          <span
            aria-hidden
            className={`mt-1 size-2 shrink-0 rounded-full ${
              step.status === "ok"
                ? "bg-emerald-500"
                : step.status === "skipped"
                  ? "bg-amber-500"
                  : "bg-destructive"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">
              {t(`workflows.node.${step.node_type}`)}
              <span className="ml-2 font-normal text-muted-foreground">
                {t(`workflows.stepStatus.${step.status}`)}
              </span>
            </p>
            <StepOutcome step={step} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The human-readable part of a step.
 *
 * A dry run's rendered email is shown in full — that is the entire point of
 * the tester: seeing the actual subject and body that would have been sent.
 */
function StepOutcome({ step }: { step: WorkflowRunStep }) {
  const { t } = useTranslation();
  // The two email nodes report slightly different shapes — the internal one
  // keys recipients as `email`, the customer one as `to` — and either can be a
  // single object or a list. One permissive shape covers both.
  type Recipient = {
    email?: string;
    to?: string;
    subject?: string;
    html?: string;
    locale?: string;
    reason?: string;
  };
  const output = (step.output ?? {}) as {
    passed?: boolean;
    sent?: Recipient | Recipient[];
    skipped?: Recipient | Recipient[];
    preview?: Recipient | Recipient[];
  };

  if (step.error) {
    return <p className="mt-0.5 text-xs text-destructive">{step.error}</p>;
  }

  const previews = toArray(output.preview);
  const sent = toArray(output.sent);
  const skipped = toArray(output.skipped);

  return (
    <div className="mt-1 space-y-1.5">
      {output.passed !== undefined ? (
        <p className="text-xs text-muted-foreground">
          {output.passed
            ? t("workflows.runs.conditionPassed")
            : t("workflows.runs.conditionFailed")}
        </p>
      ) : null}

      {sent.map((s, i) => (
        <p key={`sent-${i}`} className="text-xs text-muted-foreground">
          {t("workflows.runs.sentTo", {
            email: s.email ?? s.to,
            locale: (s.locale ?? "").toUpperCase(),
          })}
        </p>
      ))}

      {skipped.map((s, i) => (
        <p key={`skip-${i}`} className="text-xs text-amber-700 dark:text-amber-300">
          {s.email || s.to ? `${s.email ?? s.to} — ` : ""}
          {t(`workflows.skipReason.${s.reason}`, { defaultValue: s.reason ?? "" })}
        </p>
      ))}

      {previews.map((p, i) => (
        <div
          key={`prev-${i}`}
          className="rounded-lg border border-border bg-card p-2.5"
        >
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {t("workflows.runs.wouldSend", {
              email: p.email ?? p.to,
              locale: (p.locale ?? "").toUpperCase(),
            })}
          </p>
          <p className="mt-1 text-xs font-medium">{p.subject}</p>
          <div
            className="mt-1 border-t border-border pt-1.5 text-xs text-muted-foreground [&_p]:my-0.5"
            dangerouslySetInnerHTML={{ __html: p.html ?? "" }}
          />
        </div>
      ))}
    </div>
  );
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
