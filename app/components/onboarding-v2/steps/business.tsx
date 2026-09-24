"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Globe, Loader2 } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { getDoorboostEligibility } from "~/lib/api/doorboost-restore";
import {
  errorCodeOf,
  getEnrichmentJob,
  retryWebsiteRead,
  startBusiness,
  trackStepEvent,
  updateBusiness,
  type EnrichmentJob,
  type OnboardingState,
  type ProgressEvent,
} from "~/lib/api/onboarding-v2";
import { browserTimezone, checkWebsite, displayHost } from "~/lib/onboarding/helpers";
import { setStoredSelectedView, setStoredWorkspaceId } from "~/lib/api/axios-instance";
import { ActionBar, BigInput, Field, FormError, SkipLink, StepHeading } from "../primitives";
import { STATE_KEY, useWizard } from "../wizard-context";

/** After the business exists server-side, point the app at it (H1). */
function useAdoptWorkspace() {
  const qc = useQueryClient();
  return async (state: OnboardingState) => {
    if (!state.workspace) return;
    setStoredWorkspaceId(state.workspace.id);
    setStoredSelectedView(state.workspace.id);
    await qc.invalidateQueries({ queryKey: ["auth"] });
  };
}

function errorMessage(t: (k: string) => string, error: unknown): string {
  const code = errorCodeOf(error);
  if (code && ["RATE_LIMITED", "ENRICH_DAILY_CAP", "ENRICH_USER_CAP", "ENRICH_RUN_CAP", "NOT_A_CUSTOMER_ACCOUNT"].includes(code)) {
    return t(`onb.errors.${code}`);
  }
  return t("onb.errors.generic");
}

// ── 1. Name ──────────────────────────────────────────────────────────────────

