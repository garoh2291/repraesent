import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { LoadError } from "~/components/notebook/load-error";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  Bot,
  Check,
  CircleDashed,
  Inbox,
  MoreHorizontal,
  ListChecks,
  X,
} from "lucide-react";
import i18n from "~/i18n";
import { cn } from "~/lib/utils";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { CALL_QUEUE_LIMIT, useToday, useInvalidateWork, useUpdateSetup } from "~/lib/hooks/useToday";
import { LEAD_OUTCOME_MUTATION_KEY } from "~/lib/hooks/useLeadOutcome";
import { useResultsSummary } from "~/lib/hooks/useResultsSummary";
import { usePilotFeatures } from "~/lib/feature-flags";
import { updateTask } from "~/lib/api/tasks";
import { completeOnboarding } from "~/lib/api/auth";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import type {
  TodayAiAlert,
  SetupItemKey,
  SetupState,
  TodayDeal,
  TodayLead,
  TodayTask,
} from "~/lib/api/today";
import { leadSourceLabel, waitingFor } from "~/lib/leads/source-label";
import { formatCurrency, formatNumber } from "~/lib/utils/format";
import { DoorboostHomeSection } from "~/components/doorboost-home-section";
import { IntroCallCard } from "~/components/onboarding-v2/intro-call-card";
import { PageContainer } from "~/components/notebook/page-header";
import { Segmented } from "~/components/notebook/segmented";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { ContactActions } from "~/components/notebook/contact-actions";
import { NextStepChip } from "~/components/notebook/next-step-chip";
import { OutcomeBadge, useLeadFlow, type FlowLead } from "~/components/notebook/lead-flow";
import { useDealFlow } from "~/components/notebook/deal-flow";
import { ReviewsToAsk } from "~/components/notebook/review-today";
import { InstallCard } from "~/components/notebook/install-card";
import { AlertsAskCard } from "~/components/notebook/alerts-ask-card";
import { useQuickCreate } from "~/components/notebook/quick-create";
import { useOpenFromParam } from "~/lib/hooks/useOpenFromParam";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Skeleton } from "~/components/ui/skeleton";
import { TodayAppointments } from "~/components/appointment-book/appointments-card";

export function meta() {
  return [
    { title: i18n.t("today.metaTitle", "Today") + " - Repraesent" },
    { name: "description", content: i18n.t("home.metaDescription") },
  ];
}

/** Rows shown per list before "See all" — Today is a to-do list, not a table. */
const VISIBLE_ROWS = 8;

function toFlowLead(l: TodayLead): FlowLead {
  return { id: l.id, name: l.name, status: l.status, phone: l.phone, email: l.email };
}

// ─── Row exit after an outcome ──────────────────────────────────────────────

/**
 * Inquiries whose outcome was just saved (MOBILE_PACKAGE_PLAN.md A4): their
 * row fades and collapses instead of vanishing when the refetch lands. The
 * save itself lives in the lead flow; Today only watches it. A mark is
 * dropped on error, or once fresh Today data has arrived after the save (so
 * an Undo brings the row back).
 */
function useLeavingLeads(dataVersion: unknown): Set<string> {
  const qc = useQueryClient();
  const [leaving, setLeaving] = useState<Map<string, "pending" | "settled">>(() => new Map());
  useEffect(() => {
    return qc.getMutationCache().subscribe((event) => {
      if (event.type !== "updated") return;
      const m = event.mutation;
      if (m.options.mutationKey?.[0] !== LEAD_OUTCOME_MUTATION_KEY[0]) return;
      const leadId = (m.state.variables as { leadId?: string } | undefined)?.leadId;
      if (!leadId) return;
      const status = event.action.type;
      if (status === "pending") {
        // The one haptic: a saved outcome (Android; iOS ignores it).
        if (typeof navigator !== "undefined") navigator.vibrate?.(8);
        setLeaving((prev) => new Map(prev).set(leadId, "pending"));
      } else if (status === "success") {
        setLeaving((prev) => (prev.has(leadId) ? new Map(prev).set(leadId, "settled") : prev));
      } else if (status === "error") {
        setLeaving((prev) => {
          if (!prev.has(leadId)) return prev;
          const next = new Map(prev);
          next.delete(leadId);
          return next;
        });
      }
    });
  }, [qc]);
  // New Today data after the save: the row is gone (or back, after Undo).
  useEffect(() => {
    setLeaving((prev) => {
      if (![...prev.values()].includes("settled")) return prev;
      const next = new Map(prev);
      for (const [id, st] of prev) if (st === "settled") next.delete(id);
      return next;
    });
  }, [dataVersion]);
  return new Set(leaving.keys());
}

