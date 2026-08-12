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
import { readLangCookie } from "~/lib/forms/lang-cookie";
import { onColor } from "~/lib/forms/css";
import { normalizeDefinition } from "~/lib/forms/field-types";
import {
  contentKey,
  isFormLocale,
  type FormErrorCode,
  type FormLocale,
  type FormTheme,
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
    <Shell embed={isEmbed} theme={definition.theme}>
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
            scope={`rf-${data.id.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`}
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
 *
 * "Inherits the host page's background" was a lie until the document itself was
 * made transparent: app.css paints html and body `#0f0f11` for the dashboard,
 * and an iframe document paints its own body over whatever is behind it. So the
 * iframe came out near-black with the form's dark body text on top of it —
 * unreadable, and unrelated to the visitor's OS setting, which is why it looked
 * identical in light and dark mode.
 *
 * DocumentScheme below also pins the colour scheme to the form's own theme, so
 * native widgets never follow the visitor's OS.
 */
function Shell({
  embed,
  theme,
  children,
}: {
  embed: boolean;
  theme?: FormTheme;
  children: React.ReactNode;
}) {
  if (embed) {
    return (
      <>
        <DocumentScheme theme={theme} background="transparent" />
        <div className="flex w-full justify-center p-2">{children}</div>
      </>
    );
  }
  return (
    <>
      <DocumentScheme theme={theme} background="#eeeeee" />
      <main className="flex min-h-dvh w-full items-center justify-center bg-[#eeeeee] p-4 sm:p-8">
        <div className="flex w-full justify-center">{children}</div>
      </main>
    </>
  );
}

/**
 * Overrides the dashboard's `html, body { background: #0f0f11; color-scheme:
 * dark }` for this route only.
 *
 * A plain <style> element rather than a class, because the rules have to reach
 * html and body, which this route does not render. It ships in the SSR HTML, so
 * there is no flash of the dashboard's dark background before hydration.
 *
 * The scheme is derived exactly as buildFormCss derives it, from the theme's
 * surface colour — the two must agree or the page chrome and the form would
 * disagree about which scheme they are in. Defaults to light while the
 * definition is still loading, which is what almost every form is.
 */
function DocumentScheme({
  theme,
  background,
}: {
  theme?: FormTheme;
  background: string;
}) {
  const scheme =
    theme && onColor(theme.surface) === "#ffffff" ? "dark" : "light";

  return (
    <style>{`html,body{background:${background};color-scheme:${scheme};}`}</style>
  );
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
