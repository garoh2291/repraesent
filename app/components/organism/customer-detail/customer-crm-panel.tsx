import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  User,
  Building2,
  Cake,
  Globe,
  Sparkles,
  Plus,
  Search,
  Link as LinkIcon,
} from "lucide-react";
import { patchCustomer } from "~/lib/api/customers";
import {
  patchContact,
  type PatchContactBody,
} from "~/lib/api/contacts";
import {
  patchCompany,
  createCompany,
  listCompanies,
  type PatchCompanyBody,
} from "~/lib/api/companies";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { toast } from "sonner";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { ContactCompanyLinksSection } from "./contact-company-links-section";
import { cn } from "~/lib/utils";

function isoDateInput(v: unknown): string {
  if (v == null || v === "") return "";
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

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

function PanelHeader({ icon, title, subtitle, action }: ProfilePanelHeaderProps) {
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
        onClick={onSave}
        disabled={saving || !dirty || disabledExtra}
      >
        {saving
          ? t("customers.saving", { defaultValue: "Saving…" })
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
  const [first, setFirst] = useState(String(contact.first_name ?? ""));
  const [last, setLast] = useState(String(contact.last_name ?? ""));
  const [notes, setNotes] = useState(String(contact.notes ?? ""));
  const [dob, setDob] = useState(isoDateInput(contact.date_of_birth));
  const [gender, setGender] = useState(String(contact.gender ?? ""));
  const [newsletter, setNewsletter] = useState(!!contact.newsletter_opt_in);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setFirst(String(contact.first_name ?? ""));
    setLast(String(contact.last_name ?? ""));
    setNotes(String(contact.notes ?? ""));
    setDob(isoDateInput(contact.date_of_birth));
    setGender(String(contact.gender ?? ""));
    setNewsletter(!!contact.newsletter_opt_in);
    setDirty(false);
  }, [contact]);

  const markDirty = () => setDirty(true);

  const mutation = useMutation({
    mutationFn: (body: PatchContactBody) => patchContact(contactId, body),
    onSuccess: () => {
      onSaved();
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
    mutation.mutate({
      first_name: first.trim() || null,
      last_name: last.trim() || null,
      notes: notes.trim() || null,
      date_of_birth: dob || null,
      gender: gender.trim() || null,
      newsletter_opt_in: newsletter,
    });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
      <PanelHeader
        icon={<User />}
        title={t("customers.section.contact", { defaultValue: "Contact profile" })}
        subtitle={t("customers.contactProfileHint", {
          defaultValue: "Personal details about this customer.",
        })}
      />
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <FormField
          label={t("customers.firstName", { defaultValue: "First name" })}
        >
          <Input
            value={first}
            onChange={(e) => {
              setFirst(e.target.value);
              markDirty();
            }}
            disabled={!canEdit}
            className="h-9"
          />
        </FormField>
        <FormField label={t("customers.lastName", { defaultValue: "Last name" })}>
          <Input
            value={last}
            onChange={(e) => {
              setLast(e.target.value);
              markDirty();
            }}
            disabled={!canEdit}
            className="h-9"
          />
        </FormField>
        <FormField
          label={t("customers.dateOfBirth", { defaultValue: "Date of birth" })}
        >
          <div className="relative">
            <Cake className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={dob}
              onChange={(e) => {
                setDob(e.target.value);
                markDirty();
              }}
              disabled={!canEdit}
              className="h-9 pl-9"
            />
          </div>
        </FormField>
        <FormField label={t("customers.gender", { defaultValue: "Gender" })}>
          <Input
            value={gender}
            onChange={(e) => {
              setGender(e.target.value);
              markDirty();
            }}
            disabled={!canEdit}
            className="h-9"
            placeholder={t("customers.genderPh", {
              defaultValue: "e.g. female",
            })}
          />
        </FormField>
        <FormField
          label={t("customers.contactNotes", { defaultValue: "Notes" })}
          className="sm:col-span-2"
          hint={t("customers.contactNotesHint", {
            defaultValue:
              "Personal context. Use sidebar for sales/internal notes.",
          })}
        >
          <Textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              markDirty();
            }}
            disabled={!canEdit}
            rows={2}
            className="text-sm"
          />
        </FormField>
        <div className="sm:col-span-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs transition-colors hover:bg-muted/60">
            <Checkbox
              id="newsletter"
              checked={newsletter}
              onCheckedChange={(v) => {
                setNewsletter(v === true);
                markDirty();
              }}
              disabled={!canEdit}
            />
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">
                {t("customers.newsletterOptIn", {
                  defaultValue: "Subscribed to newsletter",
                })}
              </span>
            </span>
          </label>
        </div>
      </div>
      {canEdit ? (
        <PanelFooter
          dirty={dirty}
          saving={mutation.isPending}
          onSave={save}
          saveLabel={t("customers.saveContact", {
            defaultValue: "Save contact",
          })}
        />
      ) : null}
    </section>
  );
}

