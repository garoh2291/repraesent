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
import { useTranslation } from "react-i18next";
import { FormRenderer } from "~/components/forms/FormRenderer";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
} from "~/components/forms/chrome";
import { FIELD_TYPE_META } from "~/lib/forms/field-types";
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
  selection: BuilderSelection | null;
  onSelect: (selection: BuilderSelection | null) => void;
  onReorder: (orderedFieldIds: string[]) => void;
  onDuplicateField: (fieldId: string) => void;
  onDeleteField: (fieldId: string) => void;
  disabled?: boolean;
}

export function FormCanvas({
  definition,
  locale,
  fallbackLocale,
  selection,
  onSelect,
  onReorder,
  onDuplicateField,
  onDeleteField,
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
/* The design surface the form sits on. A dot grid reads as "canvas" the way a
   flat panel never does, and it is purely builder chrome — the hosted page,
   iframe, script embed and pasted HTML never see it. */
.rf-stage {
  border-radius: 12px;
  border: 1px solid var(--color-border);
  padding: 20px;
  background-image: radial-gradient(circle, var(--color-border) 1px, transparent 1px);
  background-size: 16px 16px;
  background-position: -1px -1px;
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
                selection={selection}
                onSelect={onSelect}
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
                    label={
                      getContent(
                        definition,
                        locale,
                        field.type === "heading" || field.type === "paragraph"
                          ? contentKey.fieldText(field.id)
                          : contentKey.fieldLabel(field.id),
                        fallbackLocale,
                      ) || field.key
                    }
                    selected={selectedFieldId(selection) === field.id}
                    disabled={disabled}
                    onSelect={() =>
                      onSelect({ kind: "field", fieldId: field.id })
                    }
                    onDuplicate={() => onDuplicateField(field.id)}
                    onDelete={() => onDeleteField(field.id)}
                    duplicateLabel={t("forms.builder.duplicateField")}
                    deleteLabel={t("forms.builder.deleteField")}
                  />
                ))}
              </div>
            </PanelSection>
          </PanelBody>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeField ? (
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-lg">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-xs">{activeField.key}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </Panel>
  );
}

function SortableFieldRow({
  field,
  label,
  selected,
  disabled,
  onSelect,
  onDuplicate,
  onDelete,
  duplicateLabel,
  deleteLabel,
}: {
  field: FormField;
  label: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  duplicateLabel: string;
  deleteLabel: string;
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
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
        selected
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
        <span className="truncate text-sm">{label}</span>
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
      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        aria-label={deleteLabel}
        title={deleteLabel}
        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
