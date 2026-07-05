import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { StickyNote, CheckSquare, GitCommitHorizontal } from "lucide-react";
import type { LeadHistoryItem } from "~/lib/api/leads";
import { updateTask, type Task } from "~/lib/api/tasks";
import type { Note } from "~/lib/api/notes";
import type { BccMessage } from "~/lib/api/bcc-logs";
import { EmailCard } from "~/components/organism/email-card";
import { TaskDetailModal } from "~/components/organism/tasks/task-detail-modal";
import { TaskUrgencyBadge } from "~/components/organism/tasks/task-urgency-badge";
import type { WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";
import {
  formatHistoryAction,
  buildUserLabel,
} from "~/components/organism/lead-detail-sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { Checkbox } from "~/components/ui/checkbox";
import { formatRelativeTime } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import TooltipContainer from "~/components/tooltip-container";
import {
  notesQuery,
  tasksQuery,
  emailsQuery,
  noteTs,
  taskTs,
  hasNotesTasksContext,
  type ActivityContext,
  type Variant,
} from "./shared";

type Item =
  | { kind: "note"; ts: number; id: string; note: Note }
  | { kind: "task"; ts: number; id: string; task: Task }
  | { kind: "email"; ts: number; id: string; email: BccMessage }
  | { kind: "event"; ts: number; id: string; event: LeadHistoryItem };

// Note/task CRUD is already shown as its own card, so drop those audit lines.
function isMeaningfulEvent(action: string): boolean {
  return !/^(note_|task_)/.test(action);
}

function initials(first: string | null, last: string | null): string {
  const f = first?.trim() ?? "";
  const l = last?.trim() ?? "";
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  return "·";
}

export function ActivityTimeline({
  ctx,
  variant,
  canEdit,
  workspaceMembers,
  history,
  historyLoading,
}: {
  ctx: ActivityContext;
  variant: Variant;
  canEdit: boolean;
  workspaceMembers: WorkspaceMemberItem[];
  history: LeadHistoryItem[];
  historyLoading: boolean;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const nq = notesQuery(ctx);
  const tq = tasksQuery(ctx);
  const eq = emailsQuery(ctx, variant);
  const enabledNT = hasNotesTasksContext(ctx);

  const notes = useQuery({
    queryKey: nq.key,
    queryFn: nq.fn,
    enabled: enabledNT,
  });
  const tasks = useQuery({
    queryKey: tq.key,
    queryFn: tq.fn,
    enabled: enabledNT,
  });
  const emails = useQuery({
    queryKey: eq.key,
    queryFn: eq.fn,
    enabled: !!eq.id,
  });

  const toggleDone = useMutation({
    mutationFn: ({ taskId, isDone }: { taskId: string; isDone: boolean }) =>
      updateTask(taskId, { status: isDone ? "done" : "todo" }),
    onMutate: async ({ taskId, isDone }) => {
      await queryClient.cancelQueries({ queryKey: tq.key });
      const prev = queryClient.getQueryData<Task[]>(tq.key);
      queryClient.setQueryData<Task[]>(tq.key, (old = []) =>
        old.map((x) =>
          x.id === taskId ? { ...x, status: isDone ? "done" : "todo" } : x,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, c) => {
      if (c?.prev) queryClient.setQueryData(tq.key, c.prev);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq.key });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (ctx.dealId) {
        queryClient.invalidateQueries({ queryKey: ["deal", ctx.dealId] });
        queryClient.invalidateQueries({
          queryKey: ["deal-history", ctx.dealId],
        });
      }
      if (ctx.contactId) {
        queryClient.invalidateQueries({ queryKey: ["contact", ctx.contactId] });
        queryClient.invalidateQueries({
          queryKey: ["contact-history", ctx.contactId],
        });
      }
      if (ctx.historyContactId) {
        queryClient.invalidateQueries({
          queryKey: ["contact-history", ctx.historyContactId],
        });
      }
    },
  });

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const n of notes.data ?? [])
      out.push({ kind: "note", ts: noteTs(n), id: `note-${n.id}`, note: n });
    for (const tk of tasks.data ?? [])
      out.push({ kind: "task", ts: taskTs(tk), id: `task-${tk.id}`, task: tk });
    for (const m of emails.data?.data ?? [])
      out.push({
        kind: "email",
        ts: new Date(m.sent_at ?? m.ingested_at).getTime(),
        id: `email-${m.id}`,
        email: m,
      });
    history.forEach((ev, i) => {
      if (!isMeaningfulEvent(ev.action)) return;
      out.push({
        kind: "event",
        ts: ev.created_at ? new Date(ev.created_at).getTime() : 0,
        id: `event-${i}`,
        event: ev,
      });
    });
    return out.sort((a, b) => b.ts - a.ts);
  }, [notes.data, tasks.data, emails.data, history]);

  const loading =
    (enabledNT && (notes.isLoading || tasks.isLoading)) ||
    (!!eq.id && emails.isLoading) ||
    historyLoading;

  if (loading && items.length === 0) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("activity.empty", { defaultValue: "No activity yet." })}
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2.5">
        {items.map((item, idx) => {
          const stagger = idx < 4 ? `app-fade-up-d${idx + 1}` : "";
          if (item.kind === "email") {
            return (
              <div key={item.id} className={cn("app-fade-up", stagger)}>
                <EmailCard message={item.email} locale={i18n.language} />
              </div>
            );
          }
          const label =
            item.kind === "note"
              ? t("activity.labelNote", { defaultValue: "Note" })
              : item.kind === "task"
                ? t("activity.labelTask", { defaultValue: "Task" })
                : t("activity.labelEvent", { defaultValue: "Update" });
          const time =
            item.kind === "note"
              ? formatRelativeTime(
                  item.note.version > 1
                    ? item.note.updated_at
                    : item.note.created_at,
                )
              : item.kind === "task"
                ? formatRelativeTime(item.task.created_at)
                : item.event.created_at
                  ? formatRelativeTime(item.event.created_at)
                  : "";
          return (
            <div key={item.id} className={cn("app-fade-up", stagger)}>
              <ActivityCard kind={item.kind} label={label} time={time}>
                {item.kind === "note" && <NoteBody note={item.note} />}
                {item.kind === "task" && (
                  <TaskBody
                    task={item.task}
                    canEdit={canEdit}
                    onToggle={(isDone) =>
                      toggleDone.mutate({ taskId: item.task.id, isDone })
                    }
                    onOpen={() => setOpenTaskId(item.task.id)}
                  />
                )}
                {item.kind === "event" && (
                  <EventBody
                    event={item.event}
                    label={formatHistoryAction(item.event, t)}
                    userLabel={buildUserLabel(item.event, t)}
                  />
                )}
              </ActivityCard>
            </div>
          );
        })}
      </div>

      <TaskDetailModal
        open={!!openTaskId}
        onOpenChange={(o) => !o && setOpenTaskId(null)}
        taskId={openTaskId}
        workspaceMembers={workspaceMembers}
        canEdit={canEdit}
        historyContactId={ctx.historyContactId}
      />
    </>
  );
}

