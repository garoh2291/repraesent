import { useMemo, useState, useEffect } from "react";
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
  X,
  Building2,
  User,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
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
import {
  addCompanyEmail,
  deleteCompanyEmail,
  patchCompanyEmail,
  addCompanyPhone,
  deleteCompanyPhone,
  patchCompanyPhone,
  addCompanyAddress,
  deleteCompanyAddress,
  patchCompanyAddress,
} from "~/lib/api/companies";

const EMAIL_TYPES = ["work", "personal", "other"] as const;
const PHONE_TYPES = ["mobile", "work", "home", "fax", "other"] as const;
const ADDRESS_TYPES = ["work", "home", "billing", "shipping", "other"] as const;

type Kind = "email" | "phone" | "address";
type Scope = "contact" | "company";

interface CustomerInfoCardProps {
  contactId: string | null;
  companyId: string | null;
  emails: Record<string, unknown>[];
  phones: Record<string, unknown>[];
  addresses: Record<string, unknown>[];
  canEdit: boolean;
  onInvalidate: () => void;
}

function filterRows(
  rows: Record<string, unknown>[],
  table: "contacts" | "companies",
  entityId: string | null,
) {
  if (!entityId) return [] as Record<string, unknown>[];
  return rows.filter(
    (r) => r.entity_table === table && String(r.entity_id) === entityId,
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

export function CustomerInfoCard({
  contactId,
  companyId,
  emails,
  phones,
  addresses,
  canEdit,
  onInvalidate,
}: CustomerInfoCardProps) {
  const { t } = useTranslation();

  const emailsContact = useMemo(
    () => sortByPrimary(filterRows(emails, "contacts", contactId)),
    [emails, contactId],
  );
  const emailsCompany = useMemo(
    () => sortByPrimary(filterRows(emails, "companies", companyId)),
    [emails, companyId],
  );
  const phonesContact = useMemo(
    () => sortByPrimary(filterRows(phones, "contacts", contactId)),
    [phones, contactId],
  );
  const phonesCompany = useMemo(
    () => sortByPrimary(filterRows(phones, "companies", companyId)),
    [phones, companyId],
  );
  const addressesContact = useMemo(
    () => sortByPrimary(filterRows(addresses, "contacts", contactId)),
    [addresses, contactId],
  );
  const addressesCompany = useMemo(
    () => sortByPrimary(filterRows(addresses, "companies", companyId)),
    [addresses, companyId],
  );

  const totalEmails = emailsContact.length + emailsCompany.length;
  const totalPhones = phonesContact.length + phonesCompany.length;
  const totalAddresses = addressesContact.length + addressesCompany.length;

  return (
    <section className="app-fade-up app-fade-up-d1 rounded-2xl border border-border bg-card shadow-(--shadow)">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {t("customers.section.contactInfo", {
              defaultValue: "Contact information",
            })}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("customers.contactInfoHint", {
              defaultValue:
                "Emails, phones and addresses for this customer's contact and company.",
            })}
          </p>
        </div>
      </header>

      <Tabs defaultValue="emails" className="w-full">
        <div className="border-b border-border px-3 sm:px-4">
          <TabsList variant="line" className="h-10 gap-1">
            <TabsTrigger value="emails" className="gap-2 px-3 text-xs">
              <Mail className="h-3.5 w-3.5" />
              {t("customers.emails", { defaultValue: "Emails" })}
              <CountBadge n={totalEmails} />
            </TabsTrigger>
            <TabsTrigger value="phones" className="gap-2 px-3 text-xs">
              <Phone className="h-3.5 w-3.5" />
              {t("customers.phones", { defaultValue: "Phones" })}
              <CountBadge n={totalPhones} />
            </TabsTrigger>
            <TabsTrigger value="addresses" className="gap-2 px-3 text-xs">
              <MapPin className="h-3.5 w-3.5" />
              {t("customers.addresses", { defaultValue: "Addresses" })}
              <CountBadge n={totalAddresses} />
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="emails" className="mt-0 p-4 sm:p-5">
          <KindPanel
            kind="email"
            contactId={contactId}
            companyId={companyId}
            contactRows={emailsContact}
            companyRows={emailsCompany}
            canEdit={canEdit}
            onInvalidate={onInvalidate}
          />
        </TabsContent>
        <TabsContent value="phones" className="mt-0 p-4 sm:p-5">
          <KindPanel
            kind="phone"
            contactId={contactId}
            companyId={companyId}
            contactRows={phonesContact}
            companyRows={phonesCompany}
            canEdit={canEdit}
            onInvalidate={onInvalidate}
          />
        </TabsContent>
        <TabsContent value="addresses" className="mt-0 p-4 sm:p-5">
          <KindPanel
            kind="address"
            contactId={contactId}
            companyId={companyId}
            contactRows={addressesContact}
            companyRows={addressesCompany}
            canEdit={canEdit}
            onInvalidate={onInvalidate}
          />
        </TabsContent>
      </Tabs>
    </section>
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
  companyId: string | null;
  contactRows: Record<string, unknown>[];
  companyRows: Record<string, unknown>[];
  canEdit: boolean;
  onInvalidate: () => void;
}

function KindPanel({
  kind,
  contactId,
  companyId,
  contactRows,
  companyRows,
  canEdit,
  onInvalidate,
}: KindPanelProps) {
  const { t } = useTranslation();
  const [addingScope, setAddingScope] = useState<Scope | null>(null);

  const totalRows = contactRows.length + companyRows.length;
  const hasContact = contactId != null;
  const hasCompany = companyId != null;

  const labels = {
    email: {
      addContact: t("customers.addContactEmail", {
        defaultValue: "Add personal email",
      }),
      addCompany: t("customers.addCompanyEmail", {
        defaultValue: "Add company email",
      }),
      empty: t("customers.noEmails", {
        defaultValue: "No emails on file yet.",
      }),
    },
    phone: {
      addContact: t("customers.addContactPhone", {
        defaultValue: "Add personal phone",
      }),
      addCompany: t("customers.addCompanyPhone", {
        defaultValue: "Add company phone",
      }),
      empty: t("customers.noPhones", {
        defaultValue: "No phones on file yet.",
      }),
    },
    address: {
      addContact: t("customers.addContactAddress", {
        defaultValue: "Add personal address",
      }),
      addCompany: t("customers.addCompanyAddress", {
        defaultValue: "Add company address",
      }),
      empty: t("customers.noAddresses", {
        defaultValue: "No addresses on file yet.",
      }),
    },
  }[kind];

  return (
    <div className="space-y-4">
      {canEdit && (hasContact || hasCompany) ? (
        <div className="flex flex-wrap gap-2">
          {hasContact ? (
            <Button
              type="button"
              variant={addingScope === "contact" ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() =>
                setAddingScope(addingScope === "contact" ? null : "contact")
              }
            >
              {addingScope === "contact" ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {labels.addContact}
            </Button>
          ) : null}
          {hasCompany ? (
            <Button
              type="button"
              variant={addingScope === "company" ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() =>
                setAddingScope(addingScope === "company" ? null : "company")
              }
            >
              {addingScope === "company" ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {labels.addCompany}
            </Button>
          ) : null}
        </div>
      ) : null}

      {addingScope === "contact" && contactId ? (
        <AddRowInline
          kind={kind}
          scope="contact"
          entityId={contactId}
          onDone={() => {
            setAddingScope(null);
            onInvalidate();
          }}
          onCancel={() => setAddingScope(null)}
        />
      ) : null}
      {addingScope === "company" && companyId ? (
        <AddRowInline
          kind={kind}
          scope="company"
          entityId={companyId}
          onDone={() => {
            setAddingScope(null);
            onInvalidate();
          }}
          onCancel={() => setAddingScope(null)}
        />
      ) : null}

      {totalRows === 0 && !addingScope ? (
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
          title={t("customers.scopePersonal", { defaultValue: "Personal" })}
        >
          {contactRows.map((row) => (
            <RowCard
              key={String(row.id)}
              kind={kind}
              scope="contact"
              entityId={contactId!}
              row={row}
              canEdit={canEdit}
              onInvalidate={onInvalidate}
            />
          ))}
        </ScopeGroup>
      ) : null}

      {companyRows.length > 0 ? (
        <ScopeGroup
          icon={<Building2 className="h-3 w-3" />}
          title={t("customers.scopeCompany", { defaultValue: "Company" })}
        >
          {companyRows.map((row) => (
            <RowCard
              key={String(row.id)}
              kind={kind}
              scope="company"
              entityId={companyId!}
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
  scope: Scope;
  entityId: string;
  row: Record<string, unknown>;
  canEdit: boolean;
  onInvalidate: () => void;
}

function RowCard({
  kind,
  scope,
  entityId,
  row,
  canEdit,
  onInvalidate,
}: RowCardProps) {
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
        t("customers.copied", { defaultValue: "Copied to clipboard" }),
      );
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("customers.copyFailed", { defaultValue: "Could not copy" }));
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
        scope={scope}
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
                {t("customers.emptyValue", { defaultValue: "Empty" })}
              </span>
            )}
          </p>
          {isPrimary ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <Star className="h-2.5 w-2.5 fill-current" />
              {t("customers.primary", { defaultValue: "Primary" })}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {typeText ? (
            <span className="capitalize">{typeText}</span>
          ) : null}
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
            aria-label={t("customers.openExternal", {
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
            aria-label={t("customers.copy", { defaultValue: "Copy" })}
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
            aria-label={t("customers.edit", { defaultValue: "Edit" })}
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
  scope: Scope;
  entityId: string;
  row: Record<string, unknown>;
  onCancel: () => void;
  onDone: () => void;
}

function RowEditorInline({
  kind,
  scope,
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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const save = async () => {
    setSaving(true);
    try {
      if (kind === "email") {
        const body = {
          address: address.trim(),
          type: emailType,
          is_primary: primary,
        };
        if (scope === "contact") await patchContactEmail(entityId, id, body);
        else await patchCompanyEmail(entityId, id, body);
      } else if (kind === "phone") {
        const body = {
          number: phoneNum.trim(),
          type: phoneType,
          label: label.trim() || null,
          is_primary: primary,
        };
        if (scope === "contact") await patchContactPhone(entityId, id, body);
        else await patchCompanyPhone(entityId, id, body);
      } else {
        const body = {
          type: addrType,
          line1: line1.trim() || null,
          line2: line2.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          postal_code: postal.trim() || null,
          country: country.trim() || "DE",
          is_primary: primary,
        };
        if (scope === "contact") await patchContactAddress(entityId, id, body);
        else await patchCompanyAddress(entityId, id, body);
      }
      toast.success(t("customers.saved", { defaultValue: "Saved." }));
      onDone();
    } catch {
      toast.error(
        t("customers.saveFailed", { defaultValue: "Could not save." }),
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (
      !window.confirm(
        t("customers.confirmDeleteRow", { defaultValue: "Remove this entry?" }),
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      if (kind === "email") {
        if (scope === "contact") await deleteContactEmail(entityId, id);
        else await deleteCompanyEmail(entityId, id);
      } else if (kind === "phone") {
        if (scope === "contact") await deleteContactPhone(entityId, id);
        else await deleteCompanyPhone(entityId, id);
      } else {
        if (scope === "contact") await deleteContactAddress(entityId, id);
        else await deleteCompanyAddress(entityId, id);
      }
      toast.success(t("customers.removed", { defaultValue: "Removed." }));
      onDone();
    } catch {
      toast.error(
        t("customers.removeFailed", { defaultValue: "Could not remove." }),
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/2 p-3.5 space-y-3 ring-1 ring-primary/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Pencil className="h-3.5 w-3.5 text-primary" />
          {t("customers.editEntry", { defaultValue: "Edit entry" })}
        </div>
      </div>

      {kind === "email" ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <FieldRow
            label={t("customers.email", { defaultValue: "Email" })}
          >
            <Input
              type="email"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-9"
              placeholder="name@example.com"
            />
          </FieldRow>
          <FieldRow label={t("customers.type", { defaultValue: "Type" })}>
            <Select value={emailType} onValueChange={setEmailType}>
              <SelectTrigger className="h-9 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TYPES.map((x) => (
                  <SelectItem key={x} value={x} className="capitalize">
                    {x}
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
            label={t("customers.phoneNumber", { defaultValue: "Number" })}
          >
            <Input
              type="tel"
              value={phoneNum}
              onChange={(e) => setPhoneNum(e.target.value)}
              className="h-9"
              placeholder="+49…"
            />
          </FieldRow>
          <FieldRow label={t("customers.type", { defaultValue: "Type" })}>
            <Select value={phoneType} onValueChange={setPhoneType}>
              <SelectTrigger className="h-9 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHONE_TYPES.map((x) => (
                  <SelectItem key={x} value={x} className="capitalize">
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow
            label={t("customers.label", { defaultValue: "Label (optional)" })}
            className="sm:col-span-2"
          >
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-9"
              placeholder={t("customers.labelPh", {
                defaultValue: "e.g. desk, after-hours",
              })}
            />
          </FieldRow>
        </div>
      ) : null}

      {kind === "address" ? (
        <div className="grid gap-3 sm:grid-cols-6">
          <FieldRow
            label={t("customers.type", { defaultValue: "Type" })}
            className="sm:col-span-2"
          >
            <Select value={addrType} onValueChange={setAddrType}>
              <SelectTrigger className="h-9 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADDRESS_TYPES.map((x) => (
                  <SelectItem key={x} value={x} className="capitalize">
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow
            label={t("customers.country", { defaultValue: "Country" })}
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
            label={t("customers.addrLine1", { defaultValue: "Street" })}
            className="sm:col-span-6"
          >
            <Input
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              className="h-9"
            />
          </FieldRow>
          <FieldRow
            label={t("customers.addrLine2", {
              defaultValue: "Apt, suite, etc.",
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
            label={t("customers.addrPostal", { defaultValue: "Postal" })}
            className="sm:col-span-2"
          >
            <Input
              value={postal}
              onChange={(e) => setPostal(e.target.value)}
              className="h-9"
            />
          </FieldRow>
          <FieldRow
            label={t("customers.addrCity", { defaultValue: "City" })}
            className="sm:col-span-2"
          >
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="h-9"
            />
          </FieldRow>
          <FieldRow
            label={t("customers.addrState", { defaultValue: "State / Region" })}
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
            {t("customers.markPrimary", {
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
          onClick={remove}
          disabled={deleting || saving}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("customers.remove", { defaultValue: "Remove" })}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={onCancel}
            disabled={saving || deleting}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            onClick={save}
            disabled={saving || deleting}
          >
            {saving
              ? t("customers.saving", { defaultValue: "Saving…" })
              : t("customers.saveRow", { defaultValue: "Save" })}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AddRowInlineProps {
  kind: Kind;
  scope: Scope;
  entityId: string;
  onDone: () => void;
  onCancel: () => void;
}

function AddRowInline({
  kind,
  scope,
  entityId,
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
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("DE");
  const [primary, setPrimary] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      if (kind === "email") {
        if (!address.trim()) {
          toast.error(
            t("customers.emailRequired", {
              defaultValue: "Email is required.",
            }),
          );
          setSaving(false);
          return;
        }
        const body = {
          address: address.trim(),
          type: emailType,
          is_primary: primary,
        };
        if (scope === "contact") await addContactEmail(entityId, body);
        else await addCompanyEmail(entityId, body);
      } else if (kind === "phone") {
        if (!phoneNum.trim()) {
          toast.error(
            t("customers.phoneRequired", {
              defaultValue: "Phone number is required.",
            }),
          );
          setSaving(false);
          return;
        }
        const body = {
          number: phoneNum.trim(),
          type: phoneType,
          is_primary: primary,
        };
        if (scope === "contact") await addContactPhone(entityId, body);
        else await addCompanyPhone(entityId, body);
      } else {
        const body = {
          type: addrType,
          line1: line1.trim() || null,
          city: city.trim() || null,
          postal_code: postal.trim() || null,
          country: country.trim() || "DE",
          is_primary: primary,
        };
        if (scope === "contact") await addContactAddress(entityId, body);
        else await addCompanyAddress(entityId, body);
      }
      toast.success(t("customers.added", { defaultValue: "Added." }));
      onDone();
    } catch {
      toast.error(
        t("customers.addFailed", { defaultValue: "Could not add." }),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/3 p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Plus className="h-3.5 w-3.5 text-primary" />
          {scope === "contact"
            ? t("customers.newPersonalEntry", {
                defaultValue: "New personal entry",
              })
            : t("customers.newCompanyEntry", {
                defaultValue: "New company entry",
              })}
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
                <SelectItem key={x} value={x} className="capitalize">
                  {x}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {kind === "phone" ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Input
            type="tel"
            value={phoneNum}
            onChange={(e) => setPhoneNum(e.target.value)}
            placeholder="+49…"
            className="h-9"
            autoFocus
          />
          <Select value={phoneType} onValueChange={setPhoneType}>
            <SelectTrigger className="h-9 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHONE_TYPES.map((x) => (
                <SelectItem key={x} value={x} className="capitalize">
                  {x}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {kind === "address" ? (
        <div className="grid gap-3 sm:grid-cols-6">
          <FieldRow
            label={t("customers.type", { defaultValue: "Type" })}
            className="sm:col-span-2"
          >
            <Select value={addrType} onValueChange={setAddrType}>
              <SelectTrigger className="h-9 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADDRESS_TYPES.map((x) => (
                  <SelectItem key={x} value={x} className="capitalize">
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow
            label={t("customers.country", { defaultValue: "Country" })}
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
            label={t("customers.addrLine1", { defaultValue: "Street" })}
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
            label={t("customers.addrPostal", { defaultValue: "Postal" })}
            className="sm:col-span-2"
          >
            <Input
              value={postal}
              onChange={(e) => setPostal(e.target.value)}
              className="h-9"
            />
          </FieldRow>
          <FieldRow
            label={t("customers.addrCity", { defaultValue: "City" })}
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
            checked={primary}
            onCheckedChange={(v) => setPrimary(v === true)}
          />
          <span className="font-medium">
            {t("customers.markPrimary", {
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
          disabled={saving}
        >
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs"
          onClick={submit}
          disabled={saving}
        >
          {saving
            ? t("customers.saving", { defaultValue: "Saving…" })
            : t("customers.addRow", { defaultValue: "Add" })}
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
