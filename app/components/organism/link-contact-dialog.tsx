import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link2, Search, X } from "lucide-react";
import { getContacts, type ContactListItem } from "~/lib/api/contacts-crm";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface LinkContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Seeds the search box (optional; default empty so the full list shows). */
  initialSearch?: string;
  /** The email that will be attached — drives the primary/secondary row badge. */
  emailToAdd?: string | null;
  /** Called with the chosen contact id. The parent performs the actual link. */
  onSelect: (contactId: string) => void;
  /** Id currently being linked (shows a spinner on that row). */
  pendingId?: string | null;
}

/**
 * Generic contact typeahead picker. Unlike AttachContactDialog (deal-specific),
 * this just reports the chosen contact id via onSelect — the caller decides what
 * to do (here: link a BCC message and attach the email to the contact).
 */
export function LinkContactDialog({
  open,
  onOpenChange,
  initialSearch,
  emailToAdd,
  onSelect,
  pendingId,
}: LinkContactDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Seed the search with the email each time the dialog opens.
  useEffect(() => {
    if (open) {
      const seed = initialSearch?.trim() ?? "";
      setSearch(seed);
      setDebouncedSearch(seed);
    }
  }, [open, initialSearch]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const contactsQuery = useQuery({
    queryKey: ["contacts", "link-contact-dialog", debouncedSearch],
    queryFn: () =>
      getContacts({ page: 1, limit: 50, search: debouncedSearch || undefined }),
    enabled: open,
    staleTime: 30 * 1000,
  });

  const contacts = contactsQuery.data?.data ?? [];

  const contactLabel = (c: ContactListItem) =>
    c.contact_full_name?.trim() ||
    c.primary_email?.trim() ||
    c.primary_phone?.trim() ||
    t("contacts.untitled", { defaultValue: "Untitled contact" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("mail.linkDialogTitle", { defaultValue: "Link to a contact" })}
          </DialogTitle>
          <DialogDescription>
            {t("mail.linkDialogDescription", {
              defaultValue:
                "Search for the contact this email belongs to and connect it.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("mail.linkDialogSearchPlaceholder", {
              defaultValue: "Search contacts by name or email…",
            })}
            className="pl-9 pr-9"
            autoFocus
          />
          {search ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t("common.clearSearch", { defaultValue: "Clear" })}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <div className="-mx-1 max-h-[320px] overflow-y-auto rounded-md border border-border">
          {contactsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
              {t("contacts.loading", { defaultValue: "Loading contacts…" })}
            </div>
          ) : contacts.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("mail.linkDialogNoResults", {
                defaultValue: "No contacts found.",
              })}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {contacts.map((c) => {
                const subtitle =
                  c.primary_email?.trim() || c.primary_phone?.trim() || null;
                const isPending = pendingId === c.id;
                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {contactLabel(c)}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        {subtitle ? (
                          <span className="truncate">{subtitle}</span>
                        ) : null}
                        {emailToAdd ? (
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              c.primary_email?.trim()
                                ? "bg-muted text-muted-foreground"
                                : "bg-primary/10 text-primary",
                            )}
                          >
                            {c.primary_email?.trim()
                              ? t("mail.willBeSecondary", {
                                  defaultValue: "adds as secondary",
                                })
                              : t("mail.willBePrimary", {
                                  defaultValue: "adds as primary",
                                })}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onSelect(c.id)}
                      disabled={!!pendingId}
                      className="h-7 shrink-0 gap-1.5 text-xs"
                    >
                      {isPending ? (
                        <div className="h-3.5 w-3.5 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
                      ) : (
                        <Link2 className="h-3.5 w-3.5" />
                      )}
                      {t("mail.connect", { defaultValue: "Connect" })}
                    </Button>
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
