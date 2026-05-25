import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";
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
import { ChevronDown, Mail, Phone } from "lucide-react";
import { formatDate, formatCurrency } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import {
  CONTACT_TYPES,
  type ContactType,
} from "~/lib/contacts/contact-types";
import {
  ContactSourceBadge,
  ContactTypeBadge,
} from "~/components/molecule/contact-badges";
import type { ContactListItem } from "~/lib/api/contacts-crm";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";

const TYPE_COLORS: Record<ContactType, string> = {
  customer: "bg-emerald-500",
  trade_partner: "bg-blue-500",
  supplier: "bg-violet-500",
  internal: "bg-slate-400",
  other: "bg-amber-500",
};

function normalizeContactType(raw: string): ContactType {
  return CONTACT_TYPES.includes(raw as ContactType)
    ? (raw as ContactType)
    : "other";
}

function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function assigneeInitials(row: ContactListItem): string {
  const first = row.assignee_first_name?.trim() ?? "";
  const last = row.assignee_last_name?.trim() ?? "";
  const a = first ? first[0] : "";
  const b = last ? last[0] : "";
  return (a + b).toUpperCase() || "?";
}

interface ContactsKanbanProps {
  contacts: ContactListItem[];
  isLoading: boolean;
  onContactTypeChange: (contactId: string, contactType: ContactType) => void;
  isUpdating?: boolean;
  canEdit?: boolean;
  onContactSelect: (contactId: string) => void;
}

export function ContactsKanban({
  contacts,
  isLoading,
  onContactTypeChange,
  isUpdating,
  canEdit = true,
  onContactSelect,
}: ContactsKanbanProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const undoStackRef = useRef<
    Array<{ contactId: string; previousType: ContactType }>
  >([]);

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

      const contactId = String(active.id).replace(/^contact-/, "");
      const newType = String(over.id) as ContactType;

      if (!CONTACT_TYPES.includes(newType)) return;

      const contact = contacts.find((c) => c.id === contactId);
      if (!contact) return;
      const prev = normalizeContactType(contact.contact_type ?? "other");
      if (prev === newType) return;

      undoStackRef.current.push({ contactId, previousType: prev });
      if (undoStackRef.current.length > 50) undoStackRef.current.shift();

      onContactTypeChange(contactId, newType);
    },
    [contacts, onContactTypeChange],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        const last = undoStackRef.current.pop();
        if (last) onContactTypeChange(last.contactId, last.previousType);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onContactTypeChange]);

  const contactsByType = CONTACT_TYPES.reduce(
    (acc, type) => {
      acc[type] = contacts.filter(
        (c) => normalizeContactType(c.contact_type ?? "other") === type,
      );
      return acc;
    },
    {} as Record<ContactType, ContactListItem[]>,
  );

  const activeContact = activeId
    ? contacts.find((c) => c.id === String(activeId).replace(/^contact-/, ""))
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
      <div className="sm:hidden">
        <ContactsMobileSchedule
          contactsByType={contactsByType}
          onContactSelect={onContactSelect}
        />
      </div>

      <div className="hidden sm:block flex-1 min-h-0 h-full">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className={cn(
              "flex flex-1 min-h-0 h-full gap-4 overflow-x-auto overflow-y-hidden rounded-lg py-4 pl-0 pr-4 pt-5 scrollbar-hide",
            )}
          >
            {CONTACT_TYPES.map((type) => (
              <KanbanColumn
                key={type}
                contactType={type}
                contacts={contactsByType[type]}
                onContactSelect={onContactSelect}
                isUpdating={isUpdating}
                canEdit={canEdit}
                colorClass={TYPE_COLORS[type]}
              />
            ))}
          </div>

          <DragOverlay>
            {activeContact ? (
              <div
                className={cn(
                  "w-[min(100%,280px)] rounded-lg border bg-card p-3 space-y-2 shadow-lg ring-1 ring-primary/20 cursor-grabbing",
                )}
              >
                <ContactKanbanCardInner contact={activeContact} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </>
  );
}