export function CompanyProfileSection({
  companyId,
  company,
  canEdit,
  onSaved,
}: {
  companyId: string;
  company: Record<string, unknown>;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(String(company.name ?? ""));
  const [legalForm, setLegalForm] = useState(String(company.legal_form ?? ""));
  const [website, setWebsite] = useState(String(company.website ?? ""));
  const [notes, setNotes] = useState(String(company.notes ?? ""));
  const [founded, setFounded] = useState(isoDateInput(company.founded_on));
  const [newsletter, setNewsletter] = useState(!!company.newsletter_opt_in);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setName(String(company.name ?? ""));
    setLegalForm(String(company.legal_form ?? ""));
    setWebsite(String(company.website ?? ""));
    setNotes(String(company.notes ?? ""));
    setFounded(isoDateInput(company.founded_on));
    setNewsletter(!!company.newsletter_opt_in);
    setDirty(false);
  }, [company]);

  const markDirty = () => setDirty(true);

  const mutation = useMutation({
    mutationFn: (body: PatchCompanyBody) => patchCompany(companyId, body),
    onSuccess: () => {
      onSaved();
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
    mutation.mutate({
      name: name.trim() || undefined,
      legal_form: legalForm.trim() || null,
      website: website.trim() || null,
      notes: notes.trim() || null,
      founded_on: founded || null,
      newsletter_opt_in: newsletter,
    });
  };

  const websiteHref = website.trim()
    ? website.trim().startsWith("http")
      ? website.trim()
      : `https://${website.trim()}`
    : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
      <PanelHeader
        icon={<Building2 />}
        title={t("customers.section.company", {
          defaultValue: "Company profile",
        })}
        subtitle={t("customers.companyProfileHint", {
          defaultValue: "Business details linked to this customer.",
        })}
        action={
          websiteHref ? (
            <a
              href={websiteHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Globe className="h-3 w-3" />
              {t("customers.visitWebsite", { defaultValue: "Visit" })}
            </a>
          ) : null
        }
      />
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <FormField
          label={t("customers.companyName", { defaultValue: "Company name" })}
          className="sm:col-span-2"
        >
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              markDirty();
            }}
            disabled={!canEdit}
            className="h-9"
          />
        </FormField>
        <FormField label={t("customers.legalForm", { defaultValue: "Legal form" })}>
          <Input
            value={legalForm}
            onChange={(e) => {
              setLegalForm(e.target.value);
              markDirty();
            }}
            disabled={!canEdit}
            className="h-9"
            placeholder="GmbH, Ltd…"
          />
        </FormField>
        <FormField label={t("customers.foundedOn", { defaultValue: "Founded" })}>
          <Input
            type="date"
            value={founded}
            onChange={(e) => {
              setFounded(e.target.value);
              markDirty();
            }}
            disabled={!canEdit}
            className="h-9"
          />
        </FormField>
        <FormField
          label={t("customers.website", { defaultValue: "Website" })}
          className="sm:col-span-2"
        >
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={website}
              onChange={(e) => {
                setWebsite(e.target.value);
                markDirty();
              }}
              disabled={!canEdit}
              className="h-9 pl-9"
              placeholder="example.com"
            />
          </div>
        </FormField>
        <FormField
          label={t("customers.companyNotes", { defaultValue: "Notes" })}
          className="sm:col-span-2"
        >
          <Textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              markDirty();
            }}
            disabled={!canEdit}
            rows={2}
            className="text-sm"
          />
        </FormField>
        <div className="sm:col-span-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs transition-colors hover:bg-muted/60">
            <Checkbox
              id="co-newsletter"
              checked={newsletter}
              onCheckedChange={(v) => {
                setNewsletter(v === true);
                markDirty();
              }}
              disabled={!canEdit}
            />
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">
                {t("customers.newsletterOptIn", {
                  defaultValue: "Subscribed to newsletter",
                })}
              </span>
            </span>
          </label>
        </div>
      </div>
      {canEdit ? (
        <PanelFooter
          dirty={dirty}
          saving={mutation.isPending}
          onSave={save}
          saveLabel={t("customers.saveCompany", {
            defaultValue: "Save company",
          })}
          disabledExtra={!name.trim()}
        />
      ) : null}
    </section>
  );
}

