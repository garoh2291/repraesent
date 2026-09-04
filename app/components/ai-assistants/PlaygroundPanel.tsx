import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bug,
  RotateCcw,
  Send,
  Square,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { InfoNote } from "~/components/wordpress/fields";
import { GuardChip } from "~/components/ai-assistants/GuardChip";
import {
  DebugTable,
  LeadCard,
} from "~/components/ai-assistants/PlaygroundParts";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  AI_LOCALES,
  postPlaygroundFeedback,
  streamAssistantChat,
  submitPlaygroundLead,
  type ActionItem,
  type AiLocale,
  type RetrievalDebug,
  type SourceRef,
  type SseDone,
  type SseLeadForm,
} from "~/lib/api/ai-assistants";
import { ActionChips } from "~/components/ai-assistants/ActionChips";
import { cn } from "~/lib/utils";
import { stripCitations } from "~/lib/ai-assistants/citations";

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  sources?: SourceRef[];
  done?: SseDone;
  leadForm?: SseLeadForm;
  leadSubmitted?: boolean;
  actions?: ActionItem[];
  feedback?: "up" | "down";
  error?: string;
}

export function PlaygroundPanel({ assistantId }: { assistantId: string }) {
  const { t, i18n } = useTranslation();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [debug, setDebug] = useState(false);
  const [busy, setBusy] = useState(false);
  const conversationId = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const locale: AiLocale = (AI_LOCALES as readonly string[]).includes(
    i18n.language,
  )
    ? (i18n.language as AiLocale)
    : "en";

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns]);

  useEffect(() => () => abort.current?.abort(), []);

  const patch = (id: string, fn: (t: Turn) => Turn) =>
    setTurns((prev) => prev.map((x) => (x.id === id ? fn(x) : x)));

  const send = async () => {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    const userId = `u-${Date.now()}`;
    const botId = `a-${Date.now()}`;
    setTurns((prev) => [
      ...prev,
      { id: userId, role: "user", content: message },
      { id: botId, role: "assistant", content: "", streaming: true },
    ]);
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;

    await streamAssistantChat(
      assistantId,
      { conversation_id: conversationId.current, message, locale, debug },
      {
        onMeta: (m) => {
          conversationId.current = m.conversation_id;
        },
        onToken: (tok) =>
          patch(botId, (x) => ({ ...x, content: x.content + tok })),
        onSources: (items) => patch(botId, (x) => ({ ...x, sources: items })),
        onLeadForm: (form) => patch(botId, (x) => ({ ...x, leadForm: form })),
        onActions: (a) => patch(botId, (x) => ({ ...x, actions: a.items })),
        onDone: (done) =>
          patch(botId, (x) => ({ ...x, done, streaming: false })),
        onError: (e) =>
          patch(botId, (x) => ({
            ...x,
            streaming: false,
            error: `${e.code}: ${e.message}`,
          })),
      },
      controller.signal,
    );
    patch(botId, (x) => ({ ...x, streaming: false }));
    setBusy(false);
    abort.current = null;
  };

  const reset = () => {
    abort.current?.abort();
    conversationId.current = undefined;
    setTurns([]);
    setBusy(false);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("aiAssistants.playground.title")}
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Bug className="h-3.5 w-3.5" aria-hidden />
              {t("aiAssistants.playground.debug")}
              <Switch
                checked={debug}
                onCheckedChange={setDebug}
                className="scale-90"
              />
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={turns.length === 0}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("aiAssistants.playground.reset")}
            </Button>
          </div>
        </div>

        <div
          ref={scroller}
          className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
        >
          {turns.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t("aiAssistants.playground.empty")}
            </p>
          ) : (
            turns.map((turn) => (
              <TurnView
                key={turn.id}
                turn={turn}
                assistantId={assistantId}
                conversationId={conversationId.current}
                onLeadSubmitted={() =>
                  patch(turn.id, (x) => ({ ...x, leadSubmitted: true }))
                }
                onFeedback={(rating) =>
                  patch(turn.id, (x) => ({ ...x, feedback: rating }))
                }
              />
            ))
          )}
        </div>

        <form
          className="flex items-center gap-2 border-t border-border px-3 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("aiAssistants.playground.placeholder")}
            className="flex-1"
            autoComplete="off"
          />
          {busy ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => abort.current?.abort()}
              aria-label={t("aiAssistants.playground.stop")}
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              aria-label={t("aiAssistants.playground.send")}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>

      <aside className="space-y-3">
        <InfoNote>{t("aiAssistants.playground.draftNote")}</InfoNote>
        <InfoNote>{t("aiAssistants.playground.debugNote")}</InfoNote>
      </aside>
    </div>
  );
}

