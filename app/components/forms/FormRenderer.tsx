/**
 * The one React renderer for a form definition.
 *
 * It serves two surfaces with identical markup and identical CSS:
 *   - mode="preview" — the builder canvas (selectable, drag-reorderable)
 *   - mode="live"    — the hosted page at /f/:formId
 * so what you design is exactly what a visitor gets.
 *
 * ── HARD RULE: this file, and everything it renders, imports ZERO i18next. ──
 * The same component runs inside the dashboard, where i18next speaks the
 * OPERATOR's language, and on the public page, where it speaks the VISITOR's.
 * If a field label ever came from t(), a German operator previewing a French
 * form would see German. Every visitor-facing string is form content, resolved
 * through app/lib/forms/content.ts.
 *
 * The plain <style> block scoped by a generated class is the same technique
 * app/routes/book.$configId.tsx uses for the booking page's branding.
 */

import { useMemo } from "react";
import { buildFormCss, googleFontsHref } from "~/lib/forms/css";
import { getContent } from "~/lib/forms/content";
import { isSameSelection, type BuilderSelection } from "~/lib/forms/selection";
import {
  contentKey,
  isPresentational,
  type FormDefinition,
  type FormErrorCode,
  type FormField,
  type FormLocale,
} from "~/lib/forms/schema";
import { FormFieldControl } from "./FormFieldControl";

export interface FormRendererProps {
  definition: FormDefinition;
  locale: FormLocale;
  fallbackLocale: FormLocale;
  mode: "preview" | "live";

  values: Record<string, unknown>;
  errors: Record<string, FormErrorCode>;
  onChange: (key: string, value: unknown) => void;

  onSubmit?: () => void;
  submitting?: boolean;
  /** Inline success / failure banner text, already resolved. */
  status?: { text: string; tone: "ok" | "bad" } | null;

  /** Stable prefix for input ids, so two forms on one page never collide. */
  idPrefix: string;
  /** Locales offered in the public switcher; omit to hide it. */
  offeredLocales?: FormLocale[];
  onLocaleChange?: (locale: FormLocale) => void;

  /** preview mode only */
  selection?: BuilderSelection | null;
  onSelect?: (selection: BuilderSelection) => void;

  className?: string;
}

