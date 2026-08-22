import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ExternalLink,
  Link2,
  Link2Off,
  Sparkles,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import {
  createDealCustomer,
  linkDealCustomer,
  unlinkDealCustomer,
  type DealCustomer,
  type DealCustomerSuggestion,
  type DealDetailResponse,
} from "~/lib/api/deals";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { stripeDashboardUrl } from "~/lib/api/stripe-catalog";
import { useStripeConnection } from "~/lib/hooks/useWorkspaceIntegrations";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { LinkCustomerDialog } from "./link-customer-dialog";

interface DealCustomerSectionProps {
  dealId: string;
  customer: DealCustomer | null;
  suggestion: DealCustomerSuggestion | null;
  canEdit?: boolean;
}

/**
 * The Stripe customer a deal bills to. Third sibling of the contacts and
 * products cards, in the same idiom: header with the action, a row body, an
 * empty state that says what to do next.
 */
export function DealCustomerSection({
  dealId,
  customer,
  suggestion,
  canEdit = false,
}: DealCustomerSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { stripe } = useStripeConnection();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);
  const dealKey = ["deal", dealId] as const;

  const applyDetail = (detail: DealDetailResponse) => {
    queryClient.setQueryData(dealKey, detail);
    void queryClient.invalidateQueries({
      queryKey: ["deal-history", dealId],
      refetchType: "none",
    });
  };

  const linkMutation = useMutation({
    mutationFn: (stripeCustomerId: string) =>
      linkDealCustomer(dealId, stripeCustomerId),
    onSuccess: (detail) => {
      applyDetail(detail);
      toast.success(
        t("pipeline.customer.linkedToast", { defaultValue: "Customer linked." }),
      );
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const createMutation = useMutation({
    mutationFn: (input: { name: string; email: string; contact_id?: string }) =>
      createDealCustomer(dealId, input),
    onSuccess: (detail) => {
      applyDetail(detail);
      void queryClient.invalidateQueries({ queryKey: ["contact"] });
      toast.success(
        t("pipeline.customer.created", {
          defaultValue: "Customer created in Stripe and linked.",
        }),
      );
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const unlinkMutation = useMutation({
    mutationFn: () => unlinkDealCustomer(dealId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: dealKey });
      const previous = queryClient.getQueryData<DealDetailResponse>(dealKey);
      if (previous) {
        queryClient.setQueryData<DealDetailResponse>(dealKey, {
          ...previous,
          customer: null,
          invoice_readiness: {
            ...previous.invoice_readiness,
            blockers: ["no_customer", ...previous.invoice_readiness.blockers],
          },
        });
      }
      return { previous };
    },
    onSuccess: (detail) => {
      applyDetail(detail);
      toast.success(
        t("pipeline.customer.unlinked", { defaultValue: "Customer unlinked." }),
      );
    },
    onError: (err, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(dealKey, ctx.previous);
      toast.error(extractErrorMessage(err));
    },
  });

  const busy =
    linkMutation.isPending ||
    createMutation.isPending ||
    unlinkMutation.isPending;

  const dashboardHref = customer
    ? stripeDashboardUrl(
        customer.stripe_account_id,
        stripe?.livemode ?? null,
        `customers/${customer.stripe_customer_id}`,
      )
    : null;

  return (
    <>
      <LinkCustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        suggestion={suggestion}
        currentCustomerId={customer?.stripe_customer_id ?? null}
        busy={busy}
        onLink={(id) => linkMutation.mutateAsync(id).then(() => undefined)}
        onCreate={(input) =>
          createMutation.mutateAsync(input).then(() => undefined)
        }
      />

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {t("pipeline.customer.title", { defaultValue: "Stripe customer" })}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {customer
                ? t("pipeline.customer.subtitle", {
                    defaultValue: "Invoices from this deal go here.",
                  })
                : t("pipeline.customer.emptyHint", {
                    defaultValue: "Needed before an invoice can be created.",
                  })}
            </p>
          </div>
          {canEdit ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                disabled={busy}
                onClick={() => setDialogOpen(true)}
              >
                <Link2 className="h-3.5 w-3.5" />
                {customer
                  ? t("pipeline.customer.change", { defaultValue: "Change" })
                  : t("pipeline.customer.link", { defaultValue: "Link customer" })}
              </Button>
            </div>
          ) : null}
        </header>

        {customer ? (
          <TooltipProvider>
            <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-background">
                <UserRound className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {customer.name ||
                      customer.email ||
                      t("pipeline.customer.unnamed", {
                        defaultValue: "Unnamed customer",
                      })}
                  </p>
                  {customer.currency ? (
                    <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      {customer.currency}
                    </span>
                  ) : null}
                  {customer.stale || customer.account_mismatch ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="shrink-0 text-amber-500">
                          <TriangleAlert className="h-3.5 w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-60 text-center">
                        {customer.account_mismatch
                          ? t("pipeline.customer.accountMismatch", {
                              defaultValue:
                                "Linked on a different Stripe account than the one connected now. Relink the customer.",
                            })
                          : t("pipeline.customer.stale", {
                              defaultValue:
                                "Stripe could not confirm this customer. It may have been deleted.",
                            })}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                  {customer.name && customer.email ? (
                    <span className="truncate">{customer.email}</span>
                  ) : null}
                  <span className="shrink-0 font-mono">
                    {customer.stripe_customer_id}
                  </span>
                  {dashboardHref ? (
                    <a
                      href={dashboardHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-0.5 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t("pipeline.customer.openInStripe", {
                        defaultValue: "Stripe",
                      })}
                    </a>
                  ) : null}
                </p>
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={busy}
                  onClick={() => setConfirmUnlinkOpen(true)}
                  aria-label={t("pipeline.customer.unlink", {
                    defaultValue: "Unlink customer",
                  })}
                  title={t("pipeline.customer.unlink", {
                    defaultValue: "Unlink customer",
                  })}
                >
                  <Link2Off className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </TooltipProvider>
        ) : (
          <div className="px-4 py-5 text-center sm:px-5">
            <p className="text-xs text-muted-foreground">
              {t("pipeline.customer.none", {
                defaultValue: "No Stripe customer linked to this deal.",
              })}
            </p>
            {canEdit && suggestion?.stripe_customer_id ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 h-8 gap-1.5 text-xs"
                disabled={busy}
                onClick={() =>
                  linkMutation.mutate(suggestion.stripe_customer_id!)
                }
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {t("pipeline.customer.useSuggestion", {
                  defaultValue: "Use {{name}}",
                  name: suggestion.name || suggestion.email || suggestion.stripe_customer_id,
                })}
              </Button>
            ) : null}
          </div>
        )}
      </section>

      <AlertDialog open={confirmUnlinkOpen} onOpenChange={setConfirmUnlinkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("pipeline.customer.unlinkConfirmTitle", {
                defaultValue: "Unlink this Stripe customer?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("pipeline.customer.unlinkConfirmBody", {
                name:
                  customer?.name ??
                  customer?.email ??
                  customer?.stripe_customer_id ??
                  "",
                defaultValue:
                  '"{{name}}" is unlinked from this deal only — nothing changes in Stripe, and invoices already on the deal stay. New invoices need a customer again.',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setConfirmUnlinkOpen(false);
                unlinkMutation.mutate();
              }}
            >
              {t("pipeline.customer.unlink", {
                defaultValue: "Unlink customer",
              })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
