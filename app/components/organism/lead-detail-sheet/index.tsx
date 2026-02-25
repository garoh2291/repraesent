import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { getLead, getLeadHistory, type Lead, type LeadHistoryItem } from "~/lib/api/leads";
import { LEAD_STATUS_LABELS } from "~/lib/leads/constants";
import TooltipContainer from "~/components/tooltip-container";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

function formatUserName(item: LeadHistoryItem): string {
  const first = item.user_first_name?.trim() ?? "";
  const last = item.user_last_name?.trim() ?? "";
  if (first || last) {
    return [first, last].filter(Boolean).join(" ").trim();
  }
  return "";
}

function formatHistoryAction(item: LeadHistoryItem): string {
  const userName = formatUserName(item);

  if (item.action === "lead_created") {
    return userName
      ? `User ${userName} created the lead`
      : "Lead created";
  }
  if (item.action === "lead_status_updated") {
    const oldStatus = item.details?.old_status as string | undefined;
    const newStatus = item.details?.new_status as string | undefined;
    const oldLabel = oldStatus
      ? (LEAD_STATUS_LABELS[oldStatus as keyof typeof LEAD_STATUS_LABELS] ?? oldStatus)
      : "";
    const newLabel = newStatus
      ? (LEAD_STATUS_LABELS[newStatus as keyof typeof LEAD_STATUS_LABELS] ?? newStatus)
      : "";
    const statusPart =
      oldLabel && newLabel
        ? `changed status from ${oldLabel} to ${newLabel}`
        : "updated the status";
    return userName
      ? `User ${userName} ${statusPart}`
      : statusPart;
  }
  return item.action.replace(/_/g, " ");
}

interface LeadDetailSheetProps {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadDetailSheet({ leadId, open, onOpenChange }: LeadDetailSheetProps) {
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
              <LeadInfoSection lead={lead} />
              <HistorySection history={history} isLoading={historyLoading} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LeadInfoSection({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Lead Information
      </h3>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Full Name</dt>
          <dd className="font-medium">{lead.full_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-medium break-all">{lead.email || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Phone</dt>
          <dd className="font-medium">{lead.phone || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Source</dt>
          <dd className="font-medium">
            {lead.source_label || lead.source_table || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium">
            {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] ??
              lead.status}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd className="font-medium">
            {lead.created_at
              ? format(new Date(lead.created_at), "PPp")
              : "—"}
          </dd>
        </div>
        {Object.keys(lead.metadata || {}).length > 0 && (
          <div>
            <dt className="text-muted-foreground mb-1">Metadata</dt>
            <dd>
              <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                {JSON.stringify(lead.metadata, null, 2)}
              </pre>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function HistorySection({
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
        <div className="space-y-3">
          {history.map((item, idx) => {
            const actionText = formatHistoryAction(item);
            return (
              <div
                key={idx}
                className="flex gap-3 text-sm border-l-2 pl-3 py-1 border-muted"
              >
                <div className="flex-1 min-w-0">
                  <TooltipContainer
                    tooltipContent={actionText}
                    disableTooltip={actionText.length < 60}
                    showCopyButton={false}
                  >
                    <p className="font-medium truncate">{actionText}</p>
                  </TooltipContainer>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.created_at
                      ? format(new Date(item.created_at), "PPp")
                      : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
