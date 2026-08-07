import { GripVertical, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { newId, snakeKey } from "~/lib/forms/field-types";
import type { FormFieldOption } from "~/lib/forms/schema";

interface Props {
  options: FormFieldOption[];
  /** Locale label for an option, read/written through form content. */
  labelFor: (optionId: string) => string;
  onLabelChange: (optionId: string, label: string) => void;
  onChange: (options: FormFieldOption[]) => void;
  disabled?: boolean;
}

/**
 * Value and label are edited separately on purpose: the value is what gets
 * stored on the lead and must stay stable across languages, while the label is
 * per-locale form content.
 */
export function OptionsEditor({
  options,
  labelFor,
  onLabelChange,
  onChange,
  disabled,
}: Props) {
  const { t } = useTranslation();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = options.findIndex((o) => o.id === active.id);
    const to = options.findIndex((o) => o.id === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(options, from, to));
  };

  const addOption = () => {
    const taken = new Set(options.map((o) => o.value));
    let value = `option_${options.length + 1}`;
    let n = options.length + 1;
    while (taken.has(value)) value = `option_${++n}`;
    onChange([...options, { id: newId("o"), value }]);
  };

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={options.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {options.map((option) => (
              <OptionRow
                key={option.id}
                option={option}
                label={labelFor(option.id)}
                disabled={disabled}
                onLabelChange={(label) => onLabelChange(option.id, label)}
                onValueChange={(value) =>
                  onChange(
                    options.map((o) =>
                      o.id === option.id ? { ...o, value } : o,
                    ),
                  )
                }
                onRemove={() =>
                  onChange(options.filter((o) => o.id !== option.id))
                }
                valueLabel={t("forms.inspector.optionValue")}
                labelLabel={t("forms.inspector.optionLabel")}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={addOption}
        className="w-full"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("forms.inspector.addOption")}
      </Button>
    </div>
  );
}

function OptionRow({
  option,
  label,
  disabled,
  onLabelChange,
  onValueChange,
  onRemove,
  valueLabel,
  labelLabel,
}: {
  option: FormFieldOption;
  label: string;
  disabled?: boolean;
  onLabelChange: (label: string) => void;
  onValueChange: (value: string) => void;
  onRemove: () => void;
  valueLabel: string;
  labelLabel: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="flex items-center gap-1.5 rounded-lg border bg-card p-1.5"
    >
      <button
        type="button"
        className="cursor-grab touch-none p-1 text-muted-foreground/60 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <Input
        value={label}
        disabled={disabled}
        placeholder={labelLabel}
        onChange={(e) => onLabelChange(e.target.value)}
        className="h-8 flex-1 text-sm"
      />
      <Input
        value={option.value}
        disabled={disabled}
        placeholder={valueLabel}
        onChange={(e) => onValueChange(snakeKey(e.target.value))}
        className="h-8 w-28 font-mono text-xs"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={disabled}
        onClick={onRemove}
        aria-label="Remove"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
