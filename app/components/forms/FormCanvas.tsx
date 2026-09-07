/**
 * The builder canvas: the live form preview, made selectable and reorderable.
 *
 * Single-page forms: one flat vertical sortable list — the two-column layout
 * comes from each field's `width`, not from row containers, so there is
 * nothing to drag between. Multi-step forms: the step rail (StepStrip) shows
 * one step at a time; the list below is that step's fields, and a row dropped
 * on another step's pill moves there. Steps themselves reorder by dragging
 * their pill. One DndContext covers both, with closestCenter — the pills and
 * the rows are far enough apart that nothing steals hits.
 *
 * Ordering is persisted as the whole `sections` array in one JSON blob, so
 * arrayMove is enough — no fractional board_position bookkeeping.
 */

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRightLeft,
  Copy,
  Eye,
  GripVertical,
  Layers,
  SplitSquareVertical,
  Trash2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FormRenderer } from "~/components/forms/FormRenderer";
import {
  GhostAction,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
} from "~/components/forms/chrome";
import {
  StepStrip,
  isStepDndId,
  sectionIdOf,
  stepDndId,
} from "~/components/forms/StepStrip";
import { FIELD_TYPE_META, isFieldDeletable } from "~/lib/forms/field-types";
import {
  contentKey,
  flattenFields,
  isMultiStep,
  type FormDefinition,
  type FormField,
  type FormLocale,
} from "~/lib/forms/schema";
import { getContent } from "~/lib/forms/content";
import { selectedFieldId, type BuilderSelection } from "~/lib/forms/selection";

interface Props {
  definition: FormDefinition;
  locale: FormLocale;
  fallbackLocale: FormLocale;
  /**
   * Every locale the form offers. Passed through to the renderer so the preview
   * shows the language switcher the visitor will actually get — without it the
   * switcher's `offeredLocales.length > 1` guard can never be true, and the
   * control was invisible in the builder no matter how the toggle was set.
   */
  offeredLocales: FormLocale[];
  selection: BuilderSelection | null;
  onSelect: (selection: BuilderSelection | null) => void;
  /** Single-page: the whole form's field order. */
  onReorder: (orderedFieldIds: string[]) => void;
  onDuplicateField: (fieldId: string) => void;
  onDeleteField: (fieldId: string) => void;
  /** Multi-step: which step the canvas shows. Owned by the route. */
  activeStep: number;
  onActiveStepChange: (index: number) => void;
  /** Multi-step: field order within one step. */
  onReorderInStep: (sectionId: string, orderedFieldIds: string[]) => void;
  onMoveFieldToStep: (fieldId: string, sectionId: string) => void;
  /** Several fields at once (the empty-step "Move fields here" picker). */
  onMoveFieldsToStep: (fieldIds: string[], sectionId: string) => void;
  onReorderSteps: (orderedSectionIds: string[]) => void;
  onAddStep: () => void;
  onDuplicateStep: (sectionId: string) => void;
  onDeleteStep: (sectionId: string) => void;
  /** Toggle between one page and steps. */
  onSplitIntoSteps: () => void;
  onMergeSteps: () => void;
  /** Blocking issues per section id, in the editing locale (step-rail dots). */
  issuesBySection: ReadonlyMap<string, number>;
  /** Switches the locale being edited from the preview's own switcher. */
  onLocaleChange: (locale: FormLocale) => void;
  /** Hides the title block — the canvas-side equivalent of Design's toggle. */
  onRemoveTitle: () => void;
  /** Fields with a blocking issue in the language being edited. */
  invalidFieldIds: ReadonlySet<string>;
  disabled?: boolean;
}

