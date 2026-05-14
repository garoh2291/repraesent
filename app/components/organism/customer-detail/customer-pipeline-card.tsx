import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Activity,
  UserCog,
  Coins,
  Calendar,
  CalendarClock,
  CheckCircle2,
  StickyNote,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  patchCustomer,
  type CustomerStatus,
  type PatchCustomerBody,
} from "~/lib/api/customers";
import { cn } from "~/lib/utils";
import type { WorkspaceMemberOption } from "./customer-crm-panel";

const CUSTOMER_STATUSES: CustomerStatus[] = [
  "imported",
  "active",
  "completed",
  "churned",
  "lost",
];

function isoDateInput(v: unknown): string {
  if (v == null || v === "") return "";
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function isoDateTimeLocal(v: unknown): string {
  if (v == null || v === "") return "";
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

interface CustomerPipelineCardProps {
  customerId: string;
  customer: Record<string, unknown>;
  workspaceMembers: WorkspaceMemberOption[];
  canEdit: boolean;
}

export function CustomerPipelineCard({
  customerId,
  customer,
  workspaceMembers,
  canEdit,
}: CustomerPipelineCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState(String(customer.status ?? "active"));
  const [assignedTo, setAssignedTo] = useState<string>(
    customer.assigned_to ? String(customer.assigned_to) : "unassigned",
  );
  const [notes, setNotes] = useState(String(customer.notes ?? ""));
  const [ltv, setLtv] = useState(
    customer.lifetime_value != null ? String(customer.lifetime_value) : "",
  );
  const [firstPurchase, setFirstPurchase] = useState(
    isoDateInput(customer.first_purchase_date),
  );
  const [lastPurchase, setLastPurchase] = useState(
    isoDateInput(customer.last_purchase_date),
  );
  const [lastContacted, setLastContacted] = useState(
    isoDateTimeLocal(customer.last_contacted_at),
  );
  const [reviewState, setReviewState] = useState(
    customer.review_state != null ? String(customer.review_state) : "",
  );
  const [satisfaction, setSatisfaction] = useState(
    customer.satisfaction_score != null
      ? String(customer.satisfaction_score)
      : "",
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setStatus(String(customer.status ?? "active"));
    setAssignedTo(
      customer.assigned_to ? String(customer.assigned_to) : "unassigned",
    );
    setNotes(String(customer.notes ?? ""));
    setLtv(customer.lifetime_value != null ? String(customer.lifetime_value) : "");
    setFirstPurchase(isoDateInput(customer.first_purchase_date));
    setLastPurchase(isoDateInput(customer.last_purchase_date));
    setLastContacted(isoDateTimeLocal(customer.last_contacted_at));
    setReviewState(
      customer.review_state != null ? String(customer.review_state) : "",
    );
    setSatisfaction(
      customer.satisfaction_score != null
        ? String(customer.satisfaction_score)
        : "",
    );
    setDirty(false);
  }, [customer]);

  const markDirty = () => setDirty(true);

  const mutation = useMutation({
    mutationFn: (body: PatchCustomerBody) => patchCustomer(customerId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["customer", customerId],
      });
      toast.success(t("customers.saved", { defaultValue: "Saved." }));
      setDirty(false);
    },
    onError: () => {
      toast.error(
        t("customers.saveFailed", { defaultValue: "Could not save." }),
      );
    },
  });

  const save = () => {
    const ltvNum = ltv.trim() === "" ? null : Number(ltv);
    const body: PatchCustomerBody = {
      status: status as CustomerStatus,
      assigned_to: assignedTo === "unassigned" ? null : assignedTo,
      notes: notes.trim() || null,
      lifetime_value:
        ltv.trim() === ""
          ? null
          : Number.isFinite(ltvNum)
            ? (ltvNum as number)
            : null,
      first_purchase_date: firstPurchase || null,
      last_purchase_date: lastPurchase || null,
      last_contacted_at: lastContacted
        ? new Date(lastContacted).toISOString()
        : null,
    };
    mutation.mutate(body);
  };

  return (
    <aside className="app-fade-up app-fade-up-d2 space-y-4">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary [&>svg]:h-3.5 [&>svg]:w-3.5">
            <Activity />
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-tight text-foreground">
              {t("customers.pipeline", { defaultValue: "Pipeline" })}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {t("customers.pipelineHint", {
                defaultValue: "Status, ownership and value.",
              })}
            </p>
          </div>
        </header>

        <div className="space-y-3.5 p-4">
          <SidebarField
            icon={<Activity className="h-3.5 w-3.5" />}
            label={t("customers.columns.status", { defaultValue: "Status" })}
          >
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                markDirty();
              }}
              disabled={!canEdit}
            >
              <SelectTrigger className="h-9 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SidebarField>

          <SidebarField
            icon={<UserCog className="h-3.5 w-3.5" />}
            label={t("customers.assignedTo", { defaultValue: "Assigned to" })}
          >
            <Select
              value={assignedTo}
              onValueChange={(v) => {
                setAssignedTo(v);
                markDirty();
              }}
              disabled={!canEdit}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  {t("customers.unassigned", { defaultValue: "Unassigned" })}
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
          </SidebarField>

          <SidebarField
            icon={<Coins className="h-3.5 w-3.5" />}
            label={t("customers.lifetimeValue", {
              defaultValue: "Lifetime value",
            })}
          >
            <Input
              type="number"
              step="0.01"
              value={ltv}
              onChange={(e) => {
                setLtv(e.target.value);
                markDirty();
              }}
              disabled={!canEdit}
              placeholder="0.00"
              className="h-9"
            />
          </SidebarField>

          <SidebarField
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            label={t("customers.lastContacted", {
              defaultValue: "Last contacted",
            })}
          >
            <Input
              type="datetime-local"
              value={lastContacted}
              onChange={(e) => {
                setLastContacted(e.target.value);
                markDirty();
              }}
              disabled={!canEdit}
              className="h-9"
            />
          </SidebarField>

          <div>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {moreOpen
                  ? t("customers.hidePurchaseDates", {
                      defaultValue: "Hide purchase dates",
                    })
                  : t("customers.showPurchaseDates", {
                      defaultValue: "Show purchase dates",
                    })}
              </span>
              {moreOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {moreOpen ? (
              <div className="mt-2 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <SidebarField
                  label={t("customers.firstPurchase", {
                    defaultValue: "First purchase",
                  })}
                >
                  <Input
                    type="date"
                    value={firstPurchase}
                    onChange={(e) => {
                      setFirstPurchase(e.target.value);
                      markDirty();
                    }}
                    disabled={!canEdit}
                    className="h-9"
                  />
                </SidebarField>
                <SidebarField
                  label={t("customers.lastPurchase", {
                    defaultValue: "Last purchase",
                  })}
                >
                  <Input
                    type="date"
                    value={lastPurchase}
                    onChange={(e) => {
                      setLastPurchase(e.target.value);
                      markDirty();
                    }}
                    disabled={!canEdit}
                    className="h-9"
                  />
                </SidebarField>
              </div>
            ) : null}
          </div>

          <SidebarField
            icon={<StickyNote className="h-3.5 w-3.5" />}
            label={t("customers.customerNotes", {
              defaultValue: "Internal notes",
            })}
          >
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                markDirty();
              }}
              disabled={!canEdit}
              rows={3}
              placeholder={t("customers.notesPh", {
                defaultValue: "Add a private note about this customer…",
              })}
              className="text-sm"
            />
          </SidebarField>
        </div>

        {canEdit ? (
          <div
            className={cn(
              "flex items-center justify-between gap-2 border-t border-border px-4 py-3",
              dirty ? "bg-primary/3" : "bg-muted/30",
            )}
          >
            <p className="text-[11px] text-muted-foreground">
              {dirty
                ? t("customers.unsavedChanges", {
                    defaultValue: "Unsaved changes",
                  })
                : t("customers.allSaved", { defaultValue: "All changes saved" })}
            </p>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              onClick={save}
              disabled={mutation.isPending || !dirty}
            >
              {mutation.isPending
                ? t("customers.saving", { defaultValue: "Saving…" })
                : t("customers.saveCustomer", { defaultValue: "Save changes" })}
            </Button>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary [&>svg]:h-3.5 [&>svg]:w-3.5">
            <CheckCircle2 />
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-tight text-foreground">
              {t("customers.section.review", {
                defaultValue: "Review",
              })}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {t("customers.reviewHint", {
                defaultValue: "Read-only signal from the system.",
              })}
            </p>
          </div>
        </header>
        <div className="grid grid-cols-2 gap-3 p-4 text-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("customers.reviewState", { defaultValue: "State" })}
            </p>
            <p className="mt-1 font-medium capitalize">
              {reviewState || "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("customers.satisfactionScore", {
                defaultValue: "Satisfaction",
              })}
            </p>
            <p className="mt-1 font-medium tabular-nums">
              {satisfaction || "—"}
            </p>
          </div>
        </div>
      </section>
    </aside>
  );
}

