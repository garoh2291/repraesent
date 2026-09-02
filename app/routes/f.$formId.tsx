/**
 * The hosted public form page: /f/:formId — and, with ?embed=1, the thing the
 * iframe snippet points at.
 *
 * Modelled on routes/book.$configId.tsx: no loader, pure TanStack Query against
 * unauthenticated endpoints. It uses i18next ONLY for page chrome (meta title,
 * the not-available state). Everything inside the form is form content in the
 * VISITOR's language — see the header of FormRenderer.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router";
import { FormRenderer } from "~/components/forms/FormRenderer";
import { PublicShell, navigateTop } from "~/components/forms/PublicShell";
import i18n from "~/i18n";
import { getPublicForm, submitPublicForm } from "~/lib/api/forms";
import { getContent } from "~/lib/forms/content";
import { readLangCookie } from "~/lib/forms/lang-cookie";
import { defaultQuantities, defaultSelection } from "~/lib/forms/commerce";
import { normalizeDefinition } from "~/lib/forms/field-types";
import {
  contentKey,
  isFormLocale,
  isMultiStep,
  type FormErrorCode,
  type FormLocale,
} from "~/lib/forms/schema";
import { captureUtm } from "~/lib/forms/utm";
import { injectOpenaiPixel, readOppref } from "~/lib/openai-pixel";
import {
  emptyValues,
  firstErrorStep,
  validateStepValues,
  validateValues,
} from "~/lib/forms/validate";

export function meta() {
  return [
    { title: i18n.t("forms.metaTitle") },
    { name: "description", content: i18n.t("forms.metaDescription") },
    // A public form should never be indexed as a landing page in its own right.
    { name: "robots", content: "noindex" },
  ];
}

export default function PublicFormRoute() {
  const { formId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();

  const isEmbed = searchParams.get("embed") === "1";
  const langParam = searchParams.get("lang");
  const canceled = searchParams.get("canceled") === "1";

  const { data, isLoading } = useQuery({
    queryKey: ["public-form", formId],
    queryFn: () => getPublicForm(formId!),
    enabled: !!formId,
    retry: false,
  });

  const definition = useMemo(
    () =>
      data?.definition
        ? normalizeDefinition(data.definition, data.default_locale, data.kind)
        : null,
    [data],
  );

  const [locale, setLocale] = useState<FormLocale | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, FormErrorCode>>({});
  const [status, setStatus] = useState<{
    text: string;
    tone: "ok" | "bad";
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Multi-step: which step is on screen and which way the last change went.
  const [step, setStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<"forward" | "back">(
    "forward",
  );
  // Product forms: chosen quantity per price id.
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const renderedAt = useRef(Date.now());
  const metaRef = useRef<Record<string, string>>({});
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  /**
   * ?lang= wins, then the site's `repraesent_lang` cookie, then the browser's
   * language when the form offers it, then the form's own default. Note this is
   * the VISITOR's language — deliberately not i18next's, which on a
   * dashboard-shared bundle would be the operator's.
   *
   * The cookie sits above the browser because the two answer different
   * questions: it is a choice made on the site, where `navigator.language` is
   * only how the device is configured. It sits below `?lang=` because that is a
   * choice being made right now, which must beat a stored one.
   */
  useEffect(() => {
    if (!data || locale) return;
    const offered = data.locales;

    if (isFormLocale(langParam) && offered.includes(langParam)) {
      setLocale(langParam);
      return;
    }
    const stored = readLangCookie();
    if (isFormLocale(stored) && offered.includes(stored)) {
      setLocale(stored);
      return;
    }
    const nav =
      typeof navigator !== "undefined"
        ? (navigator.language || "").split("-")[0].toLowerCase()
        : "";
    setLocale(
      isFormLocale(nav) && offered.includes(nav) ? nav : data.default_locale,
    );
  }, [data, langParam, locale]);

  useEffect(() => {
    if (!definition) return;
    // Back from a cancelled checkout: the answers were parked in
    // sessionStorage on the way out, so nothing has to be typed twice.
    const draft = canceled ? readDraft(formId) : null;
    setValues(draft?.values ?? emptyValues(definition));
    setQuantities(draft?.quantities ?? defaultQuantities(definition.commerce));
    setSelection(
      draft?.selection
        ? new Set(draft.selection)
        : defaultSelection(definition.commerce),
    );
    if (draft && typeof draft.step === "number") setStep(draft.step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition]);

  useEffect(() => {
    if (!definition) return;
    metaRef.current = captureUtm(definition.utm);
    // OpenAI Ads click id rides along outside the UTM config — the server
    // whitelists it separately and uses it for conversion attribution.
    const oppref = readOppref();
    if (oppref) {
      metaRef.current.oppref = oppref;
      if (!metaRef.current.page_url) {
        metaRef.current.page_url = window.location.href;
      }
    }
  }, [definition]);

  // Measurement pixel — only when the form's workspace turned conversions on.
  useEffect(() => {
    if (data?.openai_pixel_id) injectOpenaiPixel(data.openai_pixel_id);
  }, [data?.openai_pixel_id]);

  /**
   * The other half of the iframe snippet: report our height to the parent so the
   * embed can size itself. Without it, an embedded form clips or leaves a gap at
   * every viewport width.
   */
  useEffect(() => {
    if (
      !isEmbed ||
      !wrapperRef.current ||
      typeof ResizeObserver === "undefined"
    )
      return;

    const el = wrapperRef.current;
    const post = () => {
      window.parent?.postMessage(
        { type: "rf:height", id: formId, height: el.scrollHeight + 24 },
        "*",
      );
    };
    post();
    const observer = new ResizeObserver(post);
    observer.observe(el);
    return () => observer.disconnect();
    // `step` is here so a step change posts immediately, before the observer
    // catches the animated frames.
  }, [isEmbed, formId, definition, status, errors, step]);

  const submitMutation = useMutation({
    mutationFn: () =>
      submitPublicForm(formId!, {
        locale: locale!,
        values,
        meta: metaRef.current,
        hp: "",
        rt: data?.render_token,
        elapsed_ms: Date.now() - renderedAt.current,
        ...(definition?.commerce
          ? { quantities, selection: [...selection] }
          : {}),
      }),
    onSuccess: (result) => {
      if (!result.success) {
        // The server re-validated and disagreed with the client mirror.
        const found = result.errors ?? {};
        setErrors(found);
        // A form-level code owns no field; it goes in the status line.
        if (typeof found._form === "string") {
          setStatus({
            text:
              tContent(contentKey.error(found._form as FormErrorCode)) ||
              tContent(contentKey.errorGeneric()),
            tone: "bad",
          });
        }
        jumpToErrorStep(found);
        return;
      }
      setErrors({});

      if (result.mode === "checkout") {
        if (!result.checkout_url) {
          setStatus({
            text: tContent(contentKey.error("checkout_unavailable")),
            tone: "bad",
          });
          return;
        }
        // Park the answers so a cancelled checkout comes back to a filled form.
        writeDraft(formId, {
          values,
          quantities,
          selection: [...selection],
          step,
        });
        navigateTop(result.checkout_url, isEmbed);
        return;
      }

      if (result.mode === "redirect" && result.redirect_url) {
        navigateTop(result.redirect_url, isEmbed);
        return;
      }
      if (result.mode === "modal") {
        setModalOpen(true);
        if (definition) setValues(emptyValues(definition));
        return;
      }

      setStatus({ text: tContent(contentKey.successInline()), tone: "ok" });
      if (definition?.success.resetAfterSubmit) {
        setValues(emptyValues(definition));
        goToStep(0);
      }
    },
    onError: () => {
      setStatus({ text: tContent(contentKey.errorGeneric()), tone: "bad" });
    },
  });

  function tContent(key: string): string {
    if (!definition || !locale || !data) return "";
    return getContent(definition, locale, key, data.default_locale);
  }

  /** Move to a step; the direction is derived so the slide goes the right way. */
  const goToStep = (index: number) => {
    setStepDirection(index < step ? "back" : "forward");
    setStep(index);
  };

  /** Server-side errors on a multi-step form: show the step that owns the first one. */
  const jumpToErrorStep = (found: Record<string, unknown>) => {
    if (!definition || !isMultiStep(definition)) return;
    const target = firstErrorStep(definition, found);
    if (target >= 0 && target !== step) goToStep(target);
  };

  const handleNext = () => {
    if (!definition) return;
    const found = validateStepValues(definition, step, values);
    setErrors(found);
    setStatus(null);
    if (Object.keys(found).length > 0) return;
    goToStep(Math.min(step + 1, definition.sections.length - 1));
  };

  const handleBack = () => {
    setStatus(null);
    goToStep(Math.max(step - 1, 0));
  };

  /** Product forms: something has to be ticked, or the summary says so. */
  const productError = (): Record<string, FormErrorCode> => {
    if (!definition?.commerce) return {};
    const product = definition.sections
      .flatMap((s) => s.fields)
      .find((f) => f.type === "product");
    if (!product || selection.size > 0) return {};
    return { [product.key]: "product_required" };
  };

  const handleSubmit = () => {
    if (!definition) return;
    const found = { ...validateValues(definition, values), ...productError() };
    setErrors(found);
    setStatus(null);
    if (Object.keys(found).length > 0) {
      // On the last step, an error two steps back has to be shown, not hidden.
      jumpToErrorStep(found);
      return;
    }
    submitMutation.mutate();
  };

  // --- states --------------------------------------------------------------

  if (isLoading || (data && !locale)) {
    return (
      <PublicShell embed={isEmbed}>
        <div
          className="h-64 w-full max-w-xl animate-pulse rounded-xl bg-stone-200"
          aria-hidden="true"
        />
      </PublicShell>
    );
  }

  if (!data || !data.available || !definition || !locale) {
    return (
      <PublicShell embed={isEmbed}>
        <div className="max-w-md space-y-2 text-center">
          <h1 className="text-xl font-semibold text-stone-900">
            {t("forms.public.notAvailable")}
          </h1>
          <p className="text-sm text-stone-500">
            {t("forms.public.notAvailableHint")}
          </p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell embed={isEmbed} theme={definition.theme}>
      <div ref={wrapperRef} className="w-full">
        <FormRenderer
          definition={definition}
          locale={locale}
          fallbackLocale={data.default_locale}
          mode="live"
          idPrefix={data.id}
          formId={data.id}
          values={values}
          errors={errors}
          onChange={(key, value) => {
            setValues((prev) => ({ ...prev, [key]: value }));
            setErrors((prev) => {
              if (!prev[key]) return prev;
              const next = { ...prev };
              delete next[key];
              return next;
            });
          }}
          onSubmit={handleSubmit}
          submitting={submitMutation.isPending}
          status={status}
          step={isMultiStep(definition) ? step : undefined}
          stepDirection={stepDirection}
          onNext={handleNext}
          onBack={handleBack}
          onStepChange={goToStep}
          quantities={quantities}
          onQuantityChange={(priceId, quantity) =>
            setQuantities((prev) => ({ ...prev, [priceId]: quantity }))
          }
          productSelection={selection}
          onProductSelectionChange={(priceId, on) => {
            setSelection((prev) => {
              const next = new Set(prev);

              if (on) next.add(priceId);
              else next.delete(priceId);

              return next;
            });

            // Ticking something clears the "choose a product" error.

            setErrors((prev) => {
              const product = definition.sections

                .flatMap((s) => s.fields)

                .find((f) => f.type === "product");

              if (!product || !prev[product.key]) return prev;

              const next = { ...prev };

              delete next[product.key];

              return next;
            });
          }}
          notice={
            canceled && !noticeDismissed
              ? {
                  text: tContent(contentKey.checkout("canceled")),
                  dismissLabel: tContent(
                    contentKey.checkout("canceled.dismiss"),
                  ),
                  onDismiss: () => {
                    setNoticeDismissed(true);
                    setSearchParams(
                      (prev) => {
                        const next = new URLSearchParams(prev);
                        next.delete("canceled");
                        return next;
                      },
                      { replace: true },
                    );
                  },
                }
              : null
          }
          offeredLocales={data.locales}
          onLocaleChange={(next) => {
            setLocale(next);
            setStatus(null);
          }}
        />

        {modalOpen ? (
          <SuccessModal
            title={tContent(contentKey.successModalTitle())}
            body={tContent(contentKey.successModalBody())}
            cta={tContent(contentKey.successModalCta()) || "Close"}
            scope={`rf-${data.id.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`}
            onClose={() => setModalOpen(false)}
          />
        ) : null}
      </div>
    </PublicShell>
  );
}

/** The parked answers of a form that left for Stripe Checkout. */
interface CheckoutDraft {
  values: Record<string, unknown>;
  quantities: Record<string, number>;
  selection?: string[];
  step: number;
}

function draftKey(formId: string | undefined): string {
  return `rf:${formId ?? ""}:draft`;
}

function writeDraft(formId: string | undefined, draft: CheckoutDraft): void {
  try {
    sessionStorage.setItem(draftKey(formId), JSON.stringify(draft));
  } catch {
    /* storage denied — the visitor retypes, nothing worse */
  }
}

function readDraft(formId: string | undefined): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(formId));
    return raw ? (JSON.parse(raw) as CheckoutDraft) : null;
  } catch {
    return null;
  }
}

/**
 * The success dialog, drawn with the form's own theme.
 *
 * It used to be hardcoded Tailwind — white card, stone text, only the accent
 * themed — so a form designed dark popped a bright white box, and the hosted
 * page disagreed with the embed and the standalone snippet, which have always
 * rendered this through `.rf-modal-*` in buildFormCss.
 *
 * Reusing those class names is the whole point: one stylesheet, four delivery
 * modes, no second definition of what a modal looks like. The stylesheet is
 * already on the page — FormRenderer emits it for `scope`.
 */
function SuccessModal({
  title,
  body,
  cta,
  scope,
  onClose,
}: {
  title: string;
  body: string;
  cta: string;
  /** The scope class FormRenderer used, so the same CSS applies. */
  scope: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={scope}>
      <div
        className="rf-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="rf-modal-card">
          <h2 className="rf-modal-title">{title}</h2>
          <p className="rf-modal-body">{body}</p>
          <button
            ref={closeRef}
            type="button"
            className="rf-modal-close"
            onClick={onClose}
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}
