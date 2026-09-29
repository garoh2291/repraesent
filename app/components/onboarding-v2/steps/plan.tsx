"use client";

import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { Check, Gift, Lock } from "lucide-react";
import { PhoneNumberInput } from "~/components/molecule/phone-number-input";
import {
  completeOnboarding,
  errorCodeOf,
  fieldErrorsOf,
  saveBilling,
  type OnboardingState,
} from "~/lib/api/onboarding-v2";
import { EMAIL_RE, formatMoney, suggestEmail } from "~/lib/onboarding/helpers";
import { CountryCombobox } from "../country-combobox";
import { ActionBar, Field, FormError, StepHeading, TextInput } from "../primitives";
import { useWizard } from "../wizard-context";
import { focusFirstError } from "./profile-draft";

const EU = new Set(["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"]);

export function StepBilling() {
  const { t } = useTranslation();
  const { state, back, goTo, setState, markSaved } = useWizard();
  return (
    <BillingForm
      state={state}
      onSaved={(s) => {
        setState(s);
        markSaved();
        goTo("plan");
      }}
      header={(fromImpressum) => <StepHeading title={t("onb.billing.title")} sub={fromImpressum ? t("onb.billing.subFound") : t("onb.billing.sub")} />}
      actions={(busy) => <ActionBar onBack={back} busy={busy} primaryLabel={t("onb.continue")} />}
    />
  );
}

/**
 * The invoice details form (Stripe customer; nothing is charged). Shared by the
 * wizard's billing step and the AI assistant's billing card.
 */
