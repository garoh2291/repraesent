import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  Bot,
  Check,
  CircleDashed,
  Inbox,
  MoreHorizontal,
  X,
} from "lucide-react";
import i18n from "~/i18n";
import { cn } from "~/lib/utils";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useToday, useInvalidateWork, useUpdateSetup } from "~/lib/hooks/useToday";
import { useResultsSummary } from "~/lib/hooks/useResultsSummary";
import { usePilotFeatures } from "~/lib/feature-flags";
import { updateTask } from "~/lib/api/tasks";
import { completeOnboarding } from "~/lib/api/auth";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import type {
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
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { ContactActions } from "~/components/notebook/contact-actions";
import { NextStepChip } from "~/components/notebook/next-step-chip";
import { OutcomeBadge, useLeadFlow, type FlowLead } from "~/components/notebook/lead-flow";
import { useDealFlow } from "~/components/notebook/deal-flow";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Skeleton } from "~/components/ui/skeleton";

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
  return (
    <li className="group flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
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
}: {
  seeAllHref?: string;
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
      <PanelHeader title={title} count={count} marker />
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
          "press flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
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
                {[d.contact_name, d.value ? formatCurrency(Number(d.value), d.currency ?? "EUR") : null]
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
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
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
                className="p-1 opacity-100 transition-opacity focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
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
    <PageContainer className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Greeting firstName={firstName} count={waiting} loading={!data} />
        <div
          role="tablist"
          aria-label={t("today.scope", "Whose work")}
          className="inline-flex self-start rounded-lg border border-border bg-card p-0.5 sm:self-auto"
        >
          {(["me", "all"] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={scope === s}
              onClick={() => setScope(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                scope === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "me" ? t("today.mine", "Mine") : t("today.everyone", "Everyone")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-6">
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
              <NoNextStep
                deals={data.deals_no_next_step ?? []}
                total={counts?.deals_no_next_step ?? 0}
              />
              <ChatGaps items={data.unanswered ?? []} />
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
  );
}
