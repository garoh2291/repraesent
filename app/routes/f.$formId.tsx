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
import i18n from "~/i18n";
import { getPublicForm, submitPublicForm } from "~/lib/api/forms";
import { getContent } from "~/lib/forms/content";
import { normalizeDefinition } from "~/lib/forms/field-types";
import {
  contentKey,
  isFormLocale,
  type FormErrorCode,
  type FormLocale,
} from "~/lib/forms/schema";
import { captureUtm } from "~/lib/forms/utm";
import { emptyValues, validateValues } from "~/lib/forms/validate";

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
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const isEmbed = searchParams.get("embed") === "1";
  const langParam = searchParams.get("lang");

  const { data, isLoading } = useQuery({
    queryKey: ["public-form", formId],
    queryFn: () => getPublicForm(formId!),
    enabled: !!formId,
    retry: false,
  });

  const definition = useMemo(
    () =>
      data?.definition
        ? normalizeDefinition(data.definition, data.default_locale)
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

  const renderedAt = useRef(Date.now());
  const metaRef = useRef<Record<string, string>>({});
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  /**
   * ?lang= wins, then the browser's language when the form offers it, then the
   * form's own default. Note this is the VISITOR's language — deliberately not
   * i18next's, which on a dashboard-shared bundle would be the operator's.
   */
  useEffect(() => {
    if (!data || locale) return;
    const offered = data.locales;

    if (isFormLocale(langParam) && offered.includes(langParam)) {
      setLocale(langParam);
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
    if (definition) setValues(emptyValues(definition));
  }, [definition]);

  useEffect(() => {
    if (definition) metaRef.current = captureUtm(definition.utm);
  }, [definition]);

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
  }, [isEmbed, formId, definition, status, errors]);

  const submitMutation = useMutation({
    mutationFn: () =>
      submitPublicForm(formId!, {
        locale: locale!,
        values,
        meta: metaRef.current,
        hp: "",
        rt: data?.render_token,
        elapsed_ms: Date.now() - renderedAt.current,
      }),
    onSuccess: (result) => {
      if (!result.success) {
        // The server re-validated and disagreed with the client mirror.
        setErrors(result.errors ?? {});
        return;
      }
      setErrors({});

      if (result.mode === "redirect" && result.redirect_url) {
        window.location.href = result.redirect_url;
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

  const handleSubmit = () => {
    if (!definition) return;
    const found = validateValues(definition, values);
    setErrors(found);
    setStatus(null);
    if (Object.keys(found).length > 0) return;
    submitMutation.mutate();
  };

  // --- states --------------------------------------------------------------

  if (isLoading || (data && !locale)) {
    return (
      <Shell embed={isEmbed}>
        <div
          className="h-64 w-full max-w-xl animate-pulse rounded-xl bg-stone-200"
          aria-hidden="true"
        />
      </Shell>
    );
  }

  if (!data || !data.available || !definition || !locale) {
    return (
      <Shell embed={isEmbed}>
        <div className="max-w-md space-y-2 text-center">
          <h1 className="text-xl font-semibold text-stone-900">
            {t("forms.public.notAvailable")}
          </h1>
          <p className="text-sm text-stone-500">
            {t("forms.public.notAvailableHint")}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell embed={isEmbed}>
      <div ref={wrapperRef} className="w-full">
        <FormRenderer
          definition={definition}
          locale={locale}
          fallbackLocale={data.default_locale}
          mode="live"
          idPrefix={data.id}
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
            accent={definition.theme.accent}
            onClose={() => setModalOpen(false)}
          />
        ) : null}
      </div>
    </Shell>
  );
}

/**
 * Page chrome. Suppressed entirely under ?embed=1 so the iframe shows only the
 * form and inherits the host page's own background.
 */
function Shell({
  embed,
  children,
}: {
  embed: boolean;
  children: React.ReactNode;
}) {
  if (embed) {
    return <div className="flex w-full justify-center p-2">{children}</div>;
  }
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-[#eeeeee] p-4 sm:p-8">
      <div className="flex w-full justify-center">{children}</div>
    </main>
  );
}

function SuccessModal({
  title,
  body,
  cta,
  accent,
  onClose,
}: {
  title: string;
  body: string;
  cta: string;
  accent: string;
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
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl">
        <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
        <p className="mt-2 text-sm text-stone-600">{body}</p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-6 rounded-lg px-5 py-2.5 text-sm font-medium text-white"
          style={{ backgroundColor: accent }}
        >
          {cta}
        </button>
      </div>
    </div>
  );
}
