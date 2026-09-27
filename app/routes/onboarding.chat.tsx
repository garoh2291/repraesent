"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Check, ClipboardList, Loader2 } from "lucide-react";
import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";
import {
  AccountMenu,
  OnbLanguageSwitcher,
  OnboardingStyles,
} from "~/components/onboarding-v2/shell";
import {
  BusinessCard,
  BusinessCardChip,
} from "~/components/onboarding-v2/business-card";
import {
  Portrait,
  type FaceMood,
  type FaceReaction,
  type FaceReactionKind,
} from "~/components/onboarding-v2/chat/portrait";
import {
  AssistantPicker,
  AssistantSwitcher,
  HandoverDivider,
} from "~/components/onboarding-v2/chat/assistants";
import { ChatCardView } from "~/components/onboarding-v2/chat/chat-cards";
import {
  STATE_KEY,
  useOnboardingState,
} from "~/components/onboarding-v2/wizard-context";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import {
  openChat,
  streamChatTurn,
  visibleText,
  type ChatCard,
  type ChatEvent,
  type ChatMessage,
  type ChatProgress,
  type AssistantLevel,
} from "~/lib/api/onboarding-chat";
import { matchChoice } from "~/lib/onboarding/choice-match";
import type { OnboardingState } from "~/lib/api/onboarding-v2";
import { SafeMarkdown } from "~/lib/markdown/safe-inline";
import { cn } from "~/lib/utils";

type Turn = ChatMessage & { streaming?: boolean; error?: string | null };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Onboarding as a conversation (AI_ONBOARDING_PLAN.md, Phase 4). Same run as
 * the form: answers land in the same profile, the business card on the right
 * fills in live, and "Switch to the form" opens the step the chat reached.
 */
