import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
import { ChevronDown, Mail, Phone } from "lucide-react";
import { formatDate, formatCurrency } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import type { DealListItem } from "~/lib/api/deals";
import { DEAL_STAGE_KEYS, type DealStageKey } from "~/lib/api/deals";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  kanbanCollisionDetection,
  positionForInsertion,
} from "~/lib/kanban/board-position";

const STAGE_COLORS: Record<DealStageKey, string> = {
  new: "bg-slate-400",
  in_progress: "bg-sky-500",
  won: "bg-emerald-600",
  lost: "bg-red-500",
};

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

interface ReorderArgs {
  dealId: string;
  stage: DealStageKey;
  position: number;
}

interface DealsPipelineKanbanProps {
  deals: DealListItem[];
  isLoading: boolean;
  onStageChange: (dealId: string, stage: DealStageKey) => void;
  onTerminal: (dealId: string, status: "won" | "lost") => void;
  onReorder: (args: ReorderArgs) => void;
  isUpdating?: boolean;
  canEdit?: boolean;
  onDealSelect: (dealId: string) => void;
}

export function DealsPipelineKanban({
  deals,
  isLoading,
  onStageChange,
  onTerminal,
  onReorder,
  isUpdating,
  canEdit = true,
  onDealSelect,
}: DealsPipelineKanbanProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);
  // Local per-deal override applied between drop and the cache refresh so
  // cards don't snap back to their old position for a frame.
  const [pending, setPending] = useState<
    Record<string, { stage: DealStageKey; board_position: number }>
  >({});
  const [justMovedId, setJustMovedId] = useState<string | null>(null);
  const landTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoRef = useRef<Array<{ dealId: string; prevStage: string }>>([]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const byStage = useMemo(() => {
    const acc = {} as Record<DealStageKey, DealListItem[]>;
    for (const s of DEAL_STAGE_KEYS) acc[s] = [];
    for (const d of deals) {
      const override = pending[d.id];
      const eff = override
        ? {
            ...d,
            stage: override.stage,
            board_position: override.board_position,
          }
        : d;
      const st = eff.stage as DealStageKey;
      if (acc[st]) acc[st].push(eff);
    }
    for (const s of DEAL_STAGE_KEYS) {
      acc[s].sort((a, b) => {
        const ap = a.board_position;
        const bp = b.board_position;
        if (ap == null && bp == null) {
          return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
        }
        if (ap == null) return 1;
        if (bp == null) return -1;
        return ap - bp;
      });
    }
    return acc;
  }, [deals, pending]);

  // Clear pending overrides once the server-side data has caught up.
  useEffect(() => {
    if (Object.keys(pending).length === 0) return;
    setPending((curr) => {
      const next = { ...curr };
      let changed = false;
      for (const d of deals) {
        const ov = next[d.id];
        if (!ov) continue;
        if (
          d.stage === ov.stage &&
          d.board_position === ov.board_position
        ) {
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

  const resolveDrop = useCallback(
    (overId: string): { stage: DealStageKey; insertionIndex: number } | null => {
      if ((DEAL_STAGE_KEYS as readonly string[]).includes(overId)) {
        const stage = overId as DealStageKey;
        return { stage, insertionIndex: byStage[stage]?.length ?? 0 };
      }
      const dealId = overId.replace(/^deal-/, "");
      for (const stage of DEAL_STAGE_KEYS) {
        const idx = byStage[stage].findIndex((d) => d.id === dealId);
        if (idx !== -1) return { stage, insertionIndex: idx };
      }
      return null;
    },
    [byStage],
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
      const drop = resolveDrop(String(over.id));
      if (!drop) return;

      const currentIdx = byStage[deal.stage as DealStageKey]?.findIndex(
        (d) => d.id === dealId,
      ) ?? -1;
      // Real no-op only when dropped on itself; ±1 is a genuine reorder.
      if (
        deal.stage === drop.stage &&
        currentIdx === drop.insertionIndex
      ) {
        return;
      }

      const position = positionForInsertion(
        byStage[drop.stage],
        drop.insertionIndex,
        dealId,
      );

      if (deal.stage !== drop.stage) {
        undoRef.current.push({ dealId, prevStage: deal.stage });
        if (undoRef.current.length > 50) undoRef.current.shift();
      }

      setPending((prev) => ({
        ...prev,
        [dealId]: { stage: drop.stage, board_position: position },
      }));
      setJustMovedId(dealId);
      if (landTimerRef.current) clearTimeout(landTimerRef.current);
      landTimerRef.current = setTimeout(() => setJustMovedId(null), 500);

      onReorder({ dealId, stage: drop.stage, position });
    },
    [resolveDrop, byStage, deals, onReorder],
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
          if (last.prevStage === "won" || last.prevStage === "lost") {
            onTerminal(last.dealId, last.prevStage);
          } else {
            onStageChange(last.dealId, last.prevStage as DealStageKey);
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStageChange, onTerminal]);

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
          dealsByStage={byStage}
          onDealSelect={onDealSelect}
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
          <div className="flex gap-4 flex-1 min-h-0 pb-4 overflow-x-auto scrollbar-hide sm:grid sm:grid-cols-4">
            {DEAL_STAGE_KEYS.map((stage) => (
              <DealColumn
                key={stage}
                stage={stage}
                deals={byStage[stage]}
                onDealSelect={onDealSelect}
                isUpdating={isUpdating}
                canEdit={canEdit}
                colorClass={STAGE_COLORS[stage]}
                justMovedId={justMovedId}
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
    </>
  );
}

function DealColumn({
  stage,
  deals: columnDeals,
  onDealSelect,
  isUpdating,
  canEdit,
  colorClass,
  justMovedId,
}: {
  stage: DealStageKey;
  deals: DealListItem[];
  onDealSelect: (id: string) => void;
  isUpdating?: boolean;
  canEdit?: boolean;
  colorClass: string;
  justMovedId?: string | null;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const isEmpty = columnDeals.length === 0;
  const itemIds = useMemo(
    () => columnDeals.map((d) => `deal-${d.id}`),
    [columnDeals],
  );
  const columnTotal = useMemo(
    () => stageDealTotal(columnDeals),
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
          <span>
            {t(`pipeline.stages.${stage}`, {
              defaultValue: stage,
            })}
          </span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-xs font-medium text-muted-foreground">
            {columnDeals.length}
          </span>
        </h3>
        {columnTotal > 0 ? (
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {formatCurrency(columnTotal)}
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
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}

function DealCardInner({ deal }: { deal: DealListItem }) {
  const title = cardTitle(deal);
  const sub = deal.contact_full_name?.trim();
  const showSub = !!(sub && deal.title?.trim());
  const val =
    deal.value != null && deal.value !== ""
      ? formatCurrency(Number(deal.value))
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
          <Avatar className="size-6 shrink-0">
            <AvatarFallback className="bg-muted text-[9px] font-semibold text-foreground">
              {assigneeInitials(deal)}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>
      {val ? (
        <p className="text-sm font-semibold text-foreground">{val}</p>
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
      <p className="text-[10px] text-muted-foreground/80">
        {deal.created_at
          ? formatDate(new Date(deal.created_at), "MMM d, yyyy")
          : ""}
      </p>
    </>
  );
}

function stageDealTotal(deals: DealListItem[]): number {
  let total = 0;
  for (const d of deals) {
    if (d.value == null || d.value === "") continue;
    const n = Number(d.value);
    if (!Number.isFinite(n)) continue;
    total += n;
  }
  return total;
}

/* ─── Mobile Schedule List (Google Calendar-style) ─── */

function DealsMobileSchedule({
  dealsByStage,
  onDealSelect,
}: {
  dealsByStage: Record<DealStageKey, DealListItem[]>;
  onDealSelect: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2 pt-2 pb-6">
      {DEAL_STAGE_KEYS.map((stage) => {
        const deals = dealsByStage[stage];
        const colorClass = STAGE_COLORS[stage];
        const count = deals.length;
        const columnTotal = stageDealTotal(deals);

        return (
          <ScheduleSection
            key={stage}
            defaultOpen={count > 0}
            header={
              <>
                <div className={cn("h-8 w-1 rounded-full shrink-0", colorClass)} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground">
                    {t(`pipeline.stages.${stage}`, { defaultValue: stage })}
                  </span>
                  {columnTotal > 0 ? (
                    <p className="text-xs font-medium text-muted-foreground mt-0.5">
                      {formatCurrency(columnTotal)}
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
              <div className="px-3 pb-3 space-y-1">
                {deals.map((deal) => (
                  <DealScheduleRow
                    key={deal.id}
                    deal={deal}
                    colorClass={colorClass}
                    onSelect={() => onDealSelect(deal.id)}
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
}: {
  deal: DealListItem;
  colorClass: string;
  onSelect: () => void;
}) {
  const title = cardTitle(deal);
  const sub = deal.contact_full_name?.trim();
  const showSub = !!(sub && deal.title?.trim());
  const val =
    deal.value != null && deal.value !== ""
      ? formatCurrency(Number(deal.value))
      : null;
  const hasAssignee = !!(
    deal.assignee_first_name || deal.assignee_last_name
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        "hover:bg-muted/60 active:bg-muted",
      )}
    >
      <div className={cn("mt-1 h-4 w-0.5 rounded-full shrink-0", colorClass)} />

      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium leading-snug truncate">{title}</p>
        {showSub ? (
          <p className="text-xs text-muted-foreground truncate">{sub}</p>
        ) : null}
        {val ? (
          <p className="text-xs font-semibold text-foreground">{val}</p>
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
      </div>

      {hasAssignee ? (
        <Avatar className="size-6 shrink-0 mt-0.5">
          <AvatarFallback className="bg-muted text-[9px] font-semibold text-foreground">
            {assigneeInitials(deal)}
          </AvatarFallback>
        </Avatar>
      ) : null}
    </button>
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
}: {
  deal: DealListItem;
  onSelect: () => void;
  disabled?: boolean;
  canEdit?: boolean;
  justLanded?: boolean;
}) {
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

  return (
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
      <DealCardInner deal={deal} />
    </button>
  );
}
