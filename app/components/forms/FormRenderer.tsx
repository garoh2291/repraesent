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

import { useEffect, useMemo, useRef, useState } from "react";
import { buildFormCss, googleFontsHref } from "~/lib/forms/css";
import { InlineText } from "~/components/forms/InlineText";
import { fillTemplate, getContent } from "~/lib/forms/content";
import { isSameSelection, type BuilderSelection } from "~/lib/forms/selection";
import {
  contentKey,
  isMultiStep,
  isPresentational,
  type FormDefinition,
  type FormErrorCode,
  type FormField,
  type FormLocale,
} from "~/lib/forms/schema";
import { CommerceSummary } from "./CommerceSummary";
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
  /**
   * Builder-only copy for a product field whose bundle is still empty. The
   * renderer imports no i18next by design, so the canvas passes the words in.
   */
  emptyProductHint?: { title: string; hint: string };

  /**
   * Multi-step (definition.layout.mode === "multi_step" with 2+ sections).
   * The host owns the step index: live mode validates the current step in
   * `onNext` before advancing; preview mode flips freely via `onStepChange`.
   * Omit `step` on a single-page form.
   */
  step?: number;
  /** Direction of the last step change — drives the slide. */
  stepDirection?: "forward" | "back";
  /** Live: Next pressed (or Enter) on a step that is not the last. Validate, then advance. */
  onNext?: () => void;
  /** Back pressed. Values stay; no validation. */
  onBack?: () => void;
  /** A completed progress dot clicked (live), or any dot / Next / Back in preview. */
  onStepChange?: (index: number) => void;

  /** A dismissible notice above the header — the "checkout canceled" banner. */
  notice?: { text: string; dismissLabel: string; onDismiss: () => void } | null;

  /** Product forms: chosen quantity per price id (live), and the change handler. */
  quantities?: Record<string, number>;
  onQuantityChange?: (priceId: string, quantity: number) => void;
  /** Product forms: ticked price ids and the toggle handler. */
  productSelection?: ReadonlySet<string>;
  onProductSelectionChange?: (priceId: string, selected: boolean) => void;

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
  emptyProductHint,
  step: stepProp,
  stepDirection = "forward",
  onNext,
  onBack,
  onStepChange,
  notice,
  quantities,
  onQuantityChange,
  productSelection,
  onProductSelectionChange,
  className,
}: FormRendererProps) {
  const scope = `rf-${idPrefix.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;
  const formRef = useRef<HTMLFormElement | null>(null);

  const multi = isMultiStep(definition);
  const sections = definition.sections ?? [];
  const stepCount = sections.length;
  const step = multi
    ? Math.min(Math.max(stepProp ?? 0, 0), Math.max(stepCount - 1, 0))
    : 0;
  const isLast = !multi || step === stepCount - 1;

  /**
   * The step being left keeps rendering for one short beat, out of flow, so it
   * can slide away while the new one slides in — the same choreography the
   * embed runtime performs (see form-render.service.ts showStep). `animKey`
   * restarts the enter animation on every change; without it React reuses the
   * node and CSS never sees the class come back.
   */
  const [leaving, setLeaving] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const prevStep = useRef(step);
  useEffect(() => {
    if (!multi || prevStep.current === step) return;
    const from = sections[prevStep.current]?.id ?? null;
    prevStep.current = step;
    setLeaving(from);
    setAnimKey((k) => k + 1);
    const timer = window.setTimeout(() => setLeaving(null), 220);
    return () => window.clearTimeout(timer);
    // sections only matters for the id lookup; the step index is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, multi]);

  /**
   * Live only: move focus into the new step, and bring the form back into view
   * when the previous step was long enough to scroll its top off-screen.
   * preventScroll, so the focus itself does not yank the page; the scroll is
   * our own decision and honours reduced motion.
   */
  useEffect(() => {
    if (mode !== "live" || !multi || animKey === 0) return;
    const form = formRef.current;
    if (!form) return;
    const active = form.querySelector<HTMLElement>(".rf-step[data-rf-active]");
    const focusable = active?.querySelector<HTMLElement>(
      "input:not([type=hidden]):not(.rf-hp), select, textarea, button:not([disabled])",
    );
    try {
      focusable?.focus({ preventScroll: true });
    } catch {
      focusable?.focus();
    }
    const rect = form.getBoundingClientRect();
    if (rect.top < 0 || rect.top > window.innerHeight) {
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      form.scrollIntoView({
        block: "start",
        behavior: reduced ? "auto" : "smooth",
      });
    }
  }, [animKey, mode, multi]);
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

  // One title area. On a multi-step form it belongs to the step being shown
  // (falling back to the form's own words), so the visitor never reads two
  // stacked headings; single-step forms keep the form title as before.
  const activeSection = multi ? sections[step] : undefined;
  const title =
    (activeSection && t(contentKey.sectionTitle(activeSection.id))) ||
    t(contentKey.formTitle());
  const description =
    (activeSection && t(contentKey.sectionDescription(activeSection.id))) ||
    t(contentKey.formDescription());

  const stepOf = multi
    ? fillTemplate(t(contentKey.navStepOf()), { n: step + 1, total: stepCount })
    : "";
  const progress = definition.layout?.progress ?? "bar";
  const showStepTitles = definition.layout?.showStepTitles !== false;

  const goTo = (index: number) => {
    if (mode === "preview") onStepChange?.(index);
    else if (index < step) onStepChange?.(index);
  };

  const renderSection = (
    section: FormDefinition["sections"][number],
    index: number,
  ) => {
    const sectionTitle = t(contentKey.sectionTitle(section.id));
    const sectionDesc = t(contentKey.sectionDescription(section.id));
    const active = !multi || index === step;
    const exiting = multi && leaving === section.id && !active;
    const stepProps = multi
      ? {
          "data-rf-step": index,
          "data-rf-step-id": section.id,
          ...(active ? { "data-rf-active": "" } : {}),
          ...(!active && !exiting ? { hidden: true } : {}),
          ...region({ kind: "step", stepId: section.id }),
        }
      : {};
    return (
      <div
        className={`rf-section${multi ? " rf-step" : ""}${
          multi && active && animKey > 0 ? " rf-step-enter" : ""
        }${exiting ? " rf-step-exit" : ""}`}
        key={multi && active ? `${section.id}:${animKey}` : section.id}
        {...stepProps}
      >
        {sectionTitle && !multi ? (
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
              emptyProductHint={emptyProductHint}
              definition={definition}
              fallbackLocale={fallbackLocale}
              quantities={quantities ?? {}}
              onQuantityChange={onQuantityChange}
              productSelection={productSelection ?? EMPTY_SELECTION}
              onProductSelectionChange={onProductSelectionChange}
            />
          ))}
        </div>
      </div>
    );
  };

  const submitButton = (
    <button
      type="submit"
      className="rf-submit"
      disabled={submitting || mode === "preview"}
      aria-busy={submitting || undefined}
      hidden={multi && !isLast ? true : undefined}
    >
      {/* The spinner is a sibling, not a replacement for the label: a
          button whose text disappears mid-submit resizes, and the visitor
          loses the only confirmation of what they pressed. */}
      {submitting ? <span className="rf-spin" aria-hidden="true" /> : null}
      {t(contentKey.formSubmit()) || "Send"}
    </button>
  );

  return (
    <div className={`${scope} ${className ?? ""}`}>
      {fontHref ? <link rel="stylesheet" href={fontHref} /> : null}
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <form
        ref={formRef}
        className={`rf-form${multi ? " rf-multi" : ""}`}
        noValidate
        data-rf-steps={multi ? stepCount : undefined}
        style={
          multi
            ? ({
                "--rf-dir": stepDirection === "back" ? -1 : 1,
              } as React.CSSProperties)
            : undefined
        }
        onSubmit={(e) => {
          e.preventDefault();
          if (mode !== "live") return;
          // Enter in any input is an implicit submit; on a middle step that
          // means "Next", exactly what the visible button says.
          if (multi && !isLast) onNext?.();
          else onSubmit?.();
        }}
      >
        {notice ? (
          <div className="rf-notice" role="status">
            <span>{notice.text}</span>
            <button
              type="button"
              className="rf-notice-close"
              aria-label={notice.dismissLabel}
              title={notice.dismissLabel}
              onClick={notice.onDismiss}
            >
              ×
            </button>
          </div>
        ) : null}

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
          <div
            className="rf-head"
            {...region(
              activeSection
                ? { kind: "step", stepId: activeSection.id }
                : { kind: "header" },
            )}
          >
            {title ? (
              <h2 className="rf-title" data-rf-head-title="">
                {title}
              </h2>
            ) : mode === "preview" ? (
              <h2 className="rf-title rf-ghost" aria-hidden="true" />
            ) : null}
            {description ? (
              <p className="rf-desc" data-rf-head-desc="">
                {description}
              </p>
            ) : null}

            {/* Deleting the title means hiding the header, which the Design tab
                also does via its Show-title switch — but nobody looks in Design
                to remove something they are staring at on the canvas. Same
                affordance the fields have, in the same place. */}
            {mode === "preview" && onRemoveTitle && !multi ? (
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

        {multi && progress === "bar" ? (
          <div
            className="rf-progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={stepCount}
            aria-valuenow={step + 1}
            aria-valuetext={stepOf}
          >
            <span
              className="rf-progress-bar"
              style={{ width: `${((step + 1) / stepCount) * 100}%` }}
            />
          </div>
        ) : null}
        {multi && progress === "steps" ? (
          <ol className="rf-steps" aria-label={stepOf}>
            {sections.map((section, index) => {
              const name = showStepTitles
                ? t(contentKey.sectionTitle(section.id))
                : "";
              return (
                <li
                  key={section.id}
                  className={`rf-step-dot${index === step ? " rf-on" : ""}${
                    index < step ? " rf-done" : ""
                  }`}
                  data-rf-dot={index}
                  aria-current={index === step ? "step" : undefined}
                  onClick={() => goTo(index)}
                >
                  <span>
                    <span className="rf-step-num">{index + 1}</span>
                    {name ? (
                      <span className="rf-step-title">{name}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}

        {multi ? (
          <div className="rf-steps-wrap">{sections.map(renderSection)}</div>
        ) : (
          sections.map(renderSection)
        )}

        {multi ? (
          <div className="rf-nav" {...region({ kind: "submit" })}>
            <button
              type="button"
              className="rf-back"
              hidden={step === 0 ? true : undefined}
              onClick={() =>
                mode === "preview" ? onStepChange?.(step - 1) : onBack?.()
              }
            >
              {t(contentKey.navBack())}
            </button>
            <span className="rf-step-of" aria-live="polite" aria-atomic="true">
              {stepOf}
            </span>
            <button
              type="button"
              className="rf-next"
              hidden={isLast ? true : undefined}
              onClick={() =>
                mode === "preview" ? onStepChange?.(step + 1) : onNext?.()
              }
            >
              {t(contentKey.navNext())}
            </button>
            {submitButton}
          </div>
        ) : (
          <div className="rf-actions" {...region({ kind: "submit" })}>
            {submitButton}
          </div>
        )}

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
  /** Builder-only: what an empty product field says (see FormRendererProps). */
  emptyProductHint?: { title: string; hint: string };
  /** For the product field: the definition holds the bundle it renders. */
  definition: FormDefinition;
  fallbackLocale: FormLocale;
  quantities: Record<string, number>;
  onQuantityChange?: (priceId: string, quantity: number) => void;
  productSelection: ReadonlySet<string>;
  onProductSelectionChange?: (priceId: string, selected: boolean) => void;
}

const EMPTY_SELECTION: ReadonlySet<string> = new Set();

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
  emptyProductHint,
  definition,
  fallbackLocale,
  quantities,
  onQuantityChange,
  productSelection,
  onProductSelectionChange,
}: RenderedFieldProps) {
  // Hidden fields are populated from the URL at submit time; there is nothing
  // for a visitor to see, and nothing useful to show in the preview either.
  if (field.type === "hidden" && mode === "live") return null;

  // The product field IS the order summary. Selectable in the builder like any
  // field; an empty bundle renders nothing live, and in the builder a dashed
  // card that says what the slot is and what to do next (the words come from
  // the canvas — this file has no i18n on purpose).
  if (field.type === "product") {
    const commerce = definition.commerce;
    if (!commerce || commerce.items.length === 0) {
      return mode === "preview" ? (
        <div
          className="rf-field rf-full rf-commerce-empty"
          role="button"
          tabIndex={0}
          {...region({ kind: "field", fieldId: field.id })}
          {...(invalid ? { "data-rf-invalid": "" } : {})}
        >
          <span className="rf-commerce-empty-glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path
                d="M6 8h12l-1 12H7L6 8Z M9 8V6a3 3 0 0 1 6 0v2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <strong className="rf-commerce-empty-title">
            {emptyProductHint?.title ?? "No products yet"}
          </strong>
          <span className="rf-commerce-empty-hint">
            {emptyProductHint?.hint ??
              "Select this block, then add the Stripe products buyers can choose from."}
          </span>
        </div>
      ) : null;
    }
    return (
      <CommerceSummary
        definition={definition}
        commerce={commerce}
        locale={locale}
        fallbackLocale={fallbackLocale}
        quantities={quantities}
        onQuantityChange={onQuantityChange}
        selection={
          mode === "preview" ? previewSelection(commerce) : productSelection
        }
        onSelectionChange={onProductSelectionChange}
        fieldKey={field.key}
        error={error ?? null}
        t={t}
        mode={mode}
        regionProps={{
          ...region({ kind: "field", fieldId: field.id }),
          ...(invalid && mode === "preview" ? { "data-rf-invalid": "" } : {}),
          "data-rf-field-id": field.id,
        }}
      />
    );
  }

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

/** The builder preview shows the lines as the buyer first sees them. */
function previewSelection(
  commerce: FormDefinition["commerce"],
): ReadonlySet<string> {
  return new Set(
    (commerce?.items ?? []).filter((i) => i.preselected).map((i) => i.priceId),
  );
}
