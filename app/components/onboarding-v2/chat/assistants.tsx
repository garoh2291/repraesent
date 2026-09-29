"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeftRight, ArrowRight, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import type { AssistantLevel } from "~/lib/api/onboarding-chat";
import { cn } from "~/lib/utils";
import { Portrait } from "./portrait";

/**
 * Picking and switching the onboarding assistant (AI_ONBOARDING_PLAN.md, Phase 6).
 *
 * Customers pick by how they see themselves ("Keep it simple, please"), not by a name they
 * don't know yet, so the level is the headline and the name comes second. Each card shows
 * the SAME question the way that assistant would ask it: the difference is obvious at a glance.
 */

type Assistant = { key: AssistantLevel; name: string };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function AssistantPicker({
  assistants,
  onPick,
  disabled,
}: {
  assistants: Assistant[];
  onPick: (level: AssistantLevel) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<AssistantLevel | null>(null);
  return (
    <section aria-labelledby="onb-pick-title">
      <h1 id="onb-pick-title" className="ob2-heading text-[26px] leading-tight sm:text-3xl">
        {t("onb.chat.assistants.pickTitle")}
      </h1>
      <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground">
        {t("onb.chat.assistants.pickSub")}
      </p>
      <ul className="mt-7 space-y-3">
        {assistants.map((a, i) => (
          <motion.li
            key={a.key}
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(12px)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
            transition={reduce ? { duration: 0.15 } : { duration: 0.45, delay: 0.08 + i * 0.07, ease: EASE_OUT }}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(a.key)}
              onPointerEnter={() => setHover(a.key)}
              onPointerLeave={() => setHover((h) => (h === a.key ? null : h))}
              onFocus={() => setHover(a.key)}
              onBlur={() => setHover((h) => (h === a.key ? null : h))}
              className="group flex w-full items-start gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-[0_10px_28px_-18px_rgba(19,21,21,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 sm:gap-5 sm:p-5"
            >
              <Portrait level={a.key} size={64} mood={hover === a.key ? "listening" : "idle"} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-[16px] font-semibold leading-snug">
                      {t(`onb.chat.assistants.levels.${a.key}.title`)}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">
                      {t("onb.chat.assistants.choose", { name: a.name })}
                    </span>
                  </span>
                  <ArrowRight
                    className="mt-1 size-4 shrink-0 text-foreground/40 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
                    aria-hidden
                  />
                </span>
                <span className="mt-3 block rounded-xl rounded-tl-sm border-l-[3px] border-secondary bg-muted/60 px-3 py-2 text-[13.5px] leading-snug text-foreground/85">
                  <span className="sr-only">{t("onb.chat.assistants.howTheyAsk")}: </span>
                  {t(`onb.chat.assistants.levels.${a.key}.sample`)}
                </span>
              </span>
            </button>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

/** "Change" next to the assistant's name: the three in a small menu, current one ticked. */
export function AssistantSwitcher({
  assistants,
  current,
  onPick,
  disabled,
}: {
  assistants: Assistant[];
  current: AssistantLevel;
  onPick: (level: AssistantLevel) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[12.5px] font-medium text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 disabled:opacity-50"
        >
          <ArrowLeftRight className="size-3.5" aria-hidden />
          {t("onb.chat.assistants.change")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[min(92vw,340px)] rounded-2xl border-border bg-card p-2">
        <div className="px-2 pb-2 pt-1.5">
          <p className="text-[14px] font-semibold">{t("onb.chat.assistants.switchTitle")}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{t("onb.chat.assistants.switchSub")}</p>
        </div>
        <ul>
          {assistants.map((a) => {
            const on = a.key === current;
            return (
              <li key={a.key}>
                <button
                  type="button"
                  aria-current={on ? "true" : undefined}
                  onClick={() => {
                    setOpen(false);
                    if (!on) onPick(a.key);
                  }}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30",
                    on ? "bg-muted" : "hover:bg-muted/70",
                  )}
                >
                  <Portrait level={a.key} size={40} simple />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium">{a.name}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {t(`onb.chat.assistants.levels.${a.key}.title`)}
                    </span>
                  </span>
                  {on ? (
                    <span className="inline-flex items-center gap-1 text-[12px] text-foreground/70">
                      <Check className="size-3.5" aria-hidden />
                      <span className="sr-only sm:not-sr-only">{t("onb.chat.assistants.current")}</span>
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Divider in the conversation where another assistant took over. */
export function HandoverDivider({ level, name }: { level: AssistantLevel; name: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 py-1 text-[12.5px] text-muted-foreground" role="note">
      <span className="h-px flex-1 bg-border" aria-hidden />
      <Portrait level={level} size={22} simple />
      <span>{t("onb.chat.assistants.handover", { name })}</span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}
