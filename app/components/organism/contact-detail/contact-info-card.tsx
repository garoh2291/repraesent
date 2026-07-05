import { useMemo, useState, useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Mail,
  Phone,
  MapPin,
  Star,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  User,
  UserCircle,
  ExternalLink,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ContactProfileForm } from "~/components/organism/contact-detail/contact-crm-panel";
import { toast } from "sonner";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
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
import { cn } from "~/lib/utils";
import {
  addContactEmail,
  deleteContactEmail,
  patchContactEmail,
  addContactPhone,
  deleteContactPhone,
  patchContactPhone,
  addContactAddress,
  deleteContactAddress,
  patchContactAddress,
} from "~/lib/api/contacts";
import { PhoneNumberInput } from "~/components/molecule/phone-number-input";

const EMAIL_TYPES = ["work", "personal", "other"] as const;
const PHONE_TYPES = ["mobile", "work", "home", "fax", "other"] as const;
const ADDRESS_TYPES = ["work", "home", "billing", "shipping", "other"] as const;

type Kind = "email" | "phone" | "address";

type ContactRow = Record<string, unknown> & { id?: unknown };
type ContactQueryData = {
  emails: ContactRow[];
  phones: ContactRow[];
  addresses: ContactRow[];
  [k: string]: unknown;
};
type ContactSnapshot = Array<
  [readonly unknown[], ContactQueryData | undefined]
>;

function arrayKey(kind: Kind): "emails" | "phones" | "addresses" {
  return kind === "email"
    ? "emails"
    : kind === "phone"
      ? "phones"
      : "addresses";
}

function snapshotContactQueries(qc: QueryClient): ContactSnapshot {
  return qc.getQueriesData<ContactQueryData>({ queryKey: ["contact"] });
}

function rollbackContactQueries(qc: QueryClient, snap: ContactSnapshot) {
  for (const [key, value] of snap) qc.setQueryData(key, value);
}

function applyToContactQueries(
  qc: QueryClient,
  update: (data: ContactQueryData) => ContactQueryData,
): void {
  const queries = qc.getQueriesData<ContactQueryData>({
    queryKey: ["contact"],
  });
  for (const [key, value] of queries) {
    if (!value || !Array.isArray(value.emails)) continue;
    qc.setQueryData(key, update(value));
  }
}

function withSinglePrimary(
  rows: ContactRow[],
  primaryId: unknown,
): ContactRow[] {
  return rows.map((r) =>
    String(r.id) === String(primaryId)
      ? { ...r, is_primary: true }
      : { ...r, is_primary: false },
  );
}

function tempId(): string {
  return `tmp-${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  }`;
}

interface ContactInfoCardProps {
  contactId: string | null;
  contact?: Record<string, unknown> | null;
  crm?: Record<string, unknown> | null;
  emails: Record<string, unknown>[];
  phones: Record<string, unknown>[];
  addresses: Record<string, unknown>[];
  canEdit: boolean;
  onInvalidate: () => void;
}

function filterContactRows(
  rows: Record<string, unknown>[],
  contactId: string | null,
) {
  if (!contactId) return [] as Record<string, unknown>[];
  return rows.filter(
    (r) => r.entity_table === "contacts" && String(r.entity_id) === contactId,
  );
}

function sortByPrimary(rows: Record<string, unknown>[]) {
  return [...rows].sort((a, b) => {
    const ap = a.is_primary === true ? 0 : 1;
    const bp = b.is_primary === true ? 0 : 1;
    return ap - bp;
  });
}

function formatAddressOneLine(row: Record<string, unknown>): string {
  const parts = [
    row.line1,
    row.line2,
    [row.postal_code, row.city].filter(Boolean).join(" "),
    row.state,
    row.country,
  ]
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter(Boolean);
  return parts.join(", ");
}

/** Localize an email/phone/address type (work, mobile, home, …). */
function typeLabel(
  t: ReturnType<typeof useTranslation>["t"],
  type: string,
): string {
  if (!type) return "";
  return t(`contacts.types.${type}`, {
    defaultValue: type.charAt(0).toUpperCase() + type.slice(1),
  });
}

