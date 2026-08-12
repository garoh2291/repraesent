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
import { InlineText } from "~/components/forms/InlineText";
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
  /**
   * Live mode only: the public form id, so an appointment field can ask the
   * availability endpoint for real slots. Omitted in preview, where a draft has
   * no published availability and the slot picker renders placeholders.
   */
  formId?: string;
  /** Locales offered in the public switcher; omit to hide it. */
  offeredLocales?: FormLocale[];
  onLocaleChange?: (locale: FormLocale) => void;

  /** preview mode only */
  selection?: BuilderSelection | null;
  onSelect?: (selection: BuilderSelection) => void;
  /** Hides the header block. Omit and the delete control is not rendered. */
  onRemoveTitle?: () => void;
  removeTitleLabel?: string;
  /**
   * Fields with a blocking issue in the language being edited. Marked with a
   * data attribute and styled by the canvas, NOT by buildFormCss — the shared
   * stylesheet renders real forms for visitors and must not learn about
   * builder state.
   */
  invalidFieldIds?: ReadonlySet<string>;

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
  formId,
  offeredLocales,
  onLocaleChange,
  selection,
  onSelect,
  onRemoveTitle,
  removeTitleLabel,
  invalidFieldIds,
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
   * page, the iframe and the script embed all render byte-identically to each
   * other, and stay in step with
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

  // Preview does not require a handler: the builder shows the switcher to prove
  // the toggle works, and clicking it just moves the editing locale if the
  // canvas passed something to move. Live still needs the handler, since a
  // switcher that changes nothing would be a dead control for a visitor.
  const showSwitcher =
    definition.showLanguageSwitcher &&
    (offeredLocales?.length ?? 0) > 1 &&
    (!!onLocaleChange || mode === "preview");

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
                onClick={(e) => {
                  e.stopPropagation();
                  onLocaleChange?.(loc);
                }}
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

            {/* Deleting the title means hiding the header, which the Design tab
                also does via its Show-title switch — but nobody looks in Design
                to remove something they are staring at on the canvas. Same
                affordance the fields have, in the same place. */}
            {mode === "preview" && onRemoveTitle ? (
              <button
                type="button"
                className="rf-head-remove"
                aria-label={removeTitleLabel}
                title={removeTitleLabel}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveTitle();
                }}
              >
                ×
              </button>
            ) : null}
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
                    formId={formId}
                    locale={locale}
                    value={values[field.key]}
                    error={errors[field.key]}
                    t={t}
                    onChange={(v) => onChange(field.key, v)}
                    region={region}
                    invalid={invalidFieldIds?.has(field.id) ?? false}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <div className="rf-actions" {...region({ kind: "submit" })}>
          {/* The spinner is a sibling, not a replacement for the label: a
              button whose text disappears mid-submit resizes, and the visitor
              loses the only confirmation of what they pressed. */}
          <button
            type="submit"
            className="rf-submit"
            disabled={submitting || mode === "preview"}
            aria-busy={submitting || undefined}
          >
            {submitting ? (
              <span className="rf-spin" aria-hidden="true" />
            ) : null}
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
  /** See FormRendererProps.formId — appointment availability, live mode only. */
  formId?: string;
  locale: FormLocale;
  value: unknown;
  error?: FormErrorCode;
  t: (key: string) => string;
  onChange: (value: unknown) => void;
  region: (target: BuilderSelection) => Record<string, unknown>;
  /** Builder-only: this field has a blocking issue in the editing locale. */
  invalid?: boolean;
}

function RenderedField({
  field,
  mode,
  idPrefix,
  formId,
  locale,
  value,
  error,
  t,
  onChange,
  region,
  invalid,
}: RenderedFieldProps) {
  // Hidden fields are populated from the URL at submit time; there is nothing
  // for a visitor to see, and nothing useful to show in the preview either.
  if (field.type === "hidden" && mode === "live") return null;

  const widthClass = field.width === "half" ? "rf-half" : "rf-full";
  const inputId = `${idPrefix}-${field.id}`;
  const required = field.validation?.required === true;

  const previewProps = {
    ...region({ kind: "field", fieldId: field.id }),
    ...(invalid && mode === "preview" ? { "data-rf-invalid": "" } : {}),
  };

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

  // A label is optional now. The element still renders so it keeps its place in
  // the stack, but with no text it has no children and `.rf-label:empty`
  // collapses it — and the star goes with the text, because a lone asterisk
  // names nothing. FormFieldControl picks the accessible name up instead.
  const label = t(contentKey.fieldLabel(field.id));
  const labelled = label.trim() !== "";

  return (
    <div className={`rf-field ${widthClass}`} {...previewProps}>
      {field.type !== "checkbox" ? (
        <label className="rf-label" htmlFor={inputId}>
          <InlineText text={label} />
          {required && labelled ? (
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
        labelled={labelled}
        t={t}
        onChange={onChange}
        mode={mode}
        formId={formId}
        locale={locale}
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
