import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { startOfDay } from "date-fns";
import {
  Activity,
  UserCog,
  Coins,
  CalendarClock,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  patchContactCrm,
  type PatchContactCrmBody,
} from "~/lib/api/contacts-crm";
import {
  CONTACT_TYPES,
  type ContactType,
} from "~/lib/contacts/contact-types";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/lib/utils/format";
import {
  DatePickerPopover,
  apiDatetimeToIsoDateString,
} from "~/components/molecule/date-picker-popover";
import type { WorkspaceMemberOption } from "./contact-crm-panel";

interface ContactPipelineCardProps {
  contactId: string;
  crm: Record<string, unknown>;
  workspaceMembers: WorkspaceMemberOption[];
  canEdit: boolean;
  /** When set, contact type can be edited and saved with pipeline fields. */
  contactTypeInitial?: string | null;
  hasContact?: boolean;
}

export function ContactPipelineCard({
  contactId,
  crm,
  workspaceMembers,
  canEdit,
  contactTypeInitial,
  hasContact = false,
}: ContactPipelineCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [assignedTo, setAssignedTo] = useState<string>(
    crm.assigned_to ? String(crm.assigned_to) : "unassigned"
  );
  const [lastContacted, setLastContacted] = useState(
    apiDatetimeToIsoDateString(crm.last_contacted_at),
  );
  const [contactType, setContactType] = useState<ContactType>(() => {
    const raw = String(contactTypeInitial ?? "customer");
    return CONTACT_TYPES.includes(raw as ContactType)
      ? (raw as ContactType)
      : "customer";
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setAssignedTo(
      crm.assigned_to ? String(crm.assigned_to) : "unassigned"
    );
    setLastContacted(
      apiDatetimeToIsoDateString(crm.last_contacted_at),
    );
    const raw = String(contactTypeInitial ?? "customer");
    setContactType(
      CONTACT_TYPES.includes(raw as ContactType)
        ? (raw as ContactType)
        : "customer",
    );
    setDirty(false);
  }, [crm, contactTypeInitial]);

  const markDirty = () => setDirty(true);

  const mutation = useMutation({
    mutationFn: (body: PatchContactCrmBody) => patchContactCrm(contactId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["contact", contactId],
      });
      toast.success(t("contacts.saved", { defaultValue: "Saved." }));
      setDirty(false);
    },
    onError: () => {
      toast.error(
        t("contacts.saveFailed", { defaultValue: "Could not save." })
      );
    },
  });

  const save = () => {
    const body: PatchContactCrmBody = {
      assigned_to: assignedTo === "unassigned" ? null : assignedTo,
      last_contacted_at: lastContacted.trim()
        ? new Date(`${lastContacted.trim()}T12:00:00`).toISOString()
        : null,
    };
    if (hasContact) {
      body.contact_type = contactType;
    }
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
              {t("contacts.pipeline", { defaultValue: "Pipeline" })}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {t("contacts.pipelineHint", {
                defaultValue: "Ownership and value.",
              })}
            </p>
          </div>
        </header>

        <div className="space-y-3.5 p-4">
          {hasContact ? (
            <SidebarField
              icon={<Users className="h-3.5 w-3.5" />}
              label={t("contacts.contactType", {
                defaultValue: "Contact type",
              })}
            >
              <Select
                value={contactType}
                onValueChange={(v) => {
                  setContactType(v as ContactType);
                  markDirty();
                }}
                disabled={!canEdit}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>
                      {t(`contacts.contactTypes.${ct}`, {
                        defaultValue: ct.replace(/_/g, " "),
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarField>
          ) : null}

          <SidebarField
            icon={<UserCog className="h-3.5 w-3.5" />}
            label={t("contacts.assignedTo", { defaultValue: "Assigned to" })}
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
          </SidebarField>

          <SidebarField
            icon={<Coins className="h-3.5 w-3.5" />}
            label={t("contacts.lifetimeValue", {
              defaultValue: "Lifetime value",
            })}
          >
            <div className="space-y-1">
              <div className="flex h-9 items-center rounded-md border border-transparent bg-muted/40 px-3 text-sm tabular-nums text-foreground">
                {(() => {
                  const raw = crm.lifetime_value;
                  const n =
                    raw != null && raw !== "" ? Number(raw) : Number.NaN;
                  return Number.isFinite(n) ? formatCurrency(n) : "—";
                })()}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {t("contacts.lifetimeValueFromDeals", {
                  defaultValue: "Sum of values on deals linked to this contact.",
                })}
              </p>
            </div>
          </SidebarField>

          <SidebarField
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            label={t("contacts.lastContacted", {
              defaultValue: "Last contacted",
            })}
          >
            <DatePickerPopover
              valueIso={lastContacted || undefined}
              onChange={(iso: string | undefined) => {
                setLastContacted(iso ?? "");
                markDirty();
              }}
              disabled={!canEdit}
              allowClear
              placeholder={t("contacts.pickDate")}
              disabledDate={(d: Date) => d > startOfDay(new Date())}
              toYear={new Date().getFullYear()}
            />
          </SidebarField>
        </div>

        {canEdit ? (
          <div
            className={cn(
              "flex items-center justify-between gap-2 border-t border-border px-4 py-3",
              dirty ? "bg-primary/3" : "bg-muted/30"
            )}
          >
            <p className="text-[11px] text-muted-foreground">
              {dirty
                ? t("contacts.unsavedChanges", {
                    defaultValue: "Unsaved changes",
                  })
                : t("contacts.allSaved", {
                    defaultValue: "All changes saved",
                  })}
            </p>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              onClick={save}
              disabled={mutation.isPending || !dirty}
            >
              {mutation.isPending
                ? t("contacts.saving", { defaultValue: "Saving…" })
                : t("contacts.saveCustomer", { defaultValue: "Save changes" })}
            </Button>
          </div>
        ) : null}
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

