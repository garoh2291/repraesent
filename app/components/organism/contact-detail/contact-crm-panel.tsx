import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { User } from "lucide-react";
import { startOfDay } from "date-fns";
import { patchContact, type PatchContactBody } from "~/lib/api/contacts";
import { patchContactCrm } from "~/lib/api/contacts-crm";
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
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import {
  DatePickerPopover,
  apiDatetimeToIsoDateString,
} from "~/components/molecule/date-picker-popover";
import {
  CONTACT_TYPES,
  type ContactType,
} from "~/lib/contacts/contact-types";
import {
  SALUTATION_VALUES,
  SALUTATION_LABELS_DE,
  SALUTATION_LABELS_EN,
  isSalutation,
  type Salutation,
} from "~/lib/contacts/contact-salutations";

const SALUTATION_SELECT_NONE = "__none__";

export interface WorkspaceMemberOption {
  user_id: string;
  user_first_name: string;
  user_last_name: string;
  user_email: string;
}

interface ProfilePanelHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

function PanelHeader({
  icon,
  title,
  subtitle,
  action,
}: ProfilePanelHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div>{action}</div> : null}
    </header>
  );
}

function FormField({
  label,
  children,
  className,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? (
        <p className="text-[10px] text-muted-foreground/80">{hint}</p>
      ) : null}
    </div>
  );
}

function PanelFooter({
  dirty,
  saving,
  onSave,
  saveLabel,
  disabledExtra,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  saveLabel: string;
  disabledExtra?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5",
        dirty ? "bg-primary/3" : "bg-muted/30"
      )}
    >
      <p className="text-[11px] text-muted-foreground">
        {dirty
          ? t("contacts.unsavedChanges", {
              defaultValue: "Unsaved changes",
            })
          : t("contacts.allSaved", { defaultValue: "All changes saved" })}
      </p>
      <Button
        type="button"
        size="sm"
        className="h-8 text-xs"
        onClick={onSave}
        disabled={saving || !dirty || disabledExtra}
      >
        {saving
          ? t("contacts.saving", { defaultValue: "Saving…" })
          : saveLabel}
      </Button>
    </div>
  );
}

export function ContactProfileSection({
  contactId,
  contact,
  canEdit,
  onSaved,
}: {
  contactId: string;
  contact: Record<string, unknown>;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
      <PanelHeader
        icon={<User />}
        title={t("contacts.section.contact", {
          defaultValue: "Contact profile",
        })}
        subtitle={t("contacts.contactProfileHint", {
          defaultValue: "Personal details about this contact.",
        })}
      />
      <ContactProfileForm
        contactId={contactId}
        contact={contact}
        canEdit={canEdit}
        onSaved={onSaved}
        withSectionFooter
      />
    </section>
  );
}

