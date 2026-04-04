import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { ChevronDown, Loader2 } from "lucide-react";
import { formatDate } from "~/lib/utils/format";
import {
  getLeads,
  getLeadsKanbanCounts,
  type Lead,
} from "~/lib/api/leads";
import {
  LEAD_STATUSES,
  LEAD_STATUS_COLORS,
  type LeadStatus,
} from "~/lib/leads/constants";
import { cn } from "~/lib/utils";

const COLUMN_PAGE_SIZE = 50;

interface KanbanFilters {
  search?: string;
  source?: "website";
  form_name?: string;
  platform_campaign_id?: string;
}

interface LeadsKanbanProps {
  filters: KanbanFilters;
  onStatusChange: (leadId: string, status: LeadStatus) => void;
  onLeadSelect: (leadId: string) => void;
  isUpdating: boolean;
  canEdit?: boolean;
}

/**
 * Hook: fetches one status column's leads with infinite-scroll pagination.
 * Returns the full accumulated lead list for the column + load-more state.
 */
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
  onLeadSelect,
  isUpdating,
  canEdit = true,
}: LeadsKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const undoStackRef = useRef<
    Array<{ leadId: string; previousStatus: LeadStatus }>
  >([]);

  // One infinite query per status column — fixed hook order (8 calls)
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

  // Totals (global counts — not affected by per-column pagination)
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

  // Flatten all loaded leads by column for drag lookups
  const leadsByStatus = useMemo(() => {
    const acc = {} as Record<LeadStatus, Lead[]>;
    for (const status of LEAD_STATUSES) {
      const q = columnQueries[status];
      acc[status] = q.data?.pages.flatMap((p) => p.data) ?? [];
    }
    return acc;
  }, [columnQueries]);

  // Flat array for drag overlay lookup
  const allLoadedLeads = useMemo(
    () => Object.values(leadsByStatus).flat(),
    [leadsByStatus],
  );

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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const leadId = String(active.id).replace(/^lead-/, "");
      const newStatus = String(over.id);

      if (!LEAD_STATUSES.includes(newStatus as LeadStatus)) return;

      const lead = allLoadedLeads.find((l) => l.id === leadId);
      if (!lead || lead.status === newStatus) return;

      const previousStatus = lead.status as LeadStatus;
      undoStackRef.current.push({ leadId, previousStatus });
      if (undoStackRef.current.length > 50) undoStackRef.current.shift();

      onStatusChange(leadId, newStatus as LeadStatus);
    },
    [allLoadedLeads, onStatusChange],
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
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                  isUpdating={isUpdating}
                  canEdit={canEdit}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeLead ? (
              <KanbanCard
                lead={activeLead}
                isDragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
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
  isUpdating,
  canEdit,
}: {
  status: LeadStatus;
  leads: Lead[];
  total: number;
  hasNextPage: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => void;
  onLeadSelect: (id: string) => void;
  isUpdating: boolean;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = LEAD_STATUS_COLORS[status];

  const isEmpty = total === 0;

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
        {leads.map((lead) => (
          <KanbanCard
            key={lead.id}
            lead={lead}
            onSelect={() => onLeadSelect(lead.id)}
            disabled={isUpdating}
            canEdit={canEdit}
          />
        ))}
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
  isDragging,
  canEdit = true,
}: {
  lead: Lead;
  onSelect?: () => void;
  disabled?: boolean;
  isDragging?: boolean;
  canEdit?: boolean;
}) {
  const { t } = useTranslation();
  const status = lead.status as LeadStatus;
  const color = LEAD_STATUS_COLORS[status] ?? "bg-muted";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isDraggingState,
  } = useDraggable({
    id: `lead-${lead.id}`,
    disabled: !canEdit || disabled,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-lg border border-border bg-card shadow-[var(--shadow)] overflow-hidden",
        canEdit && !disabled && "cursor-grab active:cursor-grabbing",
        "hover:shadow-md transition-shadow",
        (isDragging || isDraggingState) && "opacity-90 shadow-lg",
        disabled && "pointer-events-none opacity-60"
      )}
      onClick={() => onSelect?.()}
    >
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
              color,
              color === "bg-muted" ? "text-foreground" : "text-white"
            )}
          >
            <span className={cn("h-1 w-1 rounded-full", color === "bg-muted" ? "bg-foreground/60" : "bg-white/80")} />
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
      {/* Color accent line */}
      <div className={cn("h-8 w-0.5 rounded-full shrink-0", colorClass)} />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium leading-snug truncate">
          {displayName}
        </p>

        {subtitle && subtitle !== displayName && (
          <p className="text-xs text-muted-foreground truncate">
            {subtitle}
          </p>
        )}

        {/* Meta: form name + date */}
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

      {/* Source indicator */}
      {lead.source_label && (
        <span className="text-[10px] text-muted-foreground/60 shrink-0">
          {lead.source_label}
        </span>
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
