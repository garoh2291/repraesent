import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router";
import { CheckCircle2, Circle, CircleDot, Lightbulb, ListTodo, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useAiVisibilityActions, useAiVisibilityJob, useInvalidateAiVisibility } from "~/lib/hooks/useAiVisibility";
import {
  aiVisibilityApi,
  apiErrorMessage,
  isActiveJob,
  type Action,
  type ActionKind,
  type ActionStatus,
  type ComparisonDraft,
} from "~/lib/api/ai-visibility";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { useAuthContext } from "~/providers/auth-provider";
import { cn } from "~/lib/utils";
import { formatDateShort, formatRelativeTime } from "~/lib/utils/format";
import { Panel } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { TaskDetailModal } from "~/components/organism/tasks/task-detail-modal";
import type { WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";
import { useAiVisibilityContext } from "~/components/ai-visibility/context";
import { Impact } from "~/components/ai-visibility/impact";
import { FilterSelect, Segmented } from "~/components/ai-visibility/shared";
import { CopyBlock } from "~/components/ai-visibility/copy-block";

type View = "open" | "done" | "dismissed";

/**
 * What to do, ranked by how many answers each gap touches. "I'm on it" turns
 * an action into a CRM task assigned to you (due in a week) and opens it; the
 * two stay in sync — finishing either one finishes the other.
 */
export default function AiVisibilityActions() {
  const { t } = useTranslation();
  const { canEdit } = useAiVisibilityContext();
  const { currentWorkspace } = useAuthContext();
  const q = useAiVisibilityActions();
  const invalidate = useInvalidateAiVisibility();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("open");
  const refreshJob = useAiVisibilityJob("refresh_actions");
  const refreshing = !!refreshJob && isActiveJob(refreshJob);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [confirmDismiss, setConfirmDismiss] = useState<Action | null>(null);

  // Same member list the /tasks page hands the task modal.
  const workspaceQuery = useQuery({
    queryKey: ["workspace-detail"],
    queryFn: () => getWorkspaceDetail(),
    enabled: !!currentWorkspace,
  });
  const members: WorkspaceMemberItem[] = useMemo(
    () =>
      (workspaceQuery.data?.members ?? []).map((m) => ({
        user_id: m.user_id,
        user_first_name: m.user_first_name,
        user_last_name: m.user_last_name,
        user_email: m.user_email,
        role: m.role,
      })),
    [workspaceQuery.data],
  );

  useEffect(() => {
    const id = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (!id || !q.data) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.add("ring-2", "ring-marker");
    const timer = setTimeout(() => el.classList.remove("ring-2", "ring-marker"), 1800);
    return () => clearTimeout(timer);
  }, [q.data]);

  const kindLabel = (k: ActionKind) =>
    ({
      technical: t("aiVisibility.actions.kind.technical", "Website access"),
      own_content: t("aiVisibility.actions.kind.own_content", "Your website"),
      comparison_page: t("aiVisibility.actions.kind.comparison_page", "Your website"),
      earned_media: t("aiVisibility.actions.kind.earned_media", "Press & magazines"),
      directory: t("aiVisibility.actions.kind.directory", "Listings & reviews"),
      community: t("aiVisibility.actions.kind.community", "Communities"),
      reference: t("aiVisibility.actions.kind.reference", "Encyclopedias"),
      fact_fix: t("aiVisibility.actions.kind.fact_fix", "Wrong facts"),
    })[k];

  /** Tasks, Today and this page all change together. */
  const refreshAll = () => {
    void invalidate();
    for (const key of ["tasks", "task", "task-history", "today", "home-tasks-upcoming", "home-tasks-overdue"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const start = async (a: Action) => {
    setBusyId(a.id);
    try {
      const res = await aiVisibilityApi.startAction(a.id);
      refreshAll();
      if (res.created) toast.success(t("aiVisibility.actions.task.created", "Task created and assigned to you."));
      setOpenTaskId(res.task_id);
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.actions.task.createFailed", "Could not create the task.")));
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (a: Action, status: ActionStatus) => {
    setBusyId(a.id);
    try {
      await aiVisibilityApi.setActionStatus(a.id, status);
      refreshAll();
      if (status === "done" && a.task_id && a.task_status !== "done") {
        toast.success(t("aiVisibility.actions.task.closed", "Done — the task is closed too."));
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.actions.saveFailed", "Could not update the action.")));
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = (a: Action) => {
    if (a.task_id && a.task_status !== "done") setConfirmDismiss(a);
    else void setStatus(a, "dismissed");
  };

  const refresh = async () => {
    try {
      await aiVisibilityApi.refreshActions();
      void invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.actions.refreshFailed", "Could not update recommendations.")));
    }
  };

  if (!q.data) return <Skeleton className="h-64 rounded-xl" />;

  const all = q.data.actions;
  const shown = all.filter((a) => (view === "open" ? a.status === "new" || a.status === "in_progress" : a.status === view));
  const counts = {
    open: all.filter((a) => a.status === "new" || a.status === "in_progress").length,
    done: all.filter((a) => a.status === "done").length,
    dismissed: all.filter((a) => a.status === "dismissed").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented<View>
          label={t("aiVisibility.actions.view", "Show")}
          value={view}
          onChange={setView}
          options={[
            { value: "open", label: `${t("aiVisibility.actions.open", "To do")} ${counts.open}` },
            { value: "done", label: `${t("aiVisibility.actions.done", "Done")} ${counts.done}` },
            { value: "dismissed", label: `${t("aiVisibility.actions.dismissed", "Dismissed")} ${counts.dismissed}` },
          ]}
        />
        <div className="flex items-center gap-3 text-[12.5px] text-muted-foreground">
          {q.data.generated_at ? (
            <span>{t("aiVisibility.actions.updated", "Updated {{when}}", { when: formatRelativeTime(q.data.generated_at) })}</span>
          ) : null}
          {canEdit ? (
            <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin motion-reduce:animate-none")} />
              {t("aiVisibility.actions.refresh", "Update now")}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="max-w-3xl text-[13.5px] leading-relaxed text-muted-foreground">
        {t(
          "aiVisibility.actions.intro",
          "AI assistants repeat what trusted websites say. Each recommendation below comes from your last 30 days of answers: a place that talks about your competitors but not you, or a question where you never come up. Start with the tallest bars.",
        )}
      </p>

      {shown.length === 0 ? (
        <Panel>
          <EmptyState
            icon={view === "open" ? <Lightbulb /> : <CheckCircle2 />}
            title={
              view === "open"
                ? all.length
                  ? t("aiVisibility.actions.allDone", "Nothing open. Nice work.")
                  : t("aiVisibility.actions.none", "No recommendations yet.")
                : t("aiVisibility.actions.noneHere", "Nothing here yet.")
            }
            body={
              view === "open" && !all.length
                ? t("aiVisibility.actions.noneBody", "They appear after the first day of answers, and update once a day.")
                : undefined
            }
          />
        </Panel>
      ) : (
        <ul className="space-y-3">
          {shown.map((a) => {
            const busy = busyId === a.id;
            const isOpen = a.status === "new" || a.status === "in_progress";
            return (
              <li key={a.id} id={a.id} className="scroll-mt-24 rounded-xl transition-shadow">
                <Panel className={cn("p-4 sm:p-5", a.status === "in_progress" && "border-marker")}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                    <Impact value={a.impact} />
                    <span className="font-medium uppercase tracking-[0.06em]">{kindLabel(a.kind)}</span>
                    {a.status === "in_progress" ? (
                      <span className="rounded-full bg-marker-soft px-2 py-0.5 font-medium text-marker-ink">
                        {t("aiVisibility.actions.status.in_progress", "In progress")}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="title-display mt-2 text-[19px] font-semibold leading-snug text-foreground">{a.title}</h3>
                  <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-foreground/80">{a.why}</p>
                  {a.steps.length ? (
                    <ol className="mt-3 max-w-3xl space-y-1.5">
                      {a.steps.map((s, i) => (
                        <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-foreground/85">
                          <span className="num mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-[11px] font-semibold text-foreground/70">
                            {i + 1}
                          </span>
                          {s}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  <Evidence evidence={a.evidence} />
                  {a.kind === "comparison_page" ? <ComparisonDraftBlock action={a} canEdit={canEdit && isOpen} /> : null}

                  {a.task_id ? <LinkedTask action={a} onOpen={() => setOpenTaskId(a.task_id)} /> : null}

                  {canEdit ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {isOpen && !a.task_id ? (
                        <Button size="sm" onClick={() => start(a)} disabled={busy}>
                          <ListTodo className="size-3.5" />
                          {a.status === "in_progress"
                            ? t("aiVisibility.actions.task.create", "Make it a task")
                            : t("aiVisibility.actions.start", "I'm on it")}
                        </Button>
                      ) : null}
                      {isOpen ? (
                        <>
                          <Button size="sm" variant={a.task_id ? "default" : "outline"} onClick={() => setStatus(a, "done")} disabled={busy}>
                            {t("aiVisibility.actions.markDone", "Mark done")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => dismiss(a)} disabled={busy}>
                            {t("aiVisibility.actions.dismiss", "Not relevant")}
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setStatus(a, "new")} disabled={busy}>
                          {t("aiVisibility.actions.reopen", "Reopen")}
                        </Button>
                      )}
                    </div>
                  ) : null}
                </Panel>
              </li>
            );
          })}
        </ul>
      )}

      <TaskDetailModal
        open={!!openTaskId}
        onOpenChange={(o) => {
          if (!o) {
            setOpenTaskId(null);
            refreshAll();
          }
        }}
        taskId={openTaskId}
        workspaceMembers={members}
        canEdit={canEdit}
      />

      <AlertDialog open={!!confirmDismiss} onOpenChange={(o) => !o && setConfirmDismiss(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("aiVisibility.actions.task.dismissTitle", "Not relevant — and delete its task?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "aiVisibility.actions.task.dismissBody",
                "This recommendation has an open task. Marking it not relevant deletes that task as well. You can reopen the recommendation later.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("aiVisibility.common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const a = confirmDismiss;
                setConfirmDismiss(null);
                if (a) void setStatus(a, "dismissed");
              }}
            >
              {t("aiVisibility.actions.task.dismissConfirm", "Delete task and dismiss")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** The CRM task behind an action: who has it, when it's due, where it stands. One tap opens it. */
function LinkedTask({ action, onOpen }: { action: Action; onOpen: () => void }) {
  const { t } = useTranslation();
  const status = action.task_status ?? "todo";
  const overdue = status !== "done" && !!action.task_due_date && new Date(action.task_due_date) < new Date();
  const Icon = status === "done" ? CheckCircle2 : status === "in_progress" ? CircleDot : Circle;
  const statusLabel =
    status === "done"
      ? t("aiVisibility.actions.task.statusDone", "Done")
      : status === "in_progress"
        ? t("aiVisibility.actions.task.statusInProgress", "In progress")
        : t("aiVisibility.actions.task.statusTodo", "To do");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-4 flex w-full items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2.5 text-left transition-colors hover:border-foreground/30 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
    >
      <Icon className={cn("size-4 shrink-0", status === "done" ? "text-earned" : status === "in_progress" ? "text-marker-ink" : "text-muted-foreground")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-foreground">
          {t("aiVisibility.actions.task.label", "Task")} · {statusLabel}
        </span>
        <span className="block text-[12px] leading-snug text-muted-foreground">
          {action.task_assignee_name
            ? t("aiVisibility.actions.task.assignedTo", "Assigned to {{name}}", { name: action.task_assignee_name })
            : t("aiVisibility.actions.task.unassigned", "Not assigned")}
          {action.task_due_date ? (
            <span className={cn(overdue && "font-medium text-overdue")}>
              {" · "}
              {overdue
                ? t("aiVisibility.actions.task.overdue", "overdue since {{date}}", { date: formatDateShort(action.task_due_date) })
                : t("aiVisibility.actions.task.due", "due {{date}}", { date: formatDateShort(action.task_due_date) })}
            </span>
          ) : null}
        </span>
      </span>
      <span className="shrink-0 text-[12.5px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4">
        {t("aiVisibility.actions.task.open", "Open task")}
      </span>
    </button>
  );
}

/** The numbers behind a recommendation, in a quiet line. */
function Evidence({ evidence }: { evidence: Record<string, unknown> }) {
  const { t } = useTranslation();
  const bits: string[] = [];
  const e = evidence as {
    domain?: string;
    gap_answers?: number;
    gap_competitors?: number;
    prompts?: string[];
    rivals?: string[];
    blocked_bots?: string[];
    competitor_domains?: Array<{ domain: string; answers_used: number }>;
    link?: string;
  };
  if (e.domain) bits.push(e.domain);
  if (e.gap_answers) bits.push(t("aiVisibility.actions.ev.gap", "{{n}} answers named a competitor, not you", { n: e.gap_answers }));
  if (e.rivals?.length) bits.push(t("aiVisibility.actions.ev.rivals", "named instead: {{names}}", { names: e.rivals.slice(0, 4).join(", ") }));
  if (e.blocked_bots?.length) bits.push(t("aiVisibility.actions.ev.blocked", "blocked: {{bots}}", { bots: e.blocked_bots.join(", ") }));
  if (e.competitor_domains?.length) bits.push(e.competitor_domains.map((d) => d.domain).join(", "));
  if (!bits.length && !e.prompts?.length && !e.link) return null;
  return (
    <div className="mt-3 space-y-1.5 border-t border-dashed border-border pt-3 text-[12.5px] text-muted-foreground">
      {bits.length ? <p>{bits.join(" · ")}</p> : null}
      {e.link?.startsWith("/ai-visibility/") ? (
        <Link to={e.link} className="inline-block font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">
          {t("aiVisibility.actions.ev.openWebsite", "Open “Your website” — the details and ready-made suggestions are there")}
        </Link>
      ) : null}
      {e.prompts?.length ? (
        <ul className="space-y-0.5">
          {e.prompts.slice(0, 3).map((p) => (
            <li key={p} className="truncate">
              “{p}”
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The comparison to-do's own help: we write the page. The owner picks the
 * competitor, reads it, fills what we could not know, and publishes it
 * themselves — nothing goes online from here.
 */
function ComparisonDraftBlock({ action, canEdit }: { action: Action; canEdit: boolean }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateAiVisibility();
  const job = useAiVisibilityJob("comparison_draft");
  const writing = !!job && isActiveJob(job) && job.payload.action_id === action.id;
  const busyElsewhere = !!job && isActiveJob(job) && job.payload.action_id !== action.id;
  const names = useMemo(() => {
    const list = ((action.evidence as { competitor_domains?: Array<{ domain?: string; name?: string | null }> }).competitor_domains ?? [])
      .map((d) => d.name || d.domain || "")
      .filter(Boolean);
    return [...new Set(list)];
  }, [action.evidence]);
  const [pick, setPick] = useState<string>(action.draft?.competitor.name ?? names[0] ?? "");
  const [open, setOpen] = useState(false);
  const draft = action.draft;

  const write = async () => {
    try {
      await aiVisibilityApi.draftComparison(action.id, pick || null);
      setOpen(true);
      void invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.actions.draft.failed", "Could not start writing the page.")));
    }
  };

  if (!names.length) return null;

  const controls = canEdit ? (
    <div className="flex flex-wrap items-center gap-2">
      {names.length > 1 ? (
        <FilterSelect
          aria-label={t("aiVisibility.actions.draft.compareWith", "Compare with")}
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          disabled={writing}
        >
          {names.map((n) => (
            <option key={n} value={n}>
              {t("aiVisibility.actions.draft.vs", "You vs {{name}}", { name: n })}
            </option>
          ))}
        </FilterSelect>
      ) : null}
      <Button size="sm" variant={draft ? "ghost" : "outline"} onClick={write} disabled={writing || busyElsewhere}>
        {writing ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" /> : draft ? null : <Sparkles className="size-3.5" />}
        {writing
          ? t("aiVisibility.actions.draft.writing", "Writing the page…")
          : draft
            ? t("aiVisibility.actions.draft.again", "Write it again")
            : t("aiVisibility.actions.draft.write", "Write the page for me")}
      </Button>
    </div>
  ) : null;

  return (
    <div className="mt-4 rounded-lg border border-border bg-background/60 p-3.5">
      {!draft ? (
        <div className="space-y-2">
          <p className="text-[13px] leading-relaxed text-foreground/80">
            {t(
              "aiVisibility.actions.draft.offer",
              "We can write the page: a fair comparison from what you told us, both homepages and what the assistants said. Anything we can't confirm is left open for you. A few cents on your OpenRouter key.",
            )}
          </p>
          {controls}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="text-left text-[13.5px] font-semibold text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
            >
              {open
                ? t("aiVisibility.actions.draft.hide", "Hide the written page")
                : t("aiVisibility.actions.draft.show", "Read the written page — you vs {{name}}", { name: draft.competitor.name })}
            </button>
            {controls}
          </div>
          {open ? <DraftView draft={draft} /> : null}
        </div>
      )}
    </div>
  );
}

function draftAsText(d: ComparisonDraft): string {
  return [
    d.title,
    "",
    d.intro,
    "",
    ...d.table.map((r) => `${r.aspect}: ${r.you} | ${r.them}`),
    "",
    ...d.sections.flatMap((s) => [s.heading, s.body, ""]),
    ...d.faqs.flatMap((f) => [f.question, f.answer, ""]),
  ]
    .join("\n")
    .trim();
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function draftAsHtml(d: ComparisonDraft, you: string): string {
  const faqLd = d.faqs.length
    ? `\n<script type="application/ld+json">\n${JSON.stringify(
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: d.faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
        },
        null,
        2,
      )}\n</script>`
    : "";
  return [
    `<h1>${esc(d.title)}</h1>`,
    `<p>${esc(d.intro)}</p>`,
    d.table.length
      ? `<table>\n<thead><tr><th></th><th>${esc(you)}</th><th>${esc(d.competitor.name)}</th></tr></thead>\n<tbody>\n${d.table
          .map((r) => `<tr><th>${esc(r.aspect)}</th><td>${esc(r.you)}</td><td>${esc(r.them)}</td></tr>`)
          .join("\n")}\n</tbody>\n</table>`
      : "",
    ...d.sections.map((s) => `<h2>${esc(s.heading)}</h2>\n<p>${esc(s.body)}</p>`),
    d.faqs.length ? `<h2>FAQ</h2>\n${d.faqs.map((f) => `<h3>${esc(f.question)}</h3>\n<p>${esc(f.answer)}</p>`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n") + faqLd;
}

function DraftView({ draft }: { draft: ComparisonDraft }) {
  const { t } = useTranslation();
  const { state } = useAiVisibilityContext();
  const you = state.project.brand_name;
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      {draft.to_check.length ? (
        <div className="rounded-lg bg-marker-soft px-3.5 py-3">
          <p className="text-[13px] font-semibold text-marker-ink">{t("aiVisibility.actions.draft.toCheck", "Fill in before you publish")}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] leading-relaxed text-foreground/85">
            {draft.to_check.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <h4 className="title-display text-[18px] font-semibold leading-snug text-foreground">{draft.title}</h4>
      <p className="text-[14px] leading-relaxed text-foreground/85">{draft.intro}</p>
      {draft.table.length ? (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[420px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-3 font-medium" />
                <th className="py-2 pr-3 font-semibold text-foreground">{you}</th>
                <th className="py-2 font-semibold text-foreground">{draft.competitor.name}</th>
              </tr>
            </thead>
            <tbody>
              {draft.table.map((r, i) => (
                <tr key={i} className="border-b border-border/60 align-top">
                  <th className="py-2 pr-3 font-medium text-foreground">{r.aspect}</th>
                  <td className={cn("py-2 pr-3", r.you === "—" && "text-muted-foreground")}>{r.you}</td>
                  <td className={cn("py-2", r.them === "—" && "text-muted-foreground")}>{r.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {draft.sections.map((s, i) => (
        <div key={i}>
          <p className="text-[14px] font-semibold text-foreground">{s.heading}</p>
          <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-foreground/85">{s.body}</p>
        </div>
      ))}
      {draft.faqs.length ? (
        <dl className="space-y-2.5">
          {draft.faqs.map((f, i) => (
            <div key={i}>
              <dt className="text-[13.5px] font-semibold text-foreground">{f.question}</dt>
              <dd className="mt-0.5 text-[13.5px] leading-relaxed text-foreground/85">{f.answer}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="flex flex-wrap gap-x-2 border-t border-border pt-2">
        <CopyBlock text={draftAsText(draft)} label={t("aiVisibility.actions.draft.copyText", "Copy as text")} hideText />
        <CopyBlock text={draftAsHtml(draft, you)} label={t("aiVisibility.actions.draft.copyHtml", "Copy for your web person (HTML)")} hideText />
      </div>
      <p className="text-[12px] text-muted-foreground">
        {t("aiVisibility.actions.draft.honest", "Written {{when}} from what we know. Read it once before you publish — nothing goes online from here.", {
          when: formatRelativeTime(draft.generated_at),
        })}
      </p>
    </div>
  );
}
