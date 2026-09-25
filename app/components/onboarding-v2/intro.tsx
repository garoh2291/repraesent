"use client";

import { useTranslation } from "react-i18next";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  CalendarCheck2,
  ClipboardList,
  Gift,
  MessageSquareText,
  PhoneCall,
  ReceiptText,
  Rocket,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react";
import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";
import type { OnboardingState } from "~/lib/api/onboarding-v2";
import { formatMoney } from "~/lib/onboarding/helpers";
import { cn } from "~/lib/utils";
import { AccountMenu, OnbLanguageSwitcher, OnboardingStyles } from "./shell";
import { Portrait, PortraitStack } from "./chat/portrait";
import { ASSISTANT_LEVELS, type AssistantLevel } from "~/lib/api/onboarding-chat";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * The screen before step 1. Says, before anyone types anything: the first two
 * months are free and nothing is paid today, a real person (by name) sets
 * everything up with you, and the questions ahead are the brief for your
 * website and marketing — re:praesent is more than hosting and a CRM.
 *
 * Not a wizard step: no chapter bar, not counted in progress. Shown once per
 * browser session to people who haven't started yet.
 */
export type OnboardingMode = "form" | "chat";

export function OnboardingIntro({ state, onStart }: { state: OnboardingState; onStart: (mode: OnboardingMode) => void }) {
  const { t, i18n } = useTranslation();
  const reduce = useReducedMotion();
  const q = state.pricing;
  const free = q?.freeMonths ?? 2;
  const money = (c: number, d: "auto" | 0 | 2 = "auto") => (q ? formatMoney(c, q.currency, i18n.language, d) : "");
  const team = (state.sales_team ?? []).filter((h) => h.label || h.avatar_url);
  const assistant = state.assistant?.available ? state.assistant : null;
  // The root's own intro texts for this region + language, when set (Settings → Onboarding → AI assistant).
  const ownHeadline = assistant?.intro?.headline ?? null;
  const ownSub = assistant?.intro?.sub ?? null;
  const names = team.map((h) => h.label?.split(" ")[0]).filter((n): n is string => !!n);
  const namesText =
    names.length === 0 ? null : names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} ${t("onb.intro.and")} ${names[names.length - 1]}`;

  const rise = (i: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : {
          initial: { opacity: 0, transform: "translateY(12px)" },
          animate: { opacity: 1, transform: "translateY(0px)" },
          transition: { duration: 0.5, ease: EASE_OUT, delay: 0.06 * i },
        };

  const offer = [
    { icon: Gift, title: t("onb.intro.offer.free.title", { count: free }), sub: t("onb.intro.offer.free.sub") },
    { icon: Wallet, title: t("onb.intro.offer.today.title"), sub: t("onb.intro.offer.today.sub") },
    {
      icon: ReceiptText,
      title: q ? t("onb.intro.offer.then.title", { price: money(q.yearly) }) : t("onb.intro.offer.then.titleNoPrice"),
      sub: q ? t("onb.intro.offer.then.sub", { perDay: money(q.perDay, 2) }) : "",
    },
  ];

  const steps = [
    { icon: MessageSquareText, title: t("onb.intro.steps.tell.title"), body: t("onb.intro.steps.tell.body") },
    {
      icon: PhoneCall,
      title: t("onb.intro.steps.call.title"),
      body: namesText ? t("onb.intro.steps.call.bodyNamed", { names: namesText, count: names.length }) : t("onb.intro.steps.call.body"),
      people: true,
    },
    { icon: Rocket, title: t("onb.intro.steps.live.title"), body: t("onb.intro.steps.live.body", { count: free }) },
  ];

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <OnboardingStyles />
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <img src={logoUrl} alt="re:praesent" className="h-5 w-auto max-w-[120px] shrink-0 sm:h-6" />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <OnbLanguageSwitcher />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:pt-16">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <div>
            <motion.p {...rise(0)} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/55">
              <span aria-hidden className="size-1.5 rounded-[2px] bg-secondary ring-1 ring-foreground/15" />
              {t("onb.intro.eyebrow")}
            </motion.p>
            <motion.h1
              {...rise(1)}
              className="ob2-heading mt-4 max-w-[18ch] text-balance text-[2.25rem] leading-[1.06] tracking-[-0.02em] sm:text-[3.5rem]"
            >
              {ownHeadline ?? (
                <>
                  {t("onb.intro.title1")}{" "}
                  <span className="relative whitespace-nowrap">
                    <span className="relative z-10">{t("onb.intro.titleHighlight")}</span>
                    <span aria-hidden className="absolute inset-x-0 bottom-[0.08em] z-0 h-[0.32em] rounded-sm bg-secondary" />
                  </span>{" "}
                  {t("onb.intro.title2")}
                </>
              )}
            </motion.h1>
            <motion.p {...rise(2)} className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
              {ownSub ?? t("onb.intro.sub")}
            </motion.p>

            {/* The offer: impossible to miss, before a single field. */}
            <motion.ul
              {...rise(3)}
              aria-label={t("onb.intro.offer.label")}
              className="mt-8 grid overflow-hidden rounded-2xl border border-foreground/10 bg-secondary sm:grid-cols-3"
            >
              {offer.map((o, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3.5",
                    i > 0 && "border-t border-foreground/10 sm:border-l sm:border-t-0",
                  )}
                >
                  <o.icon className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold leading-snug text-foreground">{o.title}</span>
                    {o.sub ? <span className="mt-0.5 block text-[12.5px] leading-snug text-foreground/70">{o.sub}</span> : null}
                  </span>
                </li>
              ))}
            </motion.ul>

            {assistant ? (
              <motion.div {...rise(4)} className="mt-8">
                <WayChoice name={assistant.name} chosen={assistant.chosen ?? null} onStart={onStart} />
              </motion.div>
            ) : (
              <motion.div {...rise(4)} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                <StartButton onStart={() => onStart("form")} label={t("onb.intro.cta")} />
                <p className="text-[13px] text-muted-foreground">{t("onb.intro.ctaNote")}</p>
              </motion.div>
            )}
          </div>

          <Showcase />
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section className="mt-20 sm:mt-28" aria-labelledby="onb-intro-how">
          <h2 id="onb-intro-how" className="ob2-heading text-[1.75rem] leading-tight tracking-[-0.01em] sm:text-[2.1rem]">
            {t("onb.intro.howTitle")}
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={i} className="relative rounded-2xl border border-border bg-card p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-foreground text-background" aria-hidden>
                    <s.icon className="size-5" />
                  </span>
                  <span className="font-mono text-[12px] text-muted-foreground/70">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.01em]">{s.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{s.body}</p>
                {s.people && team.length ? (
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex -space-x-2" aria-hidden>
                      {team.slice(0, 4).map((h, j) =>
                        h.avatar_url ? (
                          <img key={j} src={h.avatar_url} alt="" className="size-9 rounded-full bg-muted object-cover ring-2 ring-card" />
                        ) : (
                          <span key={j} className="flex size-9 items-center justify-center rounded-full bg-secondary text-[13px] font-semibold ring-2 ring-card">
                            {(h.label ?? "?").charAt(0)}
                          </span>
                        ),
                      )}
                    </div>
                    <span className="text-[13px] text-muted-foreground">{t("onb.intro.realPeople")}</span>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        {/* ── Why the questions matter ─────────────────────────────────────── */}
        <section className="mt-16 overflow-hidden rounded-3xl bg-foreground px-6 py-10 text-background sm:px-12 sm:py-14">
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
                <Sparkles className="size-3.5" aria-hidden /> {t("onb.intro.whyEyebrow")}
              </p>
              <p className="ob2-heading mt-4 max-w-[30ch] text-balance text-[1.6rem] leading-snug sm:text-[2rem]">
                {t("onb.intro.whyTitle")}
              </p>
              <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-background/70">{t("onb.intro.whyBody", { count: free })}</p>
            </div>
            <StartButton
              onStart={() => onStart(assistant ? "chat" : "form")}
              label={assistant ? (assistant.name ? t("onb.intro.way.chatCta", { name: assistant.name }) : t("onb.intro.way.chatCtaTeam")) : t("onb.intro.cta")}
              inverted
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function StartButton({ onStart, label, inverted = false }: { onStart: () => void; label: string; inverted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className={cn(
        "group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold transition-[transform,opacity,background-color] duration-150 ease-out active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        inverted
          ? "bg-secondary text-foreground hover:bg-secondary/90 focus-visible:ring-secondary focus-visible:ring-offset-foreground"
          : "bg-foreground text-background hover:opacity-90 focus-visible:ring-foreground/30 focus-visible:ring-offset-background",
      )}
    >
      {label}
      <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}

/**
 * A showroom's online life, assembling: the website, then what it brings in.
 * Decorative (aria-hidden). Cards arrive with a short stagger, then drift a
 * few pixels on their own rhythm; reduced motion gets them static.
 */
function Showcase() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const float = (i: number) =>
    reduce
      ? {}
      : {
          animate: { transform: ["translateY(0px)", "translateY(-6px)", "translateY(0px)"] },
          transition: { duration: 5 + i * 0.8, repeat: Infinity, ease: "easeInOut" as const, delay: 1 + i * 0.4 },
        };
  const pop = (i: number) =>
    reduce
      ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, transform: "scale(0.94) translateY(10px)" },
          animate: { opacity: 1, transform: "scale(1) translateY(0px)" },
          transition: { type: "spring" as const, duration: 0.6, bounce: 0.15, delay: 0.35 + i * 0.18 },
        };

  const notes = [
    { icon: MessageSquareText, tone: "bg-foreground text-background", title: t("onb.intro.show.lead.title"), sub: t("onb.intro.show.lead.sub"), pos: "left-0 top-[8%] xl:left-[-8%]" },
    { icon: Star, tone: "bg-secondary text-foreground", title: t("onb.intro.show.google.title"), sub: t("onb.intro.show.google.sub"), pos: "right-0 top-[38%] xl:right-[-6%]" },
    { icon: CalendarCheck2, tone: "bg-[#a4dab8] text-[#1f5c38]", title: t("onb.intro.show.booked.title"), sub: t("onb.intro.show.booked.sub"), pos: "bottom-[16%] left-0 xl:left-[-6%]" },
    { icon: Sparkles, tone: "bg-foreground text-secondary", title: t("onb.intro.show.ai.title"), sub: t("onb.intro.show.ai.sub"), pos: "bottom-[-2%] right-[4%]" },
  ];

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[460px] py-6 lg:max-w-none">
      {/* The website */}
      <motion.div {...pop(0)} className="relative rounded-2xl border border-border bg-card shadow-[0_24px_60px_-28px_rgba(19,21,21,0.35)]">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="ml-3 h-5 flex-1 rounded-md bg-muted px-2 text-[11px] leading-5 text-muted-foreground">{t("onb.intro.show.url")}</span>
        </div>
        <div className="space-y-4 p-5">
          <div className="relative h-36 overflow-hidden rounded-xl bg-[linear-gradient(135deg,#e8e4dc_0%,#d8d2c6_100%)] sm:h-44">
            <div className="absolute bottom-4 left-4 right-4 space-y-2">
              <div className="h-4 w-2/3 rounded bg-foreground/80" />
              <div className="h-3 w-1/2 rounded bg-foreground/35" />
              <div className="mt-3 h-7 w-28 rounded-lg bg-secondary" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-16 rounded-lg bg-muted" />
                <div className="h-2.5 w-3/4 rounded bg-foreground/15" />
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* What it brings in */}
      {notes.map((n, i) => (
        <motion.div key={i} {...pop(i + 1)} className={cn("absolute", n.pos)}>
          <motion.div {...float(i)} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-[0_14px_36px_-18px_rgba(19,21,21,0.4)]">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", n.tone)}>
              <n.icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-[13px] font-semibold leading-tight">{n.title}</span>
              <span className="block whitespace-nowrap text-[12px] leading-tight text-muted-foreground">{n.sub}</span>
            </span>
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Two ways through the same onboarding. Equal weight on purpose: the form is
 * not the "boring" option, it is the in-control one.
 */
function WayChoice({ name, chosen, onStart }: { name: string | null; chosen: AssistantLevel | null; onStart: (mode: OnboardingMode) => void }) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(false);
  const card =
    "group relative flex min-h-[132px] flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-[transform,box-shadow,border-color] duration-200 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-5";
  return (
    <div>
      <p className="mb-3 text-[13px] font-medium text-foreground/70">{t("onb.intro.way.label")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onStart("chat")}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          className={cn(card, "border-foreground bg-foreground text-background shadow-[0_10px_30px_-14px_rgba(19,21,21,0.55)] hover:-translate-y-0.5")}
        >
          <span className="flex w-full items-center justify-between">
            {/* One face once they've picked someone, otherwise the three to choose from. */}
            {chosen ? (
              <Portrait level={chosen} mood={hover ? "listening" : "idle"} size={44} />
            ) : (
              <PortraitStack levels={ASSISTANT_LEVELS} size={40} className="[&>span]:ring-foreground" />
            )}
            <ArrowRight className="size-4 text-secondary transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </span>
          <span>
            <span className="block text-[15px] font-semibold">{name ? t("onb.intro.way.chatTitle", { name }) : t("onb.intro.way.chatTitleTeam")}</span>
            <span className="mt-1 block text-[13px] leading-snug text-background/70">{name ? t("onb.intro.way.chatSub", { name }) : t("onb.intro.way.chatSubTeam")}</span>
          </span>
        </button>
        <button type="button" onClick={() => onStart("form")} className={cn(card, "border-border bg-card text-foreground hover:-translate-y-0.5 hover:border-foreground/40")}>
          <span className="flex w-full items-center justify-between">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted" aria-hidden>
              <ClipboardList className="size-5 text-foreground/80" />
            </span>
            <ArrowRight className="size-4 text-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </span>
          <span>
            <span className="block text-[15px] font-semibold">{t("onb.intro.way.formTitle")}</span>
            <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">{t("onb.intro.way.formSub")}</span>
          </span>
        </button>
      </div>
      <p className="mt-3 text-[12.5px] text-muted-foreground">{t("onb.intro.way.switch")}</p>
    </div>
  );
}
