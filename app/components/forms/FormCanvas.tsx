/**
 * The builder canvas: the live form preview, made selectable and reorderable.
 *
 * Reorder is a single flat vertical sortable list across all sections — the
 * two-column layout comes from each field's `width`, not from row containers,
 * so there is nothing to drag between. That makes closestCenter the right
 * collision strategy; kanbanCollisionDetection in app/lib/kanban/board-position
 * exists for the multi-column boards, where big column droppables steal hits.
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
import { Copy, Eye, GripVertical, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FormRenderer } from "~/components/forms/FormRenderer";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
} from "~/components/forms/chrome";
import { FIELD_TYPE_META, isFieldDeletable } from "~/lib/forms/field-types";
import {
  contentKey,
  flattenFields,
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
  onReorder: (orderedFieldIds: string[]) => void;
  onDuplicateField: (fieldId: string) => void;
  onDeleteField: (fieldId: string) => void;
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
}: Props) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);

  const fields = useMemo(() => flattenFields(definition), [definition]);

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

    const ids = fields.map((f) => f.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    onReorder(arrayMove(ids, from, to));
  };

  const activeField = activeId
    ? (fields.find((f) => f.id === activeId) ?? null)
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

/* A field the validator is complaining about, in the language being edited.
   Solid red beats the dashed hover outline and the blue selection ring, because
   "this is broken" outranks "this is where your mouse is". Builder-only: the
   attribute is never emitted in live mode. */
.rf-canvas .rf-field[data-rf-invalid] {
  outline: 2px solid var(--color-destructive);
  outline-offset: 4px;
}
.rf-canvas .rf-field[data-rf-invalid] .rf-label { color: var(--color-destructive); }

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
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
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
              />
            </div>

            <PanelSection title={t("forms.builder.dragHandle")}>
              {fields.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                  {t("forms.builder.emptyCanvasHint")}
                </p>
              ) : null}
              <div className="space-y-1.5">
                {fields.map((field) => (
                  <SortableFieldRow
                    key={field.id}
                    field={field}
                    // Blank is passed through rather than falling back to the
                    // key: the row already prints the key in its own mono chip,
                    // and a label-less field is now an ordinary thing to have,
                    // so the fallback printed "zip zip" on every one of them.
                    label={getContent(
                      definition,
                      locale,
                      field.type === "heading" || field.type === "paragraph"
                        ? contentKey.fieldText(field.id)
                        : contentKey.fieldLabel(field.id),
                      fallbackLocale,
                    )}
                    selected={selectedFieldId(selection) === field.id}
                    disabled={disabled}
                    deletable={isFieldDeletable(field, fields)}
                    invalid={invalidFieldIds.has(field.id)}
                    onSelect={() =>
                      onSelect({ kind: "field", fieldId: field.id })
                    }
                    onDuplicate={() => onDuplicateField(field.id)}
                    onDelete={() => onDeleteField(field.id)}
                    duplicateLabel={t("forms.builder.duplicateField")}
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