export function ContactProfileForm({
  contactId,
  contact,
  lastContactedAt,
  canEdit,
  onSaved,
  withSectionFooter,
  saveSlot,
}: {
  contactId: string;
  contact: Record<string, unknown>;
  lastContactedAt?: string | null;
  canEdit: boolean;
  onSaved: () => void;
  withSectionFooter?: boolean;
  saveSlot?: HTMLElement | null;
}) {
  const { t, i18n } = useTranslation();
  const salutationLang = i18n.language?.toLowerCase().startsWith("de")
    ? "de"
    : "en";
  const sortedSalutations = useMemo(
    () =>
      [...SALUTATION_VALUES].sort((a, b) => {
        const la =
          salutationLang === "de"
            ? SALUTATION_LABELS_DE[a]
            : SALUTATION_LABELS_EN[a];
        const lb =
          salutationLang === "de"
            ? SALUTATION_LABELS_DE[b]
            : SALUTATION_LABELS_EN[b];
        return la.localeCompare(lb, salutationLang === "de" ? "de" : "en");
      }),
    [salutationLang],
  );
  const [first, setFirst] = useState(String(contact.first_name ?? ""));
  const [last, setLast] = useState(String(contact.last_name ?? ""));
  const [dob, setDob] = useState(
    apiDatetimeToIsoDateString(contact.date_of_birth),
  );
  const rawSalutation = String(contact.salutation ?? "");
  const [salutation, setSalutation] = useState(() =>
    isSalutation(rawSalutation) ? rawSalutation : "",
  );
  const [contactType, setContactType] = useState<ContactType>(() => {
    const raw = String(contact.contact_type ?? "customer");
    return CONTACT_TYPES.includes(raw as ContactType)
      ? (raw as ContactType)
      : "customer";
  });
  const [lastContacted, setLastContacted] = useState(
    apiDatetimeToIsoDateString(lastContactedAt),
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setFirst(String(contact.first_name ?? ""));
    setLast(String(contact.last_name ?? ""));
    setDob(apiDatetimeToIsoDateString(contact.date_of_birth));
    const nextSal = String(contact.salutation ?? "");
    setSalutation(isSalutation(nextSal) ? nextSal : "");
    const raw = String(contact.contact_type ?? "customer");
    setContactType(
      CONTACT_TYPES.includes(raw as ContactType)
        ? (raw as ContactType)
        : "customer",
    );
    setLastContacted(apiDatetimeToIsoDateString(lastContactedAt));
    setDirty(false);
  }, [contact, lastContactedAt]);

  const markDirty = () => setDirty(true);

  const mutation = useMutation({
    mutationFn: async (vars: {
      contact: PatchContactBody;
      lastContactedAt?: string | null;
    }) => {
      await patchContact(contactId, vars.contact);
      // Last contacted is a contact-level field, persisted via its own endpoint.
      if (contactId && vars.lastContactedAt !== undefined) {
        await patchContactCrm(contactId, {
          last_contacted_at: vars.lastContactedAt,
        });
      }
    },
    onMutate: () => {
      toast.loading(t("contacts.saving", { defaultValue: "Saving…" }), {
        id: "contact-profile-save",
      });
    },
    onSuccess: () => {
      onSaved();
      toast.success(t("contacts.saved", { defaultValue: "Saved." }), {
        id: "contact-profile-save",
      });
      setDirty(false);
    },
    onError: () => {
      toast.error(
        t("contacts.saveFailed", { defaultValue: "Could not save." }),
        { id: "contact-profile-save" }
      );
    },
  });

  const save = () => {
    const rawSalutation = salutation.trim();
    const salutationOut: Salutation | null =
      rawSalutation === ""
        ? null
        : isSalutation(rawSalutation)
          ? rawSalutation
          : null;
    mutation.mutate({
      contact: {
        first_name: first.trim() || null,
        last_name: last.trim() || null,
        date_of_birth: dob || null,
        salutation: salutationOut,
        contact_type: contactType,
      },
      lastContactedAt: contactId
        ? lastContacted.trim()
          ? new Date(`${lastContacted.trim()}T12:00:00`).toISOString()
          : null
        : undefined,
    });
  };

  const nameEmpty = first.trim() === "" && last.trim() === "";

  // Debounced autosave: fires ~800ms after the user stops editing, but only
  // when something changed and a name is present. onSuccess clears `dirty`, so
  // the post-save refetch doesn't loop back into another save.
  useEffect(() => {
    if (!canEdit || !dirty || nameEmpty || mutation.isPending) return;
    const handle = setTimeout(() => save(), 800);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dirty,
    nameEmpty,
    canEdit,
    mutation.isPending,
    first,
    last,
    dob,
    salutation,
    contactType,
    lastContacted,
  ]);

  return (
    <>
      <div
        className={cn(
          "grid gap-3 sm:grid-cols-2",
          withSectionFooter && "p-4 sm:p-5",
        )}
      >
        <FormField
          label={t("contacts.firstName", { defaultValue: "First name" })}
        >
          <Input
            value={first}
            onChange={(e) => {
              setFirst(e.target.value);
              markDirty();
            }}
            disabled={!canEdit}
            className="h-9"
            aria-invalid={nameEmpty}
          />
        </FormField>
        <FormField
          label={t("contacts.lastName", { defaultValue: "Last name" })}
        >
          <Input
            value={last}
            onChange={(e) => {
              setLast(e.target.value);
              markDirty();
            }}
            disabled={!canEdit}
            className="h-9"
            aria-invalid={nameEmpty}
          />
        </FormField>
        {nameEmpty ? (
          <p className="text-[11px] text-destructive sm:col-span-2">
            {t("contacts.errors.nameRequired", {
              defaultValue: "Name can't be blank.",
            })}
          </p>
        ) : null}
        <FormField
          label={t("contacts.dateOfBirth", { defaultValue: "Birthdate" })}
        >
          <DatePickerPopover
            valueIso={dob || undefined}
            onChange={(iso: string | undefined) => {
              setDob(iso ?? "");
              markDirty();
            }}
            disabled={!canEdit}
            allowClear
            placeholder={t("contacts.pickDate")}
            disabledDate={(d: Date) => d > startOfDay(new Date())}
          />
        </FormField>
        <FormField
          label={t("contacts.salutation", { defaultValue: "Salutation" })}
        >
          <Select
            value={salutation || SALUTATION_SELECT_NONE}
            onValueChange={(v) => {
              setSalutation(v === SALUTATION_SELECT_NONE ? "" : v);
              markDirty();
            }}
            disabled={!canEdit}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={t("contacts.salutationNone", {
                  defaultValue: "None",
                })}
              />
            </SelectTrigger>
            <SelectContent className="max-h-72 overflow-y-auto">
              <SelectItem value={SALUTATION_SELECT_NONE}>
                {t("contacts.salutationNone", { defaultValue: "None" })}
              </SelectItem>
              {sortedSalutations.map((code) => (
                <SelectItem key={code} value={code}>
                  {salutationLang === "de"
                    ? SALUTATION_LABELS_DE[code]
                    : SALUTATION_LABELS_EN[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label={t("contacts.contactType", {
            defaultValue: "Contact type",
          })}
          className="sm:col-span-2"
        >
          <Select
            value={contactType}
            onValueChange={(v) => {
              setContactType(v as ContactType);
              markDirty();
            }}
            disabled={!canEdit}
          >
            <SelectTrigger className="w-full">
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
        </FormField>
        {contactId ? (
          <FormField
            label={t("contacts.lastContacted", {
              defaultValue: "Last contacted",
            })}
            className="sm:col-span-2"
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
            />
          </FormField>
        ) : null}
      </div>
    </>
  );
}
