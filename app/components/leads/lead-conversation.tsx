import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Bot, ExternalLink, MessagesSquare } from "lucide-react";

import { cn } from "~/lib/utils";
import type { Lead } from "~/lib/api/leads";
import { useAiConversation } from "~/lib/hooks/useAiAssistants";
import { leadConversationRef } from "~/lib/leads/ai-assistant";
import { SafeMarkdown } from "~/lib/markdown/safe-inline";
import { Skeleton } from "~/components/ui/skeleton";
import { formatDateIntl } from "~/lib/utils/format";

/** One rendered turn, from either the live conversation or the stored summary. */
interface Turn {
  id: string;
  mine: boolean;
  content: string;
  at: string | null;
}

/**
 * Parse the stored `transcript_summary` fallback.
 *
 * The backend writes the last six turns as "Visitor: …" / "Assistant: …" lines,
 * whitespace-collapsed and capped at 1500 chars. It is a lossy snapshot, so it
 * is only used when the real conversation cannot be fetched.
 */
function parseTranscriptSummary(raw: string): Turn[] {
  const turns: Turn[] = [];
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*(Visitor|Assistant)\s*:\s*(.*)$/);
    if (match) {
      turns.push({
        id: `s${turns.length}`,
        mine: match[1] === "Visitor",
        content: match[2],
        at: null,
      });
    } else if (line.trim() !== "" && turns.length > 0) {
      // A wrapped continuation line belongs to the turn above it.
      turns[turns.length - 1].content += `\n${line}`;
    }
  }
  return turns;
}

function Bubble({ turn, lang }: { turn: Turn; lang: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        turn.mine ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          turn.mine
            ? "rounded-br-md bg-foreground text-background"
            : "rounded-bl-md bg-muted text-foreground",
        )}
      >
        <SafeMarkdown text={turn.content} />
      </div>
      {turn.at ? (
        <span className="px-1 text-[10px] tabular-nums text-muted-foreground/60">
          {new Date(turn.at).toLocaleTimeString(lang, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The AI-assistant chat a lead came out of.
 *
 * The lead already carries everything needed to fetch it — `source_id` is the
 * assistant, `metadata.conversation_id` the conversation — so this shows the
 * whole exchange rather than the truncated `transcript_summary` that used to be
 * dumped into a one-line field row.
 *
 * Renders nothing for leads that did not come from an assistant.
 */
export function LeadConversation({
  lead,
  className,
  maxHeightClassName = "max-h-[min(52vh,380px)]",
}: {
  lead: Lead;
  className?: string;
  /** Roomier on the full lead page than in the side sheet. */
  maxHeightClassName?: string;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? "de";
  const ref = leadConversationRef(lead);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useAiConversation(
    ref?.assistantId,
    ref?.conversationId,
  );

  const meta = (lead.metadata ?? {}) as Record<string, unknown>;
  const summary =
    typeof meta.transcript_summary === "string" ? meta.transcript_summary : "";
  const assistantName =
    typeof meta.assistant_name === "string" ? meta.assistant_name : null;

  // The live conversation when we have it, the stored snapshot when we don't.
  const turns = useMemo<Turn[]>(() => {
    if (data) {
      return data.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          mine: m.role === "user",
          content: m.content,
          at: m.created_at,
        }));
    }
    return summary ? parseTranscriptSummary(summary) : [];
  }, [data, summary]);

  const isPartial = !data && turns.length > 0;

  // Land on the newest message once, then leave the viewport alone.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && turns.length > 0) el.scrollTop = el.scrollHeight;
  }, [turns.length]);

  if (!ref && !summary) return null;
  if (!isLoading && turns.length === 0) return null;

  const started = data?.conversation.created_at ?? null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/50 bg-card/70 backdrop-blur-md",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <MessagesSquare
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium tracking-[0.01em] text-muted-foreground">
          {t("leads.conversation.title", { defaultValue: "Conversation" })}
          {assistantName ? ` · ${assistantName}` : null}
          {started ? ` · ${formatDateIntl(started, { dateStyle: "medium" })}` : null}
        </p>
        {ref ? (
          <Link
            to={`/ai-assistants/${ref.assistantId}?tab=conversations&open=${ref.conversationId}`}
            className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            {t("leads.conversation.open", { defaultValue: "Open" })}
          </Link>
        ) : null}
      </div>

      {isPartial ? (
        <p className="border-b border-border/40 bg-amber-50/50 px-3 py-1.5 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          {isError
            ? t("leads.conversation.partial", {
                defaultValue:
                  "Showing the saved excerpt — the full conversation is no longer available.",
              })
            : t("leads.conversation.excerpt", {
                defaultValue: "Showing the saved excerpt of this conversation.",
              })}
        </p>
      ) : null}

      <div
        ref={scrollRef}
        className={cn(
          "lead-conversation-scroll space-y-3 overflow-y-auto overscroll-contain px-3 py-3",
          maxHeightClassName,
        )}
      >
        {isLoading && turns.length === 0 ? (
          <>
            <Skeleton className="ml-auto h-9 w-2/3 rounded-2xl" />
            <Skeleton className="h-16 w-4/5 rounded-2xl" />
            <Skeleton className="ml-auto h-9 w-1/2 rounded-2xl" />
          </>
        ) : (
          turns.map((turn) => (
            <Bubble key={turn.id} turn={turn} lang={lang} />
          ))
        )}
      </div>

      {data ? (
        <div className="flex items-center gap-1.5 border-t border-border/40 px-3 py-1.5 text-[10px] text-muted-foreground/70">
          <Bot className="h-3 w-3 shrink-0" aria-hidden />
          {t("leads.conversation.messageCount", {
            count: data.conversation.message_count,
            defaultValue: "{{count}} messages",
          })}
        </div>
      ) : null}
    </div>
  );
}
