"use client";

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Loader2, Lock } from "lucide-react";
import type { ChatCard, ChatEvent } from "~/lib/api/onboarding-chat";
import { completeOnboarding, errorCodeOf, getEnrichmentJob, type OnboardingState } from "~/lib/api/onboarding-v2";
import { displayHost } from "~/lib/onboarding/helpers";
import { optionLabel } from "~/lib/onboarding/option-labels";
import { cn } from "~/lib/utils";
import { BillingForm } from "../steps/plan";
import { PlaceCard } from "../steps/presence";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export interface CardProps {
  card: ChatCard;
  /** Only the newest card can be used; older ones stay as a record of the answer. */
  active: boolean;
  state: OnboardingState | undefined;
  setState: (s: OnboardingState) => void;
  onEvent: (ev: ChatEvent) => void;
}

/** A card the assistant hands over: sits under its message, like a sample on the counter. */
export function ChatCardView(props: CardProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(10px) scale(0.98)" }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px) scale(1)" }}
      transition={reduce ? { duration: 0.15 } : { type: "spring", duration: 0.45, bounce: 0.12 }}
      className={cn("mt-3", !props.active && "pointer-events-none")}
      aria-disabled={!props.active || undefined}
    >
      {props.card.type === "choices" ? <Choices {...props} card={props.card} /> : null}
      {props.card.type === "places" ? <Places {...props} card={props.card} /> : null}
      {props.card.type === "reading" ? <Reading {...props} card={props.card} /> : null}
      {props.card.type === "billing" ? <Billing {...props} /> : null}
      {props.card.type === "consent" ? <Consent {...props} /> : null}
    </motion.div>
  );
}

