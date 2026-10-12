import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Search, X } from "lucide-react";
import { toast } from "sonner";
import { getContacts, type ContactListItem } from "~/lib/api/contacts-crm";
import { patchContact } from "~/lib/api/contacts";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { contactSubtitle } from "~/lib/contacts/contact-path";
import { companyErrorMessage } from "~/components/molecule/company-picker";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { desktopAutoFocus } from "~/lib/utils/touch";

interface AddPeopleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  /** Refreshes the pages a company link shows up on. */
  onChanged: () => void;
}

/**
 * Puts people who are already in People under this company. One company per
 * person, so someone who works elsewhere is moved — the row says where they
 * are now and the button says "Move here", never a silent switch.
 */
export function AddPeopleDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  onChanged,
}: AddPeopleDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Start from an empty search each time the dialog opens.
  useEffect(() => {
    if (open) {
      setSearch("");
      setDebouncedSearch("");
    }
  }, [open]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  // Under the "contacts" prefix on purpose: `onChanged` invalidates it, so a
  // row flips to its new state without a query of its own to refresh.
  const peopleQuery = useQuery({
    queryKey: ["contacts", "add-people-dialog", debouncedSearch],
    queryFn: () =>
      getContacts({
        page: 1,
        limit: 50,
        kind: "person",
        search: debouncedSearch || undefined,
      }),
    enabled: open,
    staleTime: 30 * 1000,
  });
  const people = peopleQuery.data?.data ?? [];

  const nameOf = (c: ContactListItem) =>
    c.contact_full_name?.trim() ||
    c.primary_email?.trim() ||
    c.primary_phone?.trim() ||
    t("contacts.untitled", { defaultValue: "Untitled contact" });

  // The dialog stays open so several people can be added in a row.
  const mutation = useMutation({
    mutationFn: (vars: { person: ContactListItem; here: boolean }) =>
      patchContact(vars.person.id, {
        parent_contact_id: vars.here ? companyId : null,
      }),
    onMutate: (vars) => setPendingId(vars.person.id),
    onSuccess: (_data, vars) => {
      onChanged();
      toast.success(
        vars.here
          ? t("contacts.company.added", {
              defaultValue: "{{name}} added.",
              name: nameOf(vars.person),
            })
          : t("contacts.company.removed", {
              defaultValue: "{{name}} removed from this company.",
              name: nameOf(vars.person),
            }),
      );
    },
    onError: (error) => {
      toast.error(t("contacts.saveFailed", { defaultValue: "Could not save." }), {
        description: companyErrorMessage(error, t) ?? extractErrorMessage(error),
      });
    },
    onSettled: () => setPendingId(null),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("contacts.company.addPeopleTitle", {
              defaultValue: "Add people to {{name}}",
              name: companyName,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("contacts.company.addPeopleHint", {
              defaultValue:
                "Pick people you already have. Someone who works elsewhere moves here.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("contacts.company.searchPeople", {
              defaultValue: "Search by name, email or phone…",
            })}
            className="pl-9 pr-9 max-sm:pr-11"
            autoComplete="off"
            enterKeyHint="search"
            autoFocus={desktopAutoFocus()}
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={t("common.clearSearch", { defaultValue: "Clear" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground max-sm:right-0 max-sm:flex max-sm:size-11 max-sm:items-center max-sm:justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="-mx-1 max-h-[320px] overflow-y-auto overscroll-contain rounded-md border border-border max-sm:max-h-[50dvh]">
          {peopleQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
              {t("contacts.loading", { defaultValue: "Loading contacts…" })}
            </div>
          ) : people.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("contacts.company.noPeopleFound", {
                defaultValue: "Nobody matches that. Try another name.",
              })}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {people.map((c) => {
                const isHere = c.parent_contact_id === companyId;
                const elsewhere =
                  !isHere && c.parent_full_name?.trim()
                    ? c.parent_full_name.trim()
                    : null;
                const reach = contactSubtitle({
                  job_title: c.job_title,
                  email: c.primary_email,
                  phone: c.primary_phone,
                });
                const pending = pendingId === c.id;
                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm max-sm:min-h-14"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {nameOf(c)}
                      </p>
                      {elsewhere ? (
                        <p className="mt-0.5 truncate text-[11px] text-foreground/80 max-sm:text-[12.5px]">
                          {t("contacts.company.nowAt", {
                            defaultValue: "Now at {{name}}",
                            name: elsewhere,
                          })}
                        </p>
                      ) : reach ? (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground max-sm:text-[12.5px]">
                          {reach}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isHere ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground max-sm:text-[13px]">
                          <Check className="h-3.5 w-3.5" />
                          {t("contacts.company.here", { defaultValue: "Here" })}
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant={isHere ? "ghost" : "outline"}
                        disabled={mutation.isPending}
                        onClick={() =>
                          mutation.mutate({ person: c, here: !isHere })
                        }
                        className="h-7 gap-1.5 text-xs max-sm:h-11 max-sm:px-3 max-sm:text-sm"
                      >
                        {pending ? (
                          <span className="h-3.5 w-3.5 app-spin rounded-full border-2 border-current/20 border-t-current" />
                        ) : null}
                        {isHere
                          ? t("contacts.company.removeShort", {
                              defaultValue: "Remove",
                            })
                          : elsewhere
                            ? t("contacts.company.moveHere", {
                                defaultValue: "Move here",
                              })
                            : t("contacts.company.add", {
                                defaultValue: "Add",
                              })}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
