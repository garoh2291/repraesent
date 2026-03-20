import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format, startOfDay } from "date-fns";
import { CalendarIcon, X, Search, ChevronDown } from "lucide-react";
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
  updateTask,
  type Task,
  type CreateTaskPayload,
  type UpdateTaskPayload,
} from "~/lib/api/tasks";
import { getLeads, type Lead } from "~/lib/api/leads";
import { useDebounce } from "~/lib/hooks/useDebounce";

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
  leadName?: string;
  task?: Task | null;
  onSuccess?: (task: Task) => void;
  workspaceMembers: WorkspaceMemberItem[];
}

const today = startOfDay(new Date());

export function TaskFormModal({
  open,
  onOpenChange,
  leadId,
  leadName,
  task,
  onSuccess,
  workspaceMembers,
}: TaskFormModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = !!task;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [assigneeId, setAssigneeId] = useState<string>("unassigned");
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Lead picker state (only used when leadId not provided)
  const [pickedLead, setPickedLead] = useState<Lead | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const leadListScrollRef = useRef<HTMLDivElement>(null);
  const debouncedLeadSearch = useDebounce(leadSearch, 300);

  // Manual wheel handler: Dialog's RemoveScroll blocks wheel events on portaled content.
  // We scroll manually and consume the event so it works when hovering over the list.
  const handleLeadListWheel = (e: React.WheelEvent) => {
    const el = leadListScrollRef.current;
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

  const leadsQuery = useQuery({
    queryKey: ["leads-picker", debouncedLeadSearch],
    queryFn: () =>
      getLeads({ search: debouncedLeadSearch || undefined, limit: 20 }),
    enabled: !leadId && open && leadPickerOpen,
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
      setPickedLead(null);
      setLeadSearch("");
      setLeadPickerOpen(false);
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
      return createTask(effectiveLeadId, payload);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({
        queryKey: ["lead-tasks", effectiveLeadId],
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({
        queryKey: ["lead-detail", effectiveLeadId],
      });
      queryClient.invalidateQueries({
        queryKey: ["lead-history", effectiveLeadId],
      });
      onOpenChange(false);
      onSuccess?.(saved);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!effectiveLeadId) return;
    mutation.mutate();
  };

  const clearDueDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDueDate(undefined);
  };

  const displayedLeadName =
    leadName ??
    pickedLead?.full_name ??
    (pickedLead
      ? [pickedLead.first_name, pickedLead.last_name]
          .filter(Boolean)
          .join(" ")
          .trim()
      : "") ??
    pickedLead?.email ??
    "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("tasks.form.editTitle") : t("tasks.form.createTitle")}
            {displayedLeadName && !isEdit && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                — {displayedLeadName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Lead picker — only when leadId not pre-provided */}
          {!leadId && !isEdit && (
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
                        ? displayedLeadName
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
                <PopoverContent className="w-[400px] p-0 flex flex-col overflow-hidden" align="start">
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
                    onWheel={handleLeadListWheel}
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
                      ? format(dueDate, "PPP")
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
                {workspaceMembers.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    {t("tasks.form.noMembers")}
                  </div>
                ) : (
                  workspaceMembers.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.user_first_name} {m.user_last_name}
                    </SelectItem>
                  ))
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
              disabled={!title.trim() || !effectiveLeadId || mutation.isPending}
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