export default function OnboardingChatRoute() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const { data: state } = useOnboardingState();
  // Chip labels in every language, for matching typed answers (customers mix languages).
  const translators = useMemo(
    () => ["en", "de", "fr", "nl"].map((l) => i18n.getFixedT(l)),
    [i18n],
  );
  // Always the server's conversation when the page opens (the form may have been used in between);
  // no cached copy, and no refetch mid-conversation (the stream keeps local state current).
  const chatQuery = useQuery({
    queryKey: ["onboarding-v2", "chat"],
    queryFn: openChat,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const [turns, setTurns] = useState<Turn[]>([]);
  const [progress, setProgress] = useState<ChatProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<FaceMood>("idle");
  const [reaction, setReaction] = useState<FaceReaction>(null);
  // Who's talking (Phase 6): picked when the chat first opens, switchable any time.
  const [level, setLevel] = useState<AssistantLevel | null>(null);
  const [typing, setTyping] = useState(false);
  const react = useCallback(
    (kind: FaceReactionKind) =>
      setReaction({ kind, id: Date.now() + Math.random() }),
    [],
  );
  const lastPct = useRef<number | null>(null);
  const [draft, setDraft] = useState("");
  const started = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);

  useDocumentMeta({
    titleKey: "onb.chat.metaTitle",
    titleSuffix: " - re:praesent",
  });

  // Having chosen the chat counts as having seen the intro (switching to the form must not show it again).
  useEffect(() => {
    try {
      window.sessionStorage.setItem("onb:intro-seen", "1");
    } catch {
      /* private mode */
    }
  }, []);

  const setState = useCallback(
    (s: OnboardingState) => qc.setQueryData(STATE_KEY, s),
    [qc],
  );

  // Leave when there's nothing to do here.
  useEffect(() => {
    if (state?.run?.status === "completed")
      navigate("/welcome", { replace: true });
  }, [navigate, state?.run?.status]);
  useEffect(() => {
    if (chatQuery.data && !chatQuery.data.available)
      navigate("/onboarding/start", { replace: true });
  }, [chatQuery.data, navigate]);

  useEffect(() => {
    if (!chatQuery.data?.available) return;
    setTurns(chatQuery.data.messages);
    setProgress(chatQuery.data.progress);
    setLevel(chatQuery.data.assistant ?? null);
    const p = chatQuery.data.progress;
    if (lastPct.current === null && p?.total)
      lastPct.current = (p.done / p.total) * 100;
  }, [chatQuery.data]);

  // Hello (and welcome back) with a wave once the conversation is on screen.
  const waved = useRef(false);
  useEffect(() => {
    if (!chatQuery.data?.available || waved.current) return;
    waved.current = true;
    const id = setTimeout(() => react("wave"), 400);
    return () => clearTimeout(id);
  }, [chatQuery.data, react]);

  // Listening while the customer writes, thinking/speaking while Lena does.
  const liveMood: FaceMood = busy
    ? mood
    : typing && draft.trim()
      ? "listening"
      : "idle";

  const patchLast = (fn: (t: Turn) => Turn) =>
    setTurns((all) => {
      const i = all.length - 1;
      if (i < 0 || all[i].role !== "assistant") return all;
      const next = [...all];
      next[i] = fn(all[i]);
      return next;
    });

  const send = useCallback(
    async (
      body: { message?: string; event?: ChatEvent; open_choice?: string },
      echo?: string,
      by: AssistantLevel | null = level,
    ) => {
      if (busy) return;
      setBusy(true);
      setMood("thinking");
      stick.current = true;
      const now = new Date().toISOString();
      setTurns((all) => [
        ...all,
        ...(echo
          ? [
              {
                id: `u-${now}`,
                role: "user" as const,
                by: null,
                content: echo,
                cards: [],
                saved: [],
                created_at: now,
              },
            ]
          : []),
        {
          id: `a-${now}`,
          role: "assistant" as const,
          by,
          content: "",
          cards: [],
          saved: [],
          created_at: now,
          streaming: true,
        },
      ]);
      const ctrl = new AbortController();
      abort.current = ctrl;
      await streamChatTurn(
        body,
        {
          // Handover divider + the new assistant's welcome: they go before the reply being written.
          onMessage: (m) =>
            setTurns((all) => {
              const i = all.findIndex((x) => x.streaming);
              return i < 0
                ? [...all, m]
                : [...all.slice(0, i), m, ...all.slice(i)];
            }),
          onToken: (tok) => {
            setMood("speaking");
            patchLast((x) => ({ ...x, content: x.content + tok }));
          },
          onText: (t) => patchLast((x) => ({ ...x, content: t })),
          onSaved: (topics) => {
            react("happy");
            patchLast((x) => ({
              ...x,
              saved: [...new Set([...x.saved, ...topics])],
            }));
          },
          onCard: (card) =>
            patchLast((x) => ({ ...x, cards: [...x.cards, card] })),
          onState: (s) => setState(s),
          onDone: (d) => {
            patchLast((x) => ({ ...x, id: d.message_id, streaming: false }));
            setProgress(d.progress);
            // A quarter, half, three quarters, done: worth a little party.
            const pct = d.progress?.total
              ? (d.progress.done / d.progress.total) * 100
              : 0;
            const before = lastPct.current ?? pct;
            if ([25, 50, 75, 100].some((m) => before < m && pct >= m))
              setTimeout(() => react("celebrate"), 700);
            lastPct.current = pct;
          },
          onError: (e) => {
            if (e.code === "BUSY") {
              // An earlier reply is still being written (they came back mid-turn): show it when ready.
              setTurns((all) => all.filter((x) => !x.streaming));
              setTimeout(() => {
                started.current = false;
                void chatQuery.refetch();
              }, 2500);
              return;
            }
            react("confused");
            patchLast((x) => ({ ...x, streaming: false, error: e.code }));
          },
        },
        ctrl.signal,
      );
      patchLast((x) => (x.streaming ? { ...x, streaming: false } : x));
      setBusy(false);
      setMood("idle");
      // The profile may have changed through a card (billing, Google): refresh quietly.
      void qc.invalidateQueries({ queryKey: STATE_KEY });
    },
    [busy, qc, setState, react, level],
  );

  // Pick (first visit) or switch: the new face shows at once, the server adds the divider.
  const pickAssistant = useCallback(
    (next: AssistantLevel) => {
      if (busy || next === level) return;
      setLevel(next);
      started.current = true;
      react("wave");
      void send(
        { event: { type: "pick_assistant", level: next } },
        undefined,
        next,
      );
    },
    [busy, level, react, send],
  );

  // Lena speaks first: the first question after her welcome, or picking up again when the
  // customer comes back (from the form, or after leaving mid-reply). Nobody has to type "hello?".
  useEffect(() => {
    const d = chatQuery.data;
    if (!d?.available || started.current) return;
    if (d.busy) {
      // She's still finishing a reply from before: look again shortly.
      const id = setTimeout(() => void chatQuery.refetch(), 2500);
      return () => clearTimeout(id);
    }
    if (!d.needs_start && !d.needs_resume) return;
    started.current = true;
    const id = setTimeout(
      () => void send({ event: { type: d.needs_start ? "start" : "resume" } }),
      reduce ? 0 : 700,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatQuery.data]);

  useEffect(() => () => abort.current?.abort(), []);

  // Follow the conversation, unless the customer scrolled up to read.
  const opened = useRef(false);
  useLayoutEffect(() => {
    if (!turns.length || !stick.current) return;
    // Opening the page: jump to the latest message; afterwards follow new words smoothly.
    const smooth = opened.current && !reduce;
    opened.current = true;
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
    if (!smooth)
      requestAnimationFrame(() =>
        window.scrollTo({ top: document.body.scrollHeight }),
      );
  }, [turns, reduce]);
  useEffect(() => {
    const onScroll = () => {
      stick.current =
        window.innerHeight + window.scrollY >= document.body.scrollHeight - 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    // Chips on screen and they typed instead: a clear match is saved exactly like a tap.
    const open = lastAssistant?.cards.find(
      (c): c is Extract<ChatCard, { type: "choices" }> => c.type === "choices",
    );
    if (open) {
      const values = matchChoice(
        text,
        open.field,
        open.options,
        translators,
        open.multi,
      );
      if (values) {
        void send(
          { event: { type: "choice", field: open.field, values, label: text } },
          text,
        );
        return;
      }
      void send({ message: text, open_choice: open.field }, text);
      return;
    }
    void send({ message: text }, text);
  };
  const onEvent = useCallback(
    (ev: ChatEvent) => {
      const echo =
        ev.type === "choice" || ev.type === "place" || ev.type === "place_none"
          ? ev.label
          : undefined;
      void send({ event: ev }, echo);
    },
    [send],
  );

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const assistants = chatQuery.data?.assistants ?? [];
  const nameOf = (l: AssistantLevel | null) =>
    assistants.find((a) => a.key === l)?.name ?? "";
  const name = nameOf(level);
  const bizName = state?.workspace?.name ?? "";
  const lastAssistant = [...turns]
    .reverse()
    .find((x) => x.role === "assistant");
  const resume = progress?.resume_step ?? "business";
  const pct =
    progress && progress.total
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  const goToForm = () => {
    try {
      window.sessionStorage.setItem("onb:intro-seen", "1");
    } catch {
      /* ignore */
    }
  };

  if (!chatQuery.data?.available || !state) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <OnboardingStyles />
        <Portrait level="assisted" mood="thinking" size={88} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <OnboardingStyles />
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 pt-safe backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-5">
          <img
            src={logoUrl}
            alt="re:praesent"
            className="h-4 w-auto max-w-[96px] shrink-0 sm:h-6 sm:max-w-[120px]"
          />
          <div
            className="hidden flex-1 items-center gap-3 px-6 md:flex"
            aria-label={t("onb.chat.progress", {
              done: progress?.done ?? 0,
              total: progress?.total ?? 0,
            })}
          >
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-secondary"
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ duration: reduce ? 0 : 0.6, ease: EASE_OUT }}
              />
            </div>
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {t("onb.chat.progress", {
                done: progress?.done ?? 0,
                total: progress?.total ?? 0,
              })}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2 md:ml-0">
            <Link
              to={`/onboarding/start/${resume}`}
              onClick={goToForm}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              <ClipboardList className="size-4" aria-hidden />
              <span className="hidden sm:inline">
                {t("onb.chat.switchToForm")}
              </span>
              <span className="sr-only sm:hidden">
                {t("onb.chat.switchToForm")}
              </span>
            </Link>
            <OnbLanguageSwitcher />
            <AccountMenu />
          </div>
        </div>
        <div className="h-0.5 bg-muted md:hidden">
          <motion.div
            className="h-full bg-secondary"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: reduce ? 0 : 0.6, ease: EASE_OUT }}
          />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
        <main className="min-w-0 max-w-[660px]" ref={scroller}>
          {!level ? (
            <div className="pb-40">
              <AssistantPicker
                assistants={assistants}
                onPick={pickAssistant}
                disabled={busy}
              />
            </div>
          ) : (
            <>
              {/* Who you're talking to */}
              <div className="mb-8 flex items-center gap-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={level}
                    initial={
                      reduce
                        ? { opacity: 0 }
                        : { opacity: 0, transform: "scale(0.85)" }
                    }
                    animate={
                      reduce
                        ? { opacity: 1 }
                        : { opacity: 1, transform: "scale(1)" }
                    }
                    exit={
                      reduce
                        ? { opacity: 0 }
                        : { opacity: 0, transform: "scale(0.85)" }
                    }
                    transition={{
                      duration: reduce ? 0.12 : 0.28,
                      ease: EASE_OUT,
                    }}
                    className="inline-flex"
                  >
                    <Portrait
                      level={level}
                      mood={liveMood}
                      reaction={reaction}
                      size={76}
                      interactive
                      trackPointer
                      label={t("onb.chat.mascotLabel", { name })}
                    />
                  </motion.span>
                </AnimatePresence>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h1 className="ob2-heading text-2xl leading-tight">
                      {name}
                    </h1>
                    <AssistantSwitcher
                      assistants={assistants}
                      current={level}
                      onPick={pickAssistant}
                      disabled={busy}
                    />
                  </div>
                  <p
                    className="flex items-center gap-1.5 text-[13px] text-muted-foreground"
                    aria-live="polite"
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        busy ? "bg-secondary" : "bg-[#3f9a64]",
                      )}
                      aria-hidden
                    />
                    {busy
                      ? t("onb.chat.thinking", { name })
                      : t("onb.chat.role")}
                  </p>
                </div>
              </div>
              {bizName ? (
                <div className="mb-6 lg:hidden">
                  <BusinessCardChip data={state.profile?.data} name={bizName} />
                </div>
              ) : null}

              <ol
                className="space-y-6 pb-40"
                aria-live="polite"
                aria-relevant="additions"
              >
                <AnimatePresence initial={false}>
                  {turns.map((turn) => (
                    <motion.li
                      key={turn.id}
                      layout={reduce ? false : "position"}
                      initial={
                        reduce
                          ? { opacity: 0 }
                          : { opacity: 0, transform: "translateY(10px)" }
                      }
                      animate={
                        reduce
                          ? { opacity: 1 }
                          : { opacity: 1, transform: "translateY(0px)" }
                      }
                      transition={
                        reduce
                          ? { duration: 0.15 }
                          : { type: "spring", duration: 0.42, bounce: 0.08 }
                      }
                      className={cn(
                        "flex",
                        turn.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      {turn.role === "handover" && turn.by ? (
                        <div className="w-full">
                          <HandoverDivider
                            level={turn.by}
                            name={nameOf(turn.by)}
                          />
                        </div>
                      ) : turn.role === "user" ? (
                        <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-[15px] leading-relaxed text-background">
                          {turn.content}
                        </p>
                      ) : (
                        <AssistantTurn
                          turn={turn}
                          level={turn.by ?? level}
                          active={turn === lastAssistant && !busy}
                          state={state}
                          setState={setState}
                          onEvent={onEvent}
                          onRetry={() =>
                            void send({ event: { type: "start" } })
                          }
                        />
                      )}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            </>
          )}
        </main>
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <BusinessCard data={state.profile?.data} name={bizName} />
          </div>
        </aside>
      </div>

      {/* Composer (after an assistant is picked) */}
      {level ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background/95 to-transparent pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
          <div className="mx-auto grid max-w-6xl px-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
            <div className="relative max-w-[660px]">
              {/* The assistant peeks over the message box: shoulders tuck behind it. */}
              {level ? (
                <div className="pointer-events-auto absolute -top-[40px] right-5 z-0">
                  <Portrait
                    key={level}
                    level={level}
                    mood={liveMood}
                    reaction={reaction}
                    size={56}
                    interactive
                    trackPointer
                    label={t("onb.chat.mascotLabel", { name })}
                  />
                </div>
              ) : null}
              <form
                className="pointer-events-auto relative z-10 flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-[0_8px_30px_-12px_rgba(19,21,21,0.25)] focus-within:border-foreground/40"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <label htmlFor="onb-chat-input" className="sr-only">
                  {t("onb.chat.placeholder", { name })}
                </label>
                <textarea
                  id="onb-chat-input"
                  ref={input}
                  rows={1}
                  value={draft}
                  maxLength={2000}
                  onChange={(e) => setDraft(e.target.value)}
                  onFocus={() => setTyping(true)}
                  onBlur={() => setTyping(false)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={t("onb.chat.placeholder", { name })}
                  className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  aria-label={t("onb.chat.send")}
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition-[transform,opacity] active:scale-[0.94] disabled:opacity-30"
                >
                  {busy ? (
                    <Loader2
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden
                    />
                  ) : (
                    <ArrowUp className="size-4" aria-hidden />
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssistantTurn({
  turn,
  level,
  active,
  state,
  setState,
  onEvent,
  onRetry,
}: {
  turn: Turn;
  level: AssistantLevel;
  active: boolean;
  state: OnboardingState;
  setState: (s: OnboardingState) => void;
  onEvent: (ev: ChatEvent) => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const waiting = turn.streaming && !visibleText(turn.content).trim();
  return (
    <div className="flex w-full max-w-[640px] gap-3">
      <Portrait
        level={level}
        size={30}
        simple
        className="mt-0.5 hidden sm:inline-flex"
      />
      <div className="min-w-0 flex-1">
        {waiting ? (
          <span
            className="inline-flex h-7 items-center gap-1"
            aria-label={t("onb.chat.typing")}
          >
            {[0, 1, 2].map((i) => (
              <i
                key={i}
                className="size-1.5 rounded-full bg-foreground/40 animate-pulse motion-reduce:animate-none"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
        ) : turn.content ? (
          <div className="text-[16px] leading-[1.65] text-foreground [&_p+p]:mt-3">
            <SafeMarkdown text={visibleText(turn.content)} />
          </div>
        ) : null}
        {turn.saved.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {turn.saved.map((k) => (
              <li
                key={k}
                className="inline-flex items-center gap-1 rounded-full bg-[#a4dab8]/25 px-2 py-0.5 text-[12px] text-[#1f5c38]"
              >
                <Check className="size-3" strokeWidth={3} aria-hidden />
                {t("onb.chat.saved", {
                  topic: k.startsWith("custom_")
                    ? t("onb.chat.yourAnswer")
                    : t(`settings.onboarding.ai.q.${k}`, { defaultValue: k }),
                })}
              </li>
            ))}
          </ul>
        ) : null}
        {turn.error ? (
          <p className="mt-1 text-[15px] text-foreground/80">
            {t(`onb.chat.errors.${turn.error}`, {
              defaultValue: t("onb.chat.errors.upstream_failed"),
            })}{" "}
            {turn.error !== "RATE_LIMITED" && turn.error !== "unavailable" ? (
              <button
                type="button"
                onClick={onRetry}
                className="font-medium underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
              >
                {t("onb.chat.retry")}
              </button>
            ) : null}
          </p>
        ) : null}
        {turn.cards.map((card) => (
          <ChatCardView
            key={card.id}
            card={card}
            active={active}
            state={state}
            setState={setState}
            onEvent={onEvent}
          />
        ))}
      </div>
    </div>
  );
}