function Choices({ card, active, onEvent }: CardProps & { card: Extract<ChatCard, { type: "choices" }> }) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const label = (v: string) => optionLabel(t, card.field, v);
  const send = (values: string[]) => {
    if (!values.length || sent) return;
    setSent(true);
    onEvent({ type: "choice", field: card.field, values, label: values.map(label).join(", ") });
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("onb.chat.pick")}>
        {card.options.map((v) => {
          const on = picked.includes(v);
          return (
            <button
              key={v}
              type="button"
              disabled={!active || sent}
              aria-pressed={card.multi ? on : undefined}
              onClick={() => (card.multi ? setPicked((p) => (on ? p.filter((x) => x !== v) : [...p, v])) : (setPicked([v]), send([v])))}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-[14px] transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]",
                on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:border-foreground/40",
                v === "unknown" && !on && "border-dashed text-muted-foreground",
                (!active || sent) && !on && "opacity-50",
              )}
            >
              {on && card.multi ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
              {label(v)}
            </button>
          );
        })}
      </div>
      {card.multi && active && !sent ? (
        <button
          type="button"
          disabled={!picked.length}
          onClick={() => send(picked)}
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-transform active:scale-[0.97] disabled:opacity-40"
        >
          {t("onb.chat.thatsIt")} <ArrowRight className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function Places({ card, active, onEvent }: CardProps & { card: Extract<ChatCard, { type: "places" }> }) {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  return (
    <div className="space-y-2">
      {card.candidates.map((p) => (
        <PlaceCard
          key={p.place_id}
          place={p}
          busy={!active || sent}
          onPick={() => {
            setSent(true);
            onEvent({ type: "place", place_id: p.place_id, label: `${t("onb.google.thisIsUs")}: ${p.name}` });
          }}
        />
      ))}
      {active && !sent ? (
        <button
          type="button"
          onClick={() => {
            setSent(true);
            onEvent({ type: "place_none", label: t("onb.chat.noneOfThese") });
          }}
          className="h-10 rounded-lg px-2 text-sm text-muted-foreground underline decoration-foreground/20 underline-offset-4 hover:text-foreground"
        >
          {t("onb.chat.noneOfThese")}
        </button>
      ) : null}
    </div>
  );
}

/** Live website read: the same progress lines as the form, then hands the turn back to the assistant. */
function Reading({ card, active, state, setState, onEvent }: CardProps & { card: Extract<ChatCard, { type: "reading" }> }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const told = useRef(false);
  const q = useQuery({
    queryKey: ["onboarding-v2", "job", card.job_id],
    queryFn: () => getEnrichmentJob(card.job_id),
    // Older reading cards load once to show how it ended; only the live one keeps polling.
    refetchInterval: (x) => (!active || x.state.data?.job.status === "done" || x.state.data?.job.status === "failed" ? false : 1200),
  });
  const job = q.data?.job;
  const done = job?.status === "done" || job?.status === "failed";
  const liveProfile = q.data?.profile ?? null;
  const liveKey = liveProfile ? JSON.stringify(liveProfile.data) : "";
  useEffect(() => {
    if (liveProfile && state && JSON.stringify(state.profile?.data ?? {}) !== liveKey) setState({ ...state, profile: liveProfile });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey]);
  useEffect(() => {
    if (!done || !active || told.current) return;
    const id = setTimeout(() => {
      told.current = true;
      onEvent({ type: "website_read" });
    }, reduce ? 200 : 900);
    return () => clearTimeout(id);
  }, [done, active, onEvent, reduce]);

  const domain = displayHost(state?.workspace?.website ?? job?.input_url);
  const seen = new Set<string>();
  const lines = (job?.progress ?? []).filter((e) => e.code !== "done" && e.code !== "failed" && e.code !== "started" && (seen.has(e.code) ? false : (seen.add(e.code), true)));
  return (
    <div className="rounded-2xl border border-border bg-card p-4" aria-live="polite" aria-busy={!done}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        {done ? <Check className="size-4 text-[#2f7d4f]" strokeWidth={3} aria-hidden /> : <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
        {done ? t("onb.reading.doneTitle", { count: job?.found_count ?? 0 }) : t("onb.reading.title", { domain })}
      </p>
      <ul className="mt-2 space-y-1.5 pl-6">
        <AnimatePresence initial={false}>
          {lines.map((e) => (
            <motion.li
              key={e.code}
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px)" }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="text-[13px] text-foreground/80"
            >
              {t(`onb.reading.lines.${e.code}`, { count: e.count ?? 1, value: e.value ?? "", domain })}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function Billing({ active, state, setState, onEvent }: CardProps) {
  const { t } = useTranslation();
  const [sent, setSent] = useState(!!state?.workspace?.has_billing && !active);
  if (sent || !active) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-[#a4dab8]/20 px-4 py-3 text-sm">
        <Check className="size-4 text-[#2f7d4f]" strokeWidth={3} aria-hidden /> {t("onb.chat.billingSaved")}
      </p>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <BillingForm
        state={state}
        onSaved={(s) => {
          setState(s);
          setSent(true);
          onEvent({ type: "billing_saved" });
        }}
        actions={(busy) => (
          <button
            type="submit"
            disabled={busy}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-transform active:scale-[0.97] disabled:opacity-50 sm:w-auto"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Lock className="size-4" aria-hidden />}
            {t("onb.chat.saveBilling")}
          </button>
        )}
      />
    </div>
  );
}

function Consent({ active, state, setState }: CardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finish = async () => {
    if (!consent) return;
    setBusy(true);
    setError(null);
    try {
      const s = await completeOnboarding();
      setState(s);
      await qc.invalidateQueries({ queryKey: ["auth"] });
      try {
        window.sessionStorage.removeItem("onb:name");
      } catch {
        /* ignore */
      }
      navigate("/welcome", { replace: true, state: { celebrate: true } });
    } catch (err) {
      setError(errorCodeOf(err) === "ONBOARDING_INCOMPLETE" ? t("onb.plan.incomplete") : t("onb.errors.generic"));
      setBusy(false);
    }
  };
  const link = "font-medium text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          disabled={!active}
          className="mt-0.5 size-5 shrink-0 accent-[var(--foreground)] [color-scheme:light]"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span className="text-sm leading-relaxed">
          {t("onb.plan.consentPre")}{" "}
          <a href={state?.privacy_url} target="_blank" rel="noreferrer" className={link}>
            {t("onb.plan.privacy")}
          </a>
          {state?.terms_url ? (
            <>
              {" "}
              {t("onb.plan.and")}{" "}
              <a href={state.terms_url} target="_blank" rel="noreferrer" className={link}>
                {t("onb.plan.terms")}
              </a>
            </>
          ) : null}
          {t("onb.plan.consentPost")}
        </span>
      </label>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      <button
        type="button"
        disabled={!active || !consent || busy}
        onClick={() => void finish()}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition-transform active:scale-[0.97] disabled:opacity-40 sm:w-auto"
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t("onb.plan.finish")}
      </button>
    </div>
  );
}
