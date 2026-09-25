import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, KeyRound, PauseCircle, TriangleAlert } from "lucide-react";
import { streamRun, type BatchProgress, type ProjectState } from "~/lib/api/ai-visibility";
import { useInvalidateAiVisibility } from "~/lib/hooks/useAiVisibility";
import { cn } from "~/lib/utils";
import { EngineMark, eur, microUsdToEurCents } from "./shared";

/**
 * Live progress of a run, streamed from the API. Follows whatever batch is in
 * flight — one the user just started, or the scheduled morning run.
 */
export function RunProgress({ batchId, onDone }: { batchId: string; onDone?: () => void }) {
  const { t } = useTranslation();
  const [p, setP] = useState<BatchProgress | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const invalidate = useInvalidateAiVisibility();
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const ac = new AbortController();
    let lastDone = 0;
    streamRun(
      batchId,
      (next) => {
        setP(next);
        // Refresh the numbers every ~10 answers so the page fills in live.
        if (next.done - lastDone >= 10) {
          lastDone = next.done;
          void invalidate();
        }
      },
      ac.signal,
    )
      .then(() => {
        void invalidate();
        doneRef.current?.();
      })
      .catch((err: unknown) => {
        if (!ac.signal.aborted) setFailed(err instanceof Error ? err.message : String(err));
      });
    return () => ac.abort();
  }, [batchId, invalidate]);

  if (failed) return null;
  const share = p && p.planned ? p.done / p.planned : 0;

  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-border bg-card px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[14px] font-medium text-foreground">
          {p?.finished
            ? t("aiVisibility.run.finished", "Done — {{done}} answers collected", { done: p.done })
            : t("aiVisibility.run.asking", "Asking the assistants… {{done}} of {{planned}}", { done: p?.done ?? 0, planned: p?.planned ?? "…" })}
        </p>
        <p className="num text-[12.5px] text-muted-foreground">
          {t("aiVisibility.run.spent", "{{cost}} so far", { cost: eur(microUsdToEurCents(p?.cost_micro_usd ?? 0), { precise: true }) })}
        </p>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
        <div className="h-full rounded-full bg-marker transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.max(3, share * 100)}%` }} />
      </div>
      {p?.engines.length ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
          {p.engines.map((e) => (
            <span key={e.engine} className="num inline-flex items-center gap-1.5">
              <EngineMark engine={e.engine} /> {e.done}
            </span>
          ))}
        </div>
      ) : null}
      {!p?.finished ? (
        <p className="mt-2 text-[12px] text-muted-foreground">
          {t("aiVisibility.run.canLeave", "Each assistant searches the web before it answers, so this takes a few minutes. You can leave this page — it keeps running.")}
        </p>
      ) : null}
      {p?.error ? <p className="mt-2 text-[12.5px] text-overdue">{p.error}</p> : null}
    </div>
  );
}

/** Why nothing is running, said plainly, with the one thing that fixes it. */
export function StateNotice({ state, className }: { state: ProjectState; className?: string }) {
  const { t } = useTranslation();
  const p = state.project;
  const keyBroken = !state.key.connected || state.key.status === "revoked" || state.key.status === "error";

  let icon = <PauseCircle className="size-4" />;
  let title: string | null = null;
  let body: string | null = null;
  let action: { to: string; label: string } | null = null;

  if (keyBroken || (p.status === "paused" && p.paused_reason === "key")) {
    icon = state.key.status === "revoked" ? <TriangleAlert className="size-4" /> : <KeyRound className="size-4" />;
    title = t("aiVisibility.notice.keyTitle", "Connect your OpenRouter key to keep tracking");
    body = state.key.last_error
      ? t("aiVisibility.notice.keyBodyError", "OpenRouter said: {{error}}. Tracking is paused and resumes by itself once the key works.", { error: state.key.last_error })
      : t("aiVisibility.notice.keyBody", "Questions are asked on your own OpenRouter key, the same one your AI chat uses. Tracking resumes by itself once it's connected.");
    action = { to: "/settings/ai", label: t("aiVisibility.notice.keyCta", "Open Settings → AI") };
  } else if (p.status === "paused" && p.paused_reason === "cap") {
    title = t("aiVisibility.notice.capTitle", "Paused: this month's spending limit is reached");
    body = t("aiVisibility.notice.capBody", "{{spent}} of {{cap}} used. Tracking restarts on the 1st, or right away if you raise the limit.", {
      spent: eur(state.spend.month_eur_cents),
      cap: eur(state.spend.cap_eur_cents),
    });
    action = { to: "/ai-visibility/plan", label: t("aiVisibility.notice.capCta", "Change the limit") };
  } else if (p.status === "paused") {
    title = t("aiVisibility.notice.pausedTitle", "Tracking is paused");
    body = t("aiVisibility.notice.pausedBody", "No questions are asked and nothing is spent until you resume.");
    action = { to: "/ai-visibility/plan", label: t("aiVisibility.notice.pausedCta", "Resume") };
  }
  if (!title) return null;

  return (
    <div role="status" className={cn("flex flex-col gap-3 rounded-xl border border-marker bg-marker-soft px-4 py-3.5 sm:flex-row sm:items-center", className)}>
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-marker text-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-foreground">{title}</p>
        {body ? <p className="mt-0.5 text-[13px] leading-relaxed text-foreground/75">{body}</p> : null}
      </div>
      {action ? (
        <Link
          to={action.to}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg bg-foreground px-3 text-[13px] font-medium text-background hover:bg-foreground/90 sm:self-auto"
        >
          {action.label}
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
