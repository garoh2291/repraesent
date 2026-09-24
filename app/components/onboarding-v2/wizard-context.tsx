"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOnboardingState,
  saveStep as saveStepApi,
  trackStepEvent,
  type Answers,
  type OnboardingState,
  type OnboardingStep,
  type ProfileData,
} from "~/lib/api/onboarding-v2";

export const STATE_KEY = ["onboarding-v2", "state"] as const;

/** Chapters shown in the progress bar, and which steps belong to each. */
export const CHAPTERS: Array<{ key: string; steps: OnboardingStep[] }> = [
  { key: "business", steps: ["business", "website", "reading", "details", "you"] },
  { key: "presence", steps: ["google", "social"] },
  { key: "goals", steps: ["goals", "growth", "sales"] },
  { key: "team", steps: ["email", "domain", "team", "notifications"] },
  { key: "plan", steps: ["billing", "plan"] },
];

const ALL_STEPS: OnboardingStep[] = CHAPTERS.flatMap((c) => c.steps);

export function chapterOf(step: OnboardingStep): number {
  return CHAPTERS.findIndex((c) => c.steps.includes(step));
}

interface WizardCtx {
  state: OnboardingState | undefined;
  isLoading: boolean;
  step: OnboardingStep;
  /** Steps in order for THIS customer ("reading" only when there is a website). */
  steps: OnboardingStep[];
  direction: 1 | -1;
  /** Name typed on step 1 before the business exists server-side. */
  draftName: string;
  setDraftName: (v: string) => void;
  goTo: (step: OnboardingStep, dir?: 1 | -1) => void;
  next: (from?: OnboardingStep) => void;
  back: () => void;
  /** Save a step and move on. Resolves with the new state. */
  save: (input: {
    step: OnboardingStep;
    next?: OnboardingStep;
    profile?: ProfileData;
    answers?: Answers;
    confirm_paths?: string[];
    skipped?: boolean;
    stay?: boolean;
  }) => Promise<OnboardingState>;
  saving: boolean;
  setState: (s: OnboardingState) => void;
  savedAt: number | null;
  markSaved: () => void;
}

const Ctx = createContext<WizardCtx | null>(null);

export function useWizard(): WizardCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWizard outside WizardProvider");
  return c;
}

export function useOnboardingState() {
  return useQuery({ queryKey: STATE_KEY, queryFn: getOnboardingState, staleTime: 5_000 });
}

export function WizardProvider({ step, children }: { step: OnboardingStep; children: React.ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: state, isLoading } = useOnboardingState();
  const [direction, setDirection] = useState<1 | -1>(1);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [draftName, setDraftNameState] = useState<string>(() => {
    try {
      return typeof window === "undefined" ? "" : window.sessionStorage.getItem("onb:name") ?? "";
    } catch {
      return "";
    }
  });
  const lastStep = useRef(step);

  const setDraftName = useCallback((v: string) => {
    setDraftNameState(v);
    try {
      window.sessionStorage.setItem("onb:name", v);
    } catch {
      /* private mode */
    }
  }, []);

  const hasWebsite = !!state?.workspace?.website;
  const steps = useMemo(
    () => ALL_STEPS.filter((s) => s !== "reading" || hasWebsite || step === "reading"),
    [hasWebsite, step],
  );

  const goTo = useCallback(
    (to: OnboardingStep, dir: 1 | -1 = 1) => {
      setDirection(dir);
      lastStep.current = to;
      navigate(`/onboarding/start/${to}`);
    },
    [navigate],
  );

  const next = useCallback(
    (from: OnboardingStep = step) => {
      const i = steps.indexOf(from);
      const to = steps[Math.min(steps.length - 1, i + 1)];
      goTo(to, 1);
    },
    [goTo, step, steps],
  );

  const back = useCallback(() => {
    const i = steps.indexOf(step);
    if (i <= 0) return;
    let to = steps[i - 1];
    // Never go "back" into the loading screen.
    if (to === "reading") to = steps[i - 2] ?? "website";
    void trackStepEvent(step, "back");
    goTo(to, -1);
  }, [goTo, step, steps]);

  const setState = useCallback((s: OnboardingState) => qc.setQueryData(STATE_KEY, s), [qc]);
  const markSaved = useCallback(() => setSavedAt(Date.now()), []);

  const mutation = useMutation({ mutationFn: saveStepApi });

  const save = useCallback<WizardCtx["save"]>(
    async (input) => {
      const i = steps.indexOf(input.step);
      const nextStep = input.next ?? steps[Math.min(steps.length - 1, i + 1)];
      const result = await mutation.mutateAsync({
        step: input.step,
        next_step: nextStep,
        profile: input.profile,
        answers: input.answers,
        confirm_paths: input.confirm_paths,
        skipped: input.skipped,
      });
      setState(result);
      markSaved();
      if (!input.stay) goTo(nextStep, 1);
      return result;
    },
    [goTo, markSaved, mutation, setState, steps],
  );

  const value: WizardCtx = {
    state,
    isLoading,
    step,
    steps,
    direction,
    draftName,
    setDraftName,
    goTo,
    next,
    back,
    save,
    saving: mutation.isPending,
    setState,
    savedAt,
    markSaved,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
