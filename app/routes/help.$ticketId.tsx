import { useEffect } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { PageContainer } from "~/components/notebook/page-header";
import { BackLink } from "~/components/notebook/back-link";
import { LoadError } from "~/components/notebook/load-error";
import { Skeleton } from "~/components/ui/skeleton";
import { Thread } from "~/components/support/thread";
import { Composer } from "~/components/support/composer";
import { SeverityMark, StatusPill, TicketStub, useSeverityLabel } from "~/components/support/ticket-bits";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  getHelpTicket,
  helpKeys,
  markHelpTicketRead,
  sendHelpMessage,
  setHelpTicketStatus,
  type TicketDetail,
} from "~/lib/api/support-tickets";
import { formatDateMedium } from "~/lib/utils/format";

/** One report: the whole conversation with re:praesent, and where it stands. */
export default function HelpTicketPage() {
  const { t } = useTranslation();
  useDocumentMeta({ titleKey: "help.metaTitle", titleSuffix: " - Repraesent" });
  const { ticketId = "" } = useParams();
  const { currentWorkspace, user } = useAuthContext();
  const qc = useQueryClient();
  const key = helpKeys.ticket(currentWorkspace?.id, ticketId);
  const severityLabel = useSeverityLabel("client");
  const q = useQuery({
    queryKey: key,
    queryFn: () => getHelpTicket(ticketId),
    enabled: !!currentWorkspace?.id && !!ticketId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Seen it: clears the dot, the badge and any email still waiting to go out.
  const seen = q.data ? `${q.data.messages.length}:${q.data.status}` : "";
  useEffect(() => {
    if (!seen) return;
    void markHelpTicketRead(ticketId)
      .then(() => qc.invalidateQueries({ queryKey: helpKeys.websites(currentWorkspace?.id) }))
      .catch(() => {});
    void qc.invalidateQueries({ queryKey: helpKeys.list(currentWorkspace?.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  const after = (d: TicketDetail) => {
    qc.setQueryData(key, d);
    void qc.invalidateQueries({ queryKey: helpKeys.all(currentWorkspace?.id) });
  };

  const send = useMutation({
    mutationFn: ({ body, files }: { body: string; files: File[] }) => sendHelpMessage(ticketId, body, files),
    onMutate: async ({ body }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TicketDetail>(key);
      if (prev) {
        qc.setQueryData<TicketDetail>(key, {
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: `pending-${Date.now()}`,
              side: "client",
              kind: "message",
              body,
              event: null,
              created_at: new Date().toISOString(),
              author: { id: user?.id ?? null, name: null, is_me: true },
              attachments: [],
              pending: true,
            },
          ],
        });
      }
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error(extractErrorMessage(err) || t("help.thread.sendFailed", "Your reply didn't go through. Try again."));
    },
    onSuccess: after,
  });

  const status = useMutation({
    mutationFn: (action: "resolve" | "reopen") => setHelpTicketStatus(ticketId, action),
    onSuccess: (d, action) => {
      after(d);
      toast.success(action === "resolve" ? t("help.thread.markedDone", "Marked done. Thanks!") : t("help.thread.reopened", "Opened again. We'll take another look."));
    },
    onError: (err) => toast.error(extractErrorMessage(err) || t("help.thread.statusFailed", "That didn't save. Try again.")),
  });

  if (q.isError) {
    return (
      <PageContainer className="max-w-[860px]">
        <BackLink to="/help">{t("help.back", "All reports")}</BackLink>
        <LoadError className="mt-4" what={t("help.reportWord", "this report")} onRetry={() => void q.refetch()} />
      </PageContainer>
    );
  }
  const d = q.data;

  return (
    <PageContainer className="max-w-[860px] pb-10">
      <BackLink to="/help">{t("help.back", "All reports")}</BackLink>
      {!d ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <header className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <TicketStub number={d.number} size="lg" />
              <StatusPill status={d.status} side="client" />
            </div>
            <h1 className="title-display line-clamp-3 text-[22px] font-semibold leading-tight text-foreground sm:text-[26px]">{d.title}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <SeverityMark severity={d.severity} />
                {severityLabel(d.severity)}
              </span>
              {d.website ? <span>{d.website.host}</span> : null}
              {d.page_url ? (
                <a href={d.page_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline decoration-foreground/25 underline-offset-2 hover:text-foreground">
                  {t("help.thread.thePage", "The page")} <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : null}
              <span>{t("help.thread.sentOn", "Sent {{date}}", { date: formatDateMedium(d.created_at) })}</span>
            </p>
          </header>

          {d.status === "waiting_on_client" ? (
            <p className="mt-5 rounded-xl bg-marker-soft px-4 py-3 text-[14px] font-medium text-foreground">
              {t("help.thread.waitingBanner", "We need your answer to go on. Reply below.")}
            </p>
          ) : null}

          <Thread messages={d.messages} viewer="client" teamName="re:praesent" className="mt-6" />

          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 mt-6 lg:bottom-4">
            {d.status === "resolved" ? (
              <div className="mb-3 flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[14px] text-foreground">{t("help.thread.doneBar", "We marked this done. Still not fixed?")}</p>
                <button
                  type="button"
                  disabled={status.isPending}
                  onClick={() => status.mutate("reopen")}
                  className="press inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-foreground px-4 text-[14px] font-semibold max-sm:h-11"
                >
                  {status.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
                  {t("help.thread.reopen", "It's still not fixed")}
                </button>
              </div>
            ) : null}
            <Composer
              placeholder={
                d.status === "resolved"
                  ? t("help.thread.placeholderReopen", "Write what you still see. Sending it opens the report again.")
                  : t("help.thread.placeholder", "Write a reply…")
              }
              sending={send.isPending}
              onSend={async (body, files) => {
                try {
                  await send.mutateAsync({ body, files });
                  return true;
                } catch {
                  return false;
                }
              }}
              className="shadow-[0_12px_32px_-18px_rgba(20,21,22,0.35)]"
            />
          </div>
          {d.status !== "resolved" ? (
            <div className="mt-3 text-right">
              <button
                type="button"
                disabled={status.isPending}
                onClick={() => status.mutate("resolve")}
                className="press min-h-10 text-[13px] font-medium text-muted-foreground underline decoration-foreground/20 underline-offset-4 hover:text-foreground"
              >
                {t("help.thread.solved", "This is solved")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </PageContainer>
  );
}
