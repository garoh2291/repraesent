/**
 * Where a product form's buyer lands after Stripe Checkout:
 * /f/:formId/thanks?session_id=cs_…
 *
 * Polls the public status endpoint (which also fulfils the session server-side
 * when the webhook has not yet) with a growing delay for about twenty seconds,
 * then settles on whatever it knows. Drawn with the form's own theme through
 * the shared stylesheet, so it looks like the form the buyer just left; every
 * string is form content (checkout.* keys), never i18next.
 */

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router";
import {
  PublicShell,
  resolveVisitorLocale,
} from "~/components/forms/PublicShell";
import i18n from "~/i18n";
import {
  getPublicCheckoutStatus,
  getPublicForm,
  type PublicCheckoutStatus,
} from "~/lib/api/forms";
import { getContent } from "~/lib/forms/content";
import { buildFormCss, googleFontsHref } from "~/lib/forms/css";
import { normalizeDefinition } from "~/lib/forms/field-types";
import { readLangCookie } from "~/lib/forms/lang-cookie";
import { contentKey, formatMinor, type FormLocale } from "~/lib/forms/schema";

export function meta() {
  return [
    {
      title: i18n.t("forms.public.thanksMetaTitle", {
        defaultValue: "Thank you",
      }),
    },
    { name: "robots", content: "noindex" },
  ];
}

const POLL_DELAYS = [800, 1200, 1800, 2700, 4000, 4000, 4000];
const POLL_BUDGET_MS = 20_000;

export default function CheckoutThanksRoute() {
  const { formId } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const sessionId = searchParams.get("session_id");
  const isEmbed = searchParams.get("embed") === "1";

  const { data: form, isLoading } = useQuery({
    queryKey: ["public-form", formId],
    queryFn: () => getPublicForm(formId!),
    enabled: !!formId,
    retry: false,
  });

  const definition = useMemo(
    () =>
      form?.definition
        ? normalizeDefinition(form.definition, form.default_locale, form.kind)
        : null,
    [form],
  );

  const locale: FormLocale | null = useMemo(() => {
    if (!form) return null;
    return resolveVisitorLocale(
      form.locales,
      form.default_locale,
      searchParams.get("lang"),
      readLangCookie(),
    );
  }, [form, searchParams]);

  const startedAt = useRef(Date.now());
  const attempts = useRef(0);
  const status = useQuery({
    queryKey: ["public-checkout", formId, sessionId],
    queryFn: () => getPublicCheckoutStatus(formId!, sessionId!),
    enabled: !!formId && !!sessionId,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as PublicCheckoutStatus | undefined;
      if (data && data.outcome !== "pending" && data.outcome !== "processing")
        return false;
      if (Date.now() - startedAt.current > POLL_BUDGET_MS) return false;
      const delay =
        POLL_DELAYS[Math.min(attempts.current, POLL_DELAYS.length - 1)];
      attempts.current += 1;
      return delay;
    },
  });

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), POLL_BUDGET_MS + 500);
    return () => window.clearTimeout(id);
  }, []);

  const outcome = status.data?.outcome;

  if (isLoading || (form && !locale)) {
    return (
      <PublicShell embed={isEmbed}>
        <div
          className="h-48 w-full max-w-md animate-pulse rounded-xl bg-stone-200"
          aria-hidden
        />
      </PublicShell>
    );
  }
  if (!form || !definition || !locale || !sessionId) {
    return (
      <PublicShell embed={isEmbed}>
        <div className="max-w-md space-y-2 text-center">
          <h1 className="text-xl font-semibold text-stone-900">
            {t("forms.public.notAvailable")}
          </h1>
        </div>
      </PublicShell>
    );
  }

  const tc = (key: string) =>
    getContent(definition, locale, key, form.default_locale);
  const scope = `rf-${form.id.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;
  const css = buildFormCss(definition.theme, scope);
  const fontHref = googleFontsHref(definition.theme);

  const state: "paid" | "processing" | "failed" | "expired" | "unknown" =
    outcome === "paid"
      ? "paid"
      : outcome === "failed"
        ? "failed"
        : outcome === "expired"
          ? "expired"
          : status.isError
            ? "unknown"
            : timedOut && outcome !== "processing"
              ? "unknown"
              : "processing";

  const title =
    state === "paid"
      ? tc(contentKey.checkout("paid.title"))
      : state === "failed" || state === "expired"
        ? tc(contentKey.checkout("failed.title"))
        : tc(contentKey.checkout("processing.title"));
  const body =
    state === "paid"
      ? tc(contentKey.checkout("paid.body"))
      : state === "failed" || state === "expired"
        ? tc(contentKey.checkout("failed.body"))
        : tc(contentKey.checkout("processing.body"));
  const amount =
    state === "paid" &&
    status.data?.amount_total != null &&
    status.data.currency
      ? formatMinor(status.data.amount_total, status.data.currency, locale)
      : null;

  return (
    <PublicShell embed={isEmbed} theme={definition.theme}>
      <div className={`${scope} w-full`}>
        {fontHref ? <link rel="stylesheet" href={fontHref} /> : null}
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <div className="rf-form">
          <section
            className={`rf-outcome rf-outcome-${state}`}
            aria-live="polite"
          >
            <span className="rf-outcome-icon" aria-hidden="true">
              {state === "paid" ? (
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : state === "processing" ? (
                <span className="rf-spin" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 7l10 10M17 7L7 17"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </span>
            <h2 className="rf-outcome-title">{title}</h2>
            {amount ? <p className="rf-outcome-amount">{amount}</p> : null}
            <p className="rf-outcome-body">{body}</p>
            {state === "failed" || state === "expired" ? (
              <a
                className="rf-submit rf-outcome-cta"
                href={`/f/${form.id}?canceled=1${isEmbed ? "&embed=1" : ""}`}
              >
                {tc(contentKey.checkout("failed.retry"))}
              </a>
            ) : null}
          </section>
        </div>
      </div>
    </PublicShell>
  );
}