export function FormCanvas({
  definition,
  locale,
  fallbackLocale,
  offeredLocales,
  selection,
  onSelect,
  onReorder,
  onDuplicateField,
  onDeleteField,
  onLocaleChange,
  onRemoveTitle,
  invalidFieldIds,
  disabled,
  activeStep,
  onActiveStepChange,
  onReorderInStep,
  onMoveFieldToStep,
  onMoveFieldsToStep,
  onReorderSteps,
  onAddStep,
  onDuplicateStep,
  onDeleteStep,
  onSplitIntoSteps,
  onMergeSteps,
  issuesBySection,
}: Props) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);

  const multi = isMultiStep(definition);

  // Blank is passed through rather than falling back to the key: the row
  // already prints the key in its own mono chip, and a label-less field is an
  // ordinary thing to have, so the fallback printed "zip zip" on every one.
  const fieldLabel = (field: FormField) =>
    field.type === "product"
      ? t("forms.palette.product")
      : getContent(
          definition,
          locale,
          field.type === "heading" || field.type === "paragraph"
            ? contentKey.fieldText(field.id)
            : contentKey.fieldLabel(field.id),
          fallbackLocale,
        );
  const stepLabel = (sectionId: string, index: number) =>
    getContent(
      definition,
      locale,
      contentKey.sectionTitle(sectionId),
      fallbackLocale,
    ) || t("forms.steps.stepN", { n: index + 1 });
  const sections = definition.sections ?? [];
  const step = Math.min(activeStep, Math.max(sections.length - 1, 0));
  const allFields = useMemo(() => flattenFields(definition), [definition]);
  /** What the Rearrange list shows: the active step's fields, or everything. */
  const fields = useMemo(
    () => (multi ? (sections[step]?.fields ?? []) : allFields),
    [multi, sections, step, allFields],
  );
  const stepTitles = useMemo(() => {
    const out: Record<string, string> = {};
    for (const section of sections) {
      out[section.id] = getContent(
        definition,
        locale,
        contentKey.sectionTitle(section.id),
        fallbackLocale,
      );
    }
    return out;
  }, [sections, definition, locale, fallbackLocale]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const handleDragStart = (event: DragStartEvent) =>
    setActiveId(String(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Step pill dragged onto another pill: reorder the steps.
    if (isStepDndId(active.id)) {
      if (!isStepDndId(over.id)) return;
      const ids = sections.map((s) => stepDndId(s.id));
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from < 0 || to < 0) return;
      onReorderSteps(arrayMove(ids, from, to).map(sectionIdOf));
      return;
    }

    // Field row dropped on a step pill: move it there.
    if (isStepDndId(over.id)) {
      const target = sectionIdOf(String(over.id));
      if (sections[step]?.id !== target) {
        onMoveFieldToStep(String(active.id), target);
      }
      return;
    }

    const ids = fields.map((f) => f.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    const ordered = arrayMove(ids, from, to);
    if (multi) onReorderInStep(sections[step].id, ordered);
    else onReorder(ordered);
  };

  const activeField =
    activeId && !isStepDndId(activeId)
      ? (allFields.find((f) => f.id === activeId) ?? null)
      : null;

  return (
    <Panel className="relative">
      {/* Preview-only chrome. Kept OUT of buildFormCss, which must stay
          byte-identical to the backend copy that renders the real form. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
/* The surface the form sits on. Deliberately unpainted: the form now carries its
   own background and padding from the theme, and any stage decoration behind it
   competes with the thing being designed. Purely builder chrome either way — the
   hosted page, iframe, script embed and pasted HTML never see this block. */
.rf-stage {
  border-radius: 12px;
  border: 1px solid var(--color-border);
  padding: 20px;
}
@media (min-width: 640px) { .rf-stage { padding: 32px; } }

.rf-canvas .rf-field,
.rf-canvas .rf-head,
.rf-canvas .rf-actions {
  position: relative; border-radius: 8px; outline-offset: 4px; cursor: pointer;
  transition: outline-color .12s ease;
  outline: 1px dashed transparent;
}
.rf-canvas .rf-field:hover,
.rf-canvas .rf-head:hover,
.rf-canvas .rf-actions:hover { outline-color: rgba(120,113,108,.45); }
/* --color-primary, not a near-miss literal: the old #6366f1 was one shade off
   the app's own #5265f3. */
.rf-canvas .rf-field[data-selected],
.rf-canvas .rf-head[data-selected],
.rf-canvas .rf-actions[data-selected] {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
}
/* The empty-title placeholder. Lives here, not in css.ts, and not via t() —
   FormRenderer imports zero i18next and css.ts must stay byte-identical to the
   backend's form-css.ts. */
.rf-canvas .rf-ghost::after { content: "Untitled form"; opacity: .35; }
.rf-canvas .rf-form { pointer-events: auto; }
.rf-canvas input, .rf-canvas textarea, .rf-canvas select, .rf-canvas button { pointer-events: none; }
.rf-canvas .rf-lang-btn { pointer-events: auto; }
/* Step navigation works in the preview so you can flip through what you are
   building; the dots too. No validation here — preview has no values. */
.rf-canvas .rf-back, .rf-canvas .rf-next, .rf-canvas .rf-step-dot { pointer-events: auto; }
.rf-canvas .rf-step-dot { cursor: pointer; }
.rf-canvas .rf-step[data-selected] {
  outline: 2px solid var(--color-primary);
  outline-offset: 12px;
  border-radius: 8px;
}
/* Step entry animation replays on every switch in the builder too, which is
   what you want to preview — but the exit clone is noise while editing. */
.rf-canvas .rf-step.rf-step-exit { display: none; }

/* A field the validator is complaining about, in the language being edited.
   Solid red beats the dashed hover outline and the blue selection ring, because
   "this is broken" outranks "this is where your mouse is". Builder-only: the
   attribute is never emitted in live mode. */
.rf-canvas .rf-field[data-rf-invalid] {
  outline: 2px solid var(--color-destructive);
  outline-offset: 4px;
}
.rf-canvas .rf-field[data-rf-invalid] .rf-label { color: var(--color-destructive); }

/* An empty product field. Live it renders nothing; here it has to be a real,
   clickable thing that explains itself, so it gets height, a dashed edge and
   two lines of copy. Builder-only — css.ts is byte-mirrored by the backend. */
.rf-canvas .rf-commerce-empty {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  min-height: 92px; padding: 18px 16px; text-align: center;
  border: 1px dashed var(--rf-border, var(--color-border));
  border-radius: var(--rf-radius, 12px);
  background: color-mix(in srgb, var(--rf-surface, var(--color-card)) 60%, transparent);
  color: var(--rf-muted, var(--color-muted-foreground));
}
.rf-canvas .rf-commerce-empty:hover { border-style: solid; }
.rf-canvas .rf-commerce-empty-glyph {
  display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center;
  border-radius: 8px; background: color-mix(in srgb, currentColor 10%, transparent);
  margin-bottom: 2px;
}
.rf-canvas .rf-commerce-empty-title { font-size: 13px; font-weight: 600; color: var(--rf-text, var(--color-foreground)); }
.rf-canvas .rf-commerce-empty-hint { font-size: 12px; line-height: 1.4; max-width: 34ch; }

/* The header's delete affordance. Absolute so it cannot push the title around
   and change the very layout it is previewing; only visible on hover or when
   the header is the selected region, so it is not part of the design at rest. */
.rf-canvas .rf-head { padding-right: 28px; }
.rf-canvas .rf-head-remove {
  /* Centred on the header block rather than pinned to its top edge: the header
     is one line with a title alone and three with a description, and a button
     stuck at top:0 drifted further from centre the taller it got. */
  position: absolute; top: 50%; right: 0; transform: translateY(-50%);
  width: 22px; height: 22px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--color-border); border-radius: 6px;
  background: var(--color-background); color: var(--color-muted-foreground);
  font-size: 14px; cursor: pointer; pointer-events: auto;
  opacity: 0; transition: opacity .12s ease, color .12s ease, border-color .12s ease;
}
.rf-canvas .rf-head:hover .rf-head-remove,
.rf-canvas .rf-head[data-selected] .rf-head-remove { opacity: 1; }
.rf-canvas .rf-head-remove:hover {
  color: var(--color-destructive); border-color: var(--color-destructive);
}
`,
        }}
      />

      <PanelHeader
        icon={<Eye className="h-3.5 w-3.5" />}
        title={t("forms.builder.previewTitle")}
        meta={
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] uppercase text-muted-foreground">
            {locale}
          </span>
        }
        action={
          disabled ? null : multi ||
            definition.layout?.mode === "multi_step" ? (
            <GhostAction onClick={onMergeSteps} className="h-8 text-xs">
              <Layers className="h-3.5 w-3.5" />
              {t("forms.steps.merge")}
            </GhostAction>
          ) : (
            <GhostAction onClick={onSplitIntoSteps} className="h-8 text-xs">
              <SplitSquareVertical className="h-3.5 w-3.5" />
              {t("forms.steps.split")}
            </GhostAction>
          )
        }
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {definition.layout?.mode === "multi_step" ? (
          <StepStrip
            sections={sections}
            activeStep={step}
            titles={stepTitles}
            issuesBySection={issuesBySection}
            fieldDragging={!!activeField}
            disabled={disabled}
            onSelectStep={onActiveStepChange}
            onRenameStep={(id) => {
              onActiveStepChange(sections.findIndex((s) => s.id === id));
              onSelect({ kind: "step", stepId: id });
            }}
            onAddStep={onAddStep}
            onDuplicateStep={onDuplicateStep}
            onMoveStep={(id, dir) => {
              const ids = sections.map((s) => s.id);
              const from = ids.indexOf(id);
              const to = from + dir;
              if (from < 0 || to < 0 || to >= ids.length) return;
              onReorderSteps(arrayMove(ids, from, to));
            }}
            onDeleteStep={onDeleteStep}
          />
        ) : null}

        <SortableContext
          items={fields.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <PanelBody>
            <div
              className="rf-stage rf-canvas overflow-x-auto"
              onClick={() => onSelect(null)}
            >
              {/* The renderer draws the form; the overlay row below draws the
                per-field handles on top of it, positioned by field order. */}
              <FormRenderer
                definition={definition}
                locale={locale}
                fallbackLocale={fallbackLocale}
                mode="preview"
                idPrefix="builder"
                values={{}}
                errors={{}}
                onChange={() => undefined}
                offeredLocales={offeredLocales}
                onLocaleChange={onLocaleChange}
                selection={selection}
                onSelect={onSelect}
                onRemoveTitle={disabled ? undefined : onRemoveTitle}
                removeTitleLabel={t("forms.builder.removeTitle")}
                invalidFieldIds={invalidFieldIds}
                emptyProductHint={{
                  title: t("forms.builder.productEmptyTitle"),
                  hint: t("forms.builder.productEmptyHint"),
                }}
                step={multi ? step : undefined}
                onStepChange={onActiveStepChange}
              />
            </div>

            <PanelSection
              title={
                multi
                  ? t("forms.steps.fieldsIn", { n: step + 1 })
                  : t("forms.builder.dragHandle")
              }
            >
              {fields.length === 0 ? (
                <div className="space-y-3 rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                  <p>
                    {multi
                      ? t("forms.steps.emptyStepHint")
                      : t("forms.builder.emptyCanvasHint")}
                  </p>
                  {/* The step you just created is empty and the fields you
                      want are one step over: bring them here in one go
                      instead of deleting and re-creating them. */}
                  {multi &&
                  !disabled &&
                  sections.some(
                    (sec, i) => i !== step && sec.fields.length > 0,
                  ) ? (
                    <MoveFieldsPicker
                      targetLabel={stepLabel(sections[step].id, step)}
                      groups={sections
                        .map((sec, i) => ({
                          id: sec.id,
                          label: stepLabel(sec.id, i),
                          fields: sec.fields.map((f) => ({
                            id: f.id,
                            label: fieldLabel(f) || f.key,
                          })),
                        }))
                        .filter((g, i) => i !== step && g.fields.length > 0)}
                      onMove={(ids) =>
                        onMoveFieldsToStep(ids, sections[step].id)
                      }
                    />
                  ) : null}
                </div>
              ) : null}
              {multi && !disabled ? (
                <p className="text-xs text-muted-foreground">
                  {t("forms.steps.dropHint")}
                </p>
              ) : null}
              <div className="space-y-1.5">
                {fields.map((field) => (
                  <SortableFieldRow
                    key={field.id}
                    field={field}
                    label={fieldLabel(field)}
                    selected={selectedFieldId(selection) === field.id}
                    disabled={disabled}
                    deletable={isFieldDeletable(field, allFields)}
                    invalid={invalidFieldIds.has(field.id)}
                    onSelect={() =>
                      onSelect({ kind: "field", fieldId: field.id })
                    }
                    onDuplicate={() => onDuplicateField(field.id)}
                    onDelete={() => onDeleteField(field.id)}
                    duplicateLabel={t("forms.builder.duplicateField")}
                    moveLabel={t("forms.steps.moveField")}
                    moveTargets={
                      multi && sections.length > 1
                        ? sections
                            .map((sec, i) => ({
                              id: sec.id,
                              label: stepLabel(sec.id, i),
                              index: i,
                            }))
                            .filter((sec) => sec.index !== step)
                        : undefined
                    }
                    onMoveTo={(sectionId) =>
                      onMoveFieldToStep(field.id, sectionId)
                    }
                    deleteLabel={t("forms.builder.deleteField")}
                    undeletableLabel={t("forms.builder.undeletableField")}
                    noLabelText={t("forms.builder.noLabel")}
                  />
                ))}
              </div>
            </PanelSection>
          </PanelBody>
        </SortableContext>

        {/* Portalled to <body>, which is not optional here. DragOverlay is
            positioned with fixed coordinates against its containing block, and
            this Panel is `position: relative` inside a CSS grid column — so
            rendered in place the dragged card resolved against the wrong box
            and shot to the bottom-right of the page. document.body has no
            transform, so the coordinates mean what dnd-kit intends.

            Guarded on `document` because the builder renders under SSR, where
            there is no body to portal into on the first pass. */}
        {typeof document !== "undefined"
          ? createPortal(
              <DragOverlay dropAnimation={null}>
                {activeField ? (
                  <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-lg">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono text-xs">{activeField.key}</span>
                  </div>
                ) : null}
              </DragOverlay>,
              document.body,
            )
          : null}
      </DndContext>
    </Panel>
  );
}

function SortableFieldRow({
  field,
  label,
  selected,
  disabled,
  deletable,
  invalid,
  onSelect,
  onDuplicate,
  onDelete,
  duplicateLabel,
  deleteLabel,
  undeletableLabel,
  noLabelText,
  moveLabel,
  moveTargets,
  onMoveTo,
}: {
  field: FormField;
  /** Empty when the field has no label — a legitimate, placeholder-only field. */
  label: string;
  selected: boolean;
  disabled?: boolean;
  /** False while this field is the only one satisfying the email or name rule. */
  deletable: boolean;
  /** Has a blocking issue in the language being edited. */
  invalid: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  duplicateLabel: string;
  deleteLabel: string;
  undeletableLabel: string;
  noLabelText: string;
  moveLabel: string;
  /** Multi-step only: the OTHER steps this field can be sent to. */
  moveTargets?: { id: string; label: string; index: number }[];
  onMoveTo?: (sectionId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, disabled });

  const Icon = FIELD_TYPE_META[field.type].icon;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }}
      // Invalid outranks selected: the list is where you go looking for the
      // field the banner just named, so it has to be findable at a glance even
      // while something else is selected.
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
        invalid
          ? "border-destructive/50 bg-destructive/5"
          : selected
            ? "border-primary/40 bg-primary/5"
            : "bg-muted/30 hover:border-border/80 hover:bg-muted/60"
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none p-1 text-muted-foreground/60 active:cursor-grabbing disabled:cursor-not-allowed"
        disabled={disabled}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${field.key}`}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <Icon
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span
          className={`truncate text-sm ${
            invalid ? "text-destructive" : label ? "" : "text-muted-foreground"
          }`}
        >
          {label || noLabelText}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          {field.key}
        </span>
        {field.validation?.required ? (
          <span className="shrink-0 text-xs text-destructive">*</span>
        ) : null}
      </button>

      {moveTargets && moveTargets.length > 0 && onMoveTo ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={moveLabel}
              title={moveLabel}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-1.5">
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {moveLabel}
            </p>
            {moveTargets.map((target) => (
              <button
                key={target.id}
                type="button"
                onClick={() => onMoveTo(target.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {target.index + 1}
                </span>
                <span className="truncate">{target.label}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        onClick={onDuplicate}
        aria-label={duplicateLabel}
        title={duplicateLabel}
        className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      {/* Rendered disabled rather than hidden when the field is load-bearing:
          a control that vanishes leaves the user hunting for it, where one that
          explains itself on hover answers the question. */}
      <button
        type="button"
        disabled={disabled || !deletable}
        onClick={onDelete}
        aria-label={deletable ? deleteLabel : undeletableLabel}
        title={deletable ? deleteLabel : undeletableLabel}
        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * "Move fields here": tick fields from the other steps and bring them over in
 * one patch. Lives in the empty-step hint, because that is the moment you
 * want it — right after "Split into steps" or "Add step".
 */
function MoveFieldsPicker({
  targetLabel,
  groups,
  onMove,
}: {
  targetLabel: string;
  groups: {
    id: string;
    label: string;
    fields: { id: string; label: string }[];
  }[];
  onMove: (fieldIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setPicked(new Set());
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <ArrowRightLeft className="h-3.5 w-3.5" />
          {t("forms.steps.moveFieldsHere")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-72 p-0 text-left">
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold text-foreground">
            {t("forms.steps.moveFieldsTitle", { step: targetLabel })}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t("forms.steps.moveFieldsHint")}
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto px-1.5 py-1.5">
          {groups.map((group) => (
            <div key={group.id} className="py-1">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {group.label}
              </p>
              {group.fields.map((field) => (
                <label
                  key={field.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={picked.has(field.id)}
                    onCheckedChange={(v) => toggle(field.id, v === true)}
                  />
                  <span className="truncate">{field.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="flex justify-end border-t border-border px-3 py-2">
          <Button
            type="button"
            size="sm"
            disabled={picked.size === 0}
            onClick={() => {
              onMove([...picked]);
              setOpen(false);
              setPicked(new Set());
            }}
          >
            {t("forms.steps.moveSelected", { count: picked.size })}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
