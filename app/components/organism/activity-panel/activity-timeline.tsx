import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  StickyNote,
  CheckSquare,
  GitCommitHorizontal,
  Mail,
} from "lucide-react";
import { isToday, isYesterday } from "date-fns";
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
import { formatDate } from "~/lib/utils/format";
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

  // Group by day (items are already newest-first), Pipedrive-style.
  const groups: { key: string; label: string; items: Item[] }[] = [];
  for (const it of items) {
    const d = new Date(it.ts);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = {
        key,
        label: isToday(d)
          ? t("activity.today", { defaultValue: "Today" })
          : isYesterday(d)
            ? t("activity.yesterday", { defaultValue: "Yesterday" })
            : formatDate(d, "MMM d, yyyy"),
        items: [],
      };
      groups.push(g);
    }
    g.items.push(it);
  }

  return (
    <>
      <div>
        {groups.map((g) => (
          <div key={g.key} className="app-fade-up">
            <div className="mb-1.5 pl-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {g.label}
            </div>
            <div>
              {g.items.map((item, ii) => {
                const isLast = ii === g.items.length - 1;
                const m = MARKER[item.kind];
                return (
                  <div
                    key={item.id}
                    className="relative flex gap-3 pb-3 last:pb-1"
                  >
                    {/* rail marker */}
                    <div className="relative flex w-8 shrink-0 justify-center">
                      {!isLast && (
                        <span className="absolute left-1/2 top-8 -bottom-3 w-px -translate-x-1/2 bg-border" />
                      )}
                      <span
                        className={cn(
                          "z-10 flex size-8 items-center justify-center rounded-full ring-4 ring-background",
                          m.wrap,
                        )}
                      >
                        {m.icon}
                      </span>
                    </div>
                    {/* content */}
                    <div className="min-w-0 flex-1">
                      {item.kind === "email" && (
                        <EmailCard
                          message={item.email}
                          locale={i18n.language}
                        />
                      )}
                      {item.kind === "note" && (
                        <NoteRow note={item.note} time={itemTime(item)} />
                      )}
                      {item.kind === "task" && (
                        <TaskRow
                          task={item.task}
                          time={itemTime(item)}
                          canEdit={canEdit}
                          onToggle={(isDone) =>
                            toggleDone.mutate({ taskId: item.task.id, isDone })
                          }
                          onOpen={() => setOpenTaskId(item.task.id)}
                        />
                      )}
                      {item.kind === "event" && (
                        <EventRow
                          event={item.event}
                          time={itemTime(item)}
                          label={formatHistoryAction(item.event, t)}
                          userLabel={buildUserLabel(item.event, t)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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

/** Time-of-day shown on each row (day is in the group header). */
function itemTime(item: Item): string {
  return formatDate(new Date(item.ts), "p");
}

const MARKER: Record<Item["kind"], { wrap: string; icon: ReactNode }> = {
  note: {
    wrap: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
    icon: <StickyNote className="size-4" />,
  },
  task: {
    wrap: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
    icon: <CheckSquare className="size-4" />,
  },
  email: {
    wrap: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400",
    icon: <Mail className="size-4" />,
  },
  event: {
    wrap: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
    icon: <GitCommitHorizontal className="size-4" />,
  },
};

/** Small author chip + time; time can sit inline (events) or be omitted. */
function MetaLine({
  first,
  last,
  deleted,
  time,
  suffix,
}: {
  first: string | null;
  last: string | null;
  deleted?: boolean;
  time?: string;
  suffix?: ReactNode;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full text-[9px] font-bold",
          deleted ? "bg-muted/50 text-muted-foreground/60" : "bg-muted",
        )}
      >
        {initials(first, last)}
      </span>
      {suffix}
      {time && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span>{time}</span>
        </>
      )}
    </div>
  );
}

const CARD =
  "rounded-lg border border-border bg-card px-3.5 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-border/70";

function NoteRow({ note, time }: { note: Note; time: string }) {
  return (
    <div className={cn(CARD, "border-l-2 border-l-amber-400")}>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
        {note.content}
      </p>
      <MetaLine
        first={note.user_first_name}
        last={note.user_last_name}
        deleted={note.user_is_deleted}
        time={time}
        suffix={
          note.version > 1 ? (
            <span className="text-muted-foreground/60">edited</span>
          ) : null
        }
      />
    </div>
  );
}

function TaskRow({
  task,
  time,
  canEdit,
  onToggle,
  onOpen,
}: {
  task: Task;
  time: string;
  canEdit: boolean;
  onToggle: (isDone: boolean) => void;
  onOpen: () => void;
}) {
  const done = task.status === "done";
  return (
    <div className={CARD}>
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
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "break-words text-sm font-medium",
                done ? "text-muted-foreground line-through" : "text-foreground",
              )}
            >
              {task.title}
            </p>
            <time className="mt-0.5 shrink-0 text-[11px] text-muted-foreground">
              {time}
            </time>
          </div>
          {task.urgency && (
            <div className="mt-1.5">
              <TaskUrgencyBadge urgency={task.urgency} />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

/** Events are low-emphasis system lines (no card), Pipedrive-style. */
function EventRow({
  event,
  time,
  label,
  userLabel,
}: {
  event: LeadHistoryItem;
  time: string;
  label: string;
  userLabel: string;
}) {
  return (
    <div className="py-1">
      <p className="break-words text-sm text-foreground/90">{label}</p>
      <MetaLine
        first={event.user_first_name}
        last={event.user_last_name}
        deleted={event.user_is_deleted}
        time={time}
        suffix={
          <TooltipContainer tooltipContent={userLabel} showCopyButton={false}>
            <span className="cursor-help">{userLabel}</span>
          </TooltipContainer>
        }
      />
    </div>
  );
}
