import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  listContactCompanies,
  createContactCompany,
  updateContactCompany,
  deleteContactCompany,
  type ContactCompanyLink,
  type ContactCompanyRole,
} from "~/lib/api/contact-companies";
import { listCompanies } from "~/lib/api/companies";
import { useDebounce } from "~/lib/hooks/useDebounce";
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
import { toast } from "sonner";

const ROLES: ContactCompanyRole[] = [
  "employee",
  "owner",
  "manager",
  "contact",
  "other",
];

function isoDateInput(v: unknown): string {
  if (v == null || v === "") return "";
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

interface ContactCompanyLinksSectionProps {
  contactId: string;
  canEdit: boolean;
  onChanged: () => void;
}

export function ContactCompanyLinksSection({
  contactId,
  canEdit,
  onChanged,
}: ContactCompanyLinksSectionProps) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const debouncedSearch = useDebounce(companySearch, 300);
  const [pickedCompanyId, setPickedCompanyId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<ContactCompanyRole>("employee");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newPrimary, setNewPrimary] = useState(true);

  const linksQuery = useQuery({
    queryKey: ["contact-companies", contactId],
    queryFn: () => listContactCompanies(contactId),
    enabled: !!contactId,
  });

  const companiesQuery = useQuery({
    queryKey: ["companies-pick", debouncedSearch],
    queryFn: () => listCompanies(debouncedSearch || undefined),
    enabled: adding && canEdit,
  });

  const links = linksQuery.data ?? [];

  const existingCompanyIds = useMemo(
    () => new Set(links.map((l) => String(l.company_id))),
    [links],
  );

  const pickList = useMemo(() => {
    const raw = companiesQuery.data ?? [];
    return raw.filter((c) => !existingCompanyIds.has(String(c.id)));
  }, [companiesQuery.data, existingCompanyIds]);

  const createMut = useMutation({
    mutationFn: () =>
      createContactCompany(contactId, {
        company_id: pickedCompanyId!,
        role: newRole,
        job_title: newJobTitle.trim() || null,
        is_primary: newPrimary,
      }),
    onSuccess: () => {
      toast.success(t("customers.saved", { defaultValue: "Saved." }));
      setAdding(false);
      setPickedCompanyId(null);
      setCompanySearch("");
      setNewJobTitle("");
      setNewRole("employee");
      setNewPrimary(true);
      void linksQuery.refetch();
      onChanged();
    },
    onError: () => {
      toast.error(t("customers.saveFailed", { defaultValue: "Could not save." }));
    },
  });

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("customers.section.employers", {
            defaultValue: "Employers & company links",
          })}
        </h2>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAdding((v) => !v)}
          >
            {adding
              ? t("common.cancel", { defaultValue: "Cancel" })
              : t("customers.addCompanyLink", { defaultValue: "Add link" })}
          </Button>
        )}
      </div>

      {adding && canEdit && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3 text-sm">
          <div className="space-y-1.5">
            <Label className="text-xs">
              {t("customers.searchCompany", { defaultValue: "Search company" })}
            </Label>
            <Input
              value={companySearch}
              onChange={(e) => {
                setCompanySearch(e.target.value);
                setPickedCompanyId(null);
              }}
              placeholder={t("customers.companySearchPh", {
                defaultValue: "Type to filter…",
              })}
              className="h-9"
            />
          </div>
          <div className="max-h-40 overflow-y-auto rounded border border-border bg-card divide-y divide-border">
            {companiesQuery.isLoading ? (
              <p className="p-2 text-xs text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : pickList.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">
                {t("customers.noCompaniesMatch", {
                  defaultValue: "No companies match (or all are already linked).",
                })}
              </p>
            ) : (
              pickList.map((c) => (
                <button
                  key={String(c.id)}
                  type="button"
                  className={`w-full text-left px-2 py-2 text-sm hover:bg-muted/60 ${pickedCompanyId === String(c.id) ? "bg-muted" : ""}`}
                  onClick={() => setPickedCompanyId(String(c.id))}
                >
                  <span className="font-medium">{String(c.name ?? c.id)}</span>
                </button>
              ))
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("customers.linkRole", { defaultValue: "Role" })}</Label>
              <Select
                value={newRole}
                onValueChange={(v) => setNewRole(v as ContactCompanyRole)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("customers.jobTitle", { defaultValue: "Job title" })}</Label>
              <Input
                value={newJobTitle}
                onChange={(e) => setNewJobTitle(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="new-primary"
              checked={newPrimary}
              onCheckedChange={(v) => setNewPrimary(v === true)}
            />
            <Label htmlFor="new-primary" className="text-sm font-normal cursor-pointer">
              {t("customers.primaryEmployer", { defaultValue: "Primary" })}
            </Label>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!pickedCompanyId || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            {t("customers.saveLink", { defaultValue: "Save link" })}
          </Button>
        </div>
      )}

      {linksQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : links.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground py-1">
          {t("customers.noEmployerLinks", {
            defaultValue: "No company links yet.",
          })}
        </p>
      ) : (
        <ul className="space-y-3">
          {links.map((row) => (
            <ContactCompanyLinkRow
              key={String(row.id)}
              contactId={contactId}
              row={row}
              canEdit={canEdit}
              onChanged={() => {
                void linksQuery.refetch();
                onChanged();
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ContactCompanyLinkRow({
  contactId,
  row,
  canEdit,
  onChanged,
}: {
  contactId: string;
  row: ContactCompanyLink;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [role, setRole] = useState<ContactCompanyRole>(row.role);
  const [jobTitle, setJobTitle] = useState(String(row.job_title ?? ""));
  const [department, setDepartment] = useState(String(row.department ?? ""));
  const [primary, setPrimary] = useState(!!row.is_primary);
  const [started, setStarted] = useState(isoDateInput(row.started_on));
  const [ended, setEnded] = useState(isoDateInput(row.ended_on));

  useEffect(() => {
    setRole(row.role);
    setJobTitle(String(row.job_title ?? ""));
    setDepartment(String(row.department ?? ""));
    setPrimary(!!row.is_primary);
    setStarted(isoDateInput(row.started_on));
    setEnded(isoDateInput(row.ended_on));
  }, [row]);

  const updateMut = useMutation({
    mutationFn: () =>
      updateContactCompany(contactId, String(row.id), {
        role,
        job_title: jobTitle.trim() || null,
        department: department.trim() || null,
        is_primary: primary,
        started_on: started || null,
        ended_on: ended || null,
      }),
    onSuccess: () => {
      toast.success(t("customers.saved", { defaultValue: "Saved." }));
      onChanged();
    },
    onError: () => {
      toast.error(t("customers.saveFailed", { defaultValue: "Could not save." }));
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteContactCompany(contactId, String(row.id)),
    onSuccess: () => {
      toast.success(t("customers.linkRemoved", { defaultValue: "Link removed." }));
      onChanged();
    },
    onError: () => {
      toast.error(t("customers.saveFailed", { defaultValue: "Could not save." }));
    },
  });

  return (
    <li className="rounded-lg border border-border p-3 space-y-2">
      <div className="font-medium text-sm">
        {String(row.company_name ?? row.company_id)}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 text-sm">
        <div className="space-y-1">
          <Label className="text-xs">{t("customers.linkRole", { defaultValue: "Role" })}</Label>
          <Select
            value={role}
            onValueChange={(v) => setRole(v as ContactCompanyRole)}
            disabled={!canEdit}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("customers.jobTitle", { defaultValue: "Job title" })}</Label>
          <Input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            disabled={!canEdit}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("customers.department", { defaultValue: "Department" })}</Label>
          <Input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            disabled={!canEdit}
            className="h-9"
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Checkbox
            id={`pri-${row.id}`}
            checked={primary}
            onCheckedChange={(v) => setPrimary(v === true)}
            disabled={!canEdit}
          />
          <Label htmlFor={`pri-${row.id}`} className="text-sm font-normal cursor-pointer">
            {t("customers.primaryEmployer", { defaultValue: "Primary" })}
          </Label>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("customers.startedOn", { defaultValue: "Started" })}</Label>
          <Input
            type="date"
            value={started}
            onChange={(e) => setStarted(e.target.value)}
            disabled={!canEdit}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("customers.endedOn", { defaultValue: "Ended" })}</Label>
          <Input
            type="date"
            value={ended}
            onChange={(e) => setEnded(e.target.value)}
            disabled={!canEdit}
            className="h-9"
          />
        </div>
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={updateMut.isPending}
            onClick={() => updateMut.mutate()}
          >
            {t("customers.saveLink", { defaultValue: "Save link" })}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
            disabled={deleteMut.isPending}
            onClick={() => deleteMut.mutate()}
          >
            {t("customers.removeLink", { defaultValue: "Remove link" })}
          </Button>
        </div>
      )}
    </li>
  );
}
