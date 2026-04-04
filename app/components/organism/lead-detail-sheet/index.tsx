import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  getLead,
  getLeadHistory,
  type Lead,
  type LeadHistoryItem,
  type LeadStatus,
} from "~/lib/api/leads";
import { LeadNotesSection } from "~/components/organism/lead-notes-section";
import { LeadTasksSection } from "~/components/organism/tasks/lead-tasks-section";
import { LeadStatusSelect } from "~/components/molecule/lead-status-select";
import type { LeadStatus as LeadStatusType } from "~/lib/leads/constants";
import type { TFunction } from "i18next";
import TooltipContainer from "~/components/tooltip-container";
import { ExternalLink } from "lucide-react";
import { formatDate, formatRelativeTime } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import type { WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";

function getHistoryItemInitials(item: LeadHistoryItem): string {
  const first = item.user_first_name?.trim() ?? "";
  const last = item.user_last_name?.trim() ?? "";
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (last) return last.slice(0, 2).toUpperCase();
  return "S";
}

function formatHistoryAction(item: LeadHistoryItem, t: TFunction): string {
  if (item.action === "lead_created")
    return t("leads.detail.historyLeadCreated");
  if (item.action === "lead_status_updated") {
    const oldStatus = item.details?.old_status as string | undefined;
    const newStatus = item.details?.new_status as string | undefined;
    const oldLabel = oldStatus
      ? t(`leads.statuses.${oldStatus}`, { defaultValue: oldStatus })
      : "";
    const newLabel = newStatus
      ? t(`leads.statuses.${newStatus}`, { defaultValue: newStatus })
      : "";
    if (oldLabel && newLabel)
      return t("leads.detail.historyStatusChanged", { oldLabel, newLabel });
    if (newLabel) return t("leads.detail.historyStatusChangedTo", { newLabel });
    return t("leads.detail.historyStatusUpdated");
  }
  if (item.action === "note_created") return t("leads.detail.historyNoteAdded");
  if (item.action === "note_updated")
    return t("leads.detail.historyNoteEdited");
  if (item.action === "note_deleted")
    return t("leads.detail.historyNoteDeleted");
  if (item.action === "task_assignee_removed")
    return t("leads.detail.historyTaskAssigneeRemoved", { defaultValue: "Task assignee removed" });
  return item.action.replace(/_/g, " ");
}

function buildUserLabel(item: LeadHistoryItem, t: TFunction): string {
  const name = [item.user_first_name, item.user_last_name].filter(Boolean).join(" ").trim()
    || item.user_email
    || t("leads.detail.system");
  return item.user_is_deleted ? `${name} (${t("common.deleted", { defaultValue: "Deleted" })})` : name;
}

interface LeadDetailSheetProps {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: (id: string, status: LeadStatus) => void;
  isStatusUpdating?: boolean;
  canEdit?: boolean;
}

export function LeadDetailSheet({
  leadId,
  open,
  onOpenChange,
  onStatusChange,
  isStatusUpdating,
  canEdit = true,
}: LeadDetailSheetProps) {
  const { t } = useTranslation();
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

  const { data: workspaceData } = useQuery({
    queryKey: ["workspace-detail"],
    queryFn: () => getWorkspaceDetail(),
    enabled: open,
  });

  const workspaceMembers: WorkspaceMemberItem[] = useMemo(
    () =>
      (workspaceData?.members ?? []).map((m) => ({
        user_id: m.user_id,
        user_first_name: m.user_first_name,
        user_last_name: m.user_last_name,
        user_email: m.user_email,
        role: m.role,
      })),
    [workspaceData]
  );

  const displayName = lead
    ? lead.full_name ||
      [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() ||
      "Lead"
    : "Lead Details";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-[480px] flex flex-col overflow-hidden p-0 gap-0"
      >
        <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
          <SheetTitle className="text-base font-semibold text-foreground">
            {displayName}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {leadLoading || !lead ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-5 w-5 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
              <p className="text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Lead info */}
              <div className="px-5 py-5">
                <LeadInfoSection
                  lead={lead}
                  onStatusChange={onStatusChange}
                  isStatusUpdating={isStatusUpdating}
                />
              </div>
              {/* Tasks */}
              <div className="px-5 py-5">
                <LeadTasksSection
                  leadId={lead.id}
                  canEdit={canEdit}
                  workspaceMembers={workspaceMembers}
                />
              </div>
              {/* Notes */}
              <div className="px-5 py-5">
                <LeadNotesSection leadId={lead.id} canEdit={canEdit} />
              </div>
              {/* History */}
              <div className="px-5 py-5">
                <LeadHistorySection
                  history={history}
                  isLoading={historyLoading}
                />
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Field helpers ─────────────────────────────────────────── */

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
      <TooltipContainer tooltipContent={label}>
        <span className="text-[11px] max-w-[150px] truncate font-semibold uppercase tracking-widest text-muted-foreground pt-1.5">
          {label}
        </span>
      </TooltipContainer>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function FieldValue({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground min-h-[34px] flex items-center",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ── Lead Info Section ─────────────────────────────────────── */

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
  const { t } = useTranslation();
  const currentStatus = lead.status as LeadStatusType;
  const metadata = lead.metadata as Record<string, unknown> | null | undefined;
  const metadataEntries =
    metadata && typeof metadata === "object" ? Object.entries(metadata) : [];
  // Hide empty metadata entries (null, undefined, empty string, empty object)
  const visibleMetadataEntries = metadataEntries.filter(([, v]) => {
    if (v == null || v === "") return false;
    if (typeof v === "object" && v !== null && Object.keys(v).length === 0)
      return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("leads.detail.leadInformation")}
        </h3>
        {!withoutLink && (
          <Link
            to={`/lead-form/${lead.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
          >
            {t("leads.detail.fullPage")} <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="space-y-2.5">
        <FieldRow label={t("leads.columns.status")}>
          {onStatusChange ? (
            <LeadStatusSelect
              value={lead.status}
              onValueChange={(status) => onStatusChange(lead.id, status)}
              disabled={isStatusUpdating}
              className="w-full"
            />
          ) : (
            <FieldValue>
              {t(`leads.statuses.${currentStatus}`, {
                defaultValue: lead.status,
              })}
            </FieldValue>
          )}
        </FieldRow>

        <FieldRow label={t("leads.columns.fullName")}>
          <FieldValue>{lead.full_name || "—"}</FieldValue>
        </FieldRow>

        <FieldRow label={t("leads.columns.email")}>
          <FieldValue className="break-all">{lead.email || "—"}</FieldValue>
        </FieldRow>

        <FieldRow label={t("leads.columns.phone")}>
          <FieldValue>{lead.phone || "—"}</FieldValue>
        </FieldRow>

        <FieldRow label={t("leads.columns.source")}>
          <FieldValue>
            {lead.source_label || lead.source_table || "—"}
          </FieldValue>
        </FieldRow>

        <FieldRow label={t("leads.columns.formName")}>
          <FieldValue>
            {lead.form_name
              ? lead.form_name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
              : "—"}
          </FieldValue>
        </FieldRow>

        <FieldRow label={t("leads.columns.createdAt")}>
          <FieldValue>
            {lead.created_at ? formatDate(new Date(lead.created_at), "PPp") : "—"}
          </FieldValue>
        </FieldRow>

        {visibleMetadataEntries.map(([key, value]) => (
          <FieldRow key={key} label={key}>
            <FieldValue className="whitespace-pre-wrap">
              {typeof value === "object"
                ? JSON.stringify(value)
                : String(value)}
            </FieldValue>
          </FieldRow>
        ))}
      </div>
    </div>
  );
}

/* ── History Section ───────────────────────────────────────── */

export function LeadHistorySection({
  history,
  isLoading,
  withoutLink = false,
}: {
  history: LeadHistoryItem[];
  isLoading: boolean;
  withoutLink?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {t("leads.detail.history")}
      </h3>

      {isLoading ? (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 app-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60" />
          <span className="text-sm text-muted-foreground">
            {t("common.loading")}
          </span>
        </div>
      ) : history.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("leads.detail.noHistory")}
        </p>
      ) : (
        <div
          className={cn(
            "pr-1",
            !withoutLink
              ? "overflow-y-hidden"
              : "overflow-y-auto max-h-[calc(100vh-16rem)]"
          )}
        >
          <div className="relative pl-4">
            {/* Vertical timeline line */}
            <div
              className="absolute left-[7px] top-2 bottom-2 w-px bg-border"
              aria-hidden
            />
            <div className="space-y-0">
              {history.map((item, idx) => {
                const actionText = formatHistoryAction(item, t);
                const relativeTime = item.created_at
                  ? formatRelativeTime(item.created_at)
                  : "";
                return (
                  <div key={idx} className="relative flex gap-3 pb-4 last:pb-0">
                    {/* Dot */}
                    <div className="absolute -left-[9px] top-1.5 z-10">
                      <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-border ring-2 ring-background" />
                    </div>
                    {/* Content */}
                    <div className="min-w-0 flex-1 py-0.5 pl-2">
                      <TooltipContainer
                        tooltipContent={actionText}
                        showCopyButton={false}
                      >
                        <p className="text-sm font-medium text-foreground truncate">
                          {actionText}
                        </p>
                      </TooltipContainer>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <TooltipContainer
                          tooltipContent={buildUserLabel(item, t)}
                          showCopyButton={false}
                        >
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${item.user_is_deleted ? "bg-muted/50 text-muted-foreground/60" : "bg-muted"}`}>
                            {getHistoryItemInitials(item)}
                          </span>
                        </TooltipContainer>
                        {item.user_is_deleted && (
                          <span className="text-[10px] text-muted-foreground/60">(Deleted)</span>
                        )}
                        <span>{relativeTime}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