function TurnView({
  turn,
  assistantId,
  conversationId,
  onLeadSubmitted,
  onFeedback,
}: {
  turn: Turn;
  assistantId: string;
  conversationId: string | undefined;
  onLeadSubmitted: () => void;
  onFeedback: (rating: "up" | "down") => void;
}) {
  const { t } = useTranslation();
  const mine = turn.role === "user";
  const rate = (rating: "up" | "down") => {
    if (!turn.done?.message_id) return;
    onFeedback(rating);
    postPlaygroundFeedback(assistantId, turn.done.message_id, rating).catch(
      (err) => toast.error(extractErrorMessage(err)),
    );
  };
  return (
    <div
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
        {stripCitations(turn.content, turn.streaming)}
        {turn.streaming && !turn.content ? (
          <span
            className="inline-flex gap-1"
            aria-label={t("aiAssistants.playground.thinking")}
          >
            <i className="size-1.5 rounded-full bg-current opacity-40 animate-pulse motion-reduce:animate-none" />
            <i className="size-1.5 rounded-full bg-current opacity-40 animate-pulse [animation-delay:150ms] motion-reduce:animate-none" />
            <i className="size-1.5 rounded-full bg-current opacity-40 animate-pulse [animation-delay:300ms] motion-reduce:animate-none" />
          </span>
        ) : null}
      </div>
      {turn.error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{turn.error}</p>
      ) : null}
      {!mine && (turn.done || turn.sources?.length) ? (
        <div className="flex max-w-[85%] flex-wrap items-center gap-1.5">
          {turn.done ? <GuardChip decision={turn.done.guard_decision} /> : null}
          {turn.sources?.map((s, i) => (
            <span
              key={`${s.title}-${i}`}
              className="max-w-[16rem] truncate rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
              title={s.url ?? undefined}
            >
              {s.title}
            </span>
          ))}
          {turn.done?.unanswered ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
              {t("aiAssistants.conversations.unanswered")}
            </span>
          ) : null}
          {turn.done ? (
            <span className="text-[10px] tabular-nums text-muted-foreground/70">
              {turn.done.tokens_in}→{turn.done.tokens_out} tok
            </span>
          ) : null}
          {turn.done?.message_id && turn.done.guard_decision === "llm" ? (
            <span className="ml-1 inline-flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => rate("up")}
                aria-label={t("aiAssistants.conversations.feedbackUp")}
                aria-pressed={turn.feedback === "up"}
                className={cn(
                  "rounded p-1 text-muted-foreground hover:text-foreground",
                  turn.feedback === "up" &&
                    "text-emerald-600 dark:text-emerald-400",
                )}
              >
                <ThumbsUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => rate("down")}
                aria-label={t("aiAssistants.conversations.feedbackDown")}
                aria-pressed={turn.feedback === "down"}
                className={cn(
                  "rounded p-1 text-muted-foreground hover:text-foreground",
                  turn.feedback === "down" && "text-red-600 dark:text-red-400",
                )}
              >
                <ThumbsDown className="h-3 w-3" />
              </button>
            </span>
          ) : null}
        </div>
      ) : null}
      {turn.actions?.length ? <ActionChips items={turn.actions} /> : null}
      {turn.leadForm ? (
        <LeadCard
          form={turn.leadForm}
          submitted={!!turn.leadSubmitted}
          assistantId={assistantId}
          conversationId={conversationId}
          onSubmitted={onLeadSubmitted}
        />
      ) : null}
      {turn.done?.debug ? <DebugTable debug={turn.done.debug} /> : null}
    </div>
  );
}
