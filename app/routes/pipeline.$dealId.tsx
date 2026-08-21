import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Send,
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
  parseDealValue,
  formatDealValueInput,
  type DealListItem,
} from "~/lib/api/deals";
import {
  patchDealInLists,
  restoreSnapshots,
  type ListSnapshots,
} from "~/lib/deals/optimistic";
import { useDealStages } from "~/lib/hooks/usePipelineStages";
import {
  resolveStageColors,
  resolveStageColorsByKey,
} from "~/lib/pipeline-stages/colors";
import {
  resolveStageLabel,
  resolveStageLabelByKey,
} from "~/lib/pipeline-stages/labels";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ActivityPanel } from "~/components/organism/activity-panel";
import { useComposeEmail } from "~/components/organism/compose-email/use-compose-email";
import { composeInvalidateKeys } from "~/components/organism/activity-panel/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
import { DealContactSection } from "~/components/organism/deal-contact-section";
import { DealProductsSection } from "~/components/organism/deal-products-section";
import { DealCustomerSection } from "~/components/organism/deal-customer-section";
import { DealInvoicesSection } from "~/components/organism/deal-invoices-section";
import type { WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";
import {
  DatePickerPopover,
  apiDatetimeToIsoDateString,
} from "~/components/molecule/date-picker-popover";
import { cn } from "~/lib/utils";
import {
  formatCurrency,
  formatDate,
  formatMoneyFromMinor,
} from "~/lib/utils/format";

export function meta() {
  return [
    { title: "Deal - Repraesent" },
    { name: "description", content: "Deal details" },
  ];
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

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
  const { openCompose } = useComposeEmail();
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useAuthContext();
  const canEdit = useCanEditLeads();
  const { visible: dealStages, byKey: dealStagesByKey } = useDealStages();

  const [title, setTitle] = useState("");
  const [valueStr, setValueStr] = useState("");
  const [assignee, setAssignee] = useState("unassigned");
  const [stage, setStage] = useState<string>("new");
  const [expectedClose, setExpectedClose] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  // The form values as last persisted (server load or successful autosave).
  // Autosave compares the live fields against this snapshot to decide whether
  // there's an actual change to push, which also prevents the post-save refetch
  // from re-triggering a save.
  const lastSaved = useRef<{
    title: string;
    valueStr: string;
    assignee: string;
    expectedClose: string;
  } | null>(null);

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
  const dealContacts = dealQuery.data?.contacts ?? [];
  const dealProducts = dealQuery.data?.products ?? [];

  const dealHistoryQuery = useQuery({
    queryKey: ["deal-history", dealId],
    queryFn: () => getDealHistory(dealId!),
    enabled: !!dealId && hasAccess && !!deal,
  });

  useEffect(() => {
    if (!deal) return;
    const nextTitle = str(deal.title);
    const v = deal.value;
    const nextValueStr =
      v != null && v !== "" ? formatDealValueInput(String(v)) : "";
    const nextAssignee = deal.assigned_to
      ? String(deal.assigned_to)
      : "unassigned";
    const nextExpectedClose = apiDatetimeToIsoDateString(
      deal.expected_close_date,
    );
    setTitle(nextTitle);
    setValueStr(nextValueStr);
    setAssignee(nextAssignee);
    setStage(str(deal.stage) || "new");
    setExpectedClose(nextExpectedClose);
    lastSaved.current = {
      title: nextTitle,
      valueStr: nextValueStr,
      assignee: nextAssignee,
      expectedClose: nextExpectedClose,
    };
  }, [deal]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["deal", dealId] });
    void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
    void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
    void queryClient.invalidateQueries({ queryKey: ["deal-history", dealId] });
  };

  // Shared with the board and the side panels — one way to patch the cached
  // lists, one way to roll them back.
  const applyOptimisticDeal = (patch: Partial<DealListItem>): ListSnapshots =>
    patchDealInLists(queryClient, dealId!, patch);
  const rollbackSnapshots = (snapshots: ListSnapshots) =>
    restoreSnapshots(queryClient, snapshots);

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
      toast.loading(t("pipeline.dealSaving", { defaultValue: "Saving…" }), {
        id: "deal-fields-save",
      });
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
      toast.success(t("pipeline.dealSaved", { defaultValue: "Deal saved." }), {
        id: "deal-fields-save",
      });
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.snapshots) rollbackSnapshots(ctx.snapshots);
      if (
        error instanceof Error &&
        (error.message === "title required" ||
          error.message === "value negative")
      ) {
        toast.dismiss("deal-fields-save");
        return;
      }
      toast.error(
        t("pipeline.errors.saveFailed", {
          defaultValue: "Could not save deal.",
        }),
        { id: "deal-fields-save" },
      );
    },
    onSettled: () => {
      invalidate();
    },
  });

  const stageMutation = useMutation({
    mutationFn: async (next: string) => {
      if (!dealId) throw new Error("missing deal");
      // The backend derives status + won_at/lost_at from the stage's category.
      await patchDeal(dealId, { stage: next });
    },
    onMutate: async (next: string) => {
      await queryClient.cancelQueries({ queryKey: ["deals-pipeline"] });
      await queryClient.cancelQueries({ queryKey: ["contact-deals"] });
      const category = dealStagesByKey.get(next)?.category;
      const patch: Partial<DealListItem> =
        category === "won" || category === "lost"
          ? { stage: next, status: category }
          : { stage: next, status: "new" };
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

  // Debounced autosave for the Deal details card. Fires ~800ms after the user
  // stops editing, but only when the fields actually differ from the last
  // persisted snapshot and pass validation (non-empty title, non-negative
  // value). Updating the snapshot before mutating stops the post-save refetch
  // from looping back into another save.
  const saveFields = saveFieldsMutation.mutate;
  useEffect(() => {
    if (!canEdit || !deal || !lastSaved.current) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const num = parseDealValue(valueStr);
    if (num != null && num < 0) return;

    const base = lastSaved.current;
    const baseNum = parseDealValue(base.valueStr);
    const valChanged =
      num !== null && baseNum !== null
        ? num !== baseNum
        : num !== baseNum || valueStr.trim() !== base.valueStr.trim();
    const dirty =
      title !== base.title ||
      valChanged ||
      assignee !== base.assignee ||
      expectedClose !== base.expectedClose;
    if (!dirty) return;

    const handle = setTimeout(() => {
      lastSaved.current = { title, valueStr, assignee, expectedClose };
      saveFields();
    }, 800);
    return () => clearTimeout(handle);
  }, [title, valueStr, assignee, expectedClose, canEdit, deal, saveFields]);

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
    [contact?.first_name, contact?.last_name].filter(Boolean).join(" ").trim();

  const displayTitle =
    title.trim() ||
    t("pipeline.untitledDeal", { defaultValue: "Untitled deal" });

  // Every attached contact with an address is prefilled, each removable in the
  // composer — a deal conversation usually involves all of them, and dropping
  // one is cheaper than hunting for the missing person.
  const composeRecipients = dealContacts
    .filter((c) => !!c.primary_email)
    .map((c) => ({ email: c.primary_email!, name: c.full_name }));

  const openComposer = () =>
    openCompose({
      to: composeRecipients,
      dealId,
      contextLabel: t("compose.contextDeal", {
        defaultValue: "Deal: {{title}}",
        title: displayTitle,
      }),
      invalidateKeys: composeInvalidateKeys({ dealId }, "deal"),
    });

  const titleEmpty = title.trim().length === 0;
  const numericValue = parseDealValue(valueStr);
  const valueNegative = numericValue != null && numericValue < 0;
  // Lines carry their own currency; the legacy formatter assumes EUR and is
  // only right for deals with no Stripe lines on them.
  const linesCurrency = dealProducts.find((p) => p.currency)?.currency ?? null;
  const valueDisplay =
    numericValue == null
      ? "—"
      : linesCurrency
        ? formatMoneyFromMinor(Math.round(numericValue * 100), linesCurrency)
        : formatCurrency(numericValue);

  const assigneeMember = workspaceMembers.find((m) => m.user_id === assignee);
  const assigneeName = assigneeMember
    ? [assigneeMember.user_first_name, assigneeMember.user_last_name]
        .filter(Boolean)
        .join(" ") || assigneeMember.user_email
    : null;

  const createdAt = deal.created_at as string | null | undefined;
  const updatedAt = deal.updated_at as string | null | undefined;

  const stageRow = dealStagesByKey.get(stage);
  const stageFacets = stageRow
    ? resolveStageColors(stageRow)
    : resolveStageColorsByKey("deal", stage);
  const stageLabel = stageRow
    ? resolveStageLabel(stageRow, t)
    : resolveStageLabelByKey("deal", stage, t);

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
      <section className="app-fade-up overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
        <div
          aria-hidden
          className={cn(
            "relative h-20 bg-linear-to-r transition-colors duration-500",
            stageFacets.heroBg,
          )}
        />
        <div className="px-4 pb-5 pt-0 sm:px-6">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
            <Avatar
              size="lg"
              className={cn(
                "size-20 shrink-0 border-4 border-card bg-card shadow-(--shadow) ring-4",
                stageFacets.ring,
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

            <div className="flex shrink-0 items-center gap-3 sm:flex-row-reverse">
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {t("pipeline.fields.value", { defaultValue: "Value" })}
                </p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
                  {valueDisplay}
                </p>
              </div>
              {canEdit && composeRecipients.length > 0 ? (
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={openComposer}
                >
                  <Send className="h-3.5 w-3.5" />
                  {t("compose.emailAction", { defaultValue: "Email" })}
                </Button>
              ) : null}
            </div>
          </div>

          {/* STAGE STEPPER */}
          <div className="mt-5">
            <div className="flex w-full overflow-hidden rounded-xl border border-border bg-background/40">
              {dealStages.map((stageOption, idx) => {
                const active = stageOption.key === stage;
                const isLast = idx === dealStages.length - 1;
                const facets = resolveStageColors(stageOption);
                return (
                  <button
                    key={stageOption.id}
                    type="button"
                    disabled={!canEdit || stageMutation.isPending || active}
                    onClick={() => {
                      setStage(stageOption.key);
                      stageMutation.mutate(stageOption.key);
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
                        facets.dot,
                        active &&
                          "scale-125 ring-2 ring-offset-1 ring-offset-card",
                        active && facets.ring,
                      )}
                    />
                    <span className="truncate">
                      {resolveStageLabel(stageOption, t)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-5">
        {/* LEFT — main */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-3">
          <section className="app-fade-up app-fade-up-d1 rounded-2xl border border-border bg-card shadow-(--shadow)">
            <header className="border-b border-border px-4 py-3.5 sm:px-5">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {t("pipeline.dealDetails", { defaultValue: "Deal details" })}
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t("pipeline.dealDetailsHint", {
                  defaultValue:
                    "Title, value, owner and expected close for this deal.",
                })}
              </p>
            </header>

            <div className="p-4 sm:p-5">
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
                    aria-invalid={titleEmpty}
                  />
                  {titleEmpty ? (
                    <p className="text-[11px] text-destructive">
                      {t("pipeline.errors.titleRequired", {
                        defaultValue: "Title can't be blank.",
                      })}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="deal-detail-value">
                    {t("pipeline.fields.value", {
                      defaultValue: "Value (EUR)",
                    })}
                  </Label>
                  <Input
                    id="deal-detail-value"
                    value={valueStr}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
                      setValueStr(formatDealValueInput(e.target.value));
                    }}
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
                        {t("contacts.unassigned", {
                          defaultValue: "Unassigned",
                        })}
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
                </div>
              </div>
            </div>
          </section>

          <ActivityPanel
            variant="deal"
            dealId={dealId}
            contextLabel={t("compose.contextDeal", {
              defaultValue: "Deal: {{title}}",
              title: displayTitle,
            })}
            composeRecipients={composeRecipients}
            canEdit={canEdit}
            workspaceMembers={workspaceMembers}
            history={dealHistoryQuery.data ?? []}
            historyLoading={dealHistoryQuery.isLoading}
          />
        </div>

        {/* RIGHT — sidebar */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          <div className="space-y-4 sm:space-y-6">
            {/* Contacts */}
            <DealContactSection
              dealId={dealId}
              contacts={dealContacts}
              canEdit={canEdit}
            />

            {/* Stripe customer — who the deal is invoiced to. */}
            <DealCustomerSection
              dealId={dealId}
              customer={dealQuery.data?.customer ?? null}
              suggestion={dealQuery.data?.customer_suggestion ?? null}
              canEdit={canEdit}
            />

            {/* Products — same attachment idiom as contacts, and the source of
                the deal value once anything is on it. */}
            <DealProductsSection
              dealId={dealId}
              products={dealProducts}
              canEdit={canEdit}
            />

            {/* Invoices & subscriptions raised from the lines above. */}
            {dealQuery.data ? (
              <DealInvoicesSection
                dealId={dealId}
                invoices={dealQuery.data.invoices ?? []}
                readiness={
                  dealQuery.data.invoice_readiness ?? {
                    kind: null,
                    blockers: ["no_customer"],
                    currency: null,
                    total: null,
                    one_time_count: 0,
                    recurring_count: 0,
                  }
                }
                products={dealProducts}
                customer={dealQuery.data.customer ?? null}
                canEdit={canEdit}
              />
            ) : null}

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
                      stageFacets.text,
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        stageFacets.dot,
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

      {canEdit ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            {t("common.delete", { defaultValue: "Delete" })}
          </Button>
        </div>
      ) : null}

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
