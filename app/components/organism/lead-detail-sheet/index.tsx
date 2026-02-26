import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  getLead,
  getLeadHistory,
  type Lead,
  type LeadHistoryItem,
  type LeadStatus,
} from "~/lib/api/leads";
import { LeadNotesSection } from "~/components/organism/lead-notes-section";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_COLORS,
  type LeadStatus as LeadStatusType,
} from "~/lib/leads/constants";
import TooltipContainer from "~/components/tooltip-container";
import { format, formatDistanceToNow } from "date-fns";
import { ExternalLink, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

function getHistoryItemInitials(item: LeadHistoryItem): string {
  const first = item.user_first_name?.trim() ?? "";
  const last = item.user_last_name?.trim() ?? "";
  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  if (first) return first.slice(0, 2).toUpperCase();
  if (last) return last.slice(0, 2).toUpperCase();
  return "S";
}

function formatHistoryAction(item: LeadHistoryItem): string {
  if (item.action === "lead_created") {
    return "Lead created";
  }
  if (item.action === "lead_status_updated") {
    const oldStatus = item.details?.old_status as string | undefined;
    const newStatus = item.details?.new_status as string | undefined;
    const oldLabel = oldStatus
      ? (LEAD_STATUS_LABELS[oldStatus as keyof typeof LEAD_STATUS_LABELS] ??
        oldStatus)
      : "";
    const newLabel = newStatus
      ? (LEAD_STATUS_LABELS[newStatus as keyof typeof LEAD_STATUS_LABELS] ??
        newStatus)
      : "";
    if (oldLabel && newLabel) {
      return `Status changed from ${oldLabel} to ${newLabel}`;
    }
    if (newLabel) {
      return `Status changed to ${newLabel}`;
    }
    return "Status updated";
  }
  if (item.action === "note_created") {
    return "Note added";
  }
  if (item.action === "note_updated") {
    return "Note edited";
  }
  if (item.action === "note_deleted") {
    return "Note deleted";
  }
  return item.action.replace(/_/g, " ");
}

interface LeadDetailSheetProps {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: (id: string, status: LeadStatus) => void;
  isStatusUpdating?: boolean;
}

export function LeadDetailSheet({
  leadId,
  open,
  onOpenChange,
  onStatusChange,
  isStatusUpdating,
}: LeadDetailSheetProps) {
  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => getLead(leadId!),
    enabled: !!leadId && open,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["lead-history", leadId],
    queryFn: () => getLeadHistory(leadId!),
    enabled: !!leadId && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-md flex flex-col overflow-hidden"
      >
        <SheetHeader>
          <SheetTitle>Lead Details</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto space-y-6 p-4">
          {leadLoading || !lead ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <LeadInfoSection
                lead={lead}
                onStatusChange={onStatusChange}
                isStatusUpdating={isStatusUpdating}
              />
              <LeadNotesSection leadId={lead.id} />
              <LeadHistorySection
                history={history}
                isLoading={historyLoading}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const fieldValueClass = "bg-muted/50 rounded-md px-2 py-1.5 text-sm";

export function LeadInfoSection({
  lead,
  onStatusChange,
  isStatusUpdating,
  withoutLink = false,
}: {
  lead: Lead;
  onStatusChange?: (id: string, status: LeadStatus) => void;
  isStatusUpdating?: boolean;
  withoutLink?: boolean;
}) {
  const currentStatus = lead.status as LeadStatusType;
  const metadata = lead.metadata as Record<string, unknown> | null | undefined;
  const metadataEntries =
    metadata && typeof metadata === "object" ? Object.entries(metadata) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Lead Information
        </h3>
        {!withoutLink && (
          <Link
            to={`/lead-form/${lead.id}`}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            View full page <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground mb-1">Status</dt>
          <dd>
            {onStatusChange ? (
              <Select
                value={lead.status}
                onValueChange={(value) =>
                  onStatusChange(lead.id, value as LeadStatus)
                }
                disabled={isStatusUpdating}
              >
                <SelectTrigger
                  className={cn("w-full border-l-4 border-l-transparent", {
                    "border-l-blue-500": currentStatus === "new_lead",
                    "border-l-amber-500": currentStatus === "pending",
                    "border-l-violet-500": currentStatus === "in_progress",
                    "border-l-red-500": currentStatus === "rejected",
                    "border-l-orange-500": currentStatus === "on_hold",
                    "border-l-gray-500": currentStatus === "stale",
                    "border-l-emerald-500": currentStatus === "success",
                    "border-l-muted": currentStatus === "hidden",
                  })}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            LEAD_STATUS_COLORS[s]
                          )}
                        />
                        {LEAD_STATUS_LABELS[s]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className={cn(fieldValueClass, "inline-block")}>
                {LEAD_STATUS_LABELS[currentStatus] ?? lead.status}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground mb-1">Full Name</dt>
          <dd className={fieldValueClass}>{lead.full_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground mb-1">Email</dt>
          <dd className={cn(fieldValueClass, "break-all whitespace-pre-wrap")}>
            {lead.email || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground mb-1">Phone</dt>
          <dd className={fieldValueClass}>{lead.phone || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground mb-1">Source</dt>
          <dd className={fieldValueClass}>
            {lead.source_label || lead.source_table || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground mb-1">Created</dt>
          <dd className={fieldValueClass}>
            {lead.created_at ? format(new Date(lead.created_at), "PPp") : "—"}
          </dd>
        </div>
        {metadataEntries.length > 0 &&
          metadataEntries.map(([key, value]) => (
            <div key={key}>
              <dt className="text-muted-foreground mb-1">{key}</dt>
              <dd className={cn(fieldValueClass, "whitespace-pre-wrap")}>
                {value == null
                  ? "—"
                  : typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
              </dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

export function LeadHistorySection({
  history,
  isLoading,
}: {
  history: LeadHistoryItem[];
  isLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        History
      </h3>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No history yet.</p>
      ) : (
        <div className="overflow-y-auto max-h-[calc(100vh-16rem)] pr-2">
          <div className="space-y-3">
            {history.map((item, idx) => {
              const actionText = formatHistoryAction(item);
              const relativeTime = item.created_at
                ? formatDistanceToNow(new Date(item.created_at), {
                    addSuffix: true,
                  })
                : "";
              return (
                <div
                  key={idx}
                  className="rounded-lg border bg-muted/30 p-3 transition-colors"
                >
                  <TooltipContainer
                    tooltipContent={actionText}
                    showCopyButton={false}
                  >
                    <p className="text-sm font-medium truncate">{actionText}</p>
                  </TooltipContainer>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 flex-wrap">
                    <TooltipContainer
                      tooltipContent={
                        item.user_first_name && item.user_last_name
                          ? item.user_first_name + " " + item.user_last_name
                          : "System"
                      }
                      showCopyButton={false}
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                        {getHistoryItemInitials(item)}
                      </span>
                    </TooltipContainer>
                    <span>{relativeTime}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
