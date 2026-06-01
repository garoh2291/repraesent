import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";
import { ChevronDown, Loader2 } from "lucide-react";
// Loader2 is still used for the per-column "load more" inline spinner; the
// initial-load state mirrors the pipeline kanban via the `app-spin` class.
import { formatDate } from "~/lib/utils/format";
import {
  getLeads,
  getLeadsKanbanCounts,
  type Lead,
} from "~/lib/api/leads";
import { LeadSourceIcon } from "~/components/organism/lead-source-icon";
import {
  LeadSuccessConfirmModal,
  type SuccessConfirmPhase,
} from "~/components/organism/lead-success-confirm-modal";
import {
  LEAD_STATUSES,
  LEAD_STATUS_COLORS,
  type LeadStatus,
} from "~/lib/leads/constants";
import { cn } from "~/lib/utils";
import {
  kanbanCollisionDetection,
  positionForInsertion,
} from "~/lib/kanban/board-position";

const COLUMN_PAGE_SIZE = 50;

interface KanbanFilters {
  search?: string;
  source?: "website";
  form_name?: string;
  platform_campaign_id?: string;
}

interface ReorderArgs {
  leadId: string;
  status: LeadStatus;
  position: number;
}

interface LeadsKanbanProps {
  filters: KanbanFilters;
  onStatusChange: (leadId: string, status: LeadStatus) => void | Promise<unknown>;
  onReorder: (args: ReorderArgs) => void | Promise<unknown>;
  onLeadSelect: (leadId: string) => void;
  canEdit?: boolean;
}

