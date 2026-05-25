import { useEffect, useMemo, useState } from "react";
import { getContacts } from "~/lib/api/contacts-crm";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  Copy,
  ExternalLink,
  Mail,
  Phone,
  Tag,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "~/providers/auth-provider";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import {
  deleteDeal,
  getDeal,
  getDealHistory,
  patchDeal,
  patchDealContact,
  patchDealStatus,
  DEAL_STAGE_KEYS,
  parseDealValue,
  type DealListItem,
  type DealStageKey,
  type PaginatedDeals,
} from "~/lib/api/deals";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { LeadTasksSection } from "~/components/organism/tasks/lead-tasks-section";
import { LeadHistorySection } from "~/components/organism/lead-detail-sheet";
import { LeadNotesSection } from "~/components/organism/lead-notes-section";
import type { WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";
import {
  DatePickerPopover,
  apiDatetimeToIsoDateString,
} from "~/components/molecule/date-picker-popover";
import { cn } from "~/lib/utils";
import { formatCurrency, formatDate } from "~/lib/utils/format";

export function meta() {
  return [
    { title: "Deal - Repraesent" },
    { name: "description", content: "Deal details" },
  ];
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

const STAGE_COLOR: Record<DealStageKey, string> = {
  new: "bg-slate-400",
  in_progress: "bg-sky-500",
  won: "bg-emerald-600",
  lost: "bg-red-500",
};

const STAGE_TEXT: Record<DealStageKey, string> = {
  new: "text-slate-600 dark:text-slate-300",
  in_progress: "text-sky-700 dark:text-sky-300",
  won: "text-emerald-700 dark:text-emerald-300",
  lost: "text-red-700 dark:text-red-300",
};

const STAGE_RING: Record<DealStageKey, string> = {
  new: "ring-slate-400/30",
  in_progress: "ring-sky-500/30",
  won: "ring-emerald-600/30",
  lost: "ring-red-500/30",
};

const STAGE_HERO_BG: Record<DealStageKey, string> = {
  new: "from-slate-400/25 via-slate-400/10 to-primary/10 dark:from-slate-500/20 dark:via-slate-500/5 dark:to-primary/15",
  in_progress:
    "from-sky-500/25 via-sky-500/10 to-primary/10 dark:from-sky-500/20 dark:via-sky-500/5 dark:to-primary/15",
  won: "from-emerald-500/25 via-emerald-500/10 to-primary/10 dark:from-emerald-500/20 dark:via-emerald-500/5 dark:to-primary/15",
  lost: "from-red-500/25 via-red-500/10 to-primary/10 dark:from-red-500/20 dark:via-red-500/5 dark:to-primary/15",
};

function initials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface MetaRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function MetaRow({ icon, label, children }: MetaRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 text-sm font-medium text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function PipelineDealDetailPage() {
  const { t } = useTranslation();
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useAuthContext();
  const canEdit = useCanEditLeads();

  const [title, setTitle] = useState("");
  const [valueStr, setValueStr] = useState("");
  const [assignee, setAssignee] = useState("unassigned");
  const [stage, setStage] = useState<DealStageKey>("new");
  const [contactSelectValue, setContactSelectValue] = useState<string>("none");
  const [expectedClose, setExpectedClose] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const hasAccess =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "lead-form" || s.service_slug === "lead-form",
    ) ?? false;

  const workspaceQuery = useQuery({
    queryKey: ["workspace-detail"],
    queryFn: () => getWorkspaceDetail(),
    enabled: hasAccess && !!currentWorkspace,
  });

  const workspaceMembers: WorkspaceMemberItem[] = useMemo(
    () =>
      (workspaceQuery.data?.members ?? []).map((m) => ({
        user_id: m.user_id,
        user_first_name: m.user_first_name,
        user_last_name: m.user_last_name,
        user_email: m.user_email,
        role: m.role,
      })),
    [workspaceQuery.data],
  );

  const dealQuery = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => getDeal(dealId!),
    enabled: !!dealId && hasAccess,
  });

  const deal = dealQuery.data?.deal;
  const contact = dealQuery.data?.contact;

  const dealHistoryQuery = useQuery({
    queryKey: ["deal-history", dealId],
    queryFn: () => getDealHistory(dealId!),
    enabled: !!dealId && hasAccess && !!deal,
  });

  const contactsQuery = useQuery({
    queryKey: ["contacts-options"],
    queryFn: () => getContacts({ limit: 200 }),
    enabled: hasAccess,
  });
  const contactOptions = contactsQuery.data?.data ?? [];

  useEffect(() => {
    if (!deal) return;
    setTitle(str(deal.title));
    const v = deal.value;
    setValueStr(v != null && v !== "" ? String(v) : "");
    setAssignee(deal.assigned_to ? String(deal.assigned_to) : "unassigned");
    const st = str(deal.stage) as DealStageKey;
    setStage(
      (DEAL_STAGE_KEYS as readonly string[]).includes(st) ? st : "new",
    );
    setExpectedClose(apiDatetimeToIsoDateString(deal.expected_close_date));
  }, [deal]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["deal", dealId] });
    void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
    void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
    void queryClient.invalidateQueries({ queryKey: ["deal-history", dealId] });
  };

  type PipelineSnapshots = Array<[readonly unknown[], unknown]>;

  /**
   * Optimistically patch the deal inside every cached pipeline board and
   * contact-deals list so both the Kanban and the contact page reflect edits
   * made here the moment the user navigates back, without waiting for a
   * refetch. Mirrors `applyOptimisticDeal` in pipeline.tsx.
   */
  const applyOptimisticDeal = (
    patch: Partial<DealListItem>,
  ): PipelineSnapshots => {
    const snapshots: PipelineSnapshots = [];
    const now = new Date().toISOString();

    const pipelineQueries = queryClient.getQueriesData<PaginatedDeals>({
      queryKey: ["deals-pipeline"],
    });
    for (const [key, value] of pipelineQueries) {
      snapshots.push([key, value]);
      if (!value) continue;
      const nextData = value.data.map((d) =>
        d.id === dealId ? { ...d, ...patch, updated_at: now } : d,
      );
      queryClient.setQueryData<PaginatedDeals>(key, { ...value, data: nextData });
    }

    const contactQueries = queryClient.getQueriesData<DealListItem[]>({
      queryKey: ["contact-deals"],
    });
    for (const [key, value] of contactQueries) {
      snapshots.push([key, value]);
      if (!value) continue;
      const nextData = value.map((d) =>
        d.id === dealId ? { ...d, ...patch, updated_at: now } : d,
      );
      queryClient.setQueryData<DealListItem[]>(key, nextData);
    }

    return snapshots;
  };

  const rollbackSnapshots = (snapshots: PipelineSnapshots) => {
    for (const [key, value] of snapshots) {
      queryClient.setQueryData(key, value);
    }
  };

  const saveFieldsMutation = useMutation({
    mutationFn: async () => {
      if (!dealId) throw new Error("missing deal");
      const val = parseDealValue(valueStr);
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        toast.error(
          t("pipeline.errors.titleRequired", {
            defaultValue: "Please enter a deal title.",
          }),
        );
        throw new Error("title required");
      }
      if (val != null && val < 0) {
        toast.error(
          t("pipeline.errors.valueNegative", {
            defaultValue: "Value cannot be negative.",
          }),
        );
        throw new Error("value negative");
      }
      await patchDeal(dealId, {
        title: trimmedTitle,
        value: val,
        assigned_to: assignee === "unassigned" ? null : assignee,
        expected_close_date: expectedClose.trim() || null,
      });
    },
    onMutate: async () => {
      const trimmedTitle = title.trim();
      // mutationFn rejects an empty title; don't optimistically blank the card.
      if (!trimmedTitle) return;
      await queryClient.cancelQueries({ queryKey: ["deals-pipeline"] });
      await queryClient.cancelQueries({ queryKey: ["contact-deals"] });
      const val = parseDealValue(valueStr);
      const member = workspaceMembers.find((m) => m.user_id === assignee);
      const patch: Partial<DealListItem> = {
        title: trimmedTitle,
        value: val != null ? String(val) : null,
        assigned_to: assignee === "unassigned" ? null : assignee,
        assignee_first_name: member?.user_first_name ?? null,
        assignee_last_name: member?.user_last_name ?? null,
      };
      return { snapshots: applyOptimisticDeal(patch) };
    },
    onSuccess: () => {
      toast.success(t("pipeline.dealSaved", { defaultValue: "Deal saved." }));
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.snapshots) rollbackSnapshots(ctx.snapshots);
      if (
        error instanceof Error &&
        (error.message === "title required" ||
          error.message === "value negative")
      )
        return;
      toast.error(
        t("pipeline.errors.saveFailed", {
          defaultValue: "Could not save deal.",
        }),
      );
    },
    onSettled: () => {
      invalidate();
    },
  });

  const stageMutation = useMutation({
    mutationFn: async (next: DealStageKey) => {
      if (!dealId) throw new Error("missing deal");
      if (next === "won" || next === "lost") {
        await patchDealStatus(dealId, next);
      } else {
        await patchDeal(dealId, { stage: next });
      }
    },
    onMutate: async (next: DealStageKey) => {
      await queryClient.cancelQueries({ queryKey: ["deals-pipeline"] });
      await queryClient.cancelQueries({ queryKey: ["contact-deals"] });
      const patch: Partial<DealListItem> =
        next === "won" || next === "lost"
          ? { stage: next, status: next }
          : { stage: next };
      return { snapshots: applyOptimisticDeal(patch) };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.snapshots) rollbackSnapshots(ctx.snapshots);
      toast.error(
        t("pipeline.errors.saveFailed", {
          defaultValue: "Could not save deal.",
        }),
      );
    },
    onSettled: () => {
      invalidate();
    },
  });

  const contactMutation = useMutation({
    mutationFn: (contact_id: string | null) => {
      if (!dealId) throw new Error("missing deal");
      return patchDealContact(dealId, contact_id);
    },
    onMutate: async (contact_id: string | null) => {
      await queryClient.cancelQueries({ queryKey: ["deals-pipeline"] });
      await queryClient.cancelQueries({ queryKey: ["contact-deals"] });
      const opt = contact_id
        ? contactOptions.find((c) => c.id === contact_id)
        : undefined;
      const patch: Partial<DealListItem> = {
        contact_id: contact_id,
        contact_full_name: opt?.contact_full_name ?? null,
        primary_email: opt?.primary_email ?? null,
        primary_phone: opt?.primary_phone ?? null,
      };
      return { snapshots: applyOptimisticDeal(patch) };
    },
    onSuccess: () => {
      setContactSelectValue("none");
      toast.success(
        t("pipeline.contactUpdated", {
          defaultValue: "Contact link updated.",
        }),
      );
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshots) rollbackSnapshots(ctx.snapshots);
      toast.error(
        t("pipeline.errors.contactFailed", {
          defaultValue: "Could not update contact on deal.",
        }),
      );
    },
    onSettled: () => {
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDeal(dealId!),
    onSuccess: () => {
      setDeleteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
      void queryClient.removeQueries({ queryKey: ["deal", dealId] });
      toast.success(
        t("pipeline.dealDeleted", { defaultValue: "Deal removed." }),
      );
      navigate("/pipeline", { replace: true });
    },
    onError: () => {
      toast.error(
        t("pipeline.errors.deleteFailed", {
          defaultValue: "Could not delete deal.",
        }),
      );
    },
  });

  useEffect(() => {
    if (!currentWorkspace) navigate("/", { replace: true });
  }, [currentWorkspace, navigate]);

  if (!hasAccess) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("contacts.noAccess", {
          defaultValue: "This workspace does not include CRM access.",
        })}
      </div>
    );
  }

  if (!dealId) {
    navigate("/pipeline", { replace: true });
    return null;
  }

  if (dealQuery.isLoading || !deal) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="app-spin h-6 w-6 rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (dealQuery.isError) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">
          {t("pipeline.dealNotFound", {
            defaultValue: "Deal could not be loaded.",
          })}
        </p>
        <Link
          to="/pipeline"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("pipeline.backToPipeline", { defaultValue: "Back to pipeline" })}
        </Link>
      </div>
    );
  }

  const contactId = deal.contact_id ? String(deal.contact_id) : null;
  const leadId = deal.lead_id ? String(deal.lead_id) : null;
  const contactName =
    (contact?.full_name as string)?.trim() ||
    [contact?.first_name, contact?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

  const contactEmail = str(contact?.primary_email ?? contact?.email);
  const contactPhone = str(contact?.primary_phone ?? contact?.phone);

  const displayTitle =
    title.trim() ||
    contactName ||
    t("pipeline.untitledDeal", { defaultValue: "Untitled deal" });

  const titleValid = title.trim().length > 0;

  // Baseline = the field values as last loaded from the server. Used to detect
  // whether the form is "dirty" so Save stays disabled until something actually
  // changes (and re-disables itself if the user reverts their edits).
  const baseTitle = str(deal.title);
  const baseValueStr =
    deal.value != null && deal.value !== "" ? String(deal.value) : "";
  const baseAssignee = deal.assigned_to ? String(deal.assigned_to) : "unassigned";
  const baseExpectedClose = apiDatetimeToIsoDateString(deal.expected_close_date);

  // Compare value numerically so equivalent inputs (e.g. "1000", "1000.0",
  // "1,000") aren't treated as a change. Falls back to a trimmed string compare
  // when either side isn't a finite number.
  const curValue = parseDealValue(valueStr);
  const baseValue = parseDealValue(baseValueStr);
  const valueChanged =
    curValue !== null && baseValue !== null
      ? curValue !== baseValue
      : curValue !== baseValue || valueStr.trim() !== baseValueStr.trim();

  const isDirty =
    title !== baseTitle ||
    valueChanged ||
    assignee !== baseAssignee ||
    expectedClose !== baseExpectedClose;

  const numericValue = parseDealValue(valueStr);
  const valueNegative = numericValue != null && numericValue < 0;
  const valueDisplay =
    numericValue != null ? formatCurrency(numericValue, "EUR") : "—";

  const assigneeMember = workspaceMembers.find((m) => m.user_id === assignee);
  const assigneeName = assigneeMember
    ? [assigneeMember.user_first_name, assigneeMember.user_last_name]
        .filter(Boolean)
        .join(" ") || assigneeMember.user_email
    : null;

  const createdAt = deal.created_at as string | null | undefined;
  const updatedAt = deal.updated_at as string | null | undefined;

  const stageLabel = t(`pipeline.stages.${stage}`, { defaultValue: stage });

  const copy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(
        t("contacts.copied", { defaultValue: "Copied {{label}}", label }),
      );
    } catch {
      toast.error(
        t("contacts.copyFailed", { defaultValue: "Could not copy" }),
      );
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 app-fade-in">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/pipeline"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("pipeline.backToPipeline", { defaultValue: "Back to pipeline" })}
        </Link>
      </div>

      {/* HERO */}
      <div className="relative">
        <section className="app-fade-up overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
          <div
            aria-hidden
            className={cn(
              "relative h-20 bg-linear-to-r transition-colors duration-500",
              STAGE_HERO_BG[stage],
            )}
          />
          <div className="px-4 pb-5 pt-0 sm:px-6">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
            <Avatar
              size="lg"
              className={cn(
                "size-20 shrink-0 border-4 border-card bg-card shadow-(--shadow) ring-4",
                STAGE_RING[stage],
              )}
            >
              <AvatarFallback className="bg-linear-to-br from-secondary/30 to-primary/10 text-lg font-semibold tracking-tight text-foreground">
                {initials(displayTitle)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
                {displayTitle}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {createdAt ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    {t("pipeline.createdOn", {
                      defaultValue: "Created {{date}}",
                      date: formatDate(new Date(createdAt), "PP"),
                    })}
                  </span>
                ) : null}
                {assigneeName ? (
                  <span className="inline-flex items-center gap-1">
                    <UserIcon className="h-3 w-3" />
                    {assigneeName}
                  </span>
                ) : null}
                {contactName && contactId ? (
                  <Link
                    to={`/contacts/${contactId}`}
                    className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {contactName}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 text-left sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t("pipeline.fields.value", { defaultValue: "Value" })}
              </p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
                {valueDisplay}
              </p>
            </div>
          </div>

          {/* STAGE STEPPER */}
          <div className="mt-5">
            <div className="flex w-full overflow-hidden rounded-xl border border-border bg-background/40">
              {DEAL_STAGE_KEYS.map((s, idx) => {
                const active = s === stage;
                const isLast = idx === DEAL_STAGE_KEYS.length - 1;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!canEdit || stageMutation.isPending || active}
                    onClick={() => {
                      setStage(s);
                      stageMutation.mutate(s);
                    }}
                    className={cn(
                      "group relative flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors",
                      !isLast && "border-r border-border",
                      active
                        ? "bg-card text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      (!canEdit || stageMutation.isPending) &&
                        !active &&
                        "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full transition-transform",
                        STAGE_COLOR[s],
                        active && "scale-125 ring-2 ring-offset-1 ring-offset-card",
                        active && STAGE_RING[s],
                      )}
                    />
                    <span className="truncate">
                      {t(`pipeline.stages.${s}`, { defaultValue: s })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

        {canEdit ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("pipeline.deleteDeal", {
                    defaultValue: "Delete deal",
                  })}
                  className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {t("pipeline.deleteDeal", { defaultValue: "Delete deal" })}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-5">
        {/* LEFT — main */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-3">
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-5 shadow-(--shadow)">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                {t("pipeline.dealDetails", { defaultValue: "Deal details" })}
              </h2>
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => saveFieldsMutation.mutate()}
                  disabled={
                    saveFieldsMutation.isPending ||
                    !titleValid ||
                    valueNegative ||
                    !isDirty
                  }
                >
                  {saveFieldsMutation.isPending
                    ? t("common.saving")
                    : t("common.save", { defaultValue: "Save" })}
                </Button>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="deal-detail-title">
                  {t("pipeline.fields.titleRequired", {
                    defaultValue: "Title (required)",
                  })}
                </Label>
                <Input
                  id="deal-detail-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!canEdit}
                  placeholder={t("pipeline.fields.titlePlaceholder", {
                    defaultValue: "Enter deal title",
                  })}
                  required
                  aria-required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deal-detail-value">
                  {t("pipeline.fields.value", { defaultValue: "Value (EUR)" })}
                </Label>
                <Input
                  id="deal-detail-value"
                  value={valueStr}
                  onChange={(e) => setValueStr(e.target.value)}
                  disabled={!canEdit}
                  inputMode="decimal"
                  aria-invalid={valueNegative}
                  placeholder={t("pipeline.fields.valuePlaceholder", {
                    defaultValue: "0",
                  })}
                />
                {valueNegative ? (
                  <p className="text-[11px] text-destructive">
                    {t("pipeline.errors.valueNegative", {
                      defaultValue: "Value cannot be negative.",
                    })}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label>
                  {t("contacts.assignedTo", { defaultValue: "Assigned to" })}
                </Label>
                <Select
                  value={assignee}
                  onValueChange={setAssignee}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">
                      {t("contacts.unassigned", { defaultValue: "Unassigned" })}
                    </SelectItem>
                    {workspaceMembers.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {[m.user_first_name, m.user_last_name]
                          .filter(Boolean)
                          .join(" ") || m.user_email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>
                  {t("pipeline.fields.expectedClose", {
                    defaultValue: "Expected close",
                  })}
                </Label>
                <DatePickerPopover
                  valueIso={expectedClose || undefined}
                  onChange={(iso) => setExpectedClose(iso ?? "")}
                  disabled={!canEdit}
                  allowClear
                  placeholder={t("contacts.pickDate", {
                    defaultValue: "Pick date",
                  })}
                />
                {canEdit ? (
                  <p className="text-[11px] text-muted-foreground">
                    {t("pipeline.fields.expectedCloseHint", {
                      defaultValue: "Saved with Save above.",
                    })}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-(--shadow)">
            <Tabs defaultValue="tasks" className="w-full">
              <TabsList variant="line" className="w-full mb-4 sm:mb-5">
                <TabsTrigger value="tasks">{t("tasks.title")}</TabsTrigger>
                <TabsTrigger value="notes">
                  {t("leads.detail.notes")}
                </TabsTrigger>
                <TabsTrigger value="history">
                  {t("leads.detail.history")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="tasks" className="mt-0">
                <LeadTasksSection
                  dealId={dealId}
                  canEdit={canEdit}
                  workspaceMembers={workspaceMembers}
                  linkedContextLabel={displayTitle}
                />
              </TabsContent>
              <TabsContent value="notes" className="mt-0">
                <LeadNotesSection dealId={dealId} canEdit={canEdit} />
              </TabsContent>
              <TabsContent value="history" className="mt-0">
                <LeadHistorySection
                  history={dealHistoryQuery.data ?? []}
                  isLoading={dealHistoryQuery.isLoading}
                  withoutLink
                />
              </TabsContent>
            </Tabs>
          </section>
        </div>

        {/* RIGHT — sidebar */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          <div className="lg:sticky lg:top-6 space-y-4 sm:space-y-6">
            {/* Linked contact */}
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-(--shadow) space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">
                  {t("pipeline.linkedContact", { defaultValue: "Contact" })}
                </h2>
                {contactId && canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => contactMutation.mutate(null)}
                    disabled={contactMutation.isPending}
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  >
                    {t("pipeline.detachContact", { defaultValue: "Detach" })}
                  </Button>
                ) : null}
              </div>

              {contactId && contact ? (
                <div className="space-y-3">
                  <Link
                    to={`/contacts/${contactId}`}
                    className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3 transition-all hover:border-border hover:bg-card hover:shadow-(--shadow-sm)"
                  >
                    <Avatar className="size-10 shrink-0">
                      <AvatarFallback className="bg-linear-to-br from-secondary/30 to-primary/10 text-sm font-semibold">
                        {initials(contactName || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                        {contactName || contactId}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t("pipeline.openContact", {
                          defaultValue: "Open contact",
                        })}
                      </p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>

                  {contactEmail ? (
                    <div className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 px-3 py-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {t("contacts.primaryEmailLabel", {
                            defaultValue: "Email",
                          })}
                        </p>
                        <p className="truncate text-sm font-medium">
                          {contactEmail}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <a
                          href={`mailto:${contactEmail}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={t("contacts.sendEmail", {
                            defaultValue: "Send email",
                          })}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => copy(contactEmail, "email")}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Copy email"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {contactPhone ? (
                    <div className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 px-3 py-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {t("contacts.primaryPhoneLabel", {
                            defaultValue: "Phone",
                          })}
                        </p>
                        <p className="truncate text-sm font-medium">
                          {contactPhone}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <a
                          href={`tel:${contactPhone.replace(/\s+/g, "")}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={t("contacts.callPhone", {
                            defaultValue: "Call",
                          })}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => copy(contactPhone, "phone")}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Copy phone"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : canEdit ? (
                <div className="space-y-2">
                  <Select
                    value={contactSelectValue}
                    onValueChange={(v) => {
                      setContactSelectValue(v);
                      if (v && v !== "none") contactMutation.mutate(v);
                    }}
                    disabled={
                      contactMutation.isPending || contactsQuery.isLoading
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          contactsQuery.isLoading
                            ? t("common.loading")
                            : t("pipeline.selectContact", {
                                defaultValue: "Link a contact…",
                              })
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t("pipeline.noContactOption", {
                          defaultValue: "No contact",
                        })}
                      </SelectItem>
                      {contactOptions.map((c) => {
                        const label =
                          (c.contact_full_name || "").trim() ||
                          c.primary_email ||
                          c.primary_phone ||
                          c.id;
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {contactOptions.length === 0 && !contactsQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">
                      {t("pipeline.noContactsAvailable", {
                        defaultValue:
                          "No contacts yet. Create one from the contacts page.",
                      })}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  {t("pipeline.noContactAttached", {
                    defaultValue: "No contact linked.",
                  })}
                </p>
              )}
            </section>

            {/* Key facts */}
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-(--shadow) space-y-4">
              <h2 className="text-sm font-semibold">
                {t("pipeline.summary", { defaultValue: "Summary" })}
              </h2>

              <div className="space-y-3">
                <MetaRow
                  icon={<Tag />}
                  label={t("pipeline.fields.stage", { defaultValue: "Stage" })}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5",
                      STAGE_TEXT[stage],
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        STAGE_COLOR[stage],
                      )}
                    />
                    {stageLabel}
                  </span>
                </MetaRow>

                <MetaRow
                  icon={<CalendarClock />}
                  label={t("pipeline.fields.expectedClose", {
                    defaultValue: "Expected close",
                  })}
                >
                  {expectedClose
                    ? formatDate(new Date(expectedClose), "PP")
                    : "—"}
                </MetaRow>

                <MetaRow
                  icon={<UserIcon />}
                  label={t("contacts.assignedTo", {
                    defaultValue: "Assigned to",
                  })}
                >
                  {assigneeName ?? (
                    <span className="italic text-muted-foreground">
                      {t("contacts.unassigned", { defaultValue: "Unassigned" })}
                    </span>
                  )}
                </MetaRow>

                {leadId ? (
                  <MetaRow
                    icon={<ExternalLink />}
                    label={t("pipeline.linkedLead", { defaultValue: "Lead" })}
                  >
                    <Link
                      to={`/lead-form/${leadId}`}
                      className="text-primary hover:underline"
                    >
                      {t("contacts.openLead", { defaultValue: "Open lead" })}
                    </Link>
                  </MetaRow>
                ) : null}
              </div>

              {(createdAt || updatedAt) && (
                <div className="space-y-1 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                  {createdAt ? (
                    <p>
                      {t("common.created", { defaultValue: "Created" })}:{" "}
                      <span className="text-foreground/80">
                        {formatDate(new Date(createdAt), "PPp")}
                      </span>
                    </p>
                  ) : null}
                  {updatedAt ? (
                    <p>
                      {t("common.updated", { defaultValue: "Updated" })}:{" "}
                      <span className="text-foreground/80">
                        {formatDate(new Date(updatedAt), "PPp")}
                      </span>
                    </p>
                  ) : null}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("pipeline.deleteDealConfirmTitle", {
                defaultValue: "Delete this deal?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("pipeline.deleteDealConfirmDescription", {
                title: displayTitle,
                defaultValue:
                  '"{{title}}" will be permanently removed from your pipeline.',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