export function CompanyAttachSection({
  customerId,
  canEdit,
  onAttached,
}: {
  customerId: string;
  canEdit: boolean;
  onAttached: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [newCompanyName, setNewCompanyName] = useState("");

  const companiesQuery = useQuery({
    queryKey: ["companies-attach", debouncedSearch],
    queryFn: () => listCompanies(debouncedSearch || undefined),
    enabled: canEdit && mode === "pick",
  });

  const attachMutation = useMutation({
    mutationFn: (companyId: string) =>
      patchCustomer(customerId, { company_id: companyId }),
    onSuccess: () => {
      toast.success(t("customers.saved", { defaultValue: "Saved." }));
      void queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onAttached();
    },
    onError: () => {
      toast.error(t("customers.saveFailed", { defaultValue: "Could not save." }));
    },
  });

  const createAndAttachMutation = useMutation({
    mutationFn: async () => {
      const name = newCompanyName.trim();
      const created = await createCompany({ name });
      const id = String((created as { id?: string }).id ?? "");
      if (!id) throw new Error("missing company id");
      await patchCustomer(customerId, { company_id: id });
    },
    onSuccess: () => {
      toast.success(t("customers.saved", { defaultValue: "Saved." }));
      setNewCompanyName("");
      void queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onAttached();
    },
    onError: () => {
      toast.error(t("customers.saveFailed", { defaultValue: "Could not save." }));
    },
  });

  if (!canEdit) {
    return (
      <section className="overflow-hidden rounded-2xl border border-dashed border-border bg-muted/20">
        <div className="p-6 text-center">
          <Building2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            {t("customers.noCompanyLinked", {
              defaultValue: "No company is linked to this customer.",
            })}
          </p>
        </div>
      </section>
    );
  }

  const rows = companiesQuery.data ?? [];

  return (
    <section className="overflow-hidden rounded-2xl border border-dashed border-border bg-card shadow-(--shadow-sm)">
      <PanelHeader
        icon={<Building2 />}
        title={t("customers.section.company", {
          defaultValue: "Link a company",
        })}
        subtitle={t("customers.attachCompanyHint", {
          defaultValue:
            "No company yet. Pick an existing one or create a new record.",
        })}
      />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
          <button
            type="button"
            onClick={() => setMode("pick")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-all",
              mode === "pick"
                ? "bg-card text-foreground shadow-(--shadow-sm)"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("customers.pickCompany", { defaultValue: "Pick existing" })}
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-all",
              mode === "create"
                ? "bg-card text-foreground shadow-(--shadow-sm)"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("customers.createCompany", { defaultValue: "Create new" })}
          </button>
        </div>

        {mode === "pick" ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("customers.companySearchPh", {
                  defaultValue: "Search companies…",
                })}
                className="h-9 pl-9"
              />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-muted/10">
              {companiesQuery.isLoading ? (
                <p className="p-3 text-xs text-muted-foreground">
                  {t("common.loading")}
                </p>
              ) : rows.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  {t("customers.noCompaniesMatch", {
                    defaultValue: "No companies found.",
                  })}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {rows.map((c: Record<string, unknown>) => (
                    <li
                      key={String(c.id)}
                      className="flex items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-muted/40"
                    >
                      <span className="truncate text-sm font-medium">
                        {String(c.name ?? c.id)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-[11px]"
                        disabled={attachMutation.isPending}
                        onClick={() => attachMutation.mutate(String(c.id))}
                      >
                        <LinkIcon className="h-3 w-3" />
                        {t("customers.attach", { defaultValue: "Attach" })}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-w-md">
            <FormField
              label={t("customers.companyName", {
                defaultValue: "Company name",
              })}
            >
              <Input
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className="h-9"
                autoFocus
              />
            </FormField>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={
                !newCompanyName.trim() || createAndAttachMutation.isPending
              }
              onClick={() => createAndAttachMutation.mutate()}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("customers.createAndAttach", {
                defaultValue: "Create and attach",
              })}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export { ContactCompanyLinksSection };