function useColumnQuery(status: LeadStatus, filters: KanbanFilters) {
  return useInfiniteQuery({
    queryKey: ["leads-kanban-column", status, filters],
    queryFn: ({ pageParam = 1 }) =>
      getLeads({
        status,
        page: pageParam as number,
        limit: COLUMN_PAGE_SIZE,
        search: filters.search,
        source: filters.source,
        form_name: filters.form_name,
        platform_campaign_id: filters.platform_campaign_id,
        include_hidden: true,
        sort: "board_position",
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? lastPage.page + 1 : undefined,
    staleTime: 10_000,
  });
}

export function LeadsKanban({
  filters,
  onStatusChange,
  onReorder,
  onLeadSelect,
  canEdit = true,
}: LeadsKanbanProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  // Confirmation dialog shown when a lead is dropped into the "Success" column.
  const [successConfirm, setSuccessConfirm] = useState<{
    lead: Lead;
    phase: SuccessConfirmPhase;
  } | null>(null);
  // Per-lead local override applied between drop and the cache refresh that
  // confirms the move, so cards land in the right place without flicker.
  const [pending, setPending] = useState<
    Record<string, { status: LeadStatus; board_position: number }>
  >({});
  // Id of the card to play the "landed" animation on for ~500ms after a drop,
  // matching the pipeline kanban.
  const [justMovedId, setJustMovedId] = useState<string | null>(null);
  const landTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoStackRef = useRef<
    Array<{ leadId: string; previousStatus: LeadStatus }>
  >([]);

  const newLeadQ = useColumnQuery("new_lead", filters);
  const pendingQ = useColumnQuery("pending", filters);
  const inProgressQ = useColumnQuery("in_progress", filters);
  const rejectedQ = useColumnQuery("rejected", filters);
  const onHoldQ = useColumnQuery("on_hold", filters);
  const staleQ = useColumnQuery("stale", filters);
  const successQ = useColumnQuery("success", filters);
  const hiddenQ = useColumnQuery("hidden", filters);

  const columnQueries = useMemo(
    () =>
      ({
        new_lead: newLeadQ,
        pending: pendingQ,
        in_progress: inProgressQ,
        rejected: rejectedQ,
        on_hold: onHoldQ,
        stale: staleQ,
        success: successQ,
        hidden: hiddenQ,
      }) as const,
    [
      newLeadQ,
      pendingQ,
      inProgressQ,
      rejectedQ,
      onHoldQ,
      staleQ,
      successQ,
      hiddenQ,
    ],
  );

  const countsQuery = useQuery({
    queryKey: ["leads-kanban-counts", filters],
    queryFn: () =>
      getLeadsKanbanCounts({
        search: filters.search,
        source: filters.source,
        form_name: filters.form_name,
        platform_campaign_id: filters.platform_campaign_id,
      }),
    staleTime: 10_000,
  });

  // Raw cache rows for every column, before applying any local pending
  // overrides. Used both as the source for the rendered view (below) and as
  // the truth against which we decide when a pending override can be cleared.
  const rawLeadsByCache = useMemo(() => {
    const acc = {} as Record<LeadStatus, Lead[]>;
    for (const status of LEAD_STATUSES) {
      acc[status] =
        columnQueries[status].data?.pages.flatMap((p) => p.data) ?? [];
    }
    return acc;
  }, [columnQueries]);

  // Apply per-lead pending overrides on top of the raw cache, then
  // bucket+sort by the resulting (status, board_position).
  const leadsByStatus = useMemo(() => {
    const all: Lead[] = [];
    for (const status of LEAD_STATUSES) {
      for (const r of rawLeadsByCache[status] ?? []) {
        const override = pending[r.id];
        all.push(
          override
            ? {
                ...r,
                status: override.status,
                board_position: override.board_position,
              }
            : r,
        );
      }
    }
    const acc = {} as Record<LeadStatus, Lead[]>;
    for (const status of LEAD_STATUSES) acc[status] = [];
    for (const lead of all) {
      const s = lead.status as LeadStatus;
      if (acc[s]) acc[s].push(lead);
    }
    for (const status of LEAD_STATUSES) {
      acc[status].sort((a, b) => {
        const ap = a.board_position;
        const bp = b.board_position;
        if (ap == null && bp == null) {
          return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        }
        if (ap == null) return 1;
        if (bp == null) return -1;
        return ap - bp;
      });
    }
    return acc;
  }, [rawLeadsByCache, pending]);

  const allLoadedLeads = useMemo(
    () => Object.values(leadsByStatus).flat(),
    [leadsByStatus],
  );

  // Clear a lead's pending override once the *raw cache* (not the
  // pending-applied view) confirms it. Comparing against the pending-applied
  // view is tautological — it would always match and clear the override on
  // the very next render, before the cache has actually caught up, causing
  // the card to flicker back to its old position for a frame.
  useEffect(() => {
    if (Object.keys(pending).length === 0) return;
    setPending((curr) => {
      const next = { ...curr };
      let changed = false;
      for (const status of LEAD_STATUSES) {
        for (const lead of rawLeadsByCache[status] ?? []) {
          const ov = next[lead.id];
          if (!ov) continue;
          if (
            lead.status === ov.status &&
            lead.board_position === ov.board_position
          ) {
            delete next[lead.id];
            changed = true;
          }
        }
      }
      return changed ? next : curr;
    });
  }, [rawLeadsByCache, pending]);

  const isInitialLoading = LEAD_STATUSES.some(
    (s) => columnQueries[s].isLoading,
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  /**
   * Resolves the drop target into a (column, insertionIndex) pair. The
   * over.id is either a column status (empty-column or end-of-column drop) or
   * a `lead-<id>` (card drop — insert before that card).
   */
  const resolveDrop = useCallback(
    (
      activeLeadId: string,
      overId: string,
    ): { status: LeadStatus; insertionIndex: number } | null => {
      if (LEAD_STATUSES.includes(overId as LeadStatus)) {
        const status = overId as LeadStatus;
        return { status, insertionIndex: leadsByStatus[status]?.length ?? 0 };
      }
      const overLeadId = overId.replace(/^lead-/, "");
      for (const status of LEAD_STATUSES) {
        const idx = leadsByStatus[status].findIndex(
          (l) => l.id === overLeadId,
        );
        if (idx !== -1) {
          // When reordering inside the same column and the moved card is
          // currently above the drop target, the index shifts up by one after
          // removal — handled by positionForInsertion which filters the moved
          // card out before reading neighbors.
          void activeLeadId;
          return { status, insertionIndex: idx };
        }
      }
      return null;
    },
    [leadsByStatus],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;

      const leadId = String(active.id).replace(/^lead-/, "");
      const drop = resolveDrop(leadId, String(over.id));
      if (!drop) return;

      const lead = allLoadedLeads.find((l) => l.id === leadId);
      if (!lead) return;

      // Dropping into "Success" is a deliberate action — confirm it first.
      if (drop.status === "success" && lead.status !== "success") {
        setSuccessConfirm({ lead, phase: "confirm" });
        return;
      }

      const position = positionForInsertion(
        leadsByStatus[drop.status],
        drop.insertionIndex,
        leadId,
      );

      // Real no-op only if the card was released exactly where it started.
      // `insertionIndex` is the index of the over-card in the unfiltered
      // column list — equal to currentIdx means the user dropped on the
      // card itself; any other value (incl. currentIdx ± 1) is a real move,
      // so we must NOT short-circuit those.
      const currentIdx = leadsByStatus[lead.status as LeadStatus].findIndex(
        (l) => l.id === leadId,
      );
      if (
        lead.status === drop.status &&
        currentIdx === drop.insertionIndex
      ) {
        return;
      }

      if (lead.status !== drop.status) {
        undoStackRef.current.push({
          leadId,
          previousStatus: lead.status as LeadStatus,
        });
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
      }

      setPending((curr) => ({
        ...curr,
        [leadId]: { status: drop.status, board_position: position },
      }));
      setJustMovedId(leadId);
      if (landTimerRef.current) clearTimeout(landTimerRef.current);
      landTimerRef.current = setTimeout(() => setJustMovedId(null), 500);

      onReorder({ leadId, status: drop.status, position });
    },
    [resolveDrop, allLoadedLeads, leadsByStatus, onReorder],
  );

  const handleConfirmSuccess = useCallback(async () => {
    setSuccessConfirm((curr) =>
      curr ? { ...curr, phase: "saving" } : curr,
    );
    const lead = successConfirm?.lead;
    if (!lead) return;
    try {
      await onStatusChange(lead.id, "success");
      undoStackRef.current.push({
        leadId: lead.id,
        previousStatus: lead.status as LeadStatus,
      });
      if (undoStackRef.current.length > 50) undoStackRef.current.shift();
      setSuccessConfirm((curr) =>
        curr ? { ...curr, phase: "done" } : curr,
      );
    } catch {
      setSuccessConfirm(null);
    }
  }, [successConfirm, onStatusChange]);

  useEffect(
    () => () => {
      if (landTimerRef.current) clearTimeout(landTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        const last = undoStackRef.current.pop();
        if (last) {
          onStatusChange(last.leadId, last.previousStatus);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onStatusChange]);

  const activeLead = activeId
    ? allLoadedLeads.find((l) => `lead-${l.id}` === activeId)
    : null;

  if (isInitialLoading) {
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
        <LeadsMobileSchedule
          leadsByStatus={leadsByStatus}
          totalsByStatus={countsQuery.data ?? {}}
          columnQueries={columnQueries}
          onLeadSelect={onLeadSelect}
        />
      </div>

      {/* Desktop: Kanban board */}
      <div className="hidden sm:block flex-1 min-h-0 h-full">
        <DndContext
          sensors={sensors}
          collisionDetection={kanbanCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className={cn(
              "flex flex-1 min-h-0 h-full gap-4 overflow-x-auto overflow-y-hidden rounded-lg py-4 pl-0 pr-4 pt-5 scrollbar-hide"
            )}
          >
            {LEAD_STATUSES.map((status) => {
              const q = columnQueries[status];
              return (
                <KanbanColumn
                  key={status}
                  status={status}
                  leads={leadsByStatus[status] ?? []}
                  total={countsQuery.data?.[status] ?? 0}
                  hasNextPage={q.hasNextPage ?? false}
                  isFetchingMore={q.isFetchingNextPage}
                  onLoadMore={() => q.fetchNextPage()}
                  onLeadSelect={onLeadSelect}
                  canEdit={canEdit}
                  justMovedId={justMovedId}
                />
              );
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeLead ? (
              <KanbanCardPresentational lead={activeLead} isDragging />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <LeadSuccessConfirmModal
        open={!!successConfirm}
        phase={successConfirm?.phase ?? "confirm"}
        leadName={
          successConfirm?.lead.full_name ||
          successConfirm?.lead.email ||
          ""
        }
        onConfirm={handleConfirmSuccess}
        onClose={() => setSuccessConfirm(null)}
      />
    </>
  );
}

function KanbanColumn({
  status,
  leads,
  total,
  hasNextPage,
  isFetchingMore,
  onLoadMore,
  onLeadSelect,
  canEdit,
  justMovedId,
}: {
  status: LeadStatus;
  leads: Lead[];
  total: number;
  hasNextPage: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => void;
  onLeadSelect: (id: string) => void;
  canEdit: boolean;
  justMovedId: string | null;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = LEAD_STATUS_COLORS[status];

  const isEmpty = total === 0;
  const itemIds = useMemo(() => leads.map((l) => `lead-${l.id}`), [leads]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full shrink-0 flex-col rounded-lg border border-border bg-muted shadow-[var(--shadow)] transition-colors overflow-hidden",
        isEmpty ? "min-w-[140px] w-[140px]" : "w-[280px] min-h-[calc(100vh-10rem)]",
        isOver && "ring-2 ring-primary/50"
      )}
    >
      <div className={cn("h-1 shrink-0", color)} />
      <div className="shrink-0 p-3">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", color)} />
          <span className="truncate">{t(`leads.statuses.${status}`)}</span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-xs font-medium text-muted-foreground">
            {total}
          </span>
        </h3>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        <SortableContext
          items={itemIds}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              onSelect={() => onLeadSelect(lead.id)}
              canEdit={canEdit}
              justLanded={justMovedId === lead.id}
            />
          ))}
        </SortableContext>
        {hasNextPage && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isFetchingMore}
            className={cn(
              "w-full rounded-lg border border-dashed border-border bg-background/50 py-2 text-xs font-medium text-muted-foreground",
              "hover:bg-background hover:text-foreground transition-colors",
              "disabled:opacity-50 disabled:pointer-events-none",
              "flex items-center justify-center gap-1.5",
            )}
          >
            {isFetchingMore ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("common.loading")}
              </>
            ) : (
              <>
                {t("leads.loadMore", {
                  defaultValue: "Load more",
                })}
                <span className="text-muted-foreground/60">
                  ({total - leads.length})
                </span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  lead,
  onSelect,
  disabled,
  canEdit = true,
  justLanded,
}: {
  lead: Lead;
  onSelect?: () => void;
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
    id: `lead-${lead.id}`,
    disabled: !canEdit || disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect?.()}
      className={cn(
        "rounded-lg border border-border bg-card shadow-[var(--shadow)] overflow-hidden transition-shadow",
        canEdit && !disabled && "cursor-grab active:cursor-grabbing",
        "hover:shadow-md",
        justLanded && "app-card-land",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <KanbanCardInner lead={lead} />
    </div>
  );
}

function KanbanCardPresentational({
  lead,
  isDragging,
}: {
  lead: Lead;
  isDragging?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-[280px] rounded-lg border bg-card overflow-hidden shadow-lg ring-1 ring-primary/20 cursor-grabbing",
        isDragging && "opacity-95",
      )}
    >
      <KanbanCardInner lead={lead} />
    </div>
  );
}

function KanbanCardInner({ lead }: { lead: Lead }) {
  const { t } = useTranslation();
  const status = lead.status as LeadStatus;
  const color = LEAD_STATUS_COLORS[status] ?? "bg-muted";

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
            color,
            color === "bg-muted" ? "text-foreground" : "text-white"
          )}
        >
          <span
            className={cn(
              "h-1 w-1 rounded-full",
              color === "bg-muted" ? "bg-foreground/60" : "bg-white/80",
            )}
          />
          {t(`leads.statuses.${status}`)}
        </span>
      </div>
      <p className="font-semibold text-sm truncate leading-tight">
        {lead.full_name || lead.email || "—"}
      </p>
      <p className="text-xs text-muted-foreground truncate line-clamp-2">
        {lead.email || lead.phone || "—"}
      </p>
    </div>
  );
}

/* ─── Mobile Schedule List (Google Calendar-style) ─── */

type ColumnQueryLike = {
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
};

function LeadsMobileSchedule({
  leadsByStatus,
  totalsByStatus,
  columnQueries,
  onLeadSelect,
}: {
  leadsByStatus: Record<LeadStatus, Lead[]>;
  totalsByStatus: Partial<Record<string, number>>;
  columnQueries: Record<LeadStatus, ColumnQueryLike>;
  onLeadSelect: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2 pt-4 pb-6">
      {LEAD_STATUSES.map((status) => {
        const leads = leadsByStatus[status] ?? [];
        const colorClass = LEAD_STATUS_COLORS[status];
        const total = totalsByStatus[status] ?? 0;
        const q = columnQueries[status];

        return (
          <ScheduleSection
            key={status}
            defaultOpen={total > 0}
            header={
              <>
                <div className={cn("h-8 w-1 rounded-full shrink-0", colorClass)} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground">
                    {t(`leads.statuses.${status}`)}
                  </span>
                </div>
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                    total > 0
                      ? `${colorClass} ${colorClass === "bg-muted" ? "text-foreground" : "text-white"}`
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {total}
                </span>
              </>
            }
          >
            {total === 0 ? (
              <div className="px-4 pb-4 pt-1">
                <p className="text-xs text-muted-foreground/50 text-center py-3">
                  —
                </p>
              </div>
            ) : (
              <div className="px-3 pb-3 space-y-1">
                {leads.map((lead) => (
                  <LeadScheduleRow
                    key={lead.id}
                    lead={lead}
                    colorClass={colorClass}
                    onSelect={() => onLeadSelect(lead.id)}
                  />
                ))}
                {q.hasNextPage && (
                  <button
                    type="button"
                    onClick={() => q.fetchNextPage()}
                    disabled={q.isFetchingNextPage}
                    className="w-full rounded-lg border border-dashed border-border py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                  >
                    {q.isFetchingNextPage ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        {t("leads.loadMore", { defaultValue: "Load more" })}
                        <span className="text-muted-foreground/60">
                          ({total - leads.length})
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </ScheduleSection>
        );
      })}
    </div>
  );
}

function LeadScheduleRow({
  lead,
  colorClass,
  onSelect,
}: {
  lead: Lead;
  colorClass: string;
  onSelect: () => void;
}) {
  const displayName = lead.full_name || lead.email || "—";
  const subtitle = lead.email || lead.phone || null;
  const formName = lead.form_name
    ? lead.form_name
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        "hover:bg-muted/60 active:bg-muted"
      )}
    >
      <div className={cn("h-8 w-0.5 rounded-full shrink-0", colorClass)} />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium leading-snug truncate">
          {displayName}
        </p>

        {subtitle && subtitle !== displayName && (
          <p className="text-xs text-muted-foreground truncate">
            {subtitle}
          </p>
        )}

        <div className="flex items-center gap-2 pt-0.5">
          {formName && (
            <span className="text-[10px] text-muted-foreground/70 truncate max-w-[120px]">
              {formName}
            </span>
          )}
          {lead.created_at && (
            <span className="text-[10px] text-muted-foreground/50">
              {formatDate(new Date(lead.created_at), "MMM d")}
            </span>
          )}
        </div>
      </div>

      {(lead.source_label || lead.source_table) && (
        <LeadSourceIcon
          source={lead.source_label}
          fallbackSource={lead.source_table}
          platform={lead.source_platform}
          size={16}
          className="shrink-0"
        />
      )}
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
        "shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]"
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
            open && "rotate-180"
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
