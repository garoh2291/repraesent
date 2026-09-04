import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import {
  ChevronLeft,
  ChevronRight,
  Contact,
  Download,
  FileText,
  Image as ImageIcon,
  MessagesSquare,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Panel } from "~/components/forms/chrome";
import { GuardChip } from "~/components/ai-assistants/GuardChip";
import { ActionChips } from "~/components/ai-assistants/ActionChips";
import {
  useAiConversation,
  useAiConversations,
} from "~/lib/hooks/useAiAssistants";
import {
  actionsFromToolCalls,
  downloadMessageAttachment,
  type MessageAttachment,
  type ConversationDetail,
  type ConversationSummary,
} from "~/lib/api/ai-assistants";
import { toast } from "sonner";
import { cn } from "~/lib/utils";

const LIMIT = 25;

export function ConversationsPanel({
  assistantId,
  assistantName,
}: {
  assistantId: string;
  assistantName?: string;
}) {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [leadOnly, setLeadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  // `?open=<id>` deep-links a transcript (from the knowledge-gaps list).
  const openId = searchParams.get("open");
  const setOpenId = (id: string | null) =>
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (id) p.set("open", id);
        else p.delete("open");
        return p;
      },
      { replace: true },
    );

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => setPage(1), [debounced, leadOnly]);

  const { data, isLoading } = useAiConversations(assistantId, {
    page,
    limit: LIMIT,
    lead_only: leadOnly,
    search: debounced || undefined,
  });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / LIMIT));

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("aiAssistants.conversations.search")}
          className="max-w-xs"
        />
        <div className="flex items-center gap-3">
          <Label
            htmlFor="lead-only"
            className="text-sm font-normal text-muted-foreground"
          >
            {t("aiAssistants.conversations.leadOnly")}
          </Label>
          <Switch
            id="lead-only"
            checked={leadOnly}
            onCheckedChange={setLeadOnly}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center">
          <MessagesSquare
            className="h-7 w-7 text-muted-foreground/60"
            aria-hidden
          />
          <div className="space-y-1">
            <p className="font-medium">
              {t("aiAssistants.conversations.empty")}
            </p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              {t("aiAssistants.conversations.emptyHint")}
            </p>
          </div>
        </div>
      ) : (
        <Panel>
          <ul className="divide-y divide-border/70">
            {data!.items.map((c) => (
              <ConversationRow
                key={c.id}
                c={c}
                formatDate={formatDate}
                onOpen={() => setOpenId(c.id)}
              />
            ))}
          </ul>
        </Panel>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">
            {t("aiAssistants.conversations.pageOf", { page, pages, total })}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label={t("common.previous", { defaultValue: "Previous" })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              aria-label={t("common.next", { defaultValue: "Next" })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <TranscriptSheet
        assistantId={assistantId}
        assistantName={assistantName}
        conversationId={openId}
        onClose={() => setOpenId(null)}
        formatDate={formatDate}
      />
    </div>
  );
}

function ConversationRow({
  c,
  formatDate,
  onOpen,
}: {
  c: ConversationSummary;
  formatDate: (iso: string) => string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm">
            {c.first_message ?? (
              <span className="italic text-muted-foreground">
                {t("aiAssistants.conversations.noMessage")}
              </span>
            )}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="tabular-nums">{formatDate(c.created_at)}</span>
            <span>·</span>
            <span>
              {t("aiAssistants.conversations.turns", {
                count: c.assistant_turns,
              })}
            </span>
            {c.locale ? (
              <>
                <span>·</span>
                <span className="font-mono uppercase">{c.locale}</span>
              </>
            ) : null}
            <span>·</span>
            <span>{c.channel}</span>
            {c.page_url ? (
              <>
                <span>·</span>
                <span className="truncate font-mono">
                  {shortUrl(c.page_url)}
                </span>
              </>
            ) : null}
          </p>
        </div>
        {c.lead_id ? (
          <Link
            to={`/lead-form/${c.lead_id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
          >
            <Contact className="h-3 w-3" aria-hidden />
            {t("aiAssistants.conversations.lead")}
          </Link>
        ) : null}
      </button>
    </li>
  );
}

function shortUrl(u: string): string {
  try {
    const url = new URL(u);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return u;
  }
}

/** Plain-text transcript: date — assistant — visitor, then one line per turn. */
function buildTranscript(
  detail: ConversationDetail,
  assistantName: string,
  lang: string,
): string {
  const c = detail.conversation;
  const date = new Date(c.created_at).toLocaleString(lang);
  const head = `${date} — ${assistantName} — ${c.visitor_id ?? "visitor"}`;
  const lines = detail.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const time = new Date(m.created_at).toLocaleTimeString(lang, {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `[${time}] ${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`;
    });
  return `${head}\n\n${lines.join("\n")}\n`;
}

function TranscriptSheet({
  assistantId,
  assistantName,
  conversationId,
  onClose,
  formatDate,
}: {
  assistantId: string;
  assistantName?: string;
  conversationId: string | null;
  onClose: () => void;
  formatDate: (iso: string) => string;
}) {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useAiConversation(
    assistantId,
    conversationId ?? undefined,
  );

  const exportTxt = () => {
    if (!data || !conversationId) return;
    const text = buildTranscript(
      data,
      assistantName ?? "Assistant",
      i18n.language,
    );
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${conversationId.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={!!conversationId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border">
          <div className="flex items-center justify-between gap-3 pr-6">
            <SheetTitle>
              {t("aiAssistants.conversations.transcript")}
            </SheetTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!data}
              onClick={exportTxt}
            >
              <Download className="h-3.5 w-3.5" />
              {t("aiAssistants.conversations.export")}
            </Button>
          </div>
          <SheetDescription className="flex flex-wrap items-center gap-2 text-xs">
            {data ? (
              <>
                <span className="tabular-nums">
                  {formatDate(data.conversation.created_at)}
                </span>
                {data.conversation.locale ? (
                  <span className="font-mono uppercase">
                    {data.conversation.locale}
                  </span>
                ) : null}
                <span>{data.conversation.channel}</span>
                {data.conversation.lead_id ? (
                  <Link
                    to={`/lead-form/${data.conversation.lead_id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-300"
                  >
                    <Contact className="h-3 w-3" aria-hidden />
                    {t("aiAssistants.conversations.openLead")}
                  </Link>
                ) : null}
              </>
            ) : (
              "…"
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {isLoading || !data ? (
            <>
              <Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" />
              <Skeleton className="h-20 w-4/5 rounded-2xl" />
            </>
          ) : (
            data.messages
              .filter((m) => m.role !== "system")
              .map((m) => {
                const mine = m.role === "user";
                const actions = actionsFromToolCalls(m.tool_calls);
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-col gap-1.5",
                      mine ? "items-end" : "items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        mine
                          ? "rounded-br-md bg-foreground text-background"
                          : "rounded-bl-md bg-muted",
                      )}
                    >
                      {m.content}
                    </div>
                    {mine && m.attachments?.length ? (
                      <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
                        {m.attachments.map((a) => (
                          <AttachmentChip
                            key={a.id}
                            assistantId={assistantId}
                            attachment={a}
                          />
                        ))}
                      </div>
                    ) : null}
                    {!mine ? (
                      <div className="flex max-w-[85%] flex-wrap items-center gap-1.5">
                        {m.guard_decision ? (
                          <GuardChip decision={m.guard_decision} />
                        ) : null}
                        {m.unanswered ? (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
                            {t("aiAssistants.conversations.unanswered")}
                          </span>
                        ) : null}
                        {m.feedback === "up" ? (
                          <ThumbsUp
                            className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
                            aria-label={t(
                              "aiAssistants.conversations.feedbackUp",
                            )}
                          />
                        ) : m.feedback === "down" ? (
                          <ThumbsDown
                            className="h-3 w-3 text-red-600 dark:text-red-400"
                            aria-label={t(
                              "aiAssistants.conversations.feedbackDown",
                            )}
                          />
                        ) : null}
                        {m.sources?.map((s, i) =>
                          s.url ? (
                            <a
                              key={`${s.url}-${i}`}
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="max-w-[16rem] truncate rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              {s.title}
                            </a>
                          ) : (
                            <span
                              key={`${s.title}-${i}`}
                              className="max-w-[16rem] truncate rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                              {s.title}
                            </span>
                          ),
                        )}
                        {m.tokens_in != null || m.tokens_out != null ? (
                          <span className="text-[10px] tabular-nums text-muted-foreground/70">
                            {m.tokens_in ?? 0}→{m.tokens_out ?? 0} tok
                            {m.latency_ms != null
                              ? ` · ${m.latency_ms} ms`
                              : ""}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {!mine && actions.length > 0 ? (
                      <ActionChips items={actions} />
                    ) : null}
                  </div>
                );
              })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A file the visitor sent. Downloads through the auth'd route while the
 * object still exists; after the 30-day sweep the chip stays as a record of
 * what was sent, muted.
 */
function AttachmentChip({
  assistantId,
  attachment,
}: {
  assistantId: string;
  attachment: MessageAttachment;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const Glyph = attachment.kind === "image" ? ImageIcon : FileText;
  const label = `${attachment.filename} · ${formatBytes(attachment.size_bytes)}`;

  if (!attachment.available) {
    return (
      <span
        title={t("aiAssistants.conversations.attachmentGone")}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground/60"
      >
        <Glyph className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate line-through">{label}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      title={t("aiAssistants.conversations.attachmentDownload")}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadMessageAttachment(assistantId, attachment);
        } catch {
          toast.error(t("aiAssistants.conversations.attachmentDownloadFailed"));
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-muted disabled:opacity-60"
    >
      <Glyph className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{label}</span>
      <Download className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}
