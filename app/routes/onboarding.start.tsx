import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { ONBOARDING_STEPS, trackStepEvent, type OnboardingStep } from "~/lib/api/onboarding-v2";
import { OnboardingStyles, WizardShell } from "~/components/onboarding-v2/shell";
import { OnboardingIntro } from "~/components/onboarding-v2/intro";
import { useOnboardingState, useWizard, WizardProvider } from "~/components/onboarding-v2/wizard-context";
import { StepName, StepReading, StepWebsite } from "~/components/onboarding-v2/steps/business";
import { StepDetails, StepYou } from "~/components/onboarding-v2/steps/details";
import { StepGoogle, StepSocial } from "~/components/onboarding-v2/steps/presence";
import { StepGoals, StepGrowth, StepSales } from "~/components/onboarding-v2/steps/goals";
import { StepDomain, StepEmail, StepNotifications, StepTeam } from "~/components/onboarding-v2/steps/team";
import { StepBilling, StepPlan } from "~/components/onboarding-v2/steps/plan";

const COMPONENTS: Record<OnboardingStep, React.ComponentType> = {
  business: StepName,
  website: StepWebsite,
  reading: StepReading,
  details: StepDetails,
  you: StepYou,
  google: StepGoogle,
  social: StepSocial,
  goals: StepGoals,
  growth: StepGrowth,
  sales: StepSales,
  email: StepEmail,
  domain: StepDomain,
  team: StepTeam,
  notifications: StepNotifications,
  billing: StepBilling,
  plan: StepPlan,
};

const isStep = (s: string | undefined): s is OnboardingStep => !!s && (ONBOARDING_STEPS as readonly string[]).includes(s);

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <OnboardingStyles />
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  );
}

function StepView() {
  const { step, back } = useWizard();
  const Component = COMPONENTS[step];

  useEffect(() => {
    void trackStepEvent(step, "view");
  }, [step]);

  // Esc goes back — unless focus is in a field or a menu/dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"],[role="menu"],[role="listbox"]')) return;
      back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back]);

  return (
    <WizardShell>
      <Component />
    </WizardShell>
  );
}

/**
 * New-account onboarding (v2). The URL names the step so the browser's back
 * button and a reload both work; the server's `current_step` says how far the
 * customer may go.
 */
export default function OnboardingStartRoute() {
  const { t } = useTranslation();
  const { step: param } = useParams();
  const navigate = useNavigate();
  const { data: state, isLoading } = useOnboardingState();
  const [introDone, setIntroDone] = useState(false);

  useDocumentMeta({ titleKey: "onb.metaTitle", descriptionKey: "onb.metaDescription", titleSuffix: " - re:praesent" });

  useEffect(() => {
    if (state?.run?.status === "completed") navigate("/welcome", { replace: true });
  }, [navigate, state?.run?.status]);

  if (isLoading || !state) return <Loading />;
  if (state.run?.status === "completed") return <Loading />;

  const order = ONBOARDING_STEPS as readonly OnboardingStep[];
  let draft = "";
  try {
    draft = typeof window === "undefined" ? "" : window.sessionStorage.getItem("onb:name") ?? "";
  } catch {
    draft = "";
  }
  // The intro (offer, real people, why the questions matter) comes before the
  // first question — once per browser session, only for people who haven't started.
  let introSeen = introDone;
  try {
    introSeen ||= typeof window !== "undefined" && window.sessionStorage.getItem("onb:intro-seen") === "1";
  } catch {
    /* private mode: show it */
  }
  if (!state.run && !draft && !introSeen && (!param || param === "business")) {
    return (
      <OnboardingIntro
        state={state}
        onStart={() => {
          try {
            window.sessionStorage.setItem("onb:intro-seen", "1");
          } catch {
            /* ignore */
          }
          setIntroDone(true);
          navigate("/onboarding/start/business", { replace: !param });
        }}
      />
    );
  }

  // "reading" is only a waiting screen: from there the review step is always open
  // (the customer may carry on while we still read, and late results merge in).
  const serverStep = state.run?.current_step;
  const furthest: OnboardingStep = serverStep
    ? serverStep === "reading"
      ? "details"
      : serverStep
    : draft
      ? "website"
      : "business";
  const wanted: OnboardingStep = isStep(param) ? param : (serverStep ?? furthest);
  // No skipping ahead of what's been answered.
  const step = order.indexOf(wanted) > order.indexOf(furthest) ? furthest : wanted;
  if (step !== param) return <Navigate to={`/onboarding/start/${step}`} replace />;

  return (
    <WizardProvider step={step}>
      <h2 className="sr-only">{t("onb.metaTitle")}</h2>
      <StepView />
    </WizardProvider>
  );
}
