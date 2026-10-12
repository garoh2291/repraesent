import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Building2, Plus, UserMinus, UserRound, Users } from "lucide-react";
import { AddPeopleDialog } from "./add-people-dialog";
import { toast } from "sonner";
import type { ContactDetail } from "~/lib/api/contacts-crm";
import { patchContact } from "~/lib/api/contacts";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Button } from "~/components/ui/button";
import {
  CompanyPicker,
  EMPTY_COMPANY,
  companyErrorMessage,
  companyPickerPayload,
  type CompanyPickerValue,
} from "~/components/molecule/company-picker";
import { CreateContactDialog } from "~/components/organism/create-contact-dialog";

interface ContactCompanySectionProps {
  contactId: string;
  displayName: string;
  isCompany: boolean;
  company: ContactDetail["company"];
  people: NonNullable<ContactDetail["people"]>;
  includes: NonNullable<ContactDetail["includes"]>;
  canEdit: boolean;
  onInvalidate: () => void;
}

/**
 * Where a contact sits among companies. For a person: the company they work
 * at. For a company: the people who work there, the company it is part of and
 * the companies that are part of it.
 */
export function ContactCompanySection({
  contactId,
  displayName,
  isCompany,
  company,
  people,
  includes,
  canEdit,
  onInvalidate,
}: ContactCompanySectionProps) {
  const { t } = useTranslation();
  const saved: CompanyPickerValue = company
    ? { id: company.id, name: company.full_name?.trim() || "" }
    : EMPTY_COMPANY;
  const [value, setValue] = useState<CompanyPickerValue>(saved);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  // Stable identity: the dialog re-applies its start values whenever this
  // object changes, which would wipe what the owner is typing.
  const addPersonStart = useMemo(
    () => ({
      kind: "person" as const,
      company: { id: contactId, name: displayName },
    }),
    [contactId, displayName],
  );

  useEffect(() => {
    setValue(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, company?.full_name]);

  const changed =
    value.id !== saved.id || (!value.id && value.name.trim() !== saved.name);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = companyPickerPayload(value);
      return patchContact(
        contactId,
        Object.keys(payload).length > 0 ? payload : { parent_contact_id: null },
      );
    },
    onSuccess: () => {
      onInvalidate();
      toast.success(t("contacts.saved", { defaultValue: "Saved." }));
    },
    onError: (error) => {
      toast.error(t("contacts.saveFailed", { defaultValue: "Could not save." }), {
        description: companyErrorMessage(error, t) ?? extractErrorMessage(error),
      });
    },
  });

  // The person stays in People; only where they work is cleared.
  const removeMutation = useMutation({
    mutationFn: (person: { id: string; name: string }) =>
      patchContact(person.id, { parent_contact_id: null }),
    onSuccess: (_data, person) => {
      onInvalidate();
      toast.success(
        t("contacts.company.removed", {
          defaultValue: "{{name}} removed from this company.",
          name: person.name,
        }),
      );
    },
    onError: (error) => {
      toast.error(t("contacts.saveFailed", { defaultValue: "Could not save." }), {
        description: extractErrorMessage(error),
      });
    },
  });

  const pickerLabel = isCompany
    ? t("contacts.company.partOf", { defaultValue: "Part of" })
    : t("contacts.company.company", { defaultValue: "Company" });

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
      <CreateContactDialog
        open={addPersonOpen}
        onOpenChange={setAddPersonOpen}
        start="manual"
        initialValues={addPersonStart}
        onCreated={onInvalidate}
      />
      {isCompany ? (
        <AddPeopleDialog
          open={addExistingOpen}
          onOpenChange={setAddExistingOpen}
          companyId={contactId}
          companyName={displayName}
          onChanged={onInvalidate}
        />
      ) : null}

      <div className="space-y-1.5 px-4 py-3.5 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="contact-company-picker"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            {pickerLabel}
          </label>
          {company ? (
            <Link
              to={`/companies/${company.id}`}
              className="text-xs font-medium text-foreground underline underline-offset-2 hover:no-underline max-sm:flex max-sm:min-h-11 max-sm:items-center"
            >
              {t("contacts.company.open", {
                defaultValue: "Open {{name}}",
                name: company.full_name?.trim() || "",
              })}
            </Link>
          ) : null}
        </div>
        <CompanyPicker
          id="contact-company-picker"
          value={value}
          onChange={setValue}
          excludeId={contactId}
          disabled={!canEdit}
          placeholder={
            isCompany
              ? t("contacts.company.partOfPlaceholder", {
                  defaultValue: "A bigger company it belongs to (optional)",
                })
              : t("contacts.company.companyPlaceholder", {
                  defaultValue: "Where they work (optional)",
                })
          }
        />
        {changed && canEdit ? (
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs max-sm:h-11 max-sm:text-sm"
              onClick={() => setValue(saved)}
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs max-sm:h-11 max-sm:text-sm"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {t("common.save", { defaultValue: "Save" })}
            </Button>
          </div>
        ) : null}
      </div>

      {isCompany ? (
        <>
          <header className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3.5 sm:px-5">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {t("contacts.company.peopleHere", {
                defaultValue: "People here",
              })}
              {people.length > 0 ? (
                <span className="num ml-1.5 font-normal text-muted-foreground">
                  {people.length}
                </span>
              ) : null}
            </h2>
            {canEdit ? (
              <div className="flex shrink-0 items-center gap-2 max-sm:w-full">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs max-sm:h-11 max-sm:flex-1 max-sm:text-sm"
                  onClick={() => setAddExistingOpen(true)}
                >
                  <Users className="h-3.5 w-3.5" />
                  {t("contacts.company.addExisting", {
                    defaultValue: "Add existing",
                  })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 text-xs max-sm:h-11 max-sm:flex-1 max-sm:text-sm"
                  onClick={() => setAddPersonOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("contacts.company.addPerson", {
                    defaultValue: "Add person",
                  })}
                </Button>
              </div>
            ) : null}
          </header>
          {people.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-5">
              {t("contacts.company.noPeopleYet", {
                defaultValue:
                  "Nobody yet. Add someone you already have, or a new person.",
              })}
            </p>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {people.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center transition-colors hover:bg-muted/60"
                >
                  <Link
                    to={`/contacts/${p.id}`}
                    className="press flex min-h-11 min-w-0 flex-1 items-center gap-3 px-4 py-2.5 sm:pl-5"
                  >
                    <UserRound className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {p.full_name?.trim() ||
                          p.primary_email ||
                          p.primary_phone ||
                          "—"}
                      </span>
                      {p.job_title || p.primary_email || p.primary_phone ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {[p.job_title?.trim(), p.primary_email || p.primary_phone]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={removeMutation.isPending}
                      onClick={() =>
                        removeMutation.mutate({
                          id: p.id,
                          name:
                            p.full_name?.trim() ||
                            p.primary_email ||
                            p.primary_phone ||
                            "—",
                        })
                      }
                      className="mr-2 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive max-sm:mr-1 max-sm:size-11"
                      aria-label={t("contacts.company.remove", {
                        defaultValue: "Remove from this company",
                      })}
                      title={t("contacts.company.remove", {
                        defaultValue: "Remove from this company",
                      })}
                    >
                      <UserMinus className="h-3.5 w-3.5 max-sm:size-4" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {includes.length > 0 ? (
            <>
              <header className="border-t border-border px-4 py-3.5 sm:px-5">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  {t("contacts.company.includes", {
                    defaultValue: "Companies that are part of it",
                  })}
                </h2>
              </header>
              <ul className="divide-y divide-border border-t border-border">
                {includes.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/companies/${c.id}`}
                      className="press flex min-h-11 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60 sm:px-5"
                    >
                      <Building2 className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {c.full_name?.trim() || "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