function SidebarField({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon ? <span className="opacity-70">{icon}</span> : null}
        {label}
      </Label>
      {children}
    </div>
  );
}

interface CustomerMetadataCardProps {
  customer: Record<string, unknown>;
  leadId: string | null;
}

export function CustomerMetadataCard({
  customer,
  leadId: _leadId,
}: CustomerMetadataCardProps) {
  const { t } = useTranslation();
  const id = String(customer.id ?? "");
  const createdAt = customer.created_at as string | null | undefined;
  const updatedAt = customer.updated_at as string | null | undefined;

  return (
    <section className="app-fade-up app-fade-up-d3 overflow-hidden rounded-2xl border border-border bg-card/60 text-xs shadow-(--shadow-sm)">
      <div className="space-y-2 p-4">
        <MetaRow
          label={t("customers.idLabel", { defaultValue: "Customer ID" })}
          value={id}
          mono
        />
        {createdAt ? (
          <MetaRow
            label={t("customers.created", { defaultValue: "Created" })}
            value={new Date(createdAt).toLocaleString()}
          />
        ) : null}
        {updatedAt ? (
          <MetaRow
            label={t("customers.updated", { defaultValue: "Last updated" })}
            value={new Date(updatedAt).toLocaleString()}
          />
        ) : null}
      </div>
    </section>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate text-right text-foreground",
          mono && "font-mono text-[11px]",
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