export function ContactInfoCard({
  contactId,
  contact,
  crm,
  emails,
  phones,
  addresses,
  canEdit,
  onInvalidate,
}: ContactInfoCardProps) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [saveSlot, setSaveSlot] = useState<HTMLDivElement | null>(null);
  const createdAt = crm?.created_at as string | null | undefined;
  const updatedAt = crm?.updated_at as string | null | undefined;
  const hasMoreInfo = Boolean(createdAt || updatedAt);

  const emailsContact = useMemo(
    () => sortByPrimary(filterContactRows(emails, contactId)),
    [emails, contactId],
  );
  const phonesContact = useMemo(
    () => sortByPrimary(filterContactRows(phones, contactId)),
    [phones, contactId],
  );
  const addressesContact = useMemo(
    () => sortByPrimary(filterContactRows(addresses, contactId)),
    [addresses, contactId],
  );

  const totalEmails = emailsContact.length;
  const totalPhones = phonesContact.length;
  const totalAddresses = addressesContact.length;

  return (
    <section className="app-fade-up app-fade-up-d1 rounded-2xl border border-border bg-card shadow-(--shadow)">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {t("contacts.section.contactInfo", {
              defaultValue: "Contact information",
            })}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("contacts.contactInfoHint", {
              defaultValue: "Emails, phones and addresses for this contact.",
            })}
          </p>
        </div>
        <div
          ref={setSaveSlot}
          className="flex items-center gap-2 empty:hidden"
        />
      </header>

      <Tabs defaultValue={contact ? "profile" : "emails"} className="w-full">
        <div className="border-b border-border px-3 sm:px-4">
          <TabsList variant="line" className="h-10 gap-1">
            {contact ? (
              <TabsTrigger
                value="profile"
                className="gap-1.5 px-2 text-xs sm:gap-2 sm:px-3"
              >
                <UserCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">
                  {t("contacts.profile", { defaultValue: "Profile" })}
                </span>
              </TabsTrigger>
            ) : null}
            <TabsTrigger
              value="emails"
              className="gap-1.5 px-2 text-xs sm:gap-2 sm:px-3"
            >
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {t("contacts.emails", { defaultValue: "Emails" })}
              </span>
              <CountBadge n={totalEmails} />
            </TabsTrigger>
            <TabsTrigger
              value="phones"
              className="gap-1.5 px-2 text-xs sm:gap-2 sm:px-3"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {t("contacts.phones", { defaultValue: "Phones" })}
              </span>
              <CountBadge n={totalPhones} />
            </TabsTrigger>
            <TabsTrigger
              value="addresses"
              className="gap-1.5 px-2 text-xs sm:gap-2 sm:px-3"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {t("contacts.addresses", { defaultValue: "Addresses" })}
              </span>
              <CountBadge n={totalAddresses} />
            </TabsTrigger>
          </TabsList>
        </div>

        {contact && contactId ? (
          <TabsContent value="profile" className="mt-0 p-4 sm:p-5">
            <ContactProfileForm
              contactId={contactId}
              contact={contact}
              lastContactedAt={
                (crm?.last_contacted_at as string | null | undefined) ?? null
              }
              canEdit={canEdit}
              onSaved={onInvalidate}
              saveSlot={saveSlot}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="emails" className="mt-0 p-4 sm:p-5">
          <KindPanel
            kind="email"
            contactId={contactId}
            contactRows={emailsContact}
            canEdit={canEdit}
            onInvalidate={onInvalidate}
          />
        </TabsContent>
        <TabsContent value="phones" className="mt-0 p-4 sm:p-5">
          <KindPanel
            kind="phone"
            contactId={contactId}
            contactRows={phonesContact}
            canEdit={canEdit}
            onInvalidate={onInvalidate}
          />
        </TabsContent>
        <TabsContent value="addresses" className="mt-0 p-4 sm:p-5">
          <KindPanel
            kind="address"
            contactId={contactId}
            contactRows={addressesContact}
            canEdit={canEdit}
            onInvalidate={onInvalidate}
          />
        </TabsContent>
      </Tabs>

      {hasMoreInfo ? (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-5"
          >
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {moreOpen
                ? t("contacts.hideMoreInfo", {
                    defaultValue: "Hide more info",
                  })
                : t("contacts.showMoreInfo", {
                    defaultValue: "Show more info",
                  })}
            </span>
            {moreOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {moreOpen ? (
            <div className="space-y-2 border-t border-border/60 px-4 py-3 text-xs sm:px-5">
              {createdAt ? (
                <MetaRow
                  label={t("contacts.created", { defaultValue: "Created" })}
                  value={new Date(createdAt).toLocaleString()}
                />
              ) : null}
              {updatedAt ? (
                <MetaRow
                  label={t("contacts.updated", {
                    defaultValue: "Last updated",
                  })}
                  value={new Date(updatedAt).toLocaleString()}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className="min-w-0 truncate text-right text-foreground"
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function CountBadge({ n }: { n: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
        n > 0
          ? "bg-foreground/10 text-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      {n}
    </span>
  );
}

interface KindPanelProps {
  kind: Kind;
  contactId: string | null;
  contactRows: Record<string, unknown>[];
  canEdit: boolean;
  onInvalidate: () => void;
}

function KindPanel({
  kind,
  contactId,
  contactRows,
  canEdit,
  onInvalidate,
}: KindPanelProps) {
  const { t } = useTranslation();
  const [pendingForms, setPendingForms] = useState<Array<{ key: number }>>([]);
  const nextKeyRef = useRef(1);

  const totalRows = contactRows.length;
  const hasContact = contactId != null;
  const canAdd = hasContact;
  /** Among stacked "add" forms, only one may claim "primary" at a time (radio UX). */
  const [pendingPrimaryKey, setPendingPrimaryKey] = useState<number | null>(
    null,
  );

  const labels = {
    email: {
      add: t("contacts.addEmail", {
        defaultValue: "Add email",
      }),
      empty: t("contacts.noEmails", {
        defaultValue: "No emails on file yet.",
      }),
    },
    phone: {
      add: t("contacts.addPhone", {
        defaultValue: "Add phone number",
      }),
      empty: t("contacts.noPhones", {
        defaultValue: "No phones on file yet.",
      }),
    },
    address: {
      add: t("contacts.addAddress", {
        defaultValue: "Add address",
      }),
      empty: t("contacts.noAddresses", {
        defaultValue: "No addresses on file yet.",
      }),
    },
  }[kind];

  const addForm = () => {
    const key = nextKeyRef.current++;
    setPendingForms((prev) => [...prev, { key }]);
  };

  const removeForm = (key: number) => {
    setPendingForms((prev) => prev.filter((f) => f.key !== key));
    setPendingPrimaryKey((k) => (k === key ? null : k));
  };

  return (
    <div className="space-y-4">
      {canEdit && canAdd ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={addForm}
          >
            <Plus className="h-3.5 w-3.5" />
            {labels.add}
          </Button>
        </div>
      ) : null}

      {pendingForms.map((form) => {
        if (!contactId) return null;
        return (
          <AddRowInline
            key={form.key}
            kind={kind}
            entityId={contactId}
            markAsPrimary={pendingPrimaryKey === form.key}
            onMarkAsPrimaryChange={(checked) => {
              if (checked) setPendingPrimaryKey(form.key);
              else setPendingPrimaryKey((k) => (k === form.key ? null : k));
            }}
            onDone={() => {
              removeForm(form.key);
              onInvalidate();
            }}
            onCancel={() => removeForm(form.key)}
          />
        );
      })}

      {totalRows === 0 && pendingForms.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
          <div>
            <KindIcon
              kind={kind}
              className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60"
            />
            <p className="text-sm text-muted-foreground">{labels.empty}</p>
          </div>
        </div>
      ) : null}

      {contactRows.length > 0 ? (
        <ScopeGroup
          icon={<User className="h-3 w-3" />}
          title={t("contacts.scopePersonal", { defaultValue: "Personal" })}
        >
          {contactRows.map((row) => (
            <RowCard
              key={String(row.id)}
              kind={kind}
              entityId={contactId!}
              row={row}
              canEdit={canEdit}
              onInvalidate={onInvalidate}
            />
          ))}
        </ScopeGroup>
      ) : null}
    </div>
  );
}

function KindIcon({ kind, className }: { kind: Kind; className?: string }) {
  if (kind === "email") return <Mail className={className} />;
  if (kind === "phone") return <Phone className={className} />;
  return <MapPin className={className} />;
}

function ScopeGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface RowCardProps {
  kind: Kind;
  entityId: string;
  row: Record<string, unknown>;
  canEdit: boolean;
  onInvalidate: () => void;
}

function RowCard({ kind, entityId, row, canEdit, onInvalidate }: RowCardProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const isPrimary = row.is_primary === true;

  const primaryValue =
    kind === "email"
      ? String(row.address ?? "")
      : kind === "phone"
        ? String(row.number ?? "")
        : formatAddressOneLine(row);

  const typeText = String(row.type ?? "");
  const labelText = kind === "phone" ? String(row.label ?? "") : "";

  const copy = async () => {
    if (!primaryValue) return;
    try {
      await navigator.clipboard.writeText(primaryValue);
      setCopied(true);
      toast.success(
        t("contacts.copied", { defaultValue: "Copied to clipboard" }),
      );
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("contacts.copyFailed", { defaultValue: "Could not copy" }));
    }
  };

  const externalHref =
    kind === "email" && primaryValue
      ? `mailto:${primaryValue}`
      : kind === "phone" && primaryValue
        ? `tel:${primaryValue.replace(/\s+/g, "")}`
        : kind === "address" && primaryValue
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(primaryValue)}`
          : null;

  if (editing) {
    return (
      <RowEditorInline
        kind={kind}
        entityId={entityId}
        row={row}
        onCancel={() => setEditing(false)}
        onDone={() => {
          setEditing(false);
          onInvalidate();
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 transition-all",
        "hover:border-border hover:shadow-(--shadow-sm)",
        isPrimary && "ring-1 ring-primary/30 border-primary/40 bg-primary/2",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          "bg-muted text-muted-foreground",
          "[&>svg]:h-4 [&>svg]:w-4",
        )}
      >
        <KindIcon kind={kind} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p
            className="truncate text-sm font-medium text-foreground"
            title={primaryValue}
          >
            {primaryValue || (
              <span className="italic text-muted-foreground">
                {t("contacts.emptyValue", { defaultValue: "Empty" })}
              </span>
            )}
          </p>
          {isPrimary ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <Star className="h-2.5 w-2.5 fill-current" />
              {t("contacts.primary", { defaultValue: "Primary" })}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {typeText ? <span>{typeLabel(t, typeText)}</span> : null}
          {labelText ? (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="truncate">{labelText}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {externalHref ? (
          <a
            href={externalHref}
            target={kind === "address" ? "_blank" : undefined}
            rel={kind === "address" ? "noreferrer" : undefined}
            aria-label={t("contacts.openExternal", {
              defaultValue: "Open",
            })}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
        {primaryValue ? (
          <button
            type="button"
            onClick={copy}
            aria-label={t("contacts.copy", { defaultValue: "Copy" })}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={t("contacts.edit", { defaultValue: "Edit" })}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface RowEditorInlineProps {
  kind: Kind;
  entityId: string;
  row: Record<string, unknown>;
  onCancel: () => void;
  onDone: () => void;
}

function RowEditorInline({
  kind,
  entityId,
  row,
  onCancel,
  onDone,
}: RowEditorInlineProps) {
  const { t } = useTranslation();
  const id = String(row.id);

  const [address, setAddress] = useState(String(row.address ?? ""));
  const [emailType, setEmailType] = useState(String(row.type ?? "work"));
  const [phoneNum, setPhoneNum] = useState(String(row.number ?? ""));
  const [phoneType, setPhoneType] = useState(String(row.type ?? "mobile"));
  const [label, setLabel] = useState(String(row.label ?? ""));
  const [addrType, setAddrType] = useState(String(row.type ?? "work"));
  const [line1, setLine1] = useState(String(row.line1 ?? ""));
  const [line2, setLine2] = useState(String(row.line2 ?? ""));
  const [city, setCity] = useState(String(row.city ?? ""));
  const [state, setState] = useState(String(row.state ?? ""));
  const [postal, setPostal] = useState(String(row.postal_code ?? ""));
  const [country, setCountry] = useState(String(row.country ?? "DE"));
  const [primary, setPrimary] = useState(!!row.is_primary);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setAddress(String(row.address ?? ""));
    setEmailType(String(row.type ?? "work"));
    setPhoneNum(String(row.number ?? ""));
    setPhoneType(String(row.type ?? "mobile"));
    setLabel(String(row.label ?? ""));
    setAddrType(String(row.type ?? "work"));
    setLine1(String(row.line1 ?? ""));
    setLine2(String(row.line2 ?? ""));
    setCity(String(row.city ?? ""));
    setState(String(row.state ?? ""));
    setPostal(String(row.postal_code ?? ""));
    setCountry(String(row.country ?? "DE"));
    setPrimary(!!row.is_primary);
  }, [row]);

  const save = () => {
    let body: Record<string, unknown>;
    let patch: ContactRow;
    if (kind === "email") {
      body = {
        address: address.trim(),
        type: emailType,
        is_primary: primary,
      };
      patch = {
        address: address.trim(),
        type: emailType,
        is_primary: primary,
      };
    } else if (kind === "phone") {
      body = {
        number: phoneNum.trim(),
        type: phoneType,
        label: label.trim() || null,
        is_primary: primary,
      };
      patch = {
        number: phoneNum.trim(),
        type: phoneType,
        label: label.trim() || null,
        is_primary: primary,
      };
    } else {
      body = {
        type: addrType,
        line1: line1.trim() || null,
        line2: line2.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        postal_code: postal.trim() || null,
        country: country.trim() || "DE",
        is_primary: primary,
      };
      patch = { ...body };
    }

    const snap = snapshotContactQueries(queryClient);
    const ak = arrayKey(kind);
    applyToContactQueries(queryClient, (v) => {
      let next = v[ak].map((r) =>
        String(r.id) === id ? { ...r, ...patch } : r,
      );
      if (primary) next = withSinglePrimary(next, id);
      return { ...v, [ak]: next };
    });
    onDone();

    const apiCall =
      kind === "email"
        ? patchContactEmail(
            entityId,
            id,
            body as Parameters<typeof patchContactEmail>[2],
          )
        : kind === "phone"
          ? patchContactPhone(
              entityId,
              id,
              body as Parameters<typeof patchContactPhone>[2],
            )
          : patchContactAddress(
              entityId,
              id,
              body as Parameters<typeof patchContactAddress>[2],
            );

    apiCall
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["contact"] });
        void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      })
      .catch((err) => {
        rollbackContactQueries(queryClient, snap);
        toast.error(
          t("contacts.saveFailed", { defaultValue: "Could not save." }),
          { description: extractErrorMessage(err) },
        );
      });
  };

  const performRemove = () => {
    setRemoveConfirmOpen(false);
    const snap = snapshotContactQueries(queryClient);
    const ak = arrayKey(kind);
    applyToContactQueries(queryClient, (v) => ({
      ...v,
      [ak]: v[ak].filter((r) => String(r.id) !== id),
    }));
    onDone();

    const apiCall =
      kind === "email"
        ? deleteContactEmail(entityId, id)
        : kind === "phone"
          ? deleteContactPhone(entityId, id)
          : deleteContactAddress(entityId, id);

    apiCall
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["contact"] });
        void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      })
      .catch(() => {
        rollbackContactQueries(queryClient, snap);
        toast.error(
          t("contacts.removeFailed", { defaultValue: "Could not remove." }),
        );
      });
  };

  const removeDialogTitle =
    kind === "phone"
      ? t("contacts.confirmRemovePhoneTitle", {
          defaultValue: "Remove this phone number?",
        })
      : kind === "email"
        ? t("contacts.confirmRemoveEmailTitle", {
            defaultValue: "Remove this email?",
          })
        : t("contacts.confirmRemoveAddressTitle", {
            defaultValue: "Remove this address?",
          });

  const removeDialogDescription =
    kind === "phone"
      ? phoneNum.trim()
        ? t("contacts.confirmRemovePhoneDescription", {
            number: phoneNum.trim(),
            defaultValue:
              "This will delete {{number}} from the profile. You can add it again later.",
          })
        : t("contacts.confirmRemovePhoneDescriptionEmpty", {
            defaultValue:
              "This phone number will be removed from the profile. You can add it again later.",
          })
      : kind === "email"
        ? address.trim()
          ? t("contacts.confirmRemoveEmailDescription", {
              address: address.trim(),
              defaultValue:
                "This will delete {{address}} from the profile. You can add it again later.",
            })
          : t("contacts.confirmRemoveEmailDescriptionEmpty", {
              defaultValue:
                "This email will be removed from the profile. You can add it again later.",
            })
        : t("contacts.confirmRemoveAddressDescription", {
            defaultValue:
              "This address will be removed from the profile. You can add it again later.",
          });

  return (
    <>
      <div className="rounded-xl border border-primary/40 bg-primary/2 p-3.5 space-y-3 ring-1 ring-primary/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Pencil className="h-3.5 w-3.5 text-primary" />
            {t("contacts.editEntry", { defaultValue: "Edit entry" })}
          </div>
        </div>

        {kind === "email" ? (
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <FieldRow label={t("contacts.email", { defaultValue: "Email" })}>
              <Input
                type="email"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="h-9"
                placeholder="name@example.com"
              />
            </FieldRow>
            <FieldRow label={t("contacts.type", { defaultValue: "Type" })}>
              <Select value={emailType} onValueChange={setEmailType}>
                <SelectTrigger className="h-9 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TYPES.map((x) => (
                    <SelectItem key={x} value={x}>
                      {typeLabel(t, x)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
        ) : null}

        {kind === "phone" ? (
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <FieldRow
              label={t("contacts.phoneNumber", { defaultValue: "Number" })}
            >
              <PhoneNumberInput
                value={phoneNum}
                onChange={setPhoneNum}
                placeholder={t("contacts.phonePlaceholder", {
                  defaultValue: "Phone number",
                })}
              />
            </FieldRow>
            <FieldRow label={t("contacts.type", { defaultValue: "Type" })}>
              <Select value={phoneType} onValueChange={setPhoneType}>
                <SelectTrigger className="h-9 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHONE_TYPES.map((x) => (
                    <SelectItem key={x} value={x}>
                      {typeLabel(t, x)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow
              label={t("contacts.label", { defaultValue: "Label (optional)" })}
              className="sm:col-span-2"
            >
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="h-9"
                placeholder={t("contacts.labelPh", {
                  defaultValue: "e.g. desk, after-hours",
                })}
              />
            </FieldRow>
          </div>
        ) : null}

        {kind === "address" ? (
          <div className="grid gap-3 sm:grid-cols-6">
            <FieldRow
              label={t("contacts.type", { defaultValue: "Type" })}
              className="sm:col-span-2"
            >
              <Select value={addrType} onValueChange={setAddrType}>
                <SelectTrigger className="h-9 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADDRESS_TYPES.map((x) => (
                    <SelectItem key={x} value={x}>
                      {typeLabel(t, x)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow
              label={t("contacts.country", { defaultValue: "Country" })}
              className="sm:col-span-2"
            >
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                maxLength={2}
                className="h-9 uppercase"
                placeholder="DE"
              />
            </FieldRow>
            <FieldRow
              label={t("contacts.addrLine1", {
                defaultValue: "Address line 1",
              })}
              className="sm:col-span-6"
            >
              <Input
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                className="h-9"
              />
            </FieldRow>
            <FieldRow
              label={t("contacts.addrLine2", {
                defaultValue: "Address line 2",
              })}
              className="sm:col-span-6"
            >
              <Input
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                className="h-9"
              />
            </FieldRow>
            <FieldRow
              label={t("contacts.addrPostal", { defaultValue: "Postal" })}
              className="sm:col-span-2"
            >
              <Input
                value={postal}
                onChange={(e) => setPostal(e.target.value)}
                className="h-9"
              />
            </FieldRow>
            <FieldRow
              label={t("contacts.addrCity", { defaultValue: "City" })}
              className="sm:col-span-2"
            >
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-9"
              />
            </FieldRow>
            <FieldRow
              label={t("contacts.addrState", {
                defaultValue: "State / Region",
              })}
              className="sm:col-span-2"
            >
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="h-9"
              />
            </FieldRow>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox
              checked={primary}
              onCheckedChange={(v) => setPrimary(v === true)}
            />
            <span className="font-medium">
              {t("contacts.markPrimary", {
                defaultValue: "Mark as primary",
              })}
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setRemoveConfirmOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("contacts.remove", { defaultValue: "Remove" })}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={onCancel}
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              onClick={save}
            >
              {t("contacts.saveRow", { defaultValue: "Save" })}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removeDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {removeDialogDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                performRemove();
              }}
            >
              {t("contacts.remove", { defaultValue: "Remove" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface AddRowInlineProps {
  kind: Kind;
  entityId: string;
  markAsPrimary: boolean;
  onMarkAsPrimaryChange: (checked: boolean) => void;
  onDone: () => void;
  onCancel: () => void;
}

function AddRowInline({
  kind,
  entityId,
  markAsPrimary,
  onMarkAsPrimaryChange,
  onDone,
  onCancel,
}: AddRowInlineProps) {
  const { t } = useTranslation();
  const [address, setAddress] = useState("");
  const [emailType, setEmailType] = useState<string>("work");
  const [phoneNum, setPhoneNum] = useState("");
  const [phoneType, setPhoneType] = useState<string>("mobile");
  const [addrType, setAddrType] = useState<string>("work");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("DE");
  const queryClient = useQueryClient();

  const submit = () => {
    let body: Record<string, unknown>;
    let optimisticRow: ContactRow;
    const newId = tempId();

    if (kind === "email") {
      if (!address.trim()) {
        toast.error(
          t("contacts.emailRequired", { defaultValue: "Email is required." }),
        );
        return;
      }
      body = {
        address: address.trim(),
        type: emailType,
        is_primary: markAsPrimary,
      };
      optimisticRow = {
        id: newId,
        entity_table: "contacts",
        entity_id: entityId,
        address: address.trim(),
        type: emailType,
        is_primary: markAsPrimary,
      };
    } else if (kind === "phone") {
      if (!phoneNum.trim()) {
        toast.error(
          t("contacts.phoneRequired", {
            defaultValue: "Phone number is required.",
          }),
        );
        return;
      }
      body = {
        number: phoneNum.trim(),
        type: phoneType,
        is_primary: markAsPrimary,
      };
      optimisticRow = {
        id: newId,
        entity_table: "contacts",
        entity_id: entityId,
        number: phoneNum.trim(),
        type: phoneType,
        is_primary: markAsPrimary,
      };
    } else {
      body = {
        type: addrType,
        line1: line1.trim() || null,
        line2: line2.trim() || null,
        city: city.trim() || null,
        postal_code: postal.trim() || null,
        country: country.trim() || "DE",
        is_primary: markAsPrimary,
      };
      optimisticRow = {
        id: newId,
        entity_table: "contacts",
        entity_id: entityId,
        type: addrType,
        line1: body.line1,
        line2: body.line2,
        city: body.city,
        postal_code: body.postal_code,
        country: body.country,
        is_primary: markAsPrimary,
      };
    }

    const snap = snapshotContactQueries(queryClient);
    const ak = arrayKey(kind);
    applyToContactQueries(queryClient, (v) => {
      let next = [...v[ak], optimisticRow];
      if (markAsPrimary) next = withSinglePrimary(next, newId);
      return { ...v, [ak]: next };
    });

    // Close the form right away; the request runs in the background.
    onDone();

    const apiCall =
      kind === "email"
        ? addContactEmail(
            entityId,
            body as Parameters<typeof addContactEmail>[1],
          )
        : kind === "phone"
          ? addContactPhone(
              entityId,
              body as Parameters<typeof addContactPhone>[1],
            )
          : addContactAddress(
              entityId,
              body as Parameters<typeof addContactAddress>[1],
            );

    apiCall
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["contact"] });
        void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      })
      .catch((err) => {
        rollbackContactQueries(queryClient, snap);
        toast.error(
          t("contacts.addFailed", { defaultValue: "Could not add." }),
          { description: extractErrorMessage(err) },
        );
      });
  };

  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/3 p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Plus className="h-3.5 w-3.5 text-primary" />
          {t("contacts.newEntry", { defaultValue: "New entry" })}
        </div>
      </div>

      {kind === "email" ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Input
            type="email"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="name@example.com"
            className="h-9"
            autoFocus
          />
          <Select value={emailType} onValueChange={setEmailType}>
            <SelectTrigger className="h-9 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_TYPES.map((x) => (
                <SelectItem key={x} value={x}>
                  {typeLabel(t, x)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {kind === "phone" ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <PhoneNumberInput
            value={phoneNum}
            onChange={setPhoneNum}
            placeholder={t("contacts.phonePlaceholder", {
              defaultValue: "Phone number",
            })}
            autoFocus
          />
          <Select value={phoneType} onValueChange={setPhoneType}>
            <SelectTrigger className="h-9 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHONE_TYPES.map((x) => (
                <SelectItem key={x} value={x}>
                  {typeLabel(t, x)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {kind === "address" ? (
        <div className="grid gap-3 sm:grid-cols-6">
          <FieldRow
            label={t("contacts.type", { defaultValue: "Type" })}
            className="sm:col-span-2"
          >
            <Select value={addrType} onValueChange={setAddrType}>
              <SelectTrigger className="h-9 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADDRESS_TYPES.map((x) => (
                  <SelectItem key={x} value={x}>
                    {typeLabel(t, x)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow
            label={t("contacts.country", { defaultValue: "Country" })}
            className="sm:col-span-2"
          >
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              maxLength={2}
              className="h-9 uppercase"
            />
          </FieldRow>
          <FieldRow
            label={t("contacts.addrLine1", { defaultValue: "Address line 1" })}
            className="sm:col-span-6"
          >
            <Input
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              className="h-9"
              autoFocus
            />
          </FieldRow>
          <FieldRow
            label={t("contacts.addrLine2", {
              defaultValue: "Address line 2",
            })}
            className="sm:col-span-6"
          >
            <Input
              value={line2}
              onChange={(e) => setLine2(e.target.value)}
              className="h-9"
            />
          </FieldRow>
          <FieldRow
            label={t("contacts.addrPostal", { defaultValue: "Postal" })}
            className="sm:col-span-2"
          >
            <Input
              value={postal}
              onChange={(e) => setPostal(e.target.value)}
              className="h-9"
            />
          </FieldRow>
          <FieldRow
            label={t("contacts.addrCity", { defaultValue: "City" })}
            className="sm:col-span-4"
          >
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="h-9"
            />
          </FieldRow>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox
            checked={markAsPrimary}
            onCheckedChange={(v) => onMarkAsPrimaryChange(v === true)}
          />
          <span className="font-medium">
            {t("contacts.markPrimary", {
              defaultValue: "Mark as primary",
            })}
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={onCancel}
        >
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs"
          onClick={submit}
        >
          {t("contacts.addRow", { defaultValue: "Add" })}
        </Button>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
