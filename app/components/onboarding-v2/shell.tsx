"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, LogOut, MoreHorizontal, Repeat } from "lucide-react";
import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";
import { Portrait, PortraitStack } from "./chat/portrait";
import { ASSISTANT_LEVELS } from "~/lib/api/onboarding-chat";
import { LanguageSwitcher } from "~/components/language-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useAuthContext } from "~/providers/auth-provider";
import { cn } from "~/lib/utils";
import { BusinessCard, BusinessCardChip } from "./business-card";
import { useWizard } from "./wizard-context";
import { ProgressHeaderBar, ProgressRail, ProgressStrip } from "./progress";

/** Lora for the questions; the app's Geist everywhere else. */
export function OnboardingStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&display=swap');
      .ob2-heading { font-family: 'Lora', Georgia, serif; font-weight: 500; }
      /* The flow is light-only: keep native controls (checkboxes, selects, time pickers) light too. */
      :root { color-scheme: light; }
    `}</style>
  );
}

/** Button group from `sm` up; a compact select on phones so the header never overflows. */
export function OnbLanguageSwitcher() {
  // One compact EN/DE/FR/NL switch on every width (the phone dropdown put its arrow far from the text).
  return <LanguageSwitcher variant="light" persistToDb />;
}

function SavedTick() {
  const { t } = useTranslation();
  const { savedAt } = useWizard();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!savedAt) return;
    setShow(true);
    const id = setTimeout(() => setShow(false), 1400);
    return () => clearTimeout(id);
  }, [savedAt]);
  return (
    <span aria-live="polite" className="hidden w-16 text-right text-[12px] text-muted-foreground sm:inline-block">
      <AnimatePresence>
        {show ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="inline-flex items-center gap-1"
          >
            <Check className="size-3.5 text-[#3f9a64]" strokeWidth={3} />
            {t("onb.saved")}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

export function AccountMenu() {
  const { t } = useTranslation();
  const { workspaces, logout, user } = useAuthContext();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("onb.account")}
        className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
      >
        <MoreHorizontal className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-2rem)]">
        {/* Long addresses (plus-aliases) truncate instead of running past the menu edge. */}
        <div className="truncate px-2 py-1.5 text-xs text-muted-foreground" title={user?.email ?? undefined}>
          {user?.email}
        </div>
        {(workspaces?.length ?? 0) > 1 ? (
          <DropdownMenuItem asChild>
            <Link to="/auth/workspace-picker">
              <Repeat className="size-4" /> {t("onb.switchWorkspace")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => logout()}>
          <LogOut className="size-4" /> {t("onb.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The wizard frame. Questions on the left, the business taking shape on the
 * right. Step changes slide in the direction of travel with a critically
 * damped spring (interruptible); reduced motion gets a short cross-fade.
 */
export function WizardShell({ children, hideCard = false }: { children: React.ReactNode; hideCard?: boolean }) {
  const { t } = useTranslation();
  const { step, direction, state, draftName } = useWizard();
  const reduce = useReducedMotion();
  const name = state?.workspace?.name ?? draftName;
  const data = state?.profile?.data;
  const offset = direction * 28;

  return (
    // overflow-x-clip (not hidden): the entering step starts 28px to the side, and an
    // autofocused input would otherwise scroll the page sideways. Clip keeps `sticky` working.
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <OnboardingStyles />
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-5 xl:max-w-7xl">
          <img src={logoUrl} alt="re:praesent" className="h-4 w-auto max-w-[96px] shrink-0 sm:h-6 sm:max-w-[120px]" />
          {/* Tablet: progress in the header. Desktop has the rail; phones the strip below. */}
          <div className="hidden flex-1 px-6 md:block xl:invisible">
            <ProgressHeaderBar />
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2 md:ml-0">
            <SavedTick />
            {state?.assistant?.available ? (
              <Link
                to="/onboarding/chat"
                className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card p-1 text-[13px] sm:pr-3 font-medium text-foreground/85 transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                {state.assistant.chosen ? (
                  <Portrait level={state.assistant.chosen} size={28} simple />
                ) : (
                  <>
                    {/* Phones: one face keeps the header on one line; the three show from sm up. */}
                    <Portrait level="assisted" size={28} simple className="sm:hidden" />
                    <PortraitStack levels={ASSISTANT_LEVELS} size={24} className="hidden sm:inline-flex" />
                  </>
                )}
                <span className="hidden sm:inline">{state.assistant.name ? t("onb.chat.continueWith", { name: state.assistant.name }) : t("onb.chat.continueChat")}</span>
                <span className="sr-only sm:hidden">{state.assistant.name ? t("onb.chat.continueWith", { name: state.assistant.name }) : t("onb.chat.continueChat")}</span>
              </Link>
            ) : null}
            <OnbLanguageSwitcher />
            <AccountMenu />
          </div>
        </div>
        <div className="md:hidden">
          <ProgressStrip />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-8 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16 xl:max-w-7xl xl:grid-cols-[200px_minmax(0,1fr)_340px] xl:gap-14">
        <aside className="hidden xl:block">
          <ProgressRail />
        </aside>
        <main className="min-w-0 max-w-[620px]">
          {/* Phones: no empty card above the very first question — it only pushes it down. */}
          {!hideCard && step !== "business" ? (
            <div className="mb-8">
              <BusinessCardChip data={data} name={name} />
            </div>
          ) : null}
          <AnimatePresence mode="wait" initial={false} custom={offset}>
            <motion.div
              key={step}
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: `translateX(${offset}px)` }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateX(0px)" }}
              exit={
                reduce
                  ? { opacity: 0, transition: { duration: 0.12 } }
                  : { opacity: 0, transform: `translateX(${-offset / 2}px)`, transition: { duration: 0.14, ease: [0.23, 1, 0.32, 1] } }
              }
              transition={reduce ? { duration: 0.15 } : { type: "spring", duration: 0.38, bounce: 0 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        {!hideCard ? (
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <BusinessCard data={data} name={name} />
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