const LeavingContext = createContext<Set<string>>(new Set());

// ─── Needs you ──────────────────────────────────────────────────────────────

function LeadRow({
  lead,
  task,
}: {
  lead: TodayLead;
  /** Set for a "no answer" follow-up. */
  task?: TodayTask;
}) {
  const { t, i18n: i } = useTranslation();
  const navigate = useNavigate();
  const flow = useLeadFlow();
  const fl = toFlowLead(lead);
  const leaving = useContext(LeavingContext).has(lead.id);
  return (
    <li className="app-row-exit" data-leaving={leaving || undefined} aria-hidden={leaving || undefined}>
    <div className="group flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <button
        type="button"
        onClick={() => navigate(`/lead-form/${lead.id}`)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-[15px] font-semibold text-foreground group-hover:underline group-hover:decoration-foreground/30 group-hover:underline-offset-4">
          {lead.name || lead.email || lead.phone || t("today.unnamed", "Someone")}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
          <span>{leadSourceLabel(lead, t)}</span>
          <span aria-hidden>·</span>
          {task ? (
            <span className={cn(task.urgency === "overdue" && "font-medium text-overdue")}>
              {t("today.callAgainDue", "Call again")}
            </span>
          ) : (
            <span
              className={cn(
                "num",
                Date.now() - new Date(lead.created_at).getTime() > 86_400_000 &&
                  "marker font-medium text-foreground",
              )}
            >
              {t("today.waiting", "waiting {{time}}", { time: waitingFor(lead.created_at, i.language) })}
            </span>
          )}
          {task || lead.attempts ? (
            <OutcomeBadge outcome={task ? "no_answer" : null} attempts={lead.attempts} />
          ) : null}
        </p>
      </button>
      <div className="flex items-center gap-1.5">
        <ContactActions
          target={{ phone: lead.phone, email: lead.email }}
          onContact={(ch) => flow.contact(fl, ch)}
          size="sm"
          emailInApp={flow.emailInApp}
        />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("today.more", "More")}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem onSelect={() => flow.recordOutcome(fl)}>
              {t("today.recordOutcome", "Record how it went")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => flow.makeDeal(fl)}>
              {t("makeDeal.cta", "Make a deal")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/lead-form/${lead.id}`)}>
              {t("today.open", "Open")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    </li>
  );
}

function NeedsYou({
  leads,
  followUps,
  total,
  title,
  emptyTitle,
  emptyBody,
  seeAllHref = "/lead-form",
  callsCount = 0,
}: {
  seeAllHref?: string;
  /** People to call now (new + call-backs due): shows "Start calls (N)". */
  callsCount?: number;
  leads: TodayLead[];
  followUps: { lead: TodayLead; task: TodayTask }[];
  total: number;
  title: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  const { t } = useTranslation();
  const count = total + followUps.length;
  return (
    <Panel>
      <PanelHeader
        title={title}
        count={count}
        marker
        action={
          callsCount > 0 ? (
            // Phones only: one person at a time, by call, WhatsApp or email.
            <Link
              to="/calls"
              className="press inline-flex shrink-0 items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1.5 text-[12.5px] font-medium text-background hover:bg-foreground/90 pointer-coarse:min-h-11 pointer-coarse:px-3.5 pointer-coarse:text-[13.5px] sm:hidden"
            >
              <ListChecks className="size-3.5" aria-hidden />
              {t("mobile.today.goThroughList", "Go through the list ({{count}})", { count: callsCount })}
            </Link>
          ) : undefined
        }
      />
      {count === 0 ? (
        <EmptyState compact icon={<Check />} title={emptyTitle} body={emptyBody} />
      ) : (
        <>
          {followUps.length > 0 ? (
            <>
              <p className="border-b border-border bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:px-5">
                {t("today.callAgainToday", "Call again today")}
              </p>
              <ul className="divide-y divide-border border-b border-border">
                {followUps.slice(0, VISIBLE_ROWS).map((f) => (
                  <LeadRow key={`f-${f.task.id}`} lead={f.lead} task={f.task} />
                ))}
              </ul>
            </>
          ) : null}
          <ul className="divide-y divide-border">
            {leads.slice(0, Math.max(0, VISIBLE_ROWS - followUps.length)).map((l) => (
              <LeadRow key={l.id} lead={l} />
            ))}
          </ul>
          {count > VISIBLE_ROWS ? (
            <Link
              to={seeAllHref}
              className="flex items-center justify-center gap-1.5 border-t border-border px-4 py-3 text-[13px] font-medium text-foreground hover:bg-accent/50"
            >
              {t("today.seeAllCount", "See all {{count}}", { count })}
              <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </>
      )}
    </Panel>
  );
}

// ─── Due today ──────────────────────────────────────────────────────────────

function entityHref(task: TodayTask) {
  if (task.entity_table === "deals") return `/pipeline/${task.entity_id}`;
  if (task.entity_table === "contacts") return `/contacts/${task.entity_id}`;
  if (task.entity_table === "leads") return `/lead-form/${task.entity_id}`;
  if (task.entity_table === "ai_visibility_actions") return `/ai-visibility/actions#${task.entity_id}`;
  return `/tasks?task_id=${task.id}`;
}

function TaskRow({ task }: { task: TodayTask }) {
  const { t, i18n: i } = useTranslation();
  const invalidate = useInvalidateWork();
  const dealFlow = useDealFlow();
  const [done, setDone] = useState(false);
  const mutation = useMutation({
    mutationFn: () => updateTask(task.id, { status: "done" }),
    onSuccess: () => {
      invalidate();
      if (
        task.entity_table === "deals" &&
        task.deal_open_tasks === 1 &&
        task.deal_is_open !== false
      ) {
        dealFlow.whatsNext({ id: task.entity_id, title: task.entity_label }, "completed");
      } else {
        toast.success(t("today.taskDone", "Done"));
      }
    },
    onError: (err) => {
      setDone(false);
      toast.error(extractErrorMessage(err) || t("common.error", "Something went wrong"));
    },
  });
  const overdue = task.urgency === "overdue";
  const due = task.due_date ? new Date(task.due_date) : null;
  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={t("today.markDone", "Mark done")}
        disabled={mutation.isPending || done}
        onClick={() => {
          setDone(true);
          mutation.mutate();
        }}
        className={cn(
          "press relative flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5",
          done ? "border-foreground bg-foreground text-background" : "border-foreground/25 hover:border-foreground",
        )}
      >
        {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </button>
      <Link to={entityHref(task)} className="min-w-0 flex-1">
        <p className={cn("truncate text-[14.5px] font-medium", done ? "text-muted-foreground line-through" : "text-foreground")}>
          {task.title}
        </p>
        <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
          {task.entity_label ? `${task.entity_label} · ` : ""}
          <span className={cn("num", overdue && "font-medium text-overdue")}>
            {overdue
              ? t("today.overdueSince", "overdue since {{date}}", {
                  date: due?.toLocaleDateString(i.language, { day: "numeric", month: "short" }),
                })
              : due && (due.getHours() !== 0 || due.getMinutes() !== 0)
                ? due.toLocaleTimeString(i.language, { hour: "2-digit", minute: "2-digit" })
                : t("nextStep.today", "today")}
          </span>
        </p>
      </Link>
    </li>
  );
}

function DueToday({
  tasks,
  total,
  overdue,
}: {
  tasks: TodayTask[];
  total: number;
  overdue: number;
}) {
  const { t } = useTranslation();
  return (
    <Panel>
      <PanelHeader
        title={t("today.dueTitle", "Due today")}
        count={total}
        marker={overdue > 0}
        hint={overdue ? t("today.overdueHint", "{{count}} overdue", { count: overdue }) : undefined}
        action={
          <Link
            to="/tasks"
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
          >
            {t("today.allTasks", "All tasks")}
            <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      {tasks.length === 0 ? (
        <EmptyState compact icon={<Check />} title={t("today.noTasks", "Nothing due today.")} />
      ) : (
        <ul className="divide-y divide-border">
          {tasks.slice(0, VISIBLE_ROWS).map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ─── Deals without a next step ─────────────────────────────────────────────

function NoNextStep({ deals, total }: { deals: TodayDeal[]; total: number }) {
  const { t } = useTranslation();
  const dealFlow = useDealFlow();
  if (total === 0) return null;
  return (
    <Panel>
      <PanelHeader title={t("today.noNextTitle", "Deals with no next step")} count={total} marker />
      <ul className="divide-y divide-border">
        {deals.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <Link to={`/pipeline/${d.id}`} className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-medium text-foreground">
                {d.title || d.contact_name || t("today.untitledDeal", "Deal")}
              </p>
              <p className="truncate text-[12.5px] text-muted-foreground">
                {[d.title ? d.contact_name : null, d.contact_company, d.value ? formatCurrency(Number(d.value), d.currency ?? "EUR") : null]
                  .filter(Boolean)
                  .join(" · ") || " "}
              </p>
            </Link>
            <NextStepChip
              summary={{ open_count: 0, nearest_due_date: null, nearest_urgency: null, nearest_title: null }}
              onAdd={() => dealFlow.whatsNext({ id: d.id, title: d.title || d.contact_name })}
            />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ─── Website chat ───────────────────────────────────────────────────────────

function ChatGaps({
  items,
}: {
  items: { assistant_id: string; name: string; total_unanswered: number }[];
}) {
  const { t } = useTranslation();
  const pilot = usePilotFeatures();
  if (!pilot.aiAssistant || items.length === 0) return null;
  return (
    <Panel>
      <PanelHeader title={t("today.chatTitle", "Your website chat")} />
      <ul className="divide-y divide-border">
        {items.map((a) => (
          <li key={a.assistant_id}>
            <Link
              to={`/ai-assistants/${a.assistant_id}?tab=knowledge`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 sm:px-5"
            >
              <Bot className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 text-[14px] text-foreground">
                {t("today.unanswered", "{{count}} questions it couldn't answer this week", {
                  count: a.total_unanswered,
                })}
                <span className="text-muted-foreground"> · {a.name}</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ─── AI visibility: only when something needs the owner ─────────────────────

function AiVisibilityAlert({ alert }: { alert: TodayAiAlert }) {
  const { t } = useTranslation();
  const link =
    alert.reason === "cap"
      ? { to: "/ai-visibility/plan", label: t("today.ai.changeLimit", "Change the limit") }
      : alert.reason === "key"
        ? { to: "/settings/ai", label: t("today.ai.reconnect", "Connect it again") }
        : alert.reason === "wrong_fact"
          ? { to: "/ai-visibility", label: t("today.ai.seeWrong", "See what they said") }
          : { to: "/ai-visibility/actions", label: t("today.ai.whatToDo", "See what to do") };
  return (
    <Panel>
      <PanelHeader title={t("today.ai.title", "What AI assistants say about you")} marker />
      <div className="space-y-2 px-4 py-4 sm:px-5">
        {alert.reason === "wrong_fact" ? (
          <p className="text-[14px] text-foreground">
            {t("today.ai.wrongFact", "{{count}} AI answers said something wrong about your business this week.", {
              count: alert.wrong_facts ?? 1,
            })}
          </p>
        ) : alert.reason === "dropped" ? (
          <>
            <p className="text-[14px] text-foreground">
              {t("today.ai.dropped", "AI assistants named you in {{named}} of {{answers}} answers this week, down from {{prevNamed}} of {{prevAnswers}}.", {
                named: formatNumber(alert.named),
                answers: formatNumber(alert.answers),
                prevNamed: formatNumber(alert.prev_named),
                prevAnswers: formatNumber(alert.prev_answers),
              })}
            </p>
            {alert.ahead ? (
              <p className="text-[13px] text-muted-foreground">
                {t("today.ai.ahead", "{{name}} was named more often.", { name: alert.ahead })}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[14px] text-foreground">
            {alert.reason === "cap"
              ? t("today.ai.cap", "AI checks are paused: this month's spending limit is reached. They start again on the 1st.")
              : t("today.ai.key", "AI checks are paused: your OpenRouter key stopped working.")}
          </p>
        )}
        <Link
          to={link.to}
          className="inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4 sm:min-h-0"
        >
          {link.label}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Panel>
  );
}

// ─── Right rail ─────────────────────────────────────────────────────────────

function ThisMonth() {
  const { t } = useTranslation();
  const q = useResultsSummary("30d");
  const data = q.data && q.data.supported ? q.data : null;

  return (
    <Panel>
      <PanelHeader
        title={t("today.thisMonth", "Last 30 days")}
        action={
          <Link
            to="/results"
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
          >
            {t("today.results", "Results")}
            <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-4 p-5">
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-12" />
          ))}
        </div>
      ) : data ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-5">
          {[
            { k: "saw", v: data.funnel.people_saw, label: t("results.saw", "saw you") },
            { k: "contacted", v: data.funnel.contacted, label: t("results.contacted", "contacted you") },
            { k: "customers", v: data.funnel.new_customers, label: t("results.customers", "new customers") },
            {
              k: "earned",
              v: data.funnel.earned,
              label: t("results.earned", "earned"),
              money: true,
            },
          ].map((s) => (
            <div key={s.k} className="min-w-0">
              <dt className="sr-only">{s.label}</dt>
              <dd
                className={cn(
                  "title-display num truncate text-[24px] font-semibold",
                  s.money && s.v ? "text-earned" : "text-foreground",
                )}
              >
                {s.v == null ? "—" : s.money ? formatCurrency(s.v, data.currency) : formatNumber(s.v)}
              </dd>
              <p className="text-[12.5px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </dl>
      ) : (
        <p className="p-5 text-[13px] text-muted-foreground">—</p>
      )}
    </Panel>
  );
}

const SETUP_TARGET: Record<SetupItemKey, string> = {
  email: "/settings/email-accounts",
  form: "/forms",
  website: "/settings/business-profile",
  assistant: "/ai-assistants",
  teammate: "/settings/team",
  calendar: "/settings/calendars",
  profile: "/settings/business-profile",
};

function GetSetUp({ setup }: { setup: SetupState }) {
  const { t } = useTranslation();
  const pilot = usePilotFeatures();
  const update = useUpdateSetup();
  if (setup.dismissed_at) return null;
  const items = setup.items.filter(
    (i) =>
      !setup.dismissed_items.includes(i.key) &&
      (i.key !== "assistant" || pilot.aiAssistant),
  );
  const done = items.filter((i) => i.done).length;
  if (items.length === 0 || done === items.length) return null;
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-border bg-marker-soft/60 px-4 py-3.5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">{t("setup.title", "Get set up")}</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {t("setup.progress", "{{done}} of {{total}} done", { done, total: items.length })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => update.mutate({ dismiss_all: true })}
            className="relative text-[12px] font-medium text-muted-foreground hover:text-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-x-2 pointer-coarse:after:-inset-y-3.5"
          >
            {t("setup.hide", "Hide")}
          </button>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-500"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </div>
      </div>
      <ul className="divide-y divide-border">
        {items.map((i) => (
          <li key={i.key} className="group flex items-center gap-3 px-4 py-2.5 sm:px-5">
            {i.done ? (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                <Check className="size-3" strokeWidth={3} />
              </span>
            ) : (
              <CircleDashed className="size-5 shrink-0 text-foreground/35" />
            )}
            {i.done ? (
              <span className="flex-1 text-[13.5px] text-muted-foreground line-through">
                {t(`setup.items.${i.key}`)}
              </span>
            ) : (
              <Link to={SETUP_TARGET[i.key]} className="flex-1 text-[13.5px] font-medium text-foreground hover:underline hover:underline-offset-4">
                {t(`setup.items.${i.key}`)}
              </Link>
            )}
            {!i.done ? (
              <button
                type="button"
                onClick={() => update.mutate({ dismiss: [i.key] })}
                className="relative p-1 opacity-100 transition-opacity focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 pointer-coarse:after:absolute pointer-coarse:after:-inset-3"
                aria-label={t("setup.skip", "Skip")}
              >
                <X className="size-3.5 text-muted-foreground" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

function Greeting({
  firstName,
  count,
  loading,
}: {
  firstName: string;
  count: number;
  loading: boolean;
}) {
  const { t, i18n: i } = useTranslation();
  const [date] = useState(() => new Date());
  return (
    <div className="space-y-1.5">
      <p className="text-[12.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {date.toLocaleDateString(i.language, { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <h1 className="title-display text-[28px] font-semibold text-foreground sm:text-[36px]">
        {loading ? (
          t("today.hello", "Hello{{name}}.", { name: firstName ? `, ${firstName}` : "" })
        ) : count > 0 ? (
          <>
            <span className="marker">{t("today.waitingCount", { count })}</span>{" "}
            {t("today.waitingTail", "on you.")}
          </>
        ) : (
          t("today.allClear", "All clear{{name}}.", { name: firstName ? `, ${firstName}` : "" })
        )}
      </h1>
    </div>
  );
}

export default function Today() {
  const { user, currentWorkspace } = useAuthContext();
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "today.metaTitle",
    descriptionKey: "home.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const [scope, setScope] = useState<"me" | "all">("me");
  const q = useToday(scope);
  const qc = useQueryClient();
  const leaving = useLeavingLeads(q.dataUpdatedAt);
  // Home-screen shortcut "New inquiry" (manifest): /?new=lead.
  const quickCreate = useQuickCreate();
  useOpenFromParam(() => quickCreate.open("lead"), "new", "lead");

  // The retired first-run tour used to stamp onboarding_completed_at; other
  // screens still gate on it (e.g. the Forms intro). Today replaces the tour,
  // so reaching it counts as the tour being done.
  const stamped = useRef(false);
  useEffect(() => {
    if (
      stamped.current ||
      !user ||
      user.onboarding_completed_at != null ||
      currentWorkspace?.status !== "active" ||
      currentWorkspace?.type === "doorboost_brand"
    ) {
      return;
    }
    stamped.current = true;
    void completeOnboarding()
      .then(() => qc.invalidateQueries({ queryKey: ["auth"] }))
      .catch(() => undefined);
  }, [user, currentWorkspace?.status, currentWorkspace?.type, qc]);
  const firstName = (user?.first_name ?? "").trim().split(" ")[0] ?? "";
  const data = q.data && q.data.supported ? q.data : null;

  // Installed app: the icon's badge shows how many people are waiting, the
  // same number the alerts set — cleared here once nobody is.
  const badgeCount = data?.counts
    ? data.counts.new_leads + data.counts.follow_ups_due + (data.counts.signups ?? 0)
    : null;
  useEffect(() => {
    if (badgeCount === null || typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
    const nav = navigator as Navigator & {
      setAppBadge: (n?: number) => Promise<void>;
      clearAppBadge: () => Promise<void>;
    };
    (badgeCount > 0 ? nav.setAppBadge(badgeCount) : nav.clearAppBadge()).catch(() => undefined);
  }, [badgeCount]);

  // Brand (DoorBoost) workspaces keep their own dashboard content.
  if (q.data && !q.data.supported) {
    return (
      <PageContainer className="space-y-6">
        <Greeting firstName={firstName} count={0} loading />
        <DoorboostHomeSection />
      </PageContainer>
    );
  }

  const counts = data?.counts;
  // People waiting — tasks are not people, they get their own panel.
  const needs = counts
    ? counts.new_leads + counts.follow_ups_due + (counts.signups ?? 0)
    : 0;
  const waiting = needs;
  const isRoot = data?.is_root === true;

  const isEmptyAccount =
    !!data &&
    needs === 0 &&
    (data.tasks?.length ?? 0) === 0 &&
    counts?.deals_no_next_step === 0;

  return (
    <LeavingContext.Provider value={leaving}>
    <PageContainer className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Greeting firstName={firstName} count={waiting} loading={!data} />
        <Segmented
          role="tablist"
          label={t("today.scope", "Whose work")}
          value={scope}
          onChange={setScope}
          stretch
          className="self-start sm:self-auto"
          options={[
            { value: "me", label: t("today.mine", "Mine") },
            { value: "all", label: t("today.everyone", "Everyone") },
          ]}
        />
      </div>

      {/* Phones only (each card decides): install first, then the alerts ask. */}
      <InstallCard />
      <AlertsAskCard />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-6">
          {!data && q.isError ? (
            <LoadError what={t("errors.what.today", "what needs you today")} onRetry={() => void q.refetch()} />
          ) : null}
          {!data && !q.isError ? (
            <Panel className="space-y-3 p-5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </Panel>
          ) : data ? (
            <>
              {isRoot && data.signups ? (
                <NeedsYou
                  title={t("today.signupsTitle", "New signups to call")}
                  leads={data.signups}
                  followUps={[]}
                  total={counts?.signups ?? data.signups.length}
                  emptyTitle={t("today.noSignups", "No new signups waiting.")}
                  emptyBody=""
                />
              ) : null}
              <NeedsYou
                title={t("today.needsYou", "Needs you")}
                leads={data.new_leads ?? []}
                followUps={data.follow_ups ?? []}
                total={counts?.new_leads ?? 0}
                // The queue works through at most CALL_QUEUE_LIMIT people per run; the button says the same.
                callsCount={Math.min(CALL_QUEUE_LIMIT, (counts?.new_leads ?? 0) + (counts?.follow_ups_due ?? 0))}
                emptyTitle={
                  isEmptyAccount
                    ? t("today.emptyTitle", "When someone reaches out, they show up here.")
                    : t("today.noNew", "Nobody is waiting on you.")
                }
                emptyBody={
                  isEmptyAccount
                    ? t(
                        "today.emptyBody",
                        "A form on your website, a chat, a booking or an ad — every new inquiry lands here with one tap to call them back.",
                      )
                    : t("today.noNewBody", "New inquiries will appear here as they come in.")
                }
              />
              <DueToday
                tasks={data.tasks ?? []}
                total={(counts?.tasks_overdue ?? 0) + (counts?.tasks_due_today ?? 0)}
                overdue={counts?.tasks_overdue ?? 0}
              />
              <TodayAppointments />
              <NoNextStep
                deals={data.deals_no_next_step ?? []}
                total={counts?.deals_no_next_step ?? 0}
              />
              <ReviewsToAsk />
              <ChatGaps items={data.unanswered ?? []} />
              {data.ai_visibility ? <AiVisibilityAlert alert={data.ai_visibility} /> : null}
            </>
          ) : (
            <Panel>
              <EmptyState
                icon={<Inbox />}
                title={t("today.loadFailed", "Today could not load.")}
                action={
                  <Button variant="outline" onClick={() => void q.refetch()}>
                    {t("common.retry", "Try again")}
                  </Button>
                }
              />
            </Panel>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
          {data?.setup ? <GetSetUp setup={data.setup} /> : null}
          <IntroCallCard />
          <ThisMonth />
          {currentWorkspace ? <DoorboostHomeSection /> : null}
        </aside>
      </div>
    </PageContainer>
    </LeavingContext.Provider>
  );
}
