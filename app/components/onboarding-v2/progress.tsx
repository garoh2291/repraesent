"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "~/components/ui/drawer";
import type { OnboardingStep } from "~/lib/api/onboarding-v2";
import { cn } from "~/lib/utils";
import { CHAPTERS, chapterOf, useWizard } from "./wizard-context";

/**
 * "How much is left?" — always visible, because that's what people check
 * before they decide to carry on. Same data everywhere:
 *
 *   desktop (xl)   a sticky rail on the left: step N of M, minutes left, the
 *                  five chapters, the current one opened up into its steps
 *   tablet         the chapter bar in the sticky header, with the same count
 *   phone          one slim sticky strip under the logo; tap it for the full
 *                  list in a bottom sheet
 *
 * Finished steps are links back (never past what's been answered: `furthest`).
 * The minutes are an honest estimate ("about"), from the ~8 minutes the whole
 * form takes.
 */

const SECONDS_PER_STEP = 35;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function useProgress() {
  const { step, steps, furthest } = useWizard();
  // "reading" is a waiting screen, not a question: never counted or listed.
  const shown: OnboardingStep[] = steps.filter((s) => s !== "reading");
  const here: OnboardingStep = step === "reading" ? "details" : step;
  const index = Math.max(0, shown.indexOf(here));
  const reach = Math.max(index, shown.indexOf(furthest === "reading" ? "details" : furthest));
  const minutes = Math.max(1, Math.ceil(((shown.length - index) * SECONDS_PER_STEP) / 60));
  const current = chapterOf(here);
  const chapters = CHAPTERS.map((c, i) => {
    const own = c.steps.filter((s) => shown.includes(s));
    const within = own.indexOf(here);
    return {
      key: c.key,
      steps: own,
      state: i < current ? ("done" as const) : i === current ? ("current" as const) : ("next" as const),
      fraction: i < current ? 1 : i > current ? 0 : (within + 0.5) / Math.max(1, own.length),
    };
  });
  return { here, number: index + 1, total: shown.length, minutes, last: index === shown.length - 1, chapters, current, canOpen: (s: OnboardingStep) => shown.indexOf(s) <= reach };
}

function Summary({ big = false }: { big?: boolean }) {
  const { t } = useTranslation();
  const p = useProgress();
  return (
    <div>
      <p className={cn(big ? "ob2-heading text-[1.6rem] leading-tight" : "text-[14px] font-semibold")}>
        {t("onb.progress.stepOf", { n: p.number, total: p.total })}
      </p>
      <p className={cn("text-muted-foreground", big ? "mt-1 text-[13.5px]" : "text-[12.5px]")}>
        {p.last ? t("onb.progress.lastStep") : t("onb.progress.minutesLeft", { count: p.minutes })}
      </p>
    </div>
  );
}

/** Thin bar split into the five chapters; the current one fills as you go. */
function SegmentedBar({ className }: { className?: string }) {
  const p = useProgress();
  const reduce = useReducedMotion();
  return (
    <div className={cn("grid grid-cols-5 gap-1", className)} aria-hidden>
      {p.chapters.map((c) => (
        <div key={c.key} className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <motion.div
            className="h-full origin-left rounded-full bg-foreground"
            initial={false}
            animate={{ transform: `scaleX(${c.fraction})` }}
            transition={{ duration: reduce ? 0 : 0.4, ease: EASE_OUT }}
          />
        </div>
      ))}
    </div>
  );
}

