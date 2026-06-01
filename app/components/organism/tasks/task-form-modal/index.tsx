import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import { startOfDay } from "date-fns";
import { CalendarIcon, X, Search, ChevronDown } from "lucide-react";
import { formatDate } from "~/lib/utils/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { cn } from "~/lib/utils";
import {
  createTask,
  createTaskForContact,
  createTaskForDeal,
  updateTask,
  type Task,
  type CreateTaskPayload,
  type UpdateTaskPayload,
} from "~/lib/api/tasks";
import { getLeads, type Lead } from "~/lib/api/leads";
import { getContacts, type ContactListItem } from "~/lib/api/contacts-crm";
import { getDeals, type DealListItem } from "~/lib/api/deals";
import { useDebounce } from "~/lib/hooks/useDebounce";

type EntityType = "lead" | "contact" | "deal";

export interface WorkspaceMemberItem {
  user_id: string;
  user_first_name: string;
  user_last_name: string;
  user_email: string;
  role: string;
}

interface TaskFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
  /** When set, new tasks are created against the contact (not the lead). */
  contactId?: string;
  /** When set, new tasks are created against a deal. */
  dealId?: string;
  leadName?: string;
  /** Shown in the title when creating a task for a contact (no lead name). */
  linkedContextLabel?: string;
  task?: Task | null;
  onSuccess?: (task: Task) => void;
  workspaceMembers: WorkspaceMemberItem[];
  /** Contact page route id: refreshes merged contact history after task writes tied to a lead. */
  historyContactId?: string;
}

const today = startOfDay(new Date());