export function BillingForm({
  state,
  onSaved,
  header,
  actions,
}: {
  state: OnboardingState | undefined;
  onSaved: (s: OnboardingState) => void;
  header?: (fromImpressum: boolean) => React.ReactNode;
  actions: (busy: boolean) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const p = state?.billing_prefill ?? {};
  const [v, setV] = useState({
    legal_name: p.legal_name ?? "",
    contact_name: p.contact_name ?? [state?.user.first_name, state?.user.last_name].filter(Boolean).join(" "),
    email: p.email ?? state?.user.email ?? "",
    phone: p.phone ?? "",
    line1: p.line1 ?? "",
    line2: "",
    postal_code: p.postal_code ?? "",
    city: p.city ?? "",
    country: p.country ?? "",
    vat_id: p.vat_id ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, val: string) => {
    setV((x) => ({ ...x, [k]: val }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  const suggestion = suggestEmail(v.email);
  // Only claim "from your legal notice" when the values really came from the website.
  const sources = state?.profile?.field_sources ?? {};
  const fromImpressum =
    p.from === "profile" &&
    ["identity.legal_name", "legal.vat_id", "location.street"].some((k) => sources[k]?.source === "website");
  const vatLabel = v.country === "CA" ? t("onb.billing.bn") : EU.has(v.country) || v.country === "GB" || v.country === "CH" ? t("onb.billing.vat") : t("onb.billing.taxId");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const req = ["legal_name", "contact_name", "email", "line1", "postal_code", "city", "country"] as const;
    const local: Record<string, string> = {};
    for (const k of req) if (!String(v[k]).trim()) local[k] = t("onb.fieldErrors.required");
    if (v.email && !EMAIL_RE.test(v.email)) local.email = t("onb.fieldErrors.invalid_email");
    if (Object.keys(local).length) {
      setErrors(local);
      focusFirstError();
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const s = await saveBilling({ ...v, phone: v.phone || null, line2: v.line2 || null, vat_id: v.vat_id || null });
      onSaved(s);
    } catch (err) {
      const fe = fieldErrorsOf(err);
      const example = (err as { response?: { data?: { details?: { example?: string } } } })?.response?.data?.details?.example;
      const mapped: Record<string, string> = {};
      if (fe.vat_id) mapped.vat_id = example ? t("onb.billing.vatFormat", { example }) : t("onb.fieldErrors.invalid");
      if (fe.phone) mapped.phone = t("onb.fieldErrors.invalid_phone");
      setErrors(mapped);
      setFormError(Object.keys(mapped).length ? t("onb.errors.fixFields") : errorCodeOf(err) === "RATE_LIMITED" ? t("onb.errors.RATE_LIMITED") : t("onb.errors.generic"));
      focusFirstError();
    } finally {
      setBusy(false);
    }
  };

  const input = (k: keyof typeof v, label: string, opts: { optional?: boolean; auto?: string; hint?: React.ReactNode } = {}) => (
    <Field label={label} optional={opts.optional} error={errors[k] || null} hint={opts.hint}>
      {(a) => (
        <TextInput id={a.id} autoComplete={opts.auto} aria-describedby={a.describedBy} aria-invalid={a.invalid} value={v[k]} onChange={(e) => set(k, e.target.value)} />
      )}
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate>
      {header?.(fromImpressum)}
      <FormError message={formError} />
      <div className="space-y-5">
        {input("legal_name", t("onb.billing.legalName"), { auto: "organization", hint: t("onb.billing.legalNameHint") })}
        <div className="grid gap-4 sm:grid-cols-2">
          {input("contact_name", t("onb.billing.contact"), { auto: "name" })}
          <Field
            label={t("onb.billing.email")}
            error={errors.email || null}
            hint={
              suggestion ? (
                <button type="button" className="font-medium text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground" onClick={() => set("email", suggestion)}>
                  {t("onb.didYouMean", { email: suggestion })}
                </button>
              ) : (
                t("onb.billing.emailHint")
              )
            }
          >
            {(a) => (
              <TextInput id={a.id} type="email" inputMode="email" autoComplete="email" aria-describedby={a.describedBy} aria-invalid={a.invalid} value={v.email} onChange={(e) => set("email", e.target.value)} />
            )}
          </Field>
        </div>
        {input("line1", t("onb.billing.street"), { auto: "address-line1" })}
        {input("line2", t("onb.billing.street2"), { optional: true, auto: "address-line2" })}
        <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
          {input("postal_code", t("onb.billing.postal"), { auto: "postal-code" })}
          {input("city", t("onb.billing.city"), { auto: "address-level2" })}
        </div>
        <Field label={t("onb.billing.country")} error={errors.country || null}>
          {(a) => <CountryCombobox id={a.id} value={v.country} invalid={a.invalid} describedBy={a.describedBy} onChange={(c) => set("country", c)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={vatLabel} optional error={errors.vat_id || null} hint={t("onb.billing.vatHint")}>
            {(a) => (
              <TextInput id={a.id} autoCapitalize="characters" spellCheck={false} aria-describedby={a.describedBy} aria-invalid={a.invalid} value={v.vat_id} onChange={(e) => set("vat_id", e.target.value)} />
            )}
          </Field>
          <Field label={t("onb.billing.phone")} optional error={errors.phone || null}>
            {(a) => (
              <PhoneNumberInput className="crm-phone-input--control" id={a.id} aria-invalid={a.invalid} value={v.phone} defaultCountry={(v.country || "DE") as never} onChange={(x) => set("phone", x)} />
            )}
          </Field>
        </div>
        <p className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-3 text-[13px] text-muted-foreground">
          <Lock className="size-3.5 shrink-0" /> {t("onb.billing.nothingCharged")}
        </p>
      </div>
      {actions(busy)}
    </form>
  );
}

export function StepPlan() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const { state, back, setState } = useWizard();
  const q = state?.pricing;
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!q) return null;
  const money = (c: number, d: "auto" | 0 | 2 = "auto") => formatMoney(c, q.currency, i18n.language, d);
  const interests = (state?.profile?.data?.interests ?? {}) as Record<string, unknown>;
  const talkAbout = [
    interests.website_plan === "rebuild"
      ? t("onb.plan.talk.website")
      : interests.website_plan === "refresh"
        ? t("onb.plan.talk.websiteRefresh")
        : null,
    interests.ai_visibility === "yes" || interests.ai_visibility === "more_info" ? t("onb.plan.talk.ai") : null,
    interests.managed_ads ? t("onb.plan.talk.ads") : null,
    interests.social_posts ? t("onb.plan.talk.social") : null,
    interests.content_updates ? t("onb.plan.talk.content") : null,
  ].filter(Boolean) as string[];

  const finish = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const code = errorCodeOf(err);
      setError(code === "ONBOARDING_INCOMPLETE" ? t("onb.plan.incomplete") : t("onb.errors.generic"));
      setBusy(false);
    }
  };

  const included = t("onb.plan.included", { returnObjects: true }) as string[];

  return (
    <form onSubmit={finish} noValidate>
      <StepHeading title={t("onb.plan.title")} sub={t("onb.plan.sub")} />
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_12px_32px_-16px_rgba(19,21,21,0.18)]">
        <div className="space-y-5 p-6 sm:p-8">
          <div className="flex flex-wrap-reverse items-start justify-between gap-x-4 gap-y-2">
            <div>
              <p className="text-sm font-semibold">{t("onb.plan.name")}</p>
              <p className="text-[13px] text-muted-foreground">{t("onb.plan.yearly")}</p>
            </div>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-secondary px-3 py-1 text-[12px] font-semibold text-secondary-foreground">
              {t("onb.plan.freeMonths", { count: q.freeMonths })}
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <span className="relative text-lg tabular-nums text-muted-foreground">
              {money(q.twelveMonthly)}
              <motion.span
                aria-hidden
                className="absolute left-0 top-1/2 h-[1.5px] w-full origin-left bg-muted-foreground"
                initial={reduce ? false : { transform: "scaleX(0)" }}
                animate={{ transform: "scaleX(1)" }}
                transition={{ duration: 0.3, delay: 0.25, ease: [0.23, 1, 0.32, 1] }}
              />
              <span className="sr-only">{t("onb.plan.insteadOf")}</span>
            </span>
            <motion.span
              className="ob2-heading text-5xl leading-none tracking-[-0.02em] tabular-nums"
              initial={reduce ? false : { opacity: 0, transform: "translateY(6px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.3, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
            >
              {money(q.yearly)}
            </motion.span>
            <span className="pb-1 text-sm text-muted-foreground">{t("onb.plan.perYear")}</span>
          </div>
          {/* The free start, said plainly — not a footnote. */}
          <div className="flex items-start gap-3 rounded-2xl bg-secondary/60 px-4 py-3">
            <Gift className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-[14px] leading-snug">
              <span className="font-semibold">{t("onb.plan.trialTitle", { count: q.freeMonths })}</span>{" "}
              {t("onb.plan.trialBody", {
                month: q.firstInvoiceMonth ?? q.freeMonths + 1,
                yearly: money(q.yearly),
                perDay: money(q.perDay, 2),
              })}
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {Array.isArray(included)
              ? included.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#3f9a64]" strokeWidth={3} /> {item}
                  </li>
                ))
              : null}
          </ul>
        </div>
        <div className="border-t border-border bg-[#a4dab8]/15 px-6 py-4 sm:px-8">
          <p className="text-sm font-semibold">{t("onb.plan.nothingToday")}</p>
          <p className="text-[13px] text-muted-foreground">{t("onb.plan.nothingTodaySub")}</p>
        </div>
      </div>
      {talkAbout.length ? (
        <p className="mt-5 text-[13px] text-muted-foreground">{t("onb.plan.talkAbout", { items: talkAbout.join(", ") })}</p>
      ) : null}
      <p className="mt-2 text-[12px] text-muted-foreground">{t("onb.plan.vat")}</p>

      <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4">
        <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--foreground)] [color-scheme:light]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span className="text-sm leading-relaxed">
          {t("onb.plan.consentPre")}{" "}
          <a href={state?.privacy_url} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground">
            {t("onb.plan.privacy")}
          </a>
          {state?.terms_url ? (
            <>
              {" "}
              {t("onb.plan.and")}{" "}
              <a href={state.terms_url} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground">
                {t("onb.plan.terms")}
              </a>
            </>
          ) : null}
          {t("onb.plan.consentPost")}
        </span>
      </label>
      <FormError message={error} />
      <ActionBar onBack={back} busy={busy} primaryDisabled={!consent} primaryLabel={t("onb.plan.finish")} />
    </form>
  );
}
