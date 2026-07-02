import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, Link2, Link2Off, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  getDealsForContact,
  detachDealContact,
  type DealListItem,
} from "~/lib/api/deals";
import { formatCurrency } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
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
import { CreateDealDialog } from "~/components/organism/create-deal-dialog";
import { DealStageBadge } from "~/components/molecule/deal-stage-badge";
import { AttachDealDialog } from "./attach-deal-dialog";

interface ContactDealsSectionProps {
  contactRouteId: string;
  /** Shown immediately in the create-deal dialog while the contact list loads in the background. */
  contactDisplayName?: string | null;
  canEdit?: boolean;
}

export function ContactDealsSection({
  contactRouteId,
  contactDisplayName,
  canEdit = false,
}: ContactDealsSectionProps) {
  const { t } = useTranslation();
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [attachDealOpen, setAttachDealOpen] = useState(false);
  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["contact-deals", contactRouteId],
    queryFn: () => getDealsForContact(contactRouteId),
    enabled: !!contactRouteId,
  });

  const headerActions = canEdit ? (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setAttachDealOpen(true)}
      >
        <Link2 className="h-3.5 w-3.5" />
        {t("contacts.dealsPanel.attachExisting", {
          defaultValue: "Attach deal",
        })}
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setCreateDealOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        {t("contacts.dealsPanel.createDeal", { defaultValue: "Create deal" })}
      </Button>
    </div>
  ) : null;

  return (
    <>
      <CreateDealDialog
        open={createDealOpen}
        onOpenChange={setCreateDealOpen}
        prefillContactId={contactRouteId}
        prefillContactLabel={contactDisplayName}
        canCreate={canEdit}
      />
      <AttachDealDialog
        open={attachDealOpen}
        onOpenChange={setAttachDealOpen}
        contactId={contactRouteId}
      />
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
        {isLoading ? (
          <>
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  {t("contacts.dealsPanel.title", { defaultValue: "Deals" })}
                </h2>
              </div>
              {headerActions}
            </header>
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
              {t("contacts.dealsPanel.loading", { defaultValue: "Loading deals…" })}
            </div>
          </>
        ) : deals.length === 0 ? (
          <>
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  {t("contacts.dealsPanel.title", { defaultValue: "Deals" })}
                </h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("contacts.dealsPanel.emptyHint", {
                    defaultValue:
                      "No deals linked yet. Use Create or add one from the pipeline.",
                  })}
                </p>
              </div>
              {headerActions}
            </header>
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              {t("contacts.dealsPanel.empty", {
                defaultValue: "No deals for this contact.",
              })}
            </div>
          </>
        ) : (
          <>
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  {t("contacts.dealsPanel.title", { defaultValue: "Deals" })}
                </h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("contacts.dealsPanel.subtitle", {
                    defaultValue:
                      "Open a deal in the pipeline to edit stage and value.",
                  })}
                </p>
              </div>
              {headerActions}
            </header>
            <ul className="divide-y divide-border">
              {deals.map((d) => (
                <DealRow
                  key={d.id}
                  deal={d}
                  contactId={contactRouteId}
                  canEdit={canEdit}
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

interface DealRowProps {
  deal: DealListItem;
  contactId: string;
  canEdit: boolean;
}

function DealRow({ deal, contactId, canEdit }: DealRowProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const title =
    deal.title?.trim() ||
    deal.contact_full_name?.trim() ||
    t("contacts.dealsPanel.untitled", { defaultValue: "Untitled deal" });
  const val =
    deal.value != null && deal.value !== ""
      ? formatCurrency(Number(deal.value))
      : null;

  const detachMutation = useMutation({
    mutationFn: () => detachDealContact(deal.id, contactId),
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
  });

  return (
    <li className="group flex items-center gap-1 pr-2 transition-colors hover:bg-muted/40">
      <Link
        to={`/pipeline/${deal.id}`}
        className={cn(
          "flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-sm",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{title}</p>
          <DealStageBadge stage={deal.stage} className="mt-0.5 text-[11px]" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {val ? (
            <span className="text-xs font-semibold tabular-nums">{val}</span>
          ) : null}
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </Link>
      {canEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setConfirmOpen(true)}
          disabled={detachMutation.isPending}
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={t("contacts.dealsPanel.detach", {
            defaultValue: "Detach deal",
          })}
          title={t("contacts.dealsPanel.detach", {
            defaultValue: "Detach deal",
          })}
        >
          <Link2Off className="h-3.5 w-3.5" />
        </Button>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("contacts.dealsPanel.detachConfirmTitle", {
                defaultValue: "Detach this deal?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("contacts.dealsPanel.detachConfirmDescription", {
                title,
                defaultValue:
                  '"{{title}}" will be unlinked from this contact. The deal itself is not deleted and can be re-attached later.',
              })}
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
                setConfirmOpen(false);
                detachMutation.mutate();
              }}
            >
              {t("contacts.dealsPanel.detach", { defaultValue: "Detach deal" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
