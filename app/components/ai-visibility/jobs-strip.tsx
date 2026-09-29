import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, RotateCcw, TriangleAlert, X } from "lucide-react";
import { aiVisibilityApi, apiErrorMessage, isActiveJob, type Job, type JobKind } from "~/lib/api/ai-visibility";
import { useAiVisibilityStatus, useInvalidateAiVisibility } from "~/lib/hooks/useAiVisibility";
import { cn } from "~/lib/utils";
import { formatRelativeTime } from "~/lib/utils/format";
import { Button } from "~/components/ui/button";

/**
 * Follow-ups the owner never asked for: finish silently. The website check
 * also runs after every run, and its tab shows its own progress.
 */
const SILENT: JobKind[] = ["classify_domains", "site_check"];

export function useJobLabel() {
  const { t } = useTranslation();
  return (kind: JobKind, active: boolean): string => {
    switch (kind) {
      case "analyze_site":
        return active ? t("aiVisibility.jobs.analyzing", "Reading your website…") : t("aiVisibility.jobs.analyze", "Website read");
      case "suggest_prompts":
        return active ? t("aiVisibility.jobs.suggesting", "Writing questions…") : t("aiVisibility.jobs.suggest", "Question writing");
      case "refresh_actions":
        return active ? t("aiVisibility.jobs.refreshing", "Updating recommendations…") : t("aiVisibility.jobs.refresh", "Recommendation update");
      case "run":
        return active ? t("aiVisibility.jobs.running", "Asking the assistants…") : t("aiVisibility.jobs.run", "Run");
      case "classify_domains":
        return active ? t("aiVisibility.jobs.classifying", "Sorting the websites…") : t("aiVisibility.jobs.classify", "Website sorting");
      case "site_check":
        return active ? t("aiVisibility.jobs.siteChecking", "Checking your website…") : t("aiVisibility.jobs.siteCheck", "Website check");
      case "page_suggest":
        return active ? t("aiVisibility.jobs.pageSuggesting", "Writing questions and an opening for the page…") : t("aiVisibility.jobs.pageSuggest", "Page suggestions");
      case "comparison_draft":
        return active ? t("aiVisibility.jobs.drafting", "Writing the comparison page…") : t("aiVisibility.jobs.draft", "Comparison page");
    }
  };
}

/**
 * Tells the owner, once, when background work finished — even work that
 * finished while the page was closed — and refreshes everything it touched.
 * Mount it once (the /ai-visibility layout does).
 */
export function useJobWatcher() {
  const { t } = useTranslation();
  const { data } = useAiVisibilityStatus();
  const invalidate = useInvalidateAiVisibility();
  const label = useJobLabel();
  const handled = useRef(new Set<string>());
  const jobs = data?.jobs;

  useEffect(() => {
    if (!jobs) return;
    let changed = false;
    for (const j of jobs) {
      if (isActiveJob(j) || j.seen_at || handled.current.has(j.id)) continue;
      handled.current.add(j.id);
      changed = true;
      if (j.status === "succeeded") {
        if (!SILENT.includes(j.kind)) {
          const added = (j.result as { added?: number } | null)?.added;
          toast.success(
            j.kind === "suggest_prompts" && typeof added === "number"
              ? t("aiVisibility.jobs.suggestDone", "{{n}} new questions to review.", { n: added })
              : t("aiVisibility.jobs.done", "{{what}} finished.", { what: label(j.kind, false) }),
          );
        }
        void aiVisibilityApi.seenJob(j.id).catch(() => undefined);
      } else if (j.status === "failed" && !SILENT.includes(j.kind)) {
        // Failed jobs stay on the strip until retried or dismissed.
        toast.error(t("aiVisibility.jobs.failedToast", "{{what}} failed: {{error}}", { what: label(j.kind, false), error: j.error ?? "" }));
      } else {
        void aiVisibilityApi.seenJob(j.id).catch(() => undefined);
      }
    }
    if (changed) void invalidate();
  }, [jobs, invalidate, label, t]);
}

/**
 * What is happening in the background, where it can be cancelled, and what
 * failed with a way to try again. Runs have their own progress bar
 * (RunProgress), so they only appear here when they fail.
 */
export function JobsStrip({ className, canEdit, onRetryRun }: { className?: string; canEdit: boolean; onRetryRun?: () => void }) {
  const { t } = useTranslation();
  const { data } = useAiVisibilityStatus();
  const invalidate = useInvalidateAiVisibility();
  const label = useJobLabel();
  const [busy, setBusy] = useState<string | null>(null);

  const jobs = data?.jobs ?? [];
  const newestByKind = new Map<JobKind, Job>();
  for (const j of jobs) if (!newestByKind.has(j.kind)) newestByKind.set(j.kind, j);
  const active = jobs.filter((j) => isActiveJob(j) && j.kind !== "run" && !SILENT.includes(j.kind));
  // Only the newest attempt of a kind matters; an older failure that was
  // followed by a success is history, not a problem.
  const failed = [...newestByKind.values()].filter((j) => j.status === "failed" && !j.seen_at && !SILENT.includes(j.kind));
  if (!active.length && !failed.length) return null;

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
      await invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.jobs.actionFailed", "That didn't work — try again.")));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn("space-y-2", className)} role="status" aria-live="polite">
      {active.map((j) => (
        <div key={j.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-foreground">
              {j.cancel_requested ? t("aiVisibility.jobs.cancelling", "Stopping…") : label(j.kind, true)}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {j.status === "queued" && j.attempts > 0
                ? t("aiVisibility.jobs.retrying", "Hit a hiccup — trying again shortly (attempt {{n}} of {{max}}).", { n: j.attempts + 1, max: j.max_attempts })
                : j.status === "queued"
                  ? t("aiVisibility.jobs.queued", "Waiting its turn…")
                  : t("aiVisibility.jobs.canLeave", "You can close this page — it keeps going and the result is saved.")}
            </p>
          </div>
          {canEdit && !j.cancel_requested ? (
            <Button variant="ghost" size="sm" disabled={busy === j.id} onClick={() => act(j.id, () => aiVisibilityApi.cancelJob(j.id))}>
              {t("aiVisibility.jobs.cancel", "Cancel")}
            </Button>
          ) : null}
        </div>
      ))}
      {failed.map((j) => (
        <div key={j.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-overdue/30 bg-overdue-soft px-4 py-3">
          <TriangleAlert className="size-4 shrink-0 text-overdue" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-foreground">
              {t("aiVisibility.jobs.failedTitle", "{{what}} didn't finish", { what: label(j.kind, false) })}
            </p>
            <p className="break-words text-[12px] text-foreground/70">
              {j.error}
              {j.finished_at ? ` · ${formatRelativeTime(j.finished_at)}` : ""}
            </p>
          </div>
          {canEdit ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === j.id}
              onClick={() =>
                act(j.id, async () => {
                  if (j.kind === "run" && onRetryRun) {
                    await aiVisibilityApi.seenJob(j.id);
                    onRetryRun();
                  } else {
                    await aiVisibilityApi.retryJob(j.id);
                  }
                })
              }
            >
              <RotateCcw className="size-3.5" />
              {t("aiVisibility.jobs.retry", "Try again")}
            </Button>
          ) : null}
          <button
            type="button"
            onClick={() => act(j.id, () => aiVisibilityApi.seenJob(j.id))}
            aria-label={t("aiVisibility.jobs.dismiss", "Dismiss")}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-background/60 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
