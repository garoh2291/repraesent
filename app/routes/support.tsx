import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { ArrowUp, Check, ChevronLeft, ExternalLink, Inbox, Loader2, Mail, Search, StickyNote, X } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Segmented } from "~/components/notebook/segmented";
import { LoadError } from "~/components/notebook/load-error";
import { Thread } from "~/components/support/thread";
import { Composer, type ComposerHandle } from "~/components/support/composer";
import { SeverityMark, StatusPill, TicketStub, useSeverityLabel, useStatusLabel } from "~/components/support/ticket-bits";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import { useIsPhone } from "~/lib/hooks/use-is-phone";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { EASE_OUT } from "~/lib/motion";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { useComposeEmail } from "~/components/organism/compose-email/use-compose-email";
import { composeInvalidateKeys } from "~/components/organism/activity-panel/shared";
import { cn } from "~/lib/utils";
import { formatRelativeTime } from "~/lib/utils/format";
import {
  SEVERITIES,
  getQueueCounts,
  getQueueFilters,
  getQueueTicket,
  listQueue,
  markQueueTicketRead,
  ensureTicketContact,
  attachTicketEmail,
  queueKeys,
  sendQueueMessage,
  updateQueueTicket,
  type QueueFilters,
  type QueueStatus,
  type Severity,
  type TeamTicketDetail,
  type TeamTicketSummary,
  type TicketStatus,
} from "~/lib/api/support-tickets";

const STATUSES: TicketStatus[] = ["open", "waiting_on_client", "resolved"];

