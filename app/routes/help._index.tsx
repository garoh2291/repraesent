import { useState } from "react";
import { Link, Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, LifeBuoy, Plus } from "lucide-react";
import { PageContainer, PageHeader } from "~/components/notebook/page-header";
import { EmptyState } from "~/components/notebook/empty-state";
import { LoadError } from "~/components/notebook/load-error";
import { Skeleton } from "~/components/ui/skeleton";
import { useHelp, useHelpAvailable } from "~/components/support/help-provider";
import { SeverityMark, StatusPill, TicketStub } from "~/components/support/ticket-bits";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { helpKeys, listHelpTickets, type TicketSummary } from "~/lib/api/support-tickets";
import { formatRelativeTime } from "~/lib/utils/format";
import { cn } from "~/lib/utils";

/**
 * Help & changes — the customer's reports. What waits for them comes first
 * (marker), then what we're on, then what's done (folded away).
 */
export default function HelpPage() {
  const { t } = useTranslation();
  useDocumentMeta({ titleKey: "help.metaTitle", titleSuffix: " - Repraesent" });
  const { currentWorkspace } = useAuthContext();
  const { available } = useHelpAvailable();
  const { openNew } = useHelp();
  const blocked = !!currentWorkspace && (currentWorkspace.is_root === true || currentWorkspace.is_demo === true);
  const q = useQuery({
    queryKey: helpKeys.list(currentWorkspace?.id),
    queryFn: listHelpTickets,
    enabled: available,
    refetchOnWindowFocus: true,
  });
  const [showDone, setShowDone] = useState(false);

  if (blocked) return <Navigate to={currentWorkspace?.is_root ? "/support" : "/"} replace />;

  const rows = q.data ?? [];
  const waiting = rows.filter((r) => r.status === "waiting_on_client");
  const open = rows.filter((r) => r.status === "open");
  const done = rows.filter((r) => r.status === "resolved");

  return (
    <PageContainer className="max-w-[860px]">
      <PageHeader
        title={t("help.title", "Help & changes")}
        subtitle={t("help.subtitle", "Something broken on your website, or a change you need? Tell us here and we'll answer in the same place.")}
        actions={
          available ? (
            <button
              type="button"
              onClick={openNew}
              className="press inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[14px] font-semibold text-background max-sm:h-11 max-sm:w-full max-sm:justify-center"
            >
              <Plus className="size-4" aria-hidden />
              {t("help.new.cta", "Report a problem")}
            </button>
          ) : null
        }
      />

      <div className="mt-7 space-y-8">
        {!available || q.isPending ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[76px] rounded-xl" />
            ))}
          </div>
        ) : q.isError ? (
          <LoadError what={t("help.title", "Help & changes")} onRetry={() => void q.refetch()} />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-foreground/20 bg-card">
            <EmptyState
              icon={<LifeBuoy />}
              title={t("help.empty.title", "Nothing reported yet")}
              body={t("help.empty.body", "When something on your website breaks or needs changing, report it here. You'll see every answer and where it stands.")}
              action={
                <button type="button" onClick={openNew} className="press inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[14px] font-semibold text-background">
                  <Plus className="size-4" aria-hidden />
                  {t("help.new.cta", "Report a problem")}
                </button>
              }
            />
          </div>
        ) : (
          <>
            {waiting.length ? <Group title={t("help.groups.waiting", "Waiting for your reply")} rows={waiting} marker /> : null}
            {open.length ? <Group title={t("help.groups.open", "We're on it")} rows={open} /> : null}
            {done.length ? (
              <section>
                <button
                  type="button"
                  onClick={() => setShowDone((v) => !v)}
                  aria-expanded={showDone}
                  className="press mb-2 inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
                >
                  {showDone ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                  {t("help.groups.done", "Done")} <span className="num">({done.length})</span>
                </button>
                {showDone ? <List rows={done} /> : null}
              </section>
            ) : null}
          </>
        )}
      </div>
    </PageContainer>
  );
}

function Group({ title, rows, marker }: { title: string; rows: TicketSummary[]; marker?: boolean }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {marker ? <span className="marker text-foreground">{title}</span> : title}
        <span className="num">({rows.length})</span>
      </h2>
      <List rows={rows} />
    </section>
  );
}

function List({ rows }: { rows: TicketSummary[] }) {
  const { t } = useTranslation();
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {rows.map((r) => {
        const fromUs = r.last_message?.side === "team";
        return (
          <li key={r.id}>
            <Link
              to={`/help/${r.id}`}
              className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-5"
            >
              <SeverityMark severity={r.severity} className="mt-[7px]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn("truncate text-[15px] text-foreground", r.unread ? "font-semibold" : "font-medium")}>{r.title}</p>
                  {r.unread ? <span className="size-2 shrink-0 rounded-full bg-marker ring-2 ring-marker/40" aria-label={t("help.unread", "New reply")} /> : null}
                </div>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                  {fromUs ? <span className="font-medium text-foreground/75">re:praesent: </span> : null}
                  {r.last_message?.body || "—"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                  <TicketStub number={r.number} />
                  {r.website ? <span>{r.website.host}</span> : null}
                  <span aria-hidden>·</span>
                  <span>{formatRelativeTime(r.last_message_at)}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <StatusPill status={r.status} side="client" className="max-sm:hidden" />
                <ChevronRight className="size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