export function StepName() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaces } = useAuthContext();
  const { state, draftName, setDraftName, goTo, setState, markSaved } = useWizard();
  const [name, setName] = useState(state?.workspace?.name ?? draftName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstBusiness = !state?.run && (workspaces?.length ?? 0) === 0;

  // A returning DoorBoost customer must see their restore offer first (C4).
  const eligibility = useQuery({
    queryKey: ["doorboost-eligibility"],
    queryFn: getDoorboostEligibility,
    enabled: firstBusiness,
    staleTime: 60_000,
    retry: false,
  });
  useEffect(() => {
    if (eligibility.data?.eligible) navigate("/onboarding/doorboost-choice", { replace: true });
  }, [eligibility.data?.eligible, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = name.trim();
    if (v.length < 2) {
      setError(t("onb.name.tooShort"));
      return;
    }
    setError(null);
    if (state?.run && state.workspace) {
      if (v !== state.workspace.name) {
        setBusy(true);
        try {
          setState(await updateBusiness({ name: v }));
          markSaved();
        } catch (err) {
          setError(errorMessage(t, err));
          setBusy(false);
          return;
        }
        setBusy(false);
      }
      goTo(state.workspace.website ? "details" : "website");
      return;
    }
    setDraftName(v);
    goTo("website");
  };

  return (
    <form onSubmit={submit} noValidate>
      <StepHeading eyebrow={t("onb.name.eyebrow")} title={t("onb.name.title")} sub={t("onb.name.sub")} />
      <Field label={t("onb.name.label")} hint={t("onb.name.hint")} error={error}>
        {({ id, describedBy, invalid }) => (
          <BigInput
            id={id}
            autoFocus
            autoComplete="organization"
            value={name}
            maxLength={120}
            onChange={(e) => {
              setName(e.target.value);
              // The card beside the question fills in as they type.
              if (!state?.run) setDraftName(e.target.value);
            }}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            placeholder={t("onb.name.placeholder")}
          />
        )}
      </Field>
      <ActionBar primaryLabel={t("onb.continue")} busy={busy} primaryDisabled={name.trim().length < 2} />
    </form>
  );
}

// ── 2. Website ───────────────────────────────────────────────────────────────

export function StepWebsite() {
  const { t } = useTranslation();
  const { state, draftName, goTo, back, setState, markSaved } = useWizard();
  const adopt = useAdoptWorkspace();
  const [value, setValue] = useState(state?.workspace?.website ?? "");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"read" | "none" | null>(null);
  const check = useMemo(() => checkWebsite(value), [value]);
  const name = state?.workspace?.name ?? draftName;

  useEffect(() => {
    // Refreshed on this step before the business exists: start over at the name.
    if (!state?.run && !draftName) goTo("business", -1);
  }, [state?.run, draftName, goTo]);

  const fieldError = touched && value.trim() && !check.ok ? t(`onb.website.errors.${check.reason}`) : error;

  const go = async (website: string | null) => {
    setBusy(website ? "read" : "none");
    setError(null);
    setFormError(null);
    try {
      const result = state?.run
        ? await updateBusiness({ website })
        : await startBusiness({ name, website, timezone: browserTimezone() ?? undefined });
      setState(result);
      markSaved();
      await adopt(result);
      goTo(result.run?.current_step === "reading" ? "reading" : "details");
    } catch (err) {
      const code = errorCodeOf(err);
      if (code === "WEBSITE_TAKEN") setError(t("onb.website.errors.taken"));
      else if (code === "WEBSITE_INVALID") setError(t("onb.website.errors.invalid"));
      else setFormError(errorMessage(t, err));
      void trackStepEvent("website", "error");
    } finally {
      setBusy(null);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!value.trim()) return;
    if (!check.ok) return;
    void go(check.url);
  };

  return (
    <form onSubmit={submit} noValidate>
      <StepHeading
        title={name ? t("onb.website.titleNamed", { name }) : t("onb.website.title")}
        sub={t("onb.website.sub")}
      />
      <Field label={t("onb.website.label")} error={fieldError}>
        {({ id, describedBy, invalid }) => (
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <BigInput
              id={id}
              autoFocus
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              onBlur={() => setTouched(true)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder={t("onb.website.placeholder")}
              className="pl-9"
            />
          </div>
        )}
      </Field>
      <AnimatePresence initial={false}>
        {check.ok && !fieldError ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-3 text-[13px] text-muted-foreground"
          >
            {t("onb.website.preview", { url: check.url })}
          </motion.p>
        ) : null}
      </AnimatePresence>
      {fieldError && error === t("onb.website.errors.taken") ? (
        <div className="mt-4">
          <SkipLink label={t("onb.website.continueWithout")} onClick={() => void go(null)} />
        </div>
      ) : null}
      <FormError message={formError} />
      <ActionBar
        onBack={back}
        primaryLabel={t("onb.website.read")}
        busy={busy === "read"}
        primaryDisabled={!!busy || !check.ok}
        secondary={<SkipLink label={t("onb.website.none")} onClick={() => void go(null)} />}
      />
    </form>
  );
}

// ── 3. Reading ───────────────────────────────────────────────────────────────

const LINE_ORDER: ProgressEvent["code"][] = [
  "started",
  "pages_found",
  "found_address",
  "found_contact",
  "found_hours",
  "found_legal",
  "found_socials",
  "found_team",
  "found_offer",
  "found_cms",
  "understanding",
];

export function StepReading() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const { state, goTo, setState } = useWizard();
  const initial = state?.jobs.find((j) => j.kind === "website") ?? null;
  const [slow, setSlow] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const jobQuery = useQuery({
    queryKey: ["onboarding-v2", "job", initial?.id],
    queryFn: () => getEnrichmentJob(initial!.id),
    enabled: !!initial?.id,
    refetchInterval: (q) => {
      const s = q.state.data?.job.status;
      return s === "done" || s === "failed" ? false : 1200;
    },
  });
  const job: EnrichmentJob | null = jobQuery.data?.job ?? initial;
  const done = job?.status === "done";
  const failed = job?.status === "failed";

  // After 90 s the customer may carry on; late results still land (M6).
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 90_000);
    return () => clearTimeout(id);
  }, [initial?.id]);

  // Mirror the profile as it fills in, so the card beside the feed grows live.
  const liveProfile = jobQuery.data?.profile;
  const liveKey = liveProfile ? JSON.stringify(liveProfile.data) : "";
  useEffect(() => {
    if (!liveProfile || !state) return;
    if (JSON.stringify(state.profile?.data ?? {}) === liveKey) return;
    setState({ ...state, profile: liveProfile });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey]);

  // When reading finishes, let the "Done" line land, then move on — once.
  // Depends on `done` only: the live-profile updates above change `state`,
  // and a cleanup tied to `state` would cancel this timer.
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => goTo("details"), reduce ? 400 : 1600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  useEffect(() => {
    if (!initial) goTo("details");
  }, [initial, goTo]);

  const domain = displayHost(state?.workspace?.website ?? job?.input_url);
  const events = (job?.progress ?? []).filter((e) => e.code !== "done" && e.code !== "failed");
  const seen = new Set<string>();
  const lines = events
    .filter((e) => (seen.has(e.code) ? false : (seen.add(e.code), true)))
    .sort((a, b) => LINE_ORDER.indexOf(a.code) - LINE_ORDER.indexOf(b.code));

  const retry = async () => {
    setRetrying(true);
    try {
      const s = await retryWebsiteRead();
      setState(s);
      await qc.invalidateQueries({ queryKey: STATE_KEY });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div aria-busy={!done && !failed}>
      <StepHeading
        title={
          done
            ? t("onb.reading.doneTitle", { count: job?.found_count ?? 0 })
            : failed
              ? t("onb.reading.failedTitle", { domain })
              : t("onb.reading.title", { domain })
        }
        sub={done ? t("onb.reading.doneSub") : failed ? t("onb.reading.failedSub") : t("onb.reading.sub")}
      />
      <ol className="space-y-3" aria-live="polite">
        <AnimatePresence initial={false}>
          {lines.map((e) => (
            <motion.li
              key={e.code}
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="flex items-center gap-3 text-[15px]"
            >
              {e.code === "understanding" && !done && !failed ? (
                <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                </span>
              ) : (
                <motion.span
                  initial={reduce ? false : { transform: "scale(0.85)" }}
                  animate={{ transform: "scale(1)" }}
                  transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
                  className="flex size-7 items-center justify-center rounded-full bg-[#a4dab8]/40 text-[#2f7d4f]"
                >
                  <Check className="size-4" strokeWidth={3} aria-hidden />
                </motion.span>
              )}
              <span className="text-foreground/90">
                {t(`onb.reading.lines.${e.code}`, { count: e.count ?? 1, value: e.value ?? "", domain })}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
        {!done && !failed ? (
          <li className="flex items-center gap-3 pl-1 text-[13px] text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/40 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-foreground" />
            </span>
            {t("onb.reading.working")}
          </li>
        ) : null}
      </ol>

      {failed ? (
        <ActionBar
          primaryType="button"
          primaryLabel={t("onb.reading.fillMyself")}
          onPrimary={() => goTo("details")}
          secondary={<SkipLink label={retrying ? t("onb.reading.retrying") : t("onb.reading.retry")} onClick={() => void retry()} />}
        />
      ) : done ? (
        <ActionBar primaryType="button" primaryLabel={t("onb.reading.review")} onPrimary={() => goTo("details")} />
      ) : slow ? (
        <ActionBar primaryType="button" primaryLabel={t("onb.reading.carryOn")} onPrimary={() => goTo("details")} />
      ) : null}
    </div>
  );
}
