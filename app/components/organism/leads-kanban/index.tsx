import { useCallback, useEffect, useRef, useState } from "react";
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
import { type Lead } from "~/lib/api/leads";
import {
  LEAD_STATUSES,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from "~/lib/leads/constants";
import { cn } from "~/lib/utils";
import { Loader2 } from "lucide-react";

interface LeadsKanbanProps {
  leads: Lead[];
  isLoading: boolean;
  onStatusChange: (leadId: string, status: LeadStatus) => void;
  onLeadSelect: (leadId: string) => void;
  isUpdating: boolean;
  canEdit?: boolean;
}

export function LeadsKanban({
  leads,
  isLoading,
  onStatusChange,
  onLeadSelect,
  isUpdating,
  canEdit = true,
}: LeadsKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const undoStackRef = useRef<Array<{ leadId: string; previousStatus: LeadStatus }>>([]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
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

      const lead = leads.find((l) => l.id === leadId);
      if (!lead || lead.status === newStatus) return;

      const previousStatus = lead.status as LeadStatus;
      undoStackRef.current.push({ leadId, previousStatus });
      if (undoStackRef.current.length > 50) undoStackRef.current.shift();

      onStatusChange(leadId, newStatus as LeadStatus);
    },
    [leads, onStatusChange]
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

  const leadsByStatus = LEAD_STATUSES.reduce(
    (acc, status) => {
      acc[status] = leads.filter((l) => l.status === status);
      return acc;
    },
    {} as Record<LeadStatus, Lead[]>
  );

  const activeLead = activeId ? leads.find((l) => `lead-${l.id}` === activeId) : null;

  if (isLoading) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          "flex flex-1 min-h-0 h-full gap-4 overflow-x-auto overflow-y-hidden rounded-lg py-4 pl-0 pr-4 pt-5 scrollbar-hide"
        )}
      >
        {LEAD_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            leads={leadsByStatus[status] ?? []}
            onLeadSelect={onLeadSelect}
            isUpdating={isUpdating}
            canEdit={canEdit}
          />
        ))}
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
  );
}

function KanbanColumn({
  status,
  leads,
  onLeadSelect,
  isUpdating,
  canEdit,
}: {
  status: LeadStatus;
  leads: Lead[];
  onLeadSelect: (id: string) => void;
  isUpdating: boolean;
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = LEAD_STATUS_COLORS[status];

  const isEmpty = leads.length === 0;

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
          <span className="truncate">{LEAD_STATUS_LABELS[status]}</span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-xs font-medium text-muted-foreground">
            {leads.length}
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
            {LEAD_STATUS_LABELS[status]}
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