export function FormRenderer({
  definition,
  locale,
  fallbackLocale,
  mode,
  values,
  errors,
  onChange,
  onSubmit,
  submitting,
  status,
  idPrefix,
  offeredLocales,
  onLocaleChange,
  selection,
  onSelect,
  className,
}: FormRendererProps) {
  const scope = `rf-${idPrefix.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;
  const css = useMemo(
    () => buildFormCss(definition.theme, scope),
    [definition.theme, scope],
  );
  const fontHref = googleFontsHref(definition.theme);

  const t = (key: string) =>
    getContent(definition, locale, key, fallbackLocale);

  /**
   * Click target + selection ring for the builder canvas.
   *
   * Returns {} in live mode — that is the single guarantee that the hosted
   * page, the iframe, the script embed and the pasted static HTML all render
   * byte-identically to before, and stay in step with
   * nestjs-monolith/src/modules/forms/form-render.service.ts, which generates
   * the same markup server-side and has no notion of a preview.
   *
   * EVERY preview-only attribute goes through here.
   */
  const region = (target: BuilderSelection) =>
    mode === "preview" && onSelect
      ? {
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onSelect(target);
          },
          "data-selected":
            isSameSelection(selection ?? null, target) || undefined,
        }
      : {};

  const showSwitcher =
    definition.showLanguageSwitcher &&
    (offeredLocales?.length ?? 0) > 1 &&
    !!onLocaleChange;

  const title = t(contentKey.formTitle());
  const description = t(contentKey.formDescription());

  return (
    <div className={`${scope} ${className ?? ""}`}>
      {fontHref ? <link rel="stylesheet" href={fontHref} /> : null}
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <form
        className="rf-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === "live") onSubmit?.();
        }}
      >
        {showSwitcher ? (
          <div className="rf-lang" role="group" aria-label="Language">
            {offeredLocales!.map((loc) => (
              <button
                key={loc}
                type="button"
                className={`rf-lang-btn${loc === locale ? " rf-on" : ""}`}
                onClick={() => onLocaleChange!(loc)}
              >
                {loc}
              </button>
            ))}
          </div>
        ) : null}

        {/* In preview the header stays selectable even when empty — otherwise
            you could never give a form a title, because selecting it is how you
            get the input. Live keeps exactly the old condition. */}
        {definition.theme.showFormTitle &&
        (title || description || mode === "preview") ? (
          <div className="rf-head" {...region({ kind: "header" })}>
            {title ? (
              <h2 className="rf-title">{title}</h2>
            ) : mode === "preview" ? (
              <h2 className="rf-title rf-ghost" aria-hidden="true" />
            ) : null}
            {description ? <p className="rf-desc">{description}</p> : null}
          </div>
        ) : null}

        {(definition.sections ?? []).map((section) => {
          const sectionTitle = t(contentKey.sectionTitle(section.id));
          const sectionDesc = t(contentKey.sectionDescription(section.id));
          return (
            <div className="rf-section" key={section.id}>
              {sectionTitle ? (
                <div>
                  <h3 className="rf-section-title">{sectionTitle}</h3>
                  {sectionDesc ? (
                    <p className="rf-section-desc">{sectionDesc}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="rf-row">
                {(section.fields ?? []).map((field) => (
                  <RenderedField
                    key={field.id}
                    field={field}
                    mode={mode}
                    idPrefix={idPrefix}
                    value={values[field.key]}
                    error={errors[field.key]}
                    t={t}
                    onChange={(v) => onChange(field.key, v)}
                    region={region}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <div className="rf-actions" {...region({ kind: "submit" })}>
          <button
            type="submit"
            className="rf-submit"
            disabled={submitting || mode === "preview"}
            aria-busy={submitting || undefined}
          >
            {t(contentKey.formSubmit()) || "Send"}
          </button>
        </div>

        {status ? (
          <div
            className={`rf-status ${status.tone === "ok" ? "rf-ok" : "rf-bad"}`}
            role="status"
            aria-live="polite"
          >
            {status.text}
          </div>
        ) : null}
      </form>
    </div>
  );
}

interface RenderedFieldProps {
  field: FormField;
  mode: "preview" | "live";
  idPrefix: string;
  value: unknown;
  error?: FormErrorCode;
  t: (key: string) => string;
  onChange: (value: unknown) => void;
  region: (target: BuilderSelection) => Record<string, unknown>;
}

function RenderedField({
  field,
  mode,
  idPrefix,
  value,
  error,
  t,
  onChange,
  region,
}: RenderedFieldProps) {
  // Hidden fields are populated from the URL at submit time; there is nothing
  // for a visitor to see, and nothing useful to show in the preview either.
  if (field.type === "hidden" && mode === "live") return null;

  const widthClass = field.width === "half" ? "rf-half" : "rf-full";
  const inputId = `${idPrefix}-${field.id}`;
  const required = field.validation?.required === true;

  const previewProps = region({ kind: "field", fieldId: field.id });

  if (isPresentational(field.type)) {
    const text = t(contentKey.fieldText(field.id));
    return (
      <div className={`rf-field ${widthClass}`} {...previewProps}>
        {field.type === "heading" ? (
          <h3 className="rf-section-title">{text}</h3>
        ) : (
          <p className="rf-desc">{text}</p>
        )}
      </div>
    );
  }

  if (field.type === "hidden") {
    return (
      <div className={`rf-field ${widthClass}`} {...previewProps}>
        <p className="rf-help">
          {field.key} = {field.hiddenValue}
        </p>
      </div>
    );
  }

  const help = t(contentKey.fieldHelp(field.id));

  return (
    <div className={`rf-field ${widthClass}`} {...previewProps}>
      {field.type !== "checkbox" ? (
        <label className="rf-label" htmlFor={inputId}>
          {t(contentKey.fieldLabel(field.id))}
          {required ? (
            <span className="rf-req" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <FormFieldControl
        field={field}
        inputId={inputId}
        value={value}
        invalid={!!error}
        t={t}
        onChange={onChange}
      />

      {help ? <p className="rf-help">{help}</p> : null}

      <p className="rf-err" role="alert">
        {error
          ? t(contentKey.error(error)) || t(contentKey.errorGeneric())
          : ""}
      </p>
    </div>
  );
}
