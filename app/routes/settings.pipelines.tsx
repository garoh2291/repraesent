import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import type {
  PipelineStage,
  StageCategory,
  StageEntity,
} from "~/lib/api/pipeline-stages";
import {
  useCreatePipelineStage,
  useDeletePipelineStage,
  usePatchPipelineStage,
  usePipelineStagesQuery,
  useReorderPipelineStages,
} from "~/lib/hooks/usePipelineStages";
import {
  STAGE_COLOR_TOKENS,
  TOKEN_FACETS,
  resolveStageColors,
} from "~/lib/pipeline-stages/colors";
import { resolveStageLabel } from "~/lib/pipeline-stages/labels";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Skeleton } from "~/components/ui/skeleton";
import TooltipContainer from "~/components/tooltip-container";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export function meta() {
  return [
    { title: `${i18n.t("settings.pipelines.metaTitle")} - Repraesent` },
    {
      name: "description",
      content: i18n.t("settings.pipelines.metaDescription"),
    },
  ];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

const CATEGORY_BADGE_CLASSES: Record<StageCategory, string> = {
  open: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  won: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  lost: "bg-red-500/10 text-red-700 dark:text-red-300",
  hidden: "bg-muted text-muted-foreground",
};

/** Seeded legacy keys get a subtle "Default" badge — purely cosmetic. */
const LEGACY_KEYS = new Set([
  "new_lead",
  "pending",
  "in_progress",
  "rejected",
  "on_hold",
  "stale",
  "success",
  "hidden",
  "new",
  "won",
  "lost",
]);

/** Client-side mirror of the server's hide/delete rules, for disabled states. */
function stageRules(stage: PipelineStage, siblings: PipelineStage[]) {
  const visibleSameCategory = siblings.filter(
    (s) => s.category === stage.category && !s.is_hidden && s.id !== stage.id,
  );
  const lastVisibleOfCategory = !stage.is_hidden && visibleSameCategory.length === 0;
  return {
    canHide:
      !stage.is_hidden &&
      !stage.is_entry &&
      stage.count === 0 &&
      !lastVisibleOfCategory,
    canUnhide: stage.is_hidden,
    canDelete:
      !stage.is_entry &&
      stage.count === 0 &&
      (stage.is_hidden || !lastVisibleOfCategory),
    canBecomeEntry:
      !stage.is_entry && stage.category === "open" && !stage.is_hidden,
  };
}

export default function PipelinesSettingsPage() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const isAdmin = currentWorkspace?.member_role === "admin";

  useDocumentMeta({
    titleKey: "settings.pipelines.metaTitle",
    descriptionKey: "settings.pipelines.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const stagesQuery = usePipelineStagesQuery();
  const stages = stagesQuery.data ?? [];

  return (
    <div className="space-y-10">
      {!isAdmin && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t("settings.pipelines.readOnlyHint", {
            defaultValue:
              "Only workspace admins can change pipeline stages. You can view the configuration below.",
          })}
        </p>
      )}
      <EntityStagesSection
        entity="lead"
        label={t("settings.pipelines.leadStages", {
          defaultValue: "Lead stages",
        })}
        description={t("settings.pipelines.leadStagesHint", {
          defaultValue:
            "The columns of the leads board, in order. Rename, recolor, reorder, hide empty stages or add new ones.",
        })}
        stages={stages.filter((s) => s.entity === "lead")}
        isLoading={stagesQuery.isLoading}
        isAdmin={isAdmin}
      />
      <EntityStagesSection
        entity="deal"
        label={t("settings.pipelines.dealStages", {
          defaultValue: "Deal stages",
        })}
        description={t("settings.pipelines.dealStagesHint", {
          defaultValue:
            "The columns of the deals pipeline, in order. Won/lost stages close deals and drive revenue stats.",
        })}
        stages={stages.filter((s) => s.entity === "deal")}
        isLoading={stagesQuery.isLoading}
        isAdmin={isAdmin}
      />
    </div>
  );
}