function KanbanColumn({
  contactType,
  contacts: columnContacts,
  onContactSelect,
  isUpdating,
  canEdit,
  colorClass,
}: {
  contactType: ContactType;
  contacts: ContactListItem[];
  onContactSelect: (id: string) => void;
  isUpdating?: boolean;
  canEdit?: boolean;
  colorClass: string;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: contactType });
  const isEmpty = columnContacts.length === 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-muted/50 transition-all duration-150 min-h-[200px] w-[min(100%,280px)] shrink-0",
        isOver && "ring-2 ring-primary/40 bg-primary/5",
      )}
    >
      <div className={cn("h-1 rounded-t-xl shrink-0", colorClass)} />

      <div className="shrink-0 px-3 pt-3 pb-2">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className={cn("inline-block h-2 w-2 rounded-full", colorClass)} />
          <span>{t(`contacts.contactTypes.${contactType}`, { defaultValue: contactType.replace(/_/g, " ") })}</span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-xs font-medium text-muted-foreground">
            {columnContacts.length}
          </span>
        </h3>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {isEmpty ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/50">
            —
          </div>
        ) : (
          columnContacts.map((c) => (
            <ContactKanbanCard
              key={c.id}
              contact={c}
              onSelect={() => onContactSelect(c.id)}
              disabled={isUpdating}
              canEdit={canEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ContactKanbanCardInner({ contact }: { contact: ContactListItem }) {
  const name = contact.contact_full_name?.trim() || "—";
  const email = contact.primary_email?.trim() ?? "";
  const phone = contact.primary_phone?.trim() ?? "";
  const ltvNum =
    contact.lifetime_value != null ? Number(contact.lifetime_value) : null;
  const hasAssignee = !!(
    contact.assignee_first_name || contact.assignee_last_name
  );

  let lastContactLabel = "";
  if (contact.last_contacted_at) {
    const d = new Date(contact.last_contacted_at);
    if (!Number.isNaN(d.getTime())) {
      lastContactLabel = formatDate(d, "MMM d");
    }
  }

  return (
    <>
      <div className="flex items-start gap-2">
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-linear-to-br from-secondary/30 to-primary/10 text-[10px] font-semibold text-foreground">
            {contactInitials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium leading-snug truncate">{name}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
            {email ? (
              <span className="inline-flex items-center gap-0.5 truncate max-w-full">
                <Mail className="h-3 w-3 shrink-0 opacity-70" />
                <span className="truncate">{email}</span>
              </span>
            ) : null}
            {phone ? (
              <span className="inline-flex items-center gap-0.5 truncate">
                <Phone className="h-3 w-3 shrink-0 opacity-70" />
                <span className="truncate">{phone}</span>
              </span>
            ) : null}
          </div>
        </div>
        {hasAssignee ? (
          <Avatar className="size-6 shrink-0">
            <AvatarFallback className="bg-muted text-[9px] font-semibold text-foreground">
              {assigneeInitials(contact)}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <ContactSourceBadge source={contact.source} />
          <ContactTypeBadge contactType={contact.contact_type} />
        </div>
        {ltvNum != null && Number.isFinite(ltvNum) ? (
          <span className="text-[11px] font-medium tabular-nums text-foreground">
            {formatCurrency(ltvNum)}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/60">
            {lastContactLabel}
          </span>
        )}
      </div>
    </>
  );
}

function ContactKanbanCard({
  contact,
  onSelect,
  disabled,
  canEdit = true,
}: {
  contact: ContactListItem;
  onSelect: () => void;
  disabled?: boolean;
  canEdit?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `contact-${contact.id}`,
    disabled: !canEdit || disabled,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!isDragging) onSelect();
        }
      }}
      className={cn(
        "rounded-lg border bg-card p-3 space-y-2 shadow-sm text-left w-full",
        canEdit && !disabled && "cursor-grab active:cursor-grabbing",
        "hover:shadow-md transition-shadow duration-150",
        isDragging && "opacity-40",
      )}
      onClick={() => !isDragging && onSelect()}
    >
      <ContactKanbanCardInner contact={contact} />
    </div>
  );
}

function ContactsMobileSchedule({
  contactsByType,
  onContactSelect,
}: {
  contactsByType: Record<ContactType, ContactListItem[]>;
  onContactSelect: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2 pt-2 pb-6">
      {CONTACT_TYPES.map((type) => {
        const list = contactsByType[type];
        const colorClass = TYPE_COLORS[type];
        const count = list.length;

        return (
          <ScheduleSection
            key={type}
            defaultOpen={count > 0}
            header={
              <>
                <div className={cn("h-8 w-1 rounded-full shrink-0", colorClass)} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground">
                    {t(`contacts.contactTypes.${type}`, { defaultValue: type.replace(/_/g, " ") })}
                  </span>
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
                {list.map((c) => (
                  <ContactScheduleRow
                    key={c.id}
                    contact={c}
                    colorClass={colorClass}
                    onSelect={() => onContactSelect(c.id)}
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

function ContactScheduleRow({
  contact,
  colorClass,
  onSelect,
}: {
  contact: ContactListItem;
  colorClass: string;
  onSelect: () => void;
}) {
  const name = contact.contact_full_name?.trim() || "—";
  const email = contact.primary_email?.trim() ?? "";

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
        <p className="text-sm font-medium leading-snug truncate">{name}</p>
        {email ? (
          <p className="text-xs text-muted-foreground line-clamp-1">{email}</p>
        ) : null}
        <div className="pt-0.5">
          <ContactTypeBadge contactType={contact.contact_type} />
        </div>
      </div>
      <Avatar className="size-7 shrink-0 mt-0.5">
        <AvatarFallback className="bg-linear-to-br from-secondary/30 to-primary/10 text-[10px] font-semibold">
          {contactInitials(name)}
        </AvatarFallback>
      </Avatar>
    </button>
  );
}

function ScheduleSection({
  defaultOpen,
  header,
  children,
}: {
  defaultOpen: boolean;
  header: ReactNode;
  children: ReactNode;
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
