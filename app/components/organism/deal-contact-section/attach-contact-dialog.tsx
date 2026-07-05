import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Link2, Link2Off, Search, X } from "lucide-react";
import { toast } from "sonner";
import { getContacts, type ContactListItem } from "~/lib/api/contacts-crm";
import { attachDealContact, detachDealContact } from "~/lib/api/deals";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface AttachContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  /** Contacts already attached to the deal. */
  attachedContactIds: string[];
}

export function AttachContactDialog({
  open,
  onOpenChange,
  dealId,
  attachedContactIds,
}: AttachContactDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [detachingId, setDetachingId] = useState<string | null>(null);

  const attachedSet = new Set(attachedContactIds);

  // Reset search each time the dialog opens.
  useEffect(() => {
    if (open) {
      setSearch("");
      setDebouncedSearch("");
    }
  }, [open]);

  // Debounce the search term so we don't hit the API on every keystroke.
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const contactsQuery = useQuery({
    queryKey: ["contacts", "attach-contact-dialog", debouncedSearch],
    queryFn: () =>
      getContacts({ page: 1, limit: 50, search: debouncedSearch || undefined }),
    enabled: open,
    staleTime: 30 * 1000,
  });

  const contacts = contactsQuery.data?.data ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["deal"] });
    void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
    void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
    void queryClient.invalidateQueries({ queryKey: ["contact"] });
  };

  // Attaching keeps the dialog open so several contacts can be added in a row;
  // the row flips to its "attached" state immediately.
  const attachMutation = useMutation({
    mutationFn: (contactId: string) => attachDealContact(dealId, contactId),
    onMutate: (contactId) => setAttachingId(contactId),
    onSuccess: () => {
      invalidate();
      toast.success(
        t("pipeline.contactAttached", { defaultValue: "Contact attached." }),
      );
    },
    onError: () => {
      toast.error(
        t("pipeline.errors.contactFailed", {
          defaultValue: "Could not update contact on deal.",
        }),
      );
    },
    onSettled: () => setAttachingId(null),
  });

  const detachMutation = useMutation({
    mutationFn: (contactId: string) => detachDealContact(dealId, contactId),
    onMutate: (contactId) => setDetachingId(contactId),
    onSuccess: () => {
      invalidate();
      toast.success(
        t("pipeline.contactDetached", { defaultValue: "Contact detached." }),
      );
    },
    onError: () => {
      toast.error(
        t("pipeline.errors.contactFailed", {
          defaultValue: "Could not update contact on deal.",
        }),
      );
    },
    onSettled: () => setDetachingId(null),
  });

  const busy = attachMutation.isPending || detachMutation.isPending;

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
            {t("pipeline.attachContactTitle", {
              defaultValue: "Attach existing contact",
            })}
          </DialogTitle>
          <DialogDescription>
            {t("pipeline.attachContactDescriptionMulti", {
              defaultValue:
                "Search for contacts and attach them to this deal. You can attach several; the first one becomes the primary contact.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("pipeline.attachContactSearchPlaceholder", {
              defaultValue: "Search by name, email, or phone…",
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
              {t("contacts.loading", {
                defaultValue: "Loading contacts…",
              })}
            </div>
          ) : contacts.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("pipeline.attachContactNoResults", {
                defaultValue: "No contacts found.",
              })}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {contacts.map((c) => {
                const alreadyAttached = attachedSet.has(c.id);
                const subtitle =
                  c.primary_email?.trim() || c.primary_phone?.trim() || null;
                const isAttaching = attachingId === c.id;
                const isDetaching = detachingId === c.id;

                const meta = subtitle ? (
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate">{subtitle}</span>
                  </p>
                ) : null;

                if (alreadyAttached) {
                  return (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {contactLabel(c)}
                        </p>
                        {meta}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                          <Check className="h-3.5 w-3.5" />
                          {t("pipeline.attachAlreadyAttached", {
                            defaultValue: "Attached",
                          })}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => detachMutation.mutate(c.id)}
                          disabled={busy}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label={t("pipeline.detachContact", {
                            defaultValue: "Detach",
                          })}
                          title={t("pipeline.detachContact", {
                            defaultValue: "Detach",
                          })}
                        >
                          {isDetaching ? (
                            <div className="h-3.5 w-3.5 app-spin rounded-full border-2 border-current/20 border-t-current" />
                          ) : (
                            <Link2Off className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </li>
                  );
                }

                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {contactLabel(c)}
                      </p>
                      {meta}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => attachMutation.mutate(c.id)}
                        disabled={busy}
                        className="h-7 gap-1.5 text-xs"
                      >
                        {isAttaching ? (
                          <div className="h-3.5 w-3.5 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5" />
                        )}
                        {t("pipeline.attachContactAction", {
                          defaultValue: "Attach",
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