function EntityStagesSection({
  entity,
  label,
  description,
  stages,
  isLoading,
  isAdmin,
}: {
  entity: StageEntity;
  label: string;
  description: string;
  stages: PipelineStage[];
  isLoading: boolean;
  isAdmin: boolean;
}) {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const reorderMutation = useReorderPipelineStages();

  const ordered = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages],
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const applyOrder = (orderedIds: string[]) => {
    reorderMutation.mutate(
      { entity, orderedIds },
      {
        onError: (err) =>
          toast.error(
            extractErrorMessage(err) ||
              t("settings.pipelines.reorderFailed", {
                defaultValue: "Could not reorder stages.",
              }),
          ),
      },
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = ordered.map((s) => s.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    applyOrder(ids);
  };

  /** Keyboard/pointer alternative to dragging (WCAG 2.2 dragging movements). */
  const moveByOne = (stageId: string, direction: -1 | 1) => {
    const ids = ordered.map((s) => s.id);
    const from = ids.indexOf(stageId);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    applyOrder(ids);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <SectionLabel>{label}</SectionLabel>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {isAdmin && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs shrink-0"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("settings.pipelines.addStage", { defaultValue: "Add stage" })}
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {isLoading ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={ordered.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {ordered.map((stage, idx) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  siblings={ordered}
                  isAdmin={isAdmin}
                  isFirst={idx === 0}
                  isLast={idx === ordered.length - 1}
                  onMoveUp={() => moveByOne(stage.id, -1)}
                  onMoveDown={() => moveByOne(stage.id, 1)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <AddStageDialog
        entity={entity}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </div>
  );
}

function StageRow({
  stage,
  siblings,
  isAdmin,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  stage: PipelineStage;
  siblings: PipelineStage[];
  isAdmin: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { t } = useTranslation();
  const patchMutation = usePatchPipelineStage();
  const deleteMutation = useDeletePipelineStage();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const rules = stageRules(stage, siblings);
  const facets = resolveStageColors(stage);
  const resolvedLabel = resolveStageLabel(stage, t);

  // Inline rename: uncontrolled-ish input seeded from the resolved label,
  // saved on blur/Enter only when actually changed.
  const [draftLabel, setDraftLabel] = useState(resolvedLabel);
  useEffect(() => {
    setDraftLabel(resolvedLabel);
  }, [resolvedLabel]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id, disabled: !isAdmin });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const patch = (
    payload: Parameters<typeof patchMutation.mutate>[0]["payload"],
    successMsg?: string,
  ) => {
    patchMutation.mutate(
      { stageId: stage.id, payload },
      {
        onSuccess: () => {
          if (successMsg) toast.success(successMsg);
        },
        onError: (err) =>
          toast.error(
            extractErrorMessage(err) ||
              t("settings.pipelines.updateFailed", {
                defaultValue: "Could not update the stage.",
              }),
          ),
      },
    );
  };

  const commitRename = () => {
    const next = draftLabel.trim();
    if (next === resolvedLabel || next === "") {
      setDraftLabel(resolvedLabel);
      return;
    }
    patch({ label: next });
  };

  const hideTooltip = stage.is_entry
    ? t("settings.pipelines.hideEntryTooltip", {
        defaultValue: "The entry stage cannot be hidden.",
      })
    : stage.count > 0
      ? t("settings.pipelines.hideNonEmptyTooltip", {
          defaultValue: "Only empty stages can be hidden — move its records first.",
        })
      : !rules.canHide && !stage.is_hidden
        ? t("settings.pipelines.hideLastTooltip", {
            defaultValue: "At least one visible stage of this type must remain.",
          })
        : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 bg-card",
        stage.is_hidden && "opacity-60",
      )}
    >
      {isAdmin && (
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground shrink-0"
          aria-label={t("settings.pipelines.dragHandle", {
            defaultValue: "Drag to reorder",
          })}
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}

      {isAdmin && (
        <span className="flex flex-col shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="text-muted-foreground/60 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            aria-label={t("settings.pipelines.moveUp", {
              defaultValue: "Move up",
            })}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="text-muted-foreground/60 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            aria-label={t("settings.pipelines.moveDown", {
              defaultValue: "Move down",
            })}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </span>
      )}

      {/* Color swatch */}
      {isAdmin ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "h-5 w-5 rounded-full shrink-0 ring-1 ring-inset ring-black/10 transition-transform hover:scale-110",
                facets.dot,
              )}
              aria-label={t("settings.pipelines.pickColor", {
                defaultValue: "Pick a color",
              })}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-6 gap-1.5">
              {STAGE_COLOR_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => patch({ color: token })}
                  className={cn(
                    "h-6 w-6 rounded-full transition-transform hover:scale-110",
                    TOKEN_FACETS[token].dot,
                    stage.color === token &&
                      "ring-2 ring-offset-2 ring-foreground/40",
                  )}
                  aria-label={token}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <span
          className={cn("h-5 w-5 rounded-full shrink-0", facets.dot)}
          aria-hidden
        />
      )}

      {/* Inline rename */}
      <div className="flex-1 min-w-0">
        {isAdmin ? (
          <Input
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setDraftLabel(resolvedLabel);
            }}
            maxLength={60}
            disabled={patchMutation.isPending}
            className="h-8 border-transparent bg-transparent px-2 text-sm font-medium hover:border-border focus-visible:border-border"
          />
        ) : (
          <span className="px-2 text-sm font-medium">{resolvedLabel}</span>
        )}
      </div>

      {/* Badges */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        <Badge
          variant="secondary"
          className={cn(
            "text-[10px] font-medium border-transparent",
            CATEGORY_BADGE_CLASSES[stage.category],
          )}
        >
          {t(`settings.pipelines.category.${stage.category}`, {
            defaultValue: stage.category,
          })}
        </Badge>
        {stage.is_entry && (
          <Badge variant="outline" className="text-[10px] font-medium">
            {t("settings.pipelines.entryBadge", { defaultValue: "Entry" })}
          </Badge>
        )}
        {LEGACY_KEYS.has(stage.key) && (
          <Badge
            variant="outline"
            className="text-[10px] font-medium text-muted-foreground"
          >
            {t("settings.pipelines.defaultBadge", { defaultValue: "Default" })}
          </Badge>
        )}
      </div>

      {/* Record count */}
      <span className="inline-flex h-5 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground shrink-0 tabular-nums">
        {stage.count}
      </span>

      {/* Visibility switch */}
      {isAdmin && (
        <TooltipContainer
          tooltipContent={
            hideTooltip ??
            (stage.is_hidden
              ? t("settings.pipelines.unhideTooltip", {
                  defaultValue: "Show this stage on the board again.",
                })
              : t("settings.pipelines.hideTooltip", {
                  defaultValue: "Hide this stage from the board.",
                }))
          }
        >
          <span className="inline-flex">
            <Switch
              checked={!stage.is_hidden}
              disabled={
                patchMutation.isPending || (!stage.is_hidden && !rules.canHide)
              }
              onCheckedChange={(visible) => patch({ is_hidden: !visible })}
              aria-label={t("settings.pipelines.visibilitySwitch", {
                defaultValue: "Stage visible on the board",
              })}
            />
          </span>
        </TooltipContainer>
      )}

      {/* Row menu */}
      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              aria-label={t("settings.pipelines.rowMenu", {
                defaultValue: "Stage actions",
              })}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={!rules.canBecomeEntry || patchMutation.isPending}
              onClick={() =>
                patch(
                  { is_entry: true },
                  t("settings.pipelines.entrySet", {
                    defaultValue: "New records now start in this stage.",
                  }),
                )
              }
            >
              {t("settings.pipelines.setEntry", {
                defaultValue: "Make this the entry stage",
              })}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!rules.canDelete || deleteMutation.isPending}
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("common.delete", { defaultValue: "Delete" })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.pipelines.deleteTitle", {
                defaultValue: "Delete stage?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.pipelines.deleteWarning", {
                name: resolvedLabel,
                defaultValue: `"${resolvedLabel}" will be removed. Workflows whose conditions reference this stage will stop matching it.`,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteMutation.mutate(stage.id, {
                  onSuccess: () => setDeleteOpen(false),
                  onError: (err) =>
                    toast.error(
                      extractErrorMessage(err) ||
                        t("settings.pipelines.deleteFailed", {
                          defaultValue: "Could not delete the stage.",
                        }),
                    ),
                })
              }
            >
              {t("common.delete", { defaultValue: "Delete" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddStageDialog({
  entity,
  open,
  onOpenChange,
}: {
  entity: StageEntity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const createMutation = useCreatePipelineStage();
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<"open" | "won" | "lost">("open");
  const [color, setColor] = useState<string>("sky");

  useEffect(() => {
    if (!open) {
      setLabel("");
      setCategory("open");
      setColor("sky");
    }
  }, [open]);

  const submit = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    createMutation.mutate(
      { entity, label: trimmed, category, color },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success(
            t("settings.pipelines.stageCreated", {
              defaultValue: "Stage added.",
            }),
          );
        },
        onError: (err) =>
          toast.error(
            extractErrorMessage(err) ||
              t("settings.pipelines.createFailed", {
                defaultValue: "Could not add the stage.",
              }),
          ),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("settings.pipelines.addStage", { defaultValue: "Add stage" })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="stage-label">
              {t("settings.pipelines.nameLabel", { defaultValue: "Name" })}
            </Label>
            <Input
              id="stage-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              maxLength={60}
              autoFocus
              placeholder={t("settings.pipelines.namePlaceholder", {
                defaultValue: "e.g. Negotiation",
              })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              {t("settings.pipelines.categoryLabel", {
                defaultValue: "Type",
              })}
            </Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as typeof category)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">
                  {t("settings.pipelines.category.open", {
                    defaultValue: "open",
                  })}
                </SelectItem>
                <SelectItem value="won">
                  {t("settings.pipelines.category.won", {
                    defaultValue: "won",
                  })}
                </SelectItem>
                <SelectItem value="lost">
                  {t("settings.pipelines.category.lost", {
                    defaultValue: "lost",
                  })}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {t("settings.pipelines.categoryHint", {
                defaultValue:
                  "Won and lost stages close records and feed revenue stats. The type cannot be changed later.",
              })}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>
              {t("settings.pipelines.colorLabel", { defaultValue: "Color" })}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {STAGE_COLOR_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => setColor(token)}
                  className={cn(
                    "h-6 w-6 rounded-full transition-transform hover:scale-110",
                    TOKEN_FACETS[token].dot,
                    color === token &&
                      "ring-2 ring-offset-2 ring-foreground/40",
                  )}
                  aria-label={token}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!label.trim() || createMutation.isPending}
          >
            {t("settings.pipelines.addStage", { defaultValue: "Add stage" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
