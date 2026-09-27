import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { PaidChip } from "~/components/notebook/deal-paid";
import { useStageLabel } from "~/lib/pipeline-stages/use-stage-label";
import { toast } from "sonner";
import { StagePickerSheet } from "~/components/notebook/stage-picker-sheet";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";
import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  ExternalLink,
  Kanban,
  Mail,
  Phone,
  Trash2,
} from "lucide-react";
import { formatDate, formatCurrency, formatCurrencyTotals, sumByCurrency } from "~/lib/utils/format";
import { useWorkspaceCurrency } from "~/lib/hooks/useWorkspaceCurrency";
import { cn } from "~/lib/utils";
import { NextStepChip } from "~/components/notebook/next-step-chip";
import { isOpenDeal } from "~/lib/deals/is-open";
import { useDealFlow } from "~/components/notebook/deal-flow";
import { useTerminalStageGuard } from "~/lib/deals/use-terminal-stage-guard";
import type { DealListItem } from "~/lib/api/deals";
import type { PipelineStage } from "~/lib/api/pipeline-stages";
import type { Pipeline } from "~/lib/api/pipelines";
import { useDealStages } from "~/lib/hooks/usePipelineStages";
import { resolveStageColors } from "~/lib/pipeline-stages/colors";
import { dealComparator, type DealSortMode } from "~/lib/deals/deal-sort";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
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
import { kanbanCollisionDetection } from "~/lib/kanban/board-position";
import { UserAvatar } from "~/components/atom/user-avatar";

function cardTitle(d: DealListItem): string {
  const t = d.title?.trim();
  if (t) return t;
  const n = d.contact_full_name?.trim();
  if (n) return n;
  return "—";
}

function assigneeInitials(row: DealListItem): string {
  const first = row.assignee_first_name?.trim() ?? "";
  const last = row.assignee_last_name?.trim() ?? "";
  const a = first ? first[0] : "";
  const b = last ? last[0] : "";
  return (a + b).toUpperCase() || "?";
}

interface DealsPipelineKanbanProps {
  deals: DealListItem[];
  isLoading: boolean;
  onStageChange: (dealId: string, stage: string) => void;
  /** Column ordering — manual drag ordering is gone, columns always sort by this. */
  sortMode: DealSortMode;
  isUpdating?: boolean;
  canEdit?: boolean;
  /** Which pipeline's stage set forms the columns; omitted = Default. */
  pipelineId?: string;
  /** All workspace pipelines — powers the card context menu's move submenu. */
  pipelines?: Pipeline[];
  /** Right-click → Move to pipeline. Optimistic handling lives in the caller. */
  onMoveToPipeline?: (dealId: string, targetPipelineId: string) => void;
  /** Right-click → Delete, after the confirm dialog. Optimistic in the caller. */
  onDeleteDeal?: (dealId: string) => void;
  onDealSelect: (dealId: string) => void;
}