/** The chapters with their steps: done ✓ (a link back), current (marker), next (quiet). */
function StepList({ onPick, expandAll = false }: { onPick?: () => void; expandAll?: boolean }) {
  const { t } = useTranslation();
  const { goTo } = useWizard();
  const p = useProgress();
  return (
    <ol className="relative space-y-1">
      {p.chapters.map((c, ci) => {
        const open = expandAll || c.state === "current";
        return (
          <li key={c.key} aria-current={c.state === "current" ? "step" : undefined}>
            <div className="flex items-center gap-3 py-1.5">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  c.state === "done" && "bg-foreground text-background",
                  c.state === "current" && "bg-secondary text-foreground ring-2 ring-foreground",
                  c.state === "next" && "border border-foreground/20 text-muted-foreground",
                )}
                aria-hidden
              >
                {c.state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : ci + 1}
              </span>
              <span className={cn("text-[14px]", c.state === "current" ? "font-semibold text-foreground" : c.state === "done" ? "text-foreground/80" : "text-muted-foreground")}>
                {t(`onb.chapters.${c.key}`)}
              </span>
            </div>
            {open ? (
              <ul className="mb-2 ml-3 space-y-0.5 border-l border-foreground/15 pl-5">
                {c.steps.map((s) => {
                  const isHere = s === p.here;
                  // Already answered (up to the furthest point reached): a link back.
                  const done = !isHere && p.canOpen(s);
                  const label = t(`onb.stepNames.${s}`);
                  return (
                    <li key={s}>
                      {done ? (
                        <button
                          type="button"
                          onClick={() => {
                            onPick?.();
                            goTo(s, -1);
                          }}
                          className="flex min-h-9 w-full items-center gap-2 rounded-md text-left text-[13px] text-foreground/75 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                        >
                          <Check className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                          <span className="truncate">{label}</span>
                        </button>
                      ) : (
                        <span
                          className={cn(
                            "relative flex min-h-9 items-center gap-2 text-[13px]",
                            isHere ? "font-semibold text-foreground" : "text-muted-foreground/80",
                          )}
                          aria-current={isHere ? "step" : undefined}
                        >
                          {isHere ? <span className="absolute -left-[23px] h-5 w-[3px] rounded-full bg-foreground" aria-hidden /> : null}
                          <span className={cn("size-1.5 shrink-0 rounded-full", isHere ? "bg-secondary ring-1 ring-foreground/40" : "bg-foreground/20")} aria-hidden />
                          <span className="truncate">{label}</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Desktop: the left rail. Sticky, so the answer to "how much is left?" never scrolls away. */
export function ProgressRail() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("onb.progress.label")} className="sticky top-28">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("onb.progress.title")}</p>
      <div className="mt-2">
        <Summary big />
      </div>
      <SegmentedBar className="mt-4" />
      <div className="mt-6">
        <StepList />
      </div>
    </nav>
  );
}

/** Tablet: the bar in the header with one line under it (chapter · step · minutes). */
export function ProgressHeaderBar() {
  const { t } = useTranslation();
  const p = useProgress();
  const chapter = p.chapters[p.current];
  return (
    <nav aria-label={t("onb.progress.label")} className="w-full">
      <SegmentedBar />
      <p className="mt-1.5 flex items-center gap-1.5 truncate text-[12px]">
        <span className="font-semibold text-foreground">{chapter ? t(`onb.chapters.${chapter.key}`) : null}</span>
        <span className="text-muted-foreground">·</span>
        <span className="tabular-nums text-muted-foreground">{t("onb.progress.stepShort", { n: p.number, total: p.total })}</span>
        <span className="text-muted-foreground">·</span>
        <span className="truncate text-muted-foreground">
          {p.last ? t("onb.progress.lastStep") : t("onb.progress.minutesShort", { count: p.minutes })}
        </span>
      </p>
    </nav>
  );
}

/** Phone: one slim strip under the logo; tap for everything in a sheet. */
export function ProgressStrip() {
  const { t } = useTranslation();
  const p = useProgress();
  const [open, setOpen] = useState(false);
  const chapter = p.chapters[p.current];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t("onb.progress.openList")}
        className="block w-full px-5 pb-2.5 pt-1 text-left"
      >
        <SegmentedBar />
        <span className="mt-1.5 flex items-center gap-1.5 text-[12.5px]">
          <span className="font-semibold text-foreground">{chapter ? t(`onb.chapters.${chapter.key}`) : null}</span>
          <span className="text-muted-foreground">·</span>
          <span className="tabular-nums text-muted-foreground">{t("onb.progress.stepShort", { n: p.number, total: p.total })}</span>
          <span className="text-muted-foreground">·</span>
          <span className="truncate text-muted-foreground">
            {p.last ? t("onb.progress.lastStep") : t("onb.progress.minutesShort", { count: p.minutes })}
          </span>
          <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
        </span>
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85dvh] rounded-t-[28px] border-0 bg-background">
          <DrawerTitle className="sr-only">{t("onb.progress.title")}</DrawerTitle>
          <DrawerDescription className="sr-only">{t("onb.progress.label")}</DrawerDescription>
          <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            <Summary big />
            <SegmentedBar className="mt-4" />
            <div className="mt-5">
              <StepList expandAll onPick={() => setOpen(false)} />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