export function TaskFormModal({
  open,
  onOpenChange,
  leadId,
  contactId,
  dealId,
  leadName,
  linkedContextLabel,
  task,
  onSuccess,
  workspaceMembers,
  historyContactId,
}: TaskFormModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthContext();

  const sortedMembers = useMemo(() => {
    if (!currentUser) return workspaceMembers;
    const others = workspaceMembers.filter((m) => m.user_id !== currentUser.id);
    const me = workspaceMembers.find((m) => m.user_id === currentUser.id);
    return me ? [me, ...others] : others;
  }, [workspaceMembers, currentUser]);
  const isEdit = !!task;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [assigneeId, setAssigneeId] = useState<string>("unassigned");
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Entity type selector (only used when no entity pre-provided)
  const [entityType, setEntityType] = useState<EntityType>("lead");

  // Lead picker state (only used when leadId not provided)
  const [pickedLead, setPickedLead] = useState<Lead | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const leadListScrollRef = useRef<HTMLDivElement>(null);
  const debouncedLeadSearch = useDebounce(leadSearch, 300);

  // Contact picker state
  const [pickedContact, setPickedContact] = useState<ContactListItem | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const contactListScrollRef = useRef<HTMLDivElement>(null);
  const debouncedContactSearch = useDebounce(contactSearch, 300);

  // Deal picker state
  const [pickedDeal, setPickedDeal] = useState<DealListItem | null>(null);
  const [dealSearch, setDealSearch] = useState("");
  const [dealPickerOpen, setDealPickerOpen] = useState(false);
  const dealListScrollRef = useRef<HTMLDivElement>(null);
  const debouncedDealSearch = useDebounce(dealSearch, 300);

  // Manual wheel handler: Dialog's RemoveScroll blocks wheel events on portaled content.
  const handleListWheel = (ref: React.RefObject<HTMLDivElement | null>) => (e: React.WheelEvent) => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const canScrollUp = scrollTop > 0;
    const canScrollDown = scrollTop < scrollHeight - clientHeight;
    if ((e.deltaY < 0 && canScrollUp) || (e.deltaY > 0 && canScrollDown)) {
      e.preventDefault();
      e.stopPropagation();
      el.scrollTop += e.deltaY;
    }
  };

  const effectiveLeadId = leadId ?? pickedLead?.id ?? "";
  const effectiveContactId = contactId ?? pickedContact?.id ?? "";
  const effectiveDealId = dealId ?? pickedDeal?.id ?? "";

  const showEntityPicker = !leadId && !contactId && !dealId && !isEdit;

  const leadsQuery = useQuery({
    queryKey: ["leads-picker", debouncedLeadSearch],
    queryFn: () =>
      getLeads({ search: debouncedLeadSearch || undefined, limit: 20 }),
    enabled: showEntityPicker && open && leadPickerOpen && entityType === "lead",
  });

  const contactsQuery = useQuery({
    queryKey: ["contacts-picker", debouncedContactSearch],
    queryFn: () =>
      getContacts({ search: debouncedContactSearch || undefined, limit: 20 }),
    enabled: showEntityPicker && open && contactPickerOpen && entityType === "contact",
  });

  const dealsQuery = useQuery({
    queryKey: ["deals-picker", debouncedDealSearch],
    queryFn: () =>
      getDeals({ search: debouncedDealSearch || undefined, limit: 20 }),
    enabled: showEntityPicker && open && dealPickerOpen && entityType === "deal",
  });

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setDueDate(task.due_date ? new Date(task.due_date) : undefined);
      setAssigneeId(task.assignee_id ?? "unassigned");
    } else {
      setTitle("");
      setDescription("");
      setDueDate(undefined);
      setAssigneeId("unassigned");
    }
  }, [task, open]);

  useEffect(() => {
    if (!open) {
      setEntityType("lead");
      setPickedLead(null);
      setLeadSearch("");
      setLeadPickerOpen(false);
      setPickedContact(null);
      setContactSearch("");
      setContactPickerOpen(false);
      setPickedDeal(null);
      setDealSearch("");
      setDealPickerOpen(false);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: CreateTaskPayload & UpdateTaskPayload = {
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate ? dueDate.toISOString() : null,
        assignee_id: assigneeId !== "unassigned" ? assigneeId : null,
      };
      if (isEdit) {
        return updateTask(task!.id, payload);
      }
      if (dealId || (!leadId && !contactId && entityType === "deal")) {
        return createTaskForDeal(effectiveDealId, payload);
      }
      if (contactId || (!leadId && !dealId && entityType === "contact")) {
        return createTaskForContact(effectiveContactId, payload);
      }
      return createTask(effectiveLeadId, payload);
    },
    onSuccess: (saved) => {
      const usedDealId = dealId || (!leadId && !contactId && entityType === "deal" ? effectiveDealId : "");
      const usedContactId = contactId || (!leadId && !dealId && entityType === "contact" ? effectiveContactId : "");

      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["home-tasks-upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["home-tasks-overdue"] });
      if (usedDealId) {
        queryClient.invalidateQueries({
          queryKey: ["deal-tasks", usedDealId],
        });
        queryClient.invalidateQueries({ queryKey: ["deal", usedDealId] });
        queryClient.invalidateQueries({
          queryKey: ["deal-history", usedDealId],
        });
      } else if (usedContactId) {
        queryClient.invalidateQueries({
          queryKey: ["contact-tasks", usedContactId],
        });
        queryClient.invalidateQueries({ queryKey: ["contact", usedContactId] });
        queryClient.invalidateQueries({
          queryKey: ["contact-history", usedContactId],
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: ["lead-tasks", effectiveLeadId],
        });
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        queryClient.invalidateQueries({
          queryKey: ["lead-detail", effectiveLeadId],
        });
        queryClient.invalidateQueries({
          queryKey: ["lead-history", effectiveLeadId],
        });
      }
      if (historyContactId) {
        void queryClient.invalidateQueries({
          queryKey: ["contact-history", historyContactId],
        });
      }
      if (isEdit && task) {
        if (task.entity_table === "contacts") {
          void queryClient.invalidateQueries({
            queryKey: ["contact-history"],
            exact: false,
          });
        } else if (task.entity_table === "deals") {
          void queryClient.invalidateQueries({
            queryKey: ["deal-tasks", task.entity_id],
          });
          void queryClient.invalidateQueries({
            queryKey: ["deal", task.entity_id],
          });
          void queryClient.invalidateQueries({
            queryKey: ["deal-history", task.entity_id],
          });
        } else if (task.entity_table === "leads") {
          void queryClient.invalidateQueries({
            queryKey: ["lead-history", task.entity_id],
          });
        }
      }
      onOpenChange(false);
      onSuccess?.(saved);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!isEdit) {
      if (dealId || (entityType === "deal" && effectiveDealId)) { /* ok */ }
      else if (contactId || (entityType === "contact" && effectiveContactId)) { /* ok */ }
      else if (leadId || effectiveLeadId) { /* ok */ }
      else return;
    }
    mutation.mutate();
  };

  const clearDueDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDueDate(undefined);
  };

  const displayedEntityName = (() => {
    if (leadName || linkedContextLabel) return leadName ?? linkedContextLabel ?? "";
    if (entityType === "lead") {
      return pickedLead?.full_name ??
        (pickedLead
          ? [pickedLead.first_name, pickedLead.last_name].filter(Boolean).join(" ").trim()
          : "") ??
        pickedLead?.email ?? "";
    }
    if (entityType === "contact") {
      return pickedContact?.contact_full_name ?? "";
    }
    if (entityType === "deal") {
      return pickedDeal?.title ?? pickedDeal?.contact_full_name ?? "";
    }
    return "";
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("tasks.form.editTitle") : t("tasks.form.createTitle")}
            {displayedEntityName && !isEdit && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                — {displayedEntityName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Entity picker — only when no entity pre-provided */}
          {showEntityPicker && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t("tasks.fields.entityType", { defaultValue: "Task type" })}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={entityType}
                  onValueChange={(v) => {
                    setEntityType(v as EntityType);
                    setPickedLead(null);
                    setLeadSearch("");
                    setLeadPickerOpen(false);
                    setPickedContact(null);
                    setContactSearch("");
                    setContactPickerOpen(false);
                    setPickedDeal(null);
                    setDealSearch("");
                    setDealPickerOpen(false);
                  }}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">
                      {t("tasks.entityTypes.lead", { defaultValue: "Lead task" })}
                    </SelectItem>
                    <SelectItem value="contact">
                      {t("tasks.entityTypes.contact", { defaultValue: "Contact task" })}
                    </SelectItem>
                    <SelectItem value="deal">
                      {t("tasks.entityTypes.deal", { defaultValue: "Deal task" })}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Lead picker */}
              {entityType === "lead" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {t("tasks.fields.lead")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Popover open={leadPickerOpen} onOpenChange={setLeadPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors",
                          "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                          !pickedLead && "text-muted-foreground"
                        )}
                      >
                        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-left truncate">
                          {pickedLead
                            ? displayedEntityName
                            : t("tasks.form.searchLead")}
                        </span>
                        {pickedLead ? (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPickedLead(null);
                              setLeadSearch("");
                            }}
                            onKeyDown={(e) =>
                              (e.key === "Enter" || e.key === " ") &&
                              setPickedLead(null)
                            }
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[min(400px,calc(100vw-2rem))] p-0 flex flex-col overflow-hidden"
                      align="start"
                    >
                      <div className="flex items-center gap-2 border-b border-border px-3 py-2 shrink-0">
                        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <Input
                          autoFocus
                          value={leadSearch}
                          onChange={(e) => setLeadSearch(e.target.value)}
                          placeholder={t("tasks.form.searchLead")}
                          className="border-0 p-0 h-auto focus-visible:ring-0 text-sm"
                        />
                      </div>
                      <div
                        ref={leadListScrollRef}
                        className="min-h-0 max-h-[200px] overflow-y-auto overscroll-contain"
                        onWheel={handleListWheel(leadListScrollRef)}
                      >
                        {leadsQuery.isFetching ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
                          </div>
                        ) : leadsQuery.data?.data.length === 0 ? (
                          <div className="px-3 py-4 text-xs text-center text-muted-foreground">
                            {t("common.noResults")}
                          </div>
                        ) : (
                          (leadsQuery.data?.data ?? []).map((lead) => {
                            const name =
                              lead.full_name ||
                              [lead.first_name, lead.last_name]
                                .filter(Boolean)
                                .join(" ")
                                .trim() ||
                              lead.email ||
                              "—";
                            return (
                              <button
                                key={lead.id}
                                type="button"
                                onClick={() => {
                                  setPickedLead(lead);
                                  setLeadPickerOpen(false);
                                }}
                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                              >
                                <span className="font-medium flex-1 truncate">
                                  {name}
                                </span>
                                {lead.email && (
                                  <span className="text-muted-foreground text-xs truncate max-w-[140px]">
                                    {lead.email}
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Contact picker */}
              {entityType === "contact" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {t("tasks.fields.contact", { defaultValue: "Contact" })}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Popover open={contactPickerOpen} onOpenChange={setContactPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors",
                          "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                          !pickedContact && "text-muted-foreground"
                        )}
                      >
                        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-left truncate">
                          {pickedContact
                            ? pickedContact.contact_full_name || pickedContact.primary_email || "—"
                            : t("tasks.form.searchContact", { defaultValue: "Search contacts…" })}
                        </span>
                        {pickedContact ? (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPickedContact(null);
                              setContactSearch("");
                            }}
                            onKeyDown={(e) =>
                              (e.key === "Enter" || e.key === " ") &&
                              setPickedContact(null)
                            }
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[min(400px,calc(100vw-2rem))] p-0 flex flex-col overflow-hidden"
                      align="start"
                    >
                      <div className="flex items-center gap-2 border-b border-border px-3 py-2 shrink-0">
                        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <Input
                          autoFocus
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          placeholder={t("tasks.form.searchContact", { defaultValue: "Search contacts…" })}
                          className="border-0 p-0 h-auto focus-visible:ring-0 text-sm"
                        />
                      </div>
                      <div
                        ref={contactListScrollRef}
                        className="min-h-0 max-h-[200px] overflow-y-auto overscroll-contain"
                        onWheel={handleListWheel(contactListScrollRef)}
                      >
                        {contactsQuery.isFetching ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
                          </div>
                        ) : contactsQuery.data?.data.length === 0 ? (
                          <div className="px-3 py-4 text-xs text-center text-muted-foreground">
                            {t("common.noResults")}
                          </div>
                        ) : (
                          (contactsQuery.data?.data ?? []).map((c) => {
                            const name = c.contact_full_name?.trim() || c.primary_email || "—";
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setPickedContact(c);
                                  setContactPickerOpen(false);
                                }}
                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                              >
                                <span className="font-medium flex-1 truncate">
                                  {name}
                                </span>
                                {c.primary_email && c.contact_full_name && (
                                  <span className="text-muted-foreground text-xs truncate max-w-[140px]">
                                    {c.primary_email}
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Deal picker */}
              {entityType === "deal" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {t("tasks.fields.deal", { defaultValue: "Deal" })}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Popover open={dealPickerOpen} onOpenChange={setDealPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors",
                          "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                          !pickedDeal && "text-muted-foreground"
                        )}
                      >
                        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-left truncate">
                          {pickedDeal
                            ? pickedDeal.title || pickedDeal.contact_full_name || "—"
                            : t("tasks.form.searchDeal", { defaultValue: "Search deals…" })}
                        </span>
                        {pickedDeal ? (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPickedDeal(null);
                              setDealSearch("");
                            }}
                            onKeyDown={(e) =>
                              (e.key === "Enter" || e.key === " ") &&
                              setPickedDeal(null)
                            }
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[min(400px,calc(100vw-2rem))] p-0 flex flex-col overflow-hidden"
                      align="start"
                    >
                      <div className="flex items-center gap-2 border-b border-border px-3 py-2 shrink-0">
                        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <Input
                          autoFocus
                          value={dealSearch}
                          onChange={(e) => setDealSearch(e.target.value)}
                          placeholder={t("tasks.form.searchDeal", { defaultValue: "Search deals…" })}
                          className="border-0 p-0 h-auto focus-visible:ring-0 text-sm"
                        />
                      </div>
                      <div
                        ref={dealListScrollRef}
                        className="min-h-0 max-h-[200px] overflow-y-auto overscroll-contain"
                        onWheel={handleListWheel(dealListScrollRef)}
                      >
                        {dealsQuery.isFetching ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
                          </div>
                        ) : dealsQuery.data?.data.length === 0 ? (
                          <div className="px-3 py-4 text-xs text-center text-muted-foreground">
                            {t("common.noResults")}
                          </div>
                        ) : (
                          (dealsQuery.data?.data ?? []).map((d) => {
                            const name = d.title?.trim() || d.contact_full_name || "—";
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                  setPickedDeal(d);
                                  setDealPickerOpen(false);
                                }}
                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                              >
                                <span className="font-medium flex-1 truncate">
                                  {name}
                                </span>
                                {d.contact_full_name && d.title && (
                                  <span className="text-muted-foreground text-xs truncate max-w-[140px]">
                                    {d.contact_full_name}
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title" className="text-xs font-medium">
              {t("tasks.fields.title")}
            </Label>
            <Input
              id="task-title"
              autoFocus={!!leadId || isEdit}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("tasks.form.titlePlaceholder")}
              className="text-sm"
              required
            />
          </div>

          {/* Description / comment */}
          <div className="space-y-1.5">
            <Label htmlFor="task-desc" className="text-xs font-medium">
              {t("tasks.fields.description")}{" "}
              <span className="text-muted-foreground font-normal">
                ({t("common.optional")})
              </span>
            </Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("tasks.form.descriptionPlaceholder")}
              className="min-h-[80px] resize-none text-sm"
            />
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {t("tasks.fields.dueDate")}{" "}
              <span className="text-muted-foreground font-normal">
                ({t("common.optional")})
              </span>
            </Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors",
                    "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-left">
                    {dueDate
                      ? formatDate(dueDate, "PPP")
                      : t("tasks.form.dueDatePlaceholder")}
                  </span>
                  {dueDate && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={clearDueDate}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") &&
                        setDueDate(undefined)
                      }
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(d) => {
                    setDueDate(d);
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => date < today}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {t("tasks.fields.assignee")}{" "}
              <span className="text-muted-foreground font-normal">
                ({t("common.optional")})
              </span>
            </Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder={t("tasks.form.unassigned")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  {t("tasks.form.unassigned")}
                </SelectItem>
                {sortedMembers.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    {t("tasks.form.noMembers")}
                  </div>
                ) : (
                  sortedMembers.map((m) => {
                    const isMe = m.user_id === currentUser?.id;
                    const name =
                      [m.user_first_name, m.user_last_name]
                        .filter(Boolean)
                        .join(" ")
                        .trim() || m.user_email;
                    const label = isMe
                      ? `${t("common.you", { defaultValue: "You" })} (${name})`
                      : name;
                    return (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {label}
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                !title.trim() ||
                mutation.isPending ||
                (!isEdit &&
                  !contactId &&
                  !dealId &&
                  !leadId &&
                  !(entityType === "lead" && effectiveLeadId) &&
                  !(entityType === "contact" && effectiveContactId) &&
                  !(entityType === "deal" && effectiveDealId))
              }
            >
              {mutation.isPending
                ? t("common.saving")
                : t("tasks.actions.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