export function DealsPipelineKanban({
  deals,
  isLoading,
  onStageChange,
  sortMode,
  isUpdating,
  canEdit = true,
  pipelineId,
  pipelines,
  onMoveToPipeline,
  onDeleteDeal,
  onDealSelect,
}: DealsPipelineKanbanProps) {
  const { t } = useTranslation();
  const { visible: stages, byKey } = useDealStages(pipelineId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);
  // Local per-deal stage override applied between drop and the cache refresh
  // so cards don't snap back to their old column for a frame.
  const [pending, setPending] = useState<
    Record<string, { stage: string; stage_changed_at: string }>
  >({});
  const [justMovedId, setJustMovedId] = useState<string | null>(null);
  const landTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoRef = useRef<Array<{ dealId: string; prevStage: string }>>([]);
  // Phones: the deal being moved through the "Move to…" sheet.
  const [movingDeal, setMovingDeal] = useState<DealListItem | null>(null);
  const sheetMoveRef = useRef<{ dealId: string; prevStage: string } | null>(null);
  const stageLabel = useStageLabel();

  // Undo entries reference the columns of one board — a stale entry after a
  // pipeline switch would 400 (its stage key belongs to another pipeline).
  useEffect(() => {
    undoRef.current = [];
  }, [pipelineId]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const byStage = useMemo(() => {
    const acc: Record<string, DealListItem[]> = {};
    for (const s of stages) acc[s.key] = [];
    for (const d of deals) {
      const override = pending[d.id];
      // Stamp stage_changed_at locally too, so a just-dropped card sorts to
      // the top of its new column before the server data catches up.
      const eff = override
        ? {
            ...d,
            stage: override.stage,
            stage_changed_at: override.stage_changed_at,
          }
        : d;
      if (acc[eff.stage]) acc[eff.stage].push(eff);
    }
    const cmp = dealComparator(sortMode);
    for (const s of stages) acc[s.key].sort(cmp);
    return acc;
  }, [stages, deals, pending, sortMode]);

  // Clear pending overrides once the server-side data has caught up.
  useEffect(() => {
    if (Object.keys(pending).length === 0) return;
    setPending((curr) => {
      const next = { ...curr };
      let changed = false;
      for (const d of deals) {
        const ov = next[d.id];
        if (!ov) continue;
        if (d.stage === ov.stage) {
          delete next[d.id];
          changed = true;
        }
      }
      return changed ? next : curr;
    });
  }, [deals, pending]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    const width = event.active.rect.current.initial?.width;
    setActiveWidth(width ?? null);
  }, []);

  /** Resolve a drop target to its column's stage key. */
  const resolveDropStage = useCallback(
    (overId: string): string | null => {
      if (byKey.has(overId)) return overId;
      const dealId = overId.replace(/^deal-/, "");
      for (const s of stages) {
        if (byStage[s.key]?.some((d) => d.id === dealId)) return s.key;
      }
      return null;
    },
    [byKey, stages, byStage],
  );

  /** Shared by drag-drop and the card context menu: undo entry, local pending
   * override, land animation, then the caller's optimistic mutation.
   *
   * Only reached AFTER the terminal-stage guard has allowed the move, so the
   * card never paints into its new column and then snaps back if the user
   * cancels. */
  const applyStageMove = useCallback(
    (deal: DealListItem, targetStage: string) => {
      if (deal.stage === targetStage) return;

      undoRef.current.push({ dealId: deal.id, prevStage: deal.stage });
      if (undoRef.current.length > 50) undoRef.current.shift();

      setPending((prev) => ({
        ...prev,
        [deal.id]: {
          stage: targetStage,
          stage_changed_at: new Date().toISOString(),
        },
      }));
      setJustMovedId(deal.id);
      if (landTimerRef.current) clearTimeout(landTimerRef.current);
      landTimerRef.current = setTimeout(() => setJustMovedId(null), 500);

      onStageChange(deal.id, targetStage);

      // Moved from the phone's "Move to…" sheet: offer Undo (a drag has Cmd+Z).
      const fromSheet = sheetMoveRef.current;
      if (fromSheet && fromSheet.dealId === deal.id) {
        sheetMoveRef.current = null;
        const stageRow = byKey.get(targetStage);
        toast.success(
          t("mobile.stagePicker.moved", "Moved to {{stage}}", {
            stage: stageRow ? stageLabel(stageRow) : targetStage,
          }),
          {
            duration: 8000, // Undo needs time on a phone (5–8 s guidance).
            action: {
              label: t("common.undo", "Undo"),
              onClick: () => onStageChange(deal.id, fromSheet.prevStage),
            },
          },
        );
      }
    },
    [onStageChange, byKey, stageLabel, t],
  );

  // Leaving a won or lost stage clears the deal's outcome date, so it asks
  // first. Entering one, or moving won <-> lost, goes straight through.
  const { requestStageChange, guardModal } = useTerminalStageGuard({
    byKey,
    onProceed: (dealId, stage) => {
      const deal = deals.find((d) => d.id === dealId);
      if (deal) applyStageMove(deal, stage);
    },
  });

  const moveDealToStage = useCallback(
    (deal: DealListItem, targetStage: string) => requestStageChange(deal, targetStage),
    [requestStageChange],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      setActiveWidth(null);
      const { active, over } = event;
      if (!over) return;
      const dealId = String(active.id).replace(/^deal-/, "");
      const deal = deals.find((d) => d.id === dealId);
      if (!deal) return;
      const targetStage = resolveDropStage(String(over.id));
      if (!targetStage) return;

      // In-column ordering is fixed (date/amount sort) — only cross-column
      // drops mean anything now.
      moveDealToStage(deal, targetStage);
    },
    [resolveDropStage, deals, moveDealToStage],
  );

  // Right-click → Delete goes through one confirm dialog for the whole board.
  const [deleteTarget, setDeleteTarget] = useState<DealListItem | null>(null);

  const otherPipelines = useMemo(
    () => (pipelines ?? []).filter((p) => p.id !== pipelineId),
    [pipelines, pipelineId],
  );

  useEffect(
    () => () => {
      if (landTimerRef.current) clearTimeout(landTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        const last = undoRef.current.pop();
        if (last) {
          // The backend derives status/timestamps from the stage's category,
          // so restoring the stage is a full undo for terminal moves too.
          onStageChange(last.dealId, last.prevStage);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStageChange]);

  const activeDeal = activeId
    ? deals.find((d) => d.id === String(activeId).replace(/^deal-/, ""))
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <div className="h-5 w-5 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Schedule-style accordion list */}
      <div className="sm:hidden">
        <DealsMobileSchedule
          stages={stages}
          dealsByStage={byStage}
          onDealSelect={onDealSelect}
          onMove={canEdit ? setMovingDeal : undefined}
        />
        <StagePickerSheet
          open={!!movingDeal}
          onOpenChange={(o) => !o && setMovingDeal(null)}
          stages={stages.map((s) => ({
            key: s.key,
            label: stageLabel(s),
            color: resolveStageColors(s).hex,
            category: s.category,
          }))}
          current={movingDeal?.stage ?? null}
          onPick={(key) => {
            if (!movingDeal || movingDeal.stage === key) return;
            sheetMoveRef.current = { dealId: movingDeal.id, prevStage: movingDeal.stage };
            moveDealToStage(movingDeal, key);
          }}
          extra={
            onMoveToPipeline && otherPipelines.length > 0 && movingDeal ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {t("pipeline.contextMovePipeline", "Move to pipeline")}
                </p>
                <ul className="-mx-2 space-y-0.5">
                  {otherPipelines.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const id = movingDeal.id;
                          setMovingDeal(null);
                          onMoveToPipeline(id, p.id);
                        }}
                        className="press flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] text-foreground hover:bg-accent/60"
                      >
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          }
        />
      </div>

      {/* Desktop: Kanban board */}
      <div className="hidden sm:block flex-1 min-h-0">
        <DndContext
          sensors={sensors}
          collisionDetection={kanbanCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setActiveWidth(null);
          }}
        >
          <div
            className="flex gap-4 flex-1 min-h-0 pb-4 overflow-x-auto scrollbar-hide sm:grid"
            style={{
              gridTemplateColumns: `repeat(${Math.max(stages.length, 1)}, minmax(0, 1fr))`,
            }}
          >
            {stages.map((stage) => (
              <DealColumn
                key={stage.id}
                stage={stage}
                deals={byStage[stage.key] ?? []}
                onDealSelect={onDealSelect}
                isUpdating={isUpdating}
                canEdit={canEdit}
                justMovedId={justMovedId}
                allStages={stages}
                otherPipelines={otherPipelines}
                onMoveToStage={moveDealToStage}
                onMoveToPipeline={onMoveToPipeline}
                onRequestDelete={onDeleteDeal ? setDeleteTarget : undefined}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDeal ? (
              <div
                style={activeWidth ? { width: activeWidth } : undefined}
                className={cn(
                  "rounded-lg border bg-card p-3 space-y-2 shadow-lg ring-1 ring-primary/20 cursor-grabbing",
                )}
              >
                <DealCardInner deal={activeDeal} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {guardModal}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("pipeline.deleteDealConfirmTitle", {
                defaultValue: "Delete this deal?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("pipeline.deleteDealConfirmDescription", {
                defaultValue:
                  '"{{title}}" will be permanently removed from your pipeline.',
                title: deleteTarget ? cardTitle(deleteTarget) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) onDeleteDeal?.(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              {t("common.delete", { defaultValue: "Delete" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DealColumn({
  stage,
  deals: columnDeals,
  onDealSelect,
  isUpdating,
  canEdit,
  justMovedId,
  allStages,
  otherPipelines,
  onMoveToStage,
  onMoveToPipeline,
  onRequestDelete,
}: {
  stage: PipelineStage;
  deals: DealListItem[];
  onDealSelect: (id: string) => void;
  isUpdating?: boolean;
  canEdit?: boolean;
  justMovedId?: string | null;
  allStages: PipelineStage[];
  otherPipelines: Pipeline[];
  onMoveToStage: (deal: DealListItem, targetStage: string) => void;
  onMoveToPipeline?: (dealId: string, targetPipelineId: string) => void;
  onRequestDelete?: (deal: DealListItem) => void;
}) {
  const { t } = useTranslation();
  const stageLabel = useStageLabel();
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  const colorClass = resolveStageColors(stage).dot;
  const isEmpty = columnDeals.length === 0;
  const itemIds = useMemo(
    () => columnDeals.map((d) => `deal-${d.id}`),
    [columnDeals],
  );
  const { currency: workspaceCurrency } = useWorkspaceCurrency();
  const columnTotals = useMemo(
    () => stageDealTotals(columnDeals),
    [columnDeals],
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-muted/50 transition-all duration-150 min-h-[200px] min-w-[240px] sm:min-w-0 shrink-0 sm:shrink",
        isOver && "ring-2 ring-primary/40 bg-primary/5",
      )}
    >
      <div className={cn("h-1 rounded-t-xl shrink-0", colorClass)} />
      <div className="shrink-0 px-3 pt-3 pb-2">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className={cn("inline-block h-2 w-2 rounded-full", colorClass)} />
          <span>{stageLabel(stage)}</span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-xs font-medium text-muted-foreground">
            {columnDeals.length}
          </span>
        </h3>
        {columnTotals.size > 0 ? (
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {formatCurrencyTotals(columnTotals, workspaceCurrency)}
          </p>
        ) : null}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {isEmpty ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/50">
            —
          </div>
        ) : (
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {columnDeals.map((d) => (
              <DealKanbanCard
                key={d.id}
                deal={d}
                onSelect={() => onDealSelect(d.id)}
                disabled={isUpdating}
                canEdit={canEdit}
                justLanded={justMovedId === d.id}
                allStages={allStages}
                otherPipelines={otherPipelines}
                onMoveToStage={onMoveToStage}
                onMoveToPipeline={onMoveToPipeline}
                onRequestDelete={onRequestDelete}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}

function DealCardInner({
  deal,
  canEdit = false,
}: {
  deal: DealListItem;
  canEdit?: boolean;
}) {
  const dealFlow = useDealFlow();
  const title = cardTitle(deal);
  const sub = deal.contact_full_name?.trim();
  const showSub = !!(sub && deal.title?.trim());
  const val =
    deal.value != null && deal.value !== ""
      ? formatCurrency(Number(deal.value), deal.currency)
      : null;
  const hasAssignee = !!(
    deal.assignee_first_name || deal.assignee_last_name
  );

  return (
    <>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium leading-snug truncate">{title}</p>
          {showSub ? (
            <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
          ) : null}
        </div>
        {hasAssignee ? (
          <UserAvatar
            userId={deal.assigned_to}
            firstName={deal.assignee_first_name}
            lastName={deal.assignee_last_name}
            size="sm"
          />
        ) : null}
      </div>
      {val || (deal.status === "won" && deal.paid_at) ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {val}
          {deal.status === "won" && deal.paid_at ? <PaidChip /> : null}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
        {deal.primary_email ? (
          <span className="inline-flex items-center gap-0.5 truncate max-w-full">
            <Mail className="h-3 w-3 shrink-0 opacity-70" />
            <span className="truncate">{deal.primary_email}</span>
          </span>
        ) : null}
        {deal.primary_phone ? (
          <span className="inline-flex items-center gap-0.5 truncate">
            <Phone className="h-3 w-3 shrink-0 opacity-70" />
            <span className="truncate">{deal.primary_phone}</span>
          </span>
        ) : null}
      </div>
      {isOpenDeal(deal) && deal.tasks_summary ? (
        <NextStepChip
          summary={deal.tasks_summary}
          onAdd={
            canEdit
              ? () => dealFlow.whatsNext({ id: deal.id, title: title })
              : undefined
          }
        />
      ) : (
        <p className="text-[10px] text-muted-foreground/80">
          {deal.created_at
            ? formatDate(new Date(deal.created_at), "MMM d, yyyy")
            : ""}
        </p>
      )}
    </>
  );
}


/** Per-currency totals of a column — CAD and EUR are never added together. */
function stageDealTotals(deals: DealListItem[]): Map<string, number> {
  return sumByCurrency(deals, (d) => ({ value: d.value, currency: d.currency }));
}

/* ─── Mobile Schedule List (Google Calendar-style) ─── */

function DealsMobileSchedule({
  stages,
  dealsByStage,
  onDealSelect,
  onMove,
}: {
  stages: PipelineStage[];
  dealsByStage: Record<string, DealListItem[]>;
  onDealSelect: (id: string) => void;
  onMove?: (deal: DealListItem) => void;
}) {
  const { t } = useTranslation();
  const stageLabel = useStageLabel();
  const { currency: workspaceCurrency } = useWorkspaceCurrency();

  return (
    <div className="space-y-2 pt-2 pb-6">
      {stages.map((stage) => {
        const deals = dealsByStage[stage.key] ?? [];
        const colorClass = resolveStageColors(stage).dot;
        const count = deals.length;
        const columnTotals = stageDealTotals(deals);

        return (
          <ScheduleSection
            key={stage.id}
            defaultOpen={count > 0}
            header={
              <>
                <div className={cn("h-8 w-1 rounded-full shrink-0", colorClass)} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground">
                    {stageLabel(stage)}
                  </span>
                  {columnTotals.size > 0 ? (
                    <p className="text-xs font-medium text-muted-foreground mt-0.5">
                      {formatCurrencyTotals(columnTotals, workspaceCurrency)}
                    </p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                    count > 0
                      ? `${colorClass} text-white`
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </>
            }
          >
            {count === 0 ? (
              <div className="px-4 pb-4 pt-1">
                <p className="text-xs text-muted-foreground/50 text-center py-3">
                  —
                </p>
              </div>
            ) : (
              <div className="px-3 pb-3 space-y-2">
                {deals.map((deal) => (
                  <DealScheduleRow
                    key={deal.id}
                    deal={deal}
                    colorClass={colorClass}
                    onSelect={() => onDealSelect(deal.id)}
                    onMove={onMove ? () => onMove(deal) : undefined}
                  />
                ))}
              </div>
            )}
          </ScheduleSection>
        );
      })}
    </div>
  );
}

function DealScheduleRow({
  deal,
  colorClass,
  onSelect,
  onMove,
}: {
  deal: DealListItem;
  colorClass: string;
  onSelect: () => void;
  onMove?: () => void;
}) {
  const { t } = useTranslation();
  const title = cardTitle(deal);
  const sub = deal.contact_full_name?.trim();
  const showSub = !!(sub && deal.title?.trim());
  const val =
    deal.value != null && deal.value !== ""
      ? formatCurrency(Number(deal.value), deal.currency)
      : null;
  const hasAssignee = !!(
    deal.assignee_first_name || deal.assignee_last_name
  );

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs transition-colors hover:bg-muted/40">
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "press flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        "active:bg-muted",
      )}
    >
      <div className={cn("mt-1 h-4 w-0.5 rounded-full shrink-0", colorClass)} />

      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium leading-snug truncate">{title}</p>
        {showSub ? (
          <p className="text-xs text-muted-foreground truncate">{sub}</p>
        ) : null}
        {val || (deal.status === "won" && deal.paid_at) ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            {val}
            {deal.status === "won" && deal.paid_at ? <PaidChip /> : null}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-2 pt-0.5 text-[10px] text-muted-foreground">
          {deal.primary_email ? (
            <span className="inline-flex items-center gap-0.5 truncate max-w-full">
              <Mail className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate">{deal.primary_email}</span>
            </span>
          ) : null}
          {deal.primary_phone ? (
            <span className="inline-flex items-center gap-0.5 truncate">
              <Phone className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate">{deal.primary_phone}</span>
            </span>
          ) : null}
          {deal.created_at ? (
            <span className="text-muted-foreground/70">
              {formatDate(new Date(deal.created_at), "MMM d")}
            </span>
          ) : null}
        </div>
        {isOpenDeal(deal) && deal.tasks_summary ? (
          <div className="pt-1">
            <NextStepChip summary={deal.tasks_summary} />
          </div>
        ) : null}
      </div>

      {hasAssignee ? (
        <UserAvatar
          userId={deal.assigned_to}
          firstName={deal.assignee_first_name}
          lastName={deal.assignee_last_name}
          size="sm"
          className="mt-0.5"
        />
      ) : null}
    </button>
    {onMove ? (
      <div className="flex justify-end px-3 pb-2.5">
        <button
          type="button"
          onClick={onMove}
          className="press inline-flex h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground"
        >
          <ArrowRightLeft className="size-3.5" aria-hidden />
          {t("mobile.stagePicker.moveTo", "Move to…")}
        </button>
      </div>
    ) : null}
    </div>
  );
}

/* ─── Lightweight disclosure (no Radix, no mount/unmount) ─── */

function ScheduleSection({
  defaultOpen,
  header,
  children,
}: {
  defaultOpen: boolean;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        "shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {header}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function DealKanbanCard({
  deal,
  onSelect,
  disabled,
  canEdit,
  justLanded,
  allStages,
  otherPipelines,
  onMoveToStage,
  onMoveToPipeline,
  onRequestDelete,
}: {
  deal: DealListItem;
  onSelect: () => void;
  disabled?: boolean;
  canEdit?: boolean;
  justLanded?: boolean;
  allStages: PipelineStage[];
  otherPipelines: Pipeline[];
  onMoveToStage: (deal: DealListItem, targetStage: string) => void;
  onMoveToPipeline?: (dealId: string, targetPipelineId: string) => void;
  onRequestDelete?: (deal: DealListItem) => void;
}) {
  const { t } = useTranslation();
  const stageLabel = useStageLabel();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `deal-${deal.id}`,
    disabled: !canEdit || disabled,
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const card = (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border bg-card p-3 text-left space-y-2 transition-shadow",
        justLanded && "app-card-land",
        canEdit && !disabled && "cursor-grab active:cursor-grabbing",
      )}
    >
      <DealCardInner deal={deal} canEdit={!!canEdit && !disabled} />
    </button>
  );

  // Viewers get the plain card — every menu action is a write.
  if (!canEdit) return card;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={onSelect}>
          <ExternalLink />
          {t("pipeline.contextOpen", { defaultValue: "Open deal" })}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Kanban />
            {t("pipeline.contextChangeStage", { defaultValue: "Change stage" })}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {allStages.map((s) => {
              const current = s.key === deal.stage;
              return (
                <ContextMenuItem
                  key={s.id}
                  disabled={current}
                  onSelect={() => onMoveToStage(deal, s.key)}
                >
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      resolveStageColors(s).dot,
                    )}
                  />
                  <span className="truncate">{stageLabel(s)}</span>
                  {current ? <Check className="ml-auto" /> : null}
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>
        {otherPipelines.length > 0 && onMoveToPipeline ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <ArrowRightLeft />
              {t("pipeline.contextMovePipeline", {
                defaultValue: "Move to pipeline",
              })}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              {otherPipelines.map((p) => (
                <ContextMenuItem
                  key={p.id}
                  onSelect={() => onMoveToPipeline(deal.id, p.id)}
                >
                  <span className="truncate">{p.name}</span>
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : null}
        {onRequestDelete ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onSelect={() => onRequestDelete(deal)}
            >
              <Trash2 />
              {t("common.delete", { defaultValue: "Delete" })}
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