/** Badge in the nav: open tickets (they wait for us). Root members only. */
export function useQueueCounts(enabled: boolean) {
  return useQuery({
    queryKey: queueKeys.counts,
    queryFn: getQueueCounts,
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

/**
 * Support — the root workspace's queue (SUPPORT_TICKETS_PLAN.md). Every
 * customer's tickets in one list; the thread opens beside it on wide screens
 * (Mail-style split view) and on top of it on phones. Filters live in the
 * URL so a link to "urgent, open" stays that.
 */
export default function SupportPage() {
  const { t } = useTranslation();
  useDocumentMeta({ titleKey: "support.metaTitle", titleSuffix: " - Repraesent" });
  const { currentWorkspace } = useAuthContext();
  const isRoot = currentWorkspace?.is_root === true;
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const phone = useIsPhone();
  const { ref: searchRef, withHint } = useSearchShortcut();

  const status = (params.get("status") as QueueStatus) || "open";
  const sort = (params.get("sort") as "severity" | "activity") || "severity";
  const ws = params.get("ws_filter") || undefined;
  const site = params.get("site") || undefined;
  const severity = (params.get("severity") as Severity) || undefined;
  const assignee = params.get("assignee") || undefined;
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebounce(search.trim(), 250);
  const setParam = (k: string, v: string | undefined) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if ((params.get("q") ?? "") !== q) setParam("q", q || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filters: QueueFilters = { status, sort, workspace_id: ws, url_id: site, severity, assignee, q: q || undefined };
  const counts = useQueueCounts(isRoot);
  const filterOpts = useQuery({ queryKey: queueKeys.filters, queryFn: getQueueFilters, enabled: isRoot && counts.data?.ready === true, staleTime: 60_000 });
  const list = useQuery({
    queryKey: queueKeys.list(filters),
    queryFn: () => listQueue(filters),
    enabled: isRoot && counts.data?.ready === true,
    placeholderData: keepPreviousData,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });
  const rows = list.data?.data ?? [];
  const search_ = params.toString() ? `?${params.toString()}` : "";
  const open = (id: string) => navigate(`/support/${id}${search_}`);

  // ↑/↓ or j/k move through the list; Enter opens (Mail / Linear habit).
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!["j", "k", "ArrowDown", "ArrowUp"].includes(e.key) || !rows.length) return;
      e.preventDefault();
      const i = rows.findIndex((r) => r.id === ticketId);
      const next = e.key === "j" || e.key === "ArrowDown" ? Math.min(rows.length - 1, i + 1) : Math.max(0, i === -1 ? 0 : i - 1);
      open(rows[next].id);
      listRef.current?.querySelector(`[data-id="${rows[next].id}"]`)?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ticketId, search_]);

  if (currentWorkspace && !isRoot) return <Navigate to="/help" replace />;

  const c = counts.data;
  const segLabel = (label: string, n: number | undefined) => (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {n ? <span className="num text-[11px] opacity-60">{n}</span> : null}
    </span>
  );
  const showList = !phone || !ticketId;
  const showThread = !phone || !!ticketId;

  return (
    <div className="flex flex-col lg:h-dvh lg:min-h-0">
      <div className="flex flex-1 lg:min-h-0">
        {/* ── list column ── */}
        {showList ? (
          <section className="flex w-full flex-col border-border lg:min-h-0 lg:w-[400px] lg:shrink-0 lg:border-r" aria-label={t("support.title", "Support")}>
            <div className="space-y-3 border-b border-border px-4 pb-3 pt-5 sm:px-5">
              <div className="flex items-baseline justify-between gap-3">
                <h1 className="title-display text-[26px] font-semibold text-foreground">{t("support.title", "Support")}</h1>
                {c?.mine_open ? (
                  <button
                    type="button"
                    onClick={() => setParam("assignee", assignee === "me" ? undefined : "me")}
                    className={cn("press text-[12.5px] font-medium underline-offset-4", assignee === "me" ? "text-foreground underline" : "text-muted-foreground hover:text-foreground")}
                  >
                    {t("support.mine", "{{n}} yours", { n: c.mine_open })}
                  </button>
                ) : null}
              </div>
              <Segmented<QueueStatus>
                value={status}
                onChange={(v) => setParam("status", v === "open" ? undefined : v)}
                label={t("support.statusFilter", "Status")}
                role="tablist"
                stretch
                className="w-full [&>button]:flex-1"
                options={[
                  { value: "open", label: segLabel(t("support.segments.open", "Needs reply"), c?.open) },
                  { value: "waiting_on_client", label: segLabel(t("support.segments.waiting", "Waiting"), c?.waiting_on_client) },
                  { value: "resolved", label: t("support.segments.resolved", "Resolved") },
                  { value: "all", label: t("support.segments.all", "All") },
                ]}
              />
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={withHint(t("support.search", "Search client, site or #number"))}
                  className="h-10 pl-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <FilterSelect
                  label={t("support.filters.client", "Client")}
                  value={ws}
                  onChange={(v) => {
                    const next = new URLSearchParams(params);
                    v ? next.set("ws_filter", v) : next.delete("ws_filter");
                    next.delete("site");
                    setParams(next, { replace: true });
                  }}
                  options={(filterOpts.data?.clients ?? []).map((o) => ({ value: o.workspace_id, label: `${o.name} (${o.count})` }))}
                />
                <FilterSelect
                  label={t("support.filters.website", "Website")}
                  value={site}
                  onChange={(v) => setParam("site", v)}
                  options={(filterOpts.data?.websites ?? []).filter((w) => !ws || w.workspace_id === ws).map((o) => ({ value: o.id, label: o.host }))}
                />
                <FilterSelect
                  label={t("support.filters.severity", "How bad")}
                  value={severity}
                  onChange={(v) => setParam("severity", v)}
                  options={SEVERITIES.map((s) => ({ value: s, label: t(`support.severity.${s}`, s) }))}
                />
                <FilterSelect
                  label={t("support.filters.assignee", "Who")}
                  value={assignee}
                  onChange={(v) => setParam("assignee", v)}
                  options={[
                    { value: "me", label: t("support.filters.me", "Mine") },
                    { value: "none", label: t("support.filters.nobody", "Nobody yet") },
                    ...(filterOpts.data?.team ?? []).map((m) => ({ value: m.id, label: m.name ?? "—" })),
                  ]}
                />
                <button
                  type="button"
                  onClick={() => setParam("sort", sort === "severity" ? "activity" : undefined)}
                  className="press ml-auto h-8 rounded-md px-2 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={t("support.sortTitle", "Change the order")}
                >
                  {sort === "severity" ? t("support.sort.severity", "Most urgent first") : t("support.sort.activity", "Latest first")}
                </button>
              </div>
            </div>

            <div className="pb-24 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pb-4">
              {c && !c.ready ? (
                <p className="px-5 py-8 text-[14px] text-muted-foreground">{t("support.notReady", "Support isn't switched on on this server yet.")}</p>
              ) : list.isError ? (
                <LoadError className="m-4" what={t("support.title", "Support")} onRetry={() => void list.refetch()} />
              ) : list.isPending ? (
                <div className="space-y-px p-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-[84px] rounded-lg" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-start gap-2 px-5 py-10">
                  <Inbox className="size-5 text-muted-foreground" aria-hidden />
                  <p className="text-[15px] font-semibold">
                    {status === "open" && !q && !ws && !site && !severity && !assignee
                      ? t("support.empty.allClear", "Nobody is waiting on you.")
                      : t("support.empty.noMatch", "No tickets match these filters.")}
                  </p>
                  <p className="text-[13.5px] text-muted-foreground">
                    {status === "open" ? t("support.empty.allClearBody", "New tickets from customers land here first.") : t("support.empty.noMatchBody", "Clear a filter to see more.")}
                  </p>
                </div>
              ) : (
                <ul ref={listRef} className="divide-y divide-border">
                  {rows.map((r) => (
                    <QueueRow key={r.id} r={r} active={r.id === ticketId} to={`/support/${r.id}${search_}`} />
                  ))}
                </ul>
              )}
              {list.data && list.data.total > rows.length ? (
                <p className="px-5 py-3 text-[12px] text-muted-foreground">{t("support.more", "Showing {{n}} of {{total}}. Narrow it down with a filter.", { n: rows.length, total: list.data.total })}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ── thread column ── */}
        {showThread ? (
          <section className="flex min-w-0 flex-1 flex-col bg-background lg:min-h-0">
            {ticketId ? (
              <TicketPane key={ticketId} id={ticketId} backTo={`/support${search_}`} />
            ) : (
              <div className="hidden flex-1 items-center justify-center lg:flex">
                <div className="max-w-xs text-center">
                  <Inbox className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
                  <p className="text-[14px] text-muted-foreground">
                    {c?.open
                      ? t("support.pick", "Pick a ticket on the left. ↑ ↓ to move through them.")
                      : t("support.empty.allClear", "Nobody is waiting on you.")}
                  </p>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <span className={cn("relative inline-flex h-8 items-center rounded-full border text-[12.5px] font-medium transition-colors", value ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground/80 hover:border-foreground/40")}>
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-full cursor-pointer appearance-none bg-transparent pl-3 pr-3 outline-none [field-sizing:content] [&>option]:text-foreground max-sm:h-10"
        style={{ maxWidth: 170 }}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {value ? (
        <button type="button" onClick={() => onChange(undefined)} className="-ml-1 mr-1 flex size-6 items-center justify-center rounded-full hover:bg-background/20" aria-label={`${label}: ${current?.label ?? ""} ×`}>
          <X className="size-3" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

function QueueRow({ r, active, to }: { r: TeamTicketSummary; active: boolean; to: string }) {
  const { t } = useTranslation();
  return (
    <li data-id={r.id}>
      <Link
        to={to}
        aria-current={active ? "true" : undefined}
        className={cn(
          "relative flex gap-3 px-4 py-3.5 transition-colors focus-visible:outline-none sm:px-5",
          active ? "bg-card" : "hover:bg-muted/40 focus-visible:bg-muted/50",
        )}
      >
        {active ? <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-foreground" /> : null}
        <SeverityMark severity={r.severity} className="mt-[6px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className={cn("truncate text-[14px] text-foreground", r.unread ? "font-semibold" : "font-medium")}>{r.client.name}</p>
            <span className="num ml-auto shrink-0 text-[11.5px] text-muted-foreground">{formatRelativeTime(r.last_message_at, { addSuffix: false })}</span>
          </div>
          <p className={cn("truncate text-[13.5px]", r.unread ? "font-medium text-foreground" : "text-foreground/85")}>{r.title}</p>
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
            {r.last_message ? (
              <>
                <span className="text-foreground/60">{r.last_message.side === "team" ? `${r.last_message.author_name ?? t("support.us", "Us")}: ` : ""}</span>
                {r.last_message.body}
              </>
            ) : null}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <TicketStub number={r.number} />
            {r.website ? <span className="truncate">{r.website.host}</span> : null}
            {r.status !== "open" ? <StatusPill status={r.status} side="team" className="ml-auto h-5 px-2 text-[11px]" /> : null}
            {r.assigned_to?.name ? <span className="ml-auto truncate">{r.assigned_to.name.split(" ")[0]}</span> : null}
          </div>
        </div>
        {r.unread ? <span className="absolute right-2 top-4 size-2 rounded-full bg-marker ring-2 ring-marker/40" aria-label={t("support.unread", "Unread")} /> : null}
      </Link>
    </li>
  );
}

function TicketPane({ id, backTo }: { id: string; backTo: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const { user } = useAuthContext();
  const severityLabel = useSeverityLabel("team");
  const statusLabel = useStatusLabel("team");
  const [mode, setMode] = useState<"message" | "note">("message");
  const composer = useRef<ComposerHandle>(null);
  const key = queueKeys.ticket(id);
  const q = useQuery({ queryKey: key, queryFn: () => getQueueTicket(id), refetchInterval: 30_000, refetchOnWindowFocus: true });
  const filters = useQuery({ queryKey: queueKeys.filters, queryFn: getQueueFilters, staleTime: 60_000 });

  const seen = q.data ? `${q.data.messages.length}` : "";
  useEffect(() => {
    if (!seen) return;
    void markQueueTicketRead(id)
      .then(() => {
        void qc.invalidateQueries({ queryKey: queueKeys.counts });
        void qc.invalidateQueries({ queryKey: ["root-support", "list"] });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  // "r" jumps to the reply box (Mail habit).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        composer.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const after = (d: TeamTicketDetail) => {
    qc.setQueryData(key, d);
    void qc.invalidateQueries({ queryKey: ["root-support", "list"] });
    void qc.invalidateQueries({ queryKey: queueKeys.counts });
    void qc.invalidateQueries({ queryKey: queueKeys.filters });
  };

  const send = useMutation({
    // The kind travels with the send: switching tabs while it's on its way
    // must not turn a note's confirmation into "Sent. The customer gets an email."
    mutationFn: (v: { body: string; files: File[]; then: "wait" | "resolve" | "keep"; kind: "message" | "note" }) =>
      sendQueueMessage(id, { body: v.body, files: v.files, kind: v.kind, then: v.then }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TeamTicketDetail>(key);
      if (prev) {
        qc.setQueryData<TeamTicketDetail>(key, {
          ...prev,
          messages: [
            ...prev.messages,
            { id: `pending-${Date.now()}`, side: "team", kind: v.kind, body: v.body, event: null, created_at: new Date().toISOString(), author: { id: user?.id ?? null, name: null, is_me: true }, attachments: [], pending: true },
          ],
        });
      }
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error(extractErrorMessage(err) || t("support.sendFailed", "Not sent. Try again."));
    },
    onSuccess: (d, v) => {
      after(d);
      if (v.kind === "note") {
        toast.success(t("support.noteAdded", "Note added. Only your team sees it."));
      } else {
        toast.success(
          v.then === "resolve" ? t("support.sentResolved", "Sent and resolved. The customer gets an email.") : t("support.sent", "Sent. The customer gets an email."),
        );
      }
    },
  });

  const update = useMutation({
    mutationFn: (patch: { status?: TicketStatus; severity?: Severity; assigned_to?: string | null }) => updateQueueTicket(id, patch),
    onSuccess: after,
    onError: (err) => toast.error(extractErrorMessage(err) || t("support.saveFailed", "That didn't save. Try again.")),
  });

  if (q.isError) return <LoadError className="m-6" what={t("support.ticketWord", "this ticket")} onRetry={() => void q.refetch()} />;
  const d = q.data;

  return (
    <motion.div
      className="flex flex-1 flex-col lg:min-h-0"
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduce ? 0.12 : 0.24, ease: EASE_OUT }}
    >
      {/* header */}
      <div className="border-b border-border bg-background/85 px-4 pb-3 pt-3 backdrop-blur sm:px-6 lg:pt-5">
        <Link to={backTo} className="press -ml-1.5 mb-1 inline-flex min-h-11 items-center gap-0.5 pr-2 text-[15px] text-foreground/75 lg:hidden">
          <ChevronLeft className="size-5" aria-hidden />
          {t("support.title", "Support")}
        </Link>
        {!d ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-7 w-2/3" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <TicketStub number={d.number} size="lg" />
              <span className="font-semibold text-foreground">{d.client.name}</span>
              {d.website ? (
                <a href={d.website.url.startsWith("http") ? d.website.url : `https://${d.website.url}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                  {d.website.host} <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : null}
              {d.reporter.email ? <ReporterEmail ticket={d} /> : null}
            </div>
            <h2 className="title-display mt-2 line-clamp-2 text-[20px] font-semibold leading-tight text-foreground sm:text-[24px]">{d.title}</h2>
            {d.page_url ? (
              <a href={d.page_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[12.5px] text-muted-foreground underline decoration-foreground/20 underline-offset-2 hover:text-foreground">
                {d.page_url} <ExternalLink className="size-3 shrink-0" aria-hidden />
              </a>
            ) : null}
            {/* controls: status · how bad · who */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <InlineSelect
                label={t("support.controls.status", "Status")}
                value={d.status}
                options={STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
                onChange={(v) => update.mutate({ status: v as TicketStatus })}
                highlight={d.status === "open"}
              />
              <InlineSelect
                label={t("support.controls.severity", "How bad")}
                value={d.severity}
                options={SEVERITIES.map((s) => ({ value: s, label: severityLabel(s) }))}
                onChange={(v) => update.mutate({ severity: v as Severity })}
                lead={<SeverityMark severity={d.severity} />}
              />
              <InlineSelect
                label={t("support.controls.assignee", "Who handles it")}
                value={d.assigned_to?.id ?? ""}
                options={[{ value: "", label: t("support.filters.nobody", "Nobody yet") }, ...(filters.data?.team ?? []).map((m) => ({ value: m.id, label: m.name ?? "—" }))]}
                onChange={(v) => update.mutate({ assigned_to: v || null })}
              />
              {update.isPending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : null}
              {d.reopen_count ? (
                <span className="text-[12px] text-muted-foreground">{t("support.reopened", "Reopened {{count}}×", { count: d.reopen_count })}</span>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* thread */}
      <div className="flex-1 px-4 py-4 sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
        {d ? <Thread messages={d.messages} viewer="team" teamName="re:praesent" /> : <Skeleton className="h-48 w-full rounded-2xl" />}
      </div>

      {/* composer */}
      {d ? (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-10 border-t border-border bg-background/95 px-3 pb-3 pt-3 backdrop-blur sm:px-6 lg:static lg:bg-background lg:pb-4">
          <div className="mb-2 flex items-center gap-1" role="tablist" aria-label={t("support.composer.mode", "Reply or note")}>
            {(["message", "note"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "press inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors max-sm:h-10",
                  mode === m ? (m === "note" ? "bg-marker text-foreground" : "bg-foreground text-background") : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {m === "note" ? <StickyNote className="size-3.5" aria-hidden /> : null}
                {m === "note" ? t("support.composer.note", "Internal note") : t("support.composer.reply", "Reply to customer")}
              </button>
            ))}
            <AnimatePresence>
              {mode === "note" ? (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ml-2 text-[12px] text-marker-ink">
                  {t("support.composer.noteHint", "Only your team sees this.")}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
          <Composer
            ref={composer}
            tone={mode === "note" ? "note" : "default"}
            placeholder={mode === "note" ? t("support.composer.notePlaceholder", "A note for the team…") : t("support.composer.placeholder", "Reply to {{client}}…", { client: d.client.name })}
            sending={send.isPending}
            onSend={async (body, files, alt) => {
              try {
                await send.mutateAsync({ body, files, kind: mode, then: mode === "note" ? "keep" : alt ? "resolve" : "wait" });
                return true;
              } catch {
                return false;
              }
            }}
            actions={(go, canSend) =>
              mode === "note" ? (
                <button type="button" disabled={!canSend} onClick={() => go(false)} className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-[13.5px] font-semibold text-background disabled:opacity-35 max-sm:h-11">
                  {send.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <StickyNote className="size-4" aria-hidden />}
                  {t("support.composer.addNote", "Add note")}
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!canSend}
                    onClick={() => go(true)}
                    title="⇧⌘Enter"
                    className="press inline-flex h-10 items-center gap-1.5 rounded-full border border-foreground/25 px-3.5 text-[13.5px] font-semibold text-foreground disabled:opacity-35 max-sm:h-11"
                  >
                    <Check className="size-4" aria-hidden />
                    {t("support.composer.sendResolve", "Send & resolve")}
                  </button>
                  <button
                    type="button"
                    disabled={!canSend}
                    onClick={() => go(false)}
                    title="⌘Enter"
                    className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-[13.5px] font-semibold text-background disabled:opacity-35 max-sm:h-11"
                  >
                    {send.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
                    {t("support.composer.send", "Send")}
                  </button>
                </div>
              )
            }
          />
          {mode === "message" ? (
            <p className="mt-1.5 px-1 text-[11.5px] text-muted-foreground max-sm:hidden">
              {t("support.composer.sendHint", "Send sets it to “waiting on client” and emails them.")}
            </p>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}

function InlineSelect({
  label,
  value,
  options,
  onChange,
  highlight,
  lead,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  highlight?: boolean;
  lead?: React.ReactNode;
}) {
  return (
    <label className={cn("relative inline-flex h-9 items-center gap-1.5 rounded-lg border pl-2.5 pr-2 text-[13px] font-medium max-sm:h-11", highlight ? "border-marker bg-marker" : "border-border bg-card")}>
      <span className="sr-only">{label}</span>
      {lead}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-full cursor-pointer appearance-none bg-transparent pr-4 outline-none">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-2 text-[10px] text-muted-foreground">▾</span>
    </label>
  );
}

/**
 * The reporter's address + "Email": the same composer as on a contact page
 * (connected mailbox, signature, templates, the BCC copy). The reporter is
 * made a contact in the root workspace first, so the mail lands on their
 * timeline too; once sent it shows in this thread ("Sent · syncing" until the
 * copy is in). People who can't send email get a plain mailto link.
 */
function ReporterEmail({ ticket }: { ticket: TeamTicketDetail }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const canEdit = useCanEditLeads();
  const { openCompose } = useComposeEmail();
  const email = ticket.reporter.email!;
  const prepare = useMutation({
    mutationFn: () => ensureTicketContact(ticket.id),
    onSuccess: (c) => {
      openCompose({
        to: [{ email: c.email, name: c.name ?? undefined, locked: true }],
        contactId: c.contactId,
        subject: `#${ticket.number} · ${ticket.title}`,
        contextLabel: t("support.email.context", "Ticket #{{number}} · {{client}}", { number: ticket.number, client: ticket.client.name }),
        invalidateKeys: composeInvalidateKeys({ emailContactId: c.contactId }, "contact"),
        onSent: (sent) => {
          void attachTicketEmail(ticket.id, sent.id)
            .then((d) => qc.setQueryData(queueKeys.ticket(ticket.id), d))
            .catch(() => void qc.invalidateQueries({ queryKey: queueKeys.ticket(ticket.id) }));
        },
      });
    },
    onError: (err) => toast.error(extractErrorMessage(err) || t("support.email.failed", "Couldn't open the email. Try again.")),
  });
  if (!canEdit) {
    return (
      <a href={`mailto:${email}`} className="inline-flex items-center gap-1 hover:text-foreground">
        <Mail className="size-3" aria-hidden /> {email}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => prepare.mutate()}
      disabled={prepare.isPending}
      title={t("support.email.title", "Email {{name}} from your mailbox", { name: ticket.reporter.name ?? email })}
      className="press inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-foreground/40 max-sm:h-9"
    >
      {prepare.isPending ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Mail className="size-3" aria-hidden />}
      <span className="max-w-[220px] truncate">{ticket.reporter.name ? `${ticket.reporter.name} · ${email}` : email}</span>
    </button>
  );
}