const KIND_STYLE = {
  note: {
    card: "border-amber-300/60 bg-amber-50/70 dark:border-amber-500/25 dark:bg-amber-500/[0.07]",
    chip: "bg-amber-400/25 text-amber-700 dark:text-amber-300",
    Icon: StickyNote,
  },
  task: {
    card: "border-sky-300/60 bg-sky-50/70 dark:border-sky-500/25 dark:bg-sky-500/[0.07]",
    chip: "bg-sky-400/25 text-sky-700 dark:text-sky-300",
    Icon: CheckSquare,
  },
  event: {
    card: "border-violet-300/55 bg-violet-50/70 dark:border-violet-500/25 dark:bg-violet-500/[0.07]",
    chip: "bg-violet-400/25 text-violet-700 dark:text-violet-300",
    Icon: GitCommitHorizontal,
  },
} as const;

/** Uniform tinted card (note=amber, task=blue, event=violet) with a type chip + time. */
function ActivityCard({
  kind,
  label,
  time,
  children,
}: {
  kind: "note" | "task" | "event";
  label: string;
  time: string;
  children: ReactNode;
}) {
  const s = KIND_STYLE[kind];
  const Icon = s.Icon;
  return (
    <div className={cn("rounded-xl border p-3.5 transition-colors", s.card)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            s.chip,
          )}
        >
          <Icon className="size-3" />
          {label}
        </span>
        <time className="shrink-0 text-[11px] font-medium text-muted-foreground">
          {time}
        </time>
      </div>
      {children}
    </div>
  );
}

function AuthorLine({
  first,
  last,
  deleted,
  suffix,
}: {
  first: string | null;
  last: string | null;
  deleted?: boolean;
  suffix?: ReactNode;
}) {
  return (
    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full text-[9px] font-bold",
          deleted ? "bg-muted/50 text-muted-foreground/60" : "bg-background/60",
        )}
      >
        {initials(first, last)}
      </span>
      {suffix}
    </div>
  );
}

function NoteBody({ note }: { note: Note }) {
  return (
    <>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
        {note.content}
      </p>
      <AuthorLine
        first={note.user_first_name}
        last={note.user_last_name}
        deleted={note.user_is_deleted}
        suffix={
          note.version > 1 ? (
            <span className="text-muted-foreground/60">edited</span>
          ) : null
        }
      />
    </>
  );
}

function TaskBody({
  task,
  canEdit,
  onToggle,
  onOpen,
}: {
  task: Task;
  canEdit: boolean;
  onToggle: (isDone: boolean) => void;
  onOpen: () => void;
}) {
  const done = task.status === "done";
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox
        checked={done}
        disabled={!canEdit}
        onCheckedChange={(v) => onToggle(!!v)}
        className="mt-0.5 border-sky-500/50 data-[state=checked]:border-sky-600 data-[state=checked]:bg-sky-600"
        aria-label={task.title}
      />
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={cn(
            "break-words text-sm font-medium",
            done ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {task.title}
        </p>
        {task.urgency && (
          <div className="mt-1">
            <TaskUrgencyBadge urgency={task.urgency} />
          </div>
        )}
      </button>
    </div>
  );
}

function EventBody({
  event,
  label,
  userLabel,
}: {
  event: LeadHistoryItem;
  label: string;
  userLabel: string;
}) {
  return (
    <>
      <p className="break-words text-sm text-foreground">{label}</p>
      <AuthorLine
        first={event.user_first_name}
        last={event.user_last_name}
        deleted={event.user_is_deleted}
        suffix={
          <TooltipContainer tooltipContent={userLabel} showCopyButton={false}>
            <span className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
              {userLabel}
            </span>
          </TooltipContainer>
        }
      />
    </>
  );
}
