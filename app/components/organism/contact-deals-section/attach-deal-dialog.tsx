import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Link2, Link2Off, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  getDeals,
  getDealsForContact,
  attachDealContact,
  detachDealContact,
  type DealListItem,
} from "~/lib/api/deals";
import { formatCurrency } from "~/lib/utils/format";
import { DealStageBadge } from "~/components/molecule/deal-stage-badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface AttachDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
}

export function AttachDealDialog({
  open,
  onOpenChange,
  contactId,
}: AttachDealDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [detachingId, setDetachingId] = useState<string | null>(null);

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

  const dealsQuery = useQuery({
    queryKey: ["deals", "attach-deal-dialog", debouncedSearch],
    queryFn: () =>
      getDeals({ page: 1, limit: 50, search: debouncedSearch || undefined }),
    enabled: open,
    staleTime: 30 * 1000,
  });

  const deals = dealsQuery.data?.data ?? [];

  // Which deals this contact is already attached to (as primary or secondary).
  // Shares the cache key with the contact's deals list so both stay in sync.
  const attachedDealsQuery = useQuery({
    queryKey: ["contact-deals", contactId],
    queryFn: () => getDealsForContact(contactId),
    enabled: open,
  });
  const attachedDealIds = new Set(
    (attachedDealsQuery.data ?? []).map((d) => d.id),
  );

  const attachMutation = useMutation({
    mutationFn: (dealId: string) => attachDealContact(dealId, contactId),
    onMutate: (dealId) => setAttachingId(dealId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["deals"] });
      void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
      void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
      void queryClient.invalidateQueries({ queryKey: ["deal"] });
      void queryClient.invalidateQueries({ queryKey: ["contact"] });
      toast.success(
        t("contacts.dealsPanel.attached", { defaultValue: "Deal attached." }),
      );
    },
    onError: () => {
      toast.error(
        t("contacts.dealsPanel.attachFailed", {
          defaultValue: "Could not attach deal.",
        }),
      );
    },
    onSettled: () => setAttachingId(null),
  });

  // Unlinking a deal keeps the dialog open so the row updates to the
  // "not linked" state and can be re-attached right away.
  const detachMutation = useMutation({
    mutationFn: (dealId: string) => detachDealContact(dealId, contactId),
    onMutate: (dealId) => setDetachingId(dealId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["deals"] });
      void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
      void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
      void queryClient.invalidateQueries({ queryKey: ["deal"] });
      void queryClient.invalidateQueries({ queryKey: ["contact"] });
      toast.success(
        t("contacts.dealsPanel.detached", { defaultValue: "Deal detached." }),
      );
    },
    onError: () => {
      toast.error(
        t("contacts.dealsPanel.detachFailed", {
          defaultValue: "Could not detach deal.",
        }),
      );
    },
    onSettled: () => setDetachingId(null),
  });

  const busy = attachMutation.isPending || detachMutation.isPending;

  const dealLabel = (d: DealListItem) =>
    d.title?.trim() ||
    d.contact_full_name?.trim() ||
    t("contacts.dealsPanel.untitled", { defaultValue: "Untitled deal" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("contacts.dealsPanel.attachTitle", {
              defaultValue: "Attach existing deal",
            })}
          </DialogTitle>
          <DialogDescription>
            {t("contacts.dealsPanel.attachDescriptionMulti", {
              defaultValue:
                "Search for deals and link them to this contact. A deal can be linked to several contacts.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("contacts.dealsPanel.attachSearchPlaceholder", {
              defaultValue: "Search deals by title…",
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
          {dealsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
              {t("contacts.dealsPanel.loading", {
                defaultValue: "Loading deals…",
              })}
            </div>
          ) : deals.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("contacts.dealsPanel.attachNoResults", {
                defaultValue: "No deals found.",
              })}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {deals.map((d) => {
                const alreadyLinked = attachedDealIds.has(d.id);
                const val =
                  d.value != null && d.value !== ""
                    ? formatCurrency(Number(d.value))
                    : null;
                const isAttaching = attachingId === d.id;
                const isDetaching = detachingId === d.id;

                const meta = (
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                    <DealStageBadge stage={d.stage} />
                    {d.contact_full_name && !alreadyLinked ? (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span>
                          {t("contacts.dealsPanel.attachCurrentContact", {
                            name: d.contact_full_name,
                            defaultValue: "Linked to {{name}}",
                          })}
                        </span>
                      </>
                    ) : null}
                  </p>
                );

                if (alreadyLinked) {
                  return (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {dealLabel(d)}
                        </p>
                        {meta}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {val ? (
                          <span className="text-xs font-semibold tabular-nums text-foreground">
                            {val}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                          <Check className="h-3.5 w-3.5" />
                          {t("contacts.dealsPanel.attachAlreadyLinked", {
                            defaultValue: "Attached",
                          })}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => detachMutation.mutate(d.id)}
                          disabled={busy}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label={t("contacts.dealsPanel.detach", {
                            defaultValue: "Detach deal",
                          })}
                          title={t("contacts.dealsPanel.detach", {
                            defaultValue: "Detach deal",
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
                    key={d.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {dealLabel(d)}
                      </p>
                      {meta}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {val ? (
                        <span className="text-xs font-semibold tabular-nums text-foreground">
                          {val}
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => attachMutation.mutate(d.id)}
                        disabled={busy}
                        className="h-7 gap-1.5 text-xs"
                      >
                        {isAttaching ? (
                          <div className="h-3.5 w-3.5 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5" />
                        )}
                        {t("contacts.dealsPanel.attachAction", {
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
