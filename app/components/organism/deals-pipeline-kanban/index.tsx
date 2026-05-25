import { useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { Mail, Phone } from "lucide-react";
import { formatDate, formatCurrency } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import type { DealListItem } from "~/lib/api/deals";
import { DEAL_STAGE_KEYS, type DealStageKey } from "~/lib/api/deals";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";

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

interface DealsPipelineKanbanProps {
  deals: DealListItem[];
  isLoading: boolean;
  onStageChange: (dealId: string, stage: DealStageKey) => void;
  onTerminal: (dealId: string, status: "won" | "lost") => void;
  isUpdating?: boolean;
  canEdit?: boolean;
  onDealSelect: (dealId: string) => void;
}

export function DealsPipelineKanban({
  deals,
  isLoading,
  onStageChange,
  onTerminal,
  isUpdating,
  canEdit = true,
  onDealSelect,
}: DealsPipelineKanbanProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  // Records a just-dropped card's new stage so it leaves its old column in the
  // same render as the drag ending — without this there is a one-frame flicker
  // before the parent's optimistic cache update arrives. Cleared once `deals`
  // reflects the move (or rolls back on error).
  const [pendingStage, setPendingStage] = useState<
    Record<string, DealStageKey>
  >({});
  // Id of the card to play the "landed" animation on, briefly after a drop.
  const [justMovedId, setJustMovedId] = useState<string | null>(null);
  const landTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoRef = useRef<Array<{ dealId: string; prevStage: string }>>([]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;
      const dealId = String(active.id).replace(/^deal-/, "");
      const target = String(over.id) as DealStageKey;
      if (!(DEAL_STAGE_KEYS as readonly string[]).includes(target)) return;
      const deal = deals.find((d) => d.id === dealId);
      if (!deal) return;
      if (deal.stage === target) return;
      undoRef.current.push({ dealId, prevStage: deal.stage });
      if (undoRef.current.length > 50) undoRef.current.shift();
      setPendingStage((prev) => ({ ...prev, [dealId]: target }));
      setJustMovedId(dealId);
      if (landTimerRef.current) clearTimeout(landTimerRef.current);
      landTimerRef.current = setTimeout(() => setJustMovedId(null), 500);
      if (target === "won" || target === "lost") {
        onTerminal(dealId, target);
      } else {
        onStageChange(dealId, target);
      }
    },
    [deals, onStageChange, onTerminal],
  );

  useEffect(
    () => () => {
      if (landTimerRef.current) clearTimeout(landTimerRef.current);
    },
    [],
  );

  // Once the deals data updates (optimistic patch lands, or rolls back on
  // error), drop the local overrides so the board follows the source of truth.
  useEffect(() => {
    setPendingStage((prev) => (Object.keys(prev).length ? {} : prev));
  }, [deals]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        const last = undoRef.current.pop();
        if (last) onStageChange(last.dealId, last.prevStage as DealStageKey);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStageChange]);

  const byStage = DEAL_STAGE_KEYS.reduce(
    (acc, st) => {
      acc[st] = deals
        .filter((d) => (pendingStage[d.id] ?? d.stage) === st)
        .sort((a, b) => {
          const av = a.updated_at || a.created_at || "";
          const bv = b.updated_at || b.created_at || "";
          return av.localeCompare(bv);
        });
      return acc;
    },
    {} as Record<DealStageKey, DealListItem[]>,
  );

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
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn(
          "flex flex-1 min-h-0 h-full gap-4 overflow-x-auto overflow-y-hidden rounded-lg py-4 pl-0 pr-4 pt-5 scrollbar-hide sm:grid sm:grid-cols-4 sm:overflow-x-hidden",
        )}
      >
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
            className={cn(
              "w-[min(100%,280px)] rounded-lg border bg-card p-3 space-y-2 shadow-lg ring-1 ring-primary/20 cursor-grabbing",
            )}
          >
            <DealCardInner deal={activeDeal} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
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
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {isEmpty ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/50">
            —
          </div>
        ) : (
          columnDeals.map((d) => (
            <DealKanbanCard
              key={d.id}
              deal={d}
              onSelect={() => onDealSelect(d.id)}
              disabled={isUpdating}
              canEdit={canEdit}
              justLanded={justMovedId === d.id}
            />
          ))
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
      ? formatCurrency(Number(deal.value), "EUR")
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
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `deal-${deal.id}`,
      disabled: !canEdit || disabled,
    });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

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
        isDragging && "invisible",
        justLanded && "app-card-land",
        canEdit && !disabled && "cursor-grab active:cursor-grabbing",
      )}
    >
      <DealCardInner deal={deal} />
    </button>
  );
}
