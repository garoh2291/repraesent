/**
 * The step rail of a multi-step form, inside the canvas panel.
 *
 * A sibling of the language strip on purpose: same pill, same ⋯ menu, same
 * dashed "add" button — so it teaches itself. Pills switch what the canvas
 * shows; the ⋯ holds what you do to a step. Each pill is a sortable (steps
 * reorder by drag) and a drop target (a field row dropped on it moves there).
 * The dnd wiring belongs to FormCanvas, which owns the single DndContext.
 */

import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { FormSection } from "~/lib/forms/schema";
import { cn } from "~/lib/utils";

/** Sortable / droppable id of a step pill. Fields use their bare id. */
export const STEP_DND_PREFIX = "step:";
export const stepDndId = (sectionId: string) =>
  `${STEP_DND_PREFIX}${sectionId}`;
export const isStepDndId = (id: unknown): id is string =>
  typeof id === "string" && id.startsWith(STEP_DND_PREFIX);
export const sectionIdOf = (dndId: string) =>
  dndId.slice(STEP_DND_PREFIX.length);

interface Props {
  sections: FormSection[];
  activeStep: number;
  /** Title per section id, already resolved in the editing locale. */
  titles: Record<string, string>;
  /** Blocking issues per section id, in the editing locale. */
  issuesBySection: ReadonlyMap<string, number>;
  /** True while a FIELD is being dragged — pills become drop targets. */
  fieldDragging: boolean;
  disabled?: boolean;
  onSelectStep: (index: number) => void;
  onRenameStep: (sectionId: string) => void;
  onAddStep: () => void;
  onDuplicateStep: (sectionId: string) => void;
  onMoveStep: (sectionId: string, direction: -1 | 1) => void;
  onDeleteStep: (sectionId: string) => void;
}

export function StepStrip({
  sections,
  activeStep,
  titles,
  issuesBySection,
  fieldDragging,
  disabled,
  onSelectStep,
  onRenameStep,
  onAddStep,
  onDuplicateStep,
  onMoveStep,
  onDeleteStep,
}: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center gap-1 overflow-x-auto border-b border-border px-4 py-2 sm:px-5"
      role="group"
      aria-label={t("forms.steps.title")}
    >
      <SortableContext
        items={sections.map((s) => stepDndId(s.id))}
        strategy={horizontalListSortingStrategy}
      >
        {sections.map((section, index) => (
          <StepPill
            key={section.id}
            section={section}
            index={index}
            total={sections.length}
            title={titles[section.id] ?? ""}
            active={index === activeStep}
            issues={issuesBySection.get(section.id) ?? 0}
            dropTarget={fieldDragging}
            disabled={disabled}
            onSelect={() => onSelectStep(index)}
            onRename={() => onRenameStep(section.id)}
            onDuplicate={() => onDuplicateStep(section.id)}
            onMove={(dir) => onMoveStep(section.id, dir)}
            onDelete={() => onDeleteStep(section.id)}
          />
        ))}
      </SortableContext>

      {!disabled ? (
        <button
          type="button"
          onClick={onAddStep}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("forms.steps.add")}
        </button>
      ) : null}
    </div>
  );
}

function StepPill({
  section,
  index,
  total,
  title,
  active,
  issues,
  dropTarget,
  disabled,
  onSelect,
  onRename,
  onDuplicate,
  onMove,
  onDelete,
}: {
  section: FormSection;
  index: number;
  total: number;
  title: string;
  active: boolean;
  issues: number;
  dropTarget: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: stepDndId(section.id), disabled });

  const fallbackTitle = t("forms.steps.stepN", { n: index + 1 });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={cn(
        "group/step inline-flex h-8 shrink-0 items-center overflow-hidden rounded-lg border transition-colors",
        active
          ? "border-primary/40 bg-primary/10"
          : "bg-muted/40 hover:border-border/80 hover:bg-muted",
        // While a field is in the air every pill is a landing zone; the one
        // under the pointer says so.
        dropTarget && "border-dashed",
        dropTarget &&
          isOver &&
          "border-primary bg-primary/15 ring-2 ring-primary/30",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        // The pill itself is the drag handle for reordering steps. A separate
        // grip would double the width of every pill for a rare action.
        {...attributes}
        {...listeners}
        aria-pressed={active}
        className={cn(
          "inline-flex h-full max-w-[220px] cursor-grab items-center gap-1.5 pl-2 pr-1.5 text-sm transition-colors active:cursor-grabbing",
          active
            ? "font-medium text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums",
            active ? "text-primary/70" : "text-muted-foreground/70",
          )}
        >
          {index + 1}
        </span>
        <span className={cn("truncate", !title && "italic opacity-70")}>
          {title || fallbackTitle}
        </span>
        {issues > 0 ? (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive"
            aria-label={t("forms.strip.hasIssues", { count: issues })}
          />
        ) : (
          <span className="h-1.5 w-1.5 shrink-0" aria-hidden="true" />
        )}
      </button>

      {!disabled ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("forms.steps.menu", { n: index + 1 })}
              className={cn(
                "flex h-full items-center border-l px-1.5 transition-colors",
                active
                  ? "border-primary/25 text-primary/70 hover:bg-primary/10 hover:text-primary"
                  : "border-border text-muted-foreground/70 hover:bg-muted hover:text-foreground",
              )}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
              <span className="font-mono tabular-nums">{index + 1}</span>
              <span className="truncate">{title || fallbackTitle}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRename}>
              <Pencil className="h-4 w-4" />
              {t("forms.steps.rename")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy className="h-4 w-4" />
              {t("forms.steps.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === 0}
              onSelect={() => onMove(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
              {t("forms.steps.moveLeft")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === total - 1}
              onSelect={() => onMove(1)}
            >
              <ChevronRight className="h-4 w-4" />
              {t("forms.steps.moveRight")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={total <= 1}
              onSelect={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              {total <= 1
                ? t("forms.steps.deleteLast")
                : t("forms.steps.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
