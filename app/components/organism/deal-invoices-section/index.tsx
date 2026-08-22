import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Link2Off,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Repeat,
  Send,
  TriangleAlert,
} from "lucide-react";
import {
  cancelDealSubscription,
  getDealInvoices,
  markDealInvoicePaid,
  sendDealInvoice,
  unlinkDealInvoice,
  voidDealInvoice,
  type DealCustomer,
  type DealDetailResponse,
  type DealInvoice,
  type DealProduct,
  type InvoiceReadiness,
} from "~/lib/api/deals";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { stripeDashboardUrl } from "~/lib/api/stripe-catalog";
import { useStripeConnection } from "~/lib/hooks/useWorkspaceIntegrations";
import { formatDateMedium, formatMoneyFromMinor } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
import { CreateInvoiceDialog } from "./create-invoice-dialog";
import { LinkInvoiceDialog } from "./link-invoice-dialog";

interface DealInvoicesSectionProps {
  dealId: string;
  invoices: DealInvoice[];
  readiness: InvoiceReadiness;
  products: DealProduct[];
  customer: DealCustomer | null;
  canEdit?: boolean;
}

type Action = "send" | "void" | "mark-paid" | "cancel-subscription" | "unlink";

const ACTION_FN: Record<
  Action,
  (dealId: string, invoiceId: string) => Promise<DealDetailResponse>
> = {
  send: sendDealInvoice,
  void: voidDealInvoice,
  "mark-paid": markDealInvoicePaid,
  "cancel-subscription": cancelDealSubscription,
  unlink: unlinkDealInvoice,
};

/** The colour rail on the left of each row: status at a glance, no reading. */
function railClass(invoice: DealInvoice): string {
  if (invoice.kind === "subscription" && invoice.subscription_status === "canceled") {
    return "bg-muted-foreground/30";
  }
  switch (invoice.status) {
    case "paid":
      return "bg-emerald-500";
    case "open":
      return "bg-primary";
    case "draft":
      return "bg-amber-400";
    case "void":
    case "uncollectible":
      return "bg-destructive";
    default:
      return "bg-border";
  }
}

export function StatusPill({ status, kind }: { status: string | null; kind: "invoice" | "subscription" }) {
  const { t } = useTranslation();
  if (!status) return null;
  const tone: Record<string, string> = {
    paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    trialing: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    open: "bg-primary/10 text-primary",
    draft: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    past_due: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    unpaid: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    incomplete: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    void: "bg-destructive/10 text-destructive",
    uncollectible: "bg-destructive/10 text-destructive",
    canceled: "bg-muted text-muted-foreground",
  };
  const label =
    kind === "subscription"
      ? t(`pipeline.invoices.subscriptionStatus.${status}`, { defaultValue: status })
      : t(`pipeline.invoices.status.${status}`, { defaultValue: status });
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

/**
 * Invoices and subscriptions raised from this deal. A ledger, not a form: each
 * row is one Stripe document with its status rail, number, total and the
 * single action that matters right now (Send, or the proof that it was sent).
 */
export function DealInvoicesSection({
  dealId,
  invoices,
  readiness,
  products,
  customer,
  canEdit = false,
}: DealInvoicesSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { stripe } = useStripeConnection();
  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [pending, setPending] = useState<{ action: Action; invoice: DealInvoice } | null>(null);
  const dealKey = ["deal", dealId] as const;
  const testMode = stripe?.livemode === false;

  const applyDetail = (detail: DealDetailResponse) => {
    queryClient.setQueryData(dealKey, detail);
    void queryClient.invalidateQueries({
      queryKey: ["deal-history", dealId],
      refetchType: "none",
    });
    void queryClient.invalidateQueries({
      queryKey: ["deal-available-invoices", dealId],
      refetchType: "none",
    });
  };

  const actionMutation = useMutation({
    mutationFn: ({ action, invoice }: { action: Action; invoice: DealInvoice }) =>
      ACTION_FN[action](dealId, invoice.id),
    onMutate: async ({ action, invoice }) => {
      if (action !== "send") return {};
      await queryClient.cancelQueries({ queryKey: dealKey });
      const previous = queryClient.getQueryData<DealDetailResponse>(dealKey);
      if (previous) {
        queryClient.setQueryData<DealDetailResponse>(dealKey, {
          ...previous,
          invoices: previous.invoices.map((i) =>
            i.id === invoice.id
              ? {
                  ...i,
                  sent_at: i.sent_at ?? new Date().toISOString(),
                  sent_count: i.sent_count + 1,
                }
              : i,
          ),
        });
      }
      return { previous };
    },
    onSuccess: (detail, { action }) => {
      applyDetail(detail);
      const messages: Record<Action, string> = {
        send: t("pipeline.invoices.sentToast", { defaultValue: "Invoice sent." }),
        void: t("pipeline.invoices.voided", { defaultValue: "Invoice voided." }),
        "mark-paid": t("pipeline.invoices.markedPaid", {
          defaultValue: "Invoice marked as paid.",
        }),
        "cancel-subscription": t("pipeline.invoices.subscriptionCanceled", {
          defaultValue: "Subscription canceled.",
        }),
        unlink: t("pipeline.invoices.unlinked", {
          defaultValue: "Invoice unlinked from this deal.",
        }),
      };
      toast.success(messages[action]);
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(dealKey, ctx.previous);
      toast.error(extractErrorMessage(err));
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => getDealInvoices(dealId),
    onSuccess: (rows) => {
      queryClient.setQueryData<DealDetailResponse>(dealKey, (prev) =>
        prev ? { ...prev, invoices: rows } : prev,
      );
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const run = (action: Action, invoice: DealInvoice) => {
    if (action === "send") {
      actionMutation.mutate({ action, invoice });
      return;
    }
    setPending({ action, invoice });
  };

  const blockers = readiness.blockers;
  const createLabel =
    readiness.kind === "subscription"
      ? t("pipeline.invoices.create.subscription", { defaultValue: "Create subscription" })
      : t("pipeline.invoices.create.invoice", { defaultValue: "Create invoice" });

  const createButton = (
    <Button
      type="button"
      size="sm"
      className="h-8 shrink-0 gap-1.5 text-xs"
      disabled={blockers.length > 0}
      onClick={() => setCreateOpen(true)}
    >
      <Plus className="h-3.5 w-3.5" />
      {createLabel}
    </Button>
  );

  return (
    <>
      <CreateInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        dealId={dealId}
        products={products}
        readiness={readiness}
        customer={customer}
      />
      <LinkInvoiceDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        dealId={dealId}
        customer={customer}
        currentLines={products}
      />

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
        <TooltipProvider>
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {t("pipeline.invoices.title", {
                  defaultValue: "Invoices & subscriptions",
                })}
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t("pipeline.invoices.subtitle", {
                  defaultValue: "Created in Stripe from this deal's products.",
                })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 gap-1.5 text-xs"
                  onClick={() => setLinkOpen(true)}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {t("pipeline.invoices.link.button", {
                    defaultValue: "Link existing",
                  })}
                </Button>
              ) : null}
              {invoices.length ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="h-8 w-8 text-muted-foreground"
                  disabled={refreshMutation.isPending}
                  onClick={() => refreshMutation.mutate()}
                  aria-label={t("pipeline.invoices.refresh", {
                    defaultValue: "Refresh statuses",
                  })}
                  title={t("pipeline.invoices.refresh", {
                    defaultValue: "Refresh statuses",
                  })}
                >
                  <RefreshCw
                    className={cn("h-3.5 w-3.5", refreshMutation.isPending && "app-spin")}
                  />
                </Button>
              ) : null}
              {canEdit ? (
                blockers.length ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>{createButton}</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-64">
                      <ul className="space-y-0.5 text-left">
                        {blockers.map((b) => (
                          <li key={b}>
                            {t(`pipeline.invoices.blockers.${b}`, { defaultValue: b })}
                          </li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  createButton
                )
              ) : null}
            </div>
          </header>

          {invoices.length ? (
            <ul className="divide-y divide-border">
              {invoices.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  canEdit={canEdit}
                  busy={actionMutation.isPending}
                  stripeAccount={stripe?.external_account_id ?? null}
                  livemode={stripe?.livemode ?? null}
                  onAction={(action) => run(action, invoice)}
                />
              ))}
            </ul>
          ) : (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              {t("pipeline.invoices.empty", { defaultValue: "No invoices yet." })}
            </div>
          )}

          {testMode && invoices.length ? (
            <p className="border-t border-border bg-amber-500/5 px-4 py-2 text-[11px] text-amber-700 dark:text-amber-400 sm:px-5">
              {t("pipeline.invoices.testModeHint", {
                defaultValue:
                  "Stripe sends no emails in test mode — share the invoice page link instead.",
              })}
            </p>
          ) : null}
        </TooltipProvider>
      </section>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.action === "void"
                ? t("pipeline.invoices.voidConfirmTitle", { defaultValue: "Void this invoice?" })
                : pending?.action === "mark-paid"
                  ? t("pipeline.invoices.markPaidConfirmTitle", { defaultValue: "Mark as paid?" })
                  : pending?.action === "unlink"
                    ? t("pipeline.invoices.unlinkConfirmTitle", {
                        defaultValue: "Unlink this invoice?",
                      })
                    : t("pipeline.invoices.cancelConfirmTitle", {
                        defaultValue: "Cancel this subscription?",
                      })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.action === "void"
                ? t("pipeline.invoices.voidConfirmBody", {
                    defaultValue:
                      "The invoice stays visible in Stripe with a void status and can no longer be paid.",
                  })
                : pending?.action === "mark-paid"
                  ? t("pipeline.invoices.markPaidConfirmBody", {
                      defaultValue:
                        "Use this when the customer paid outside Stripe, for example by bank transfer.",
                    })
                  : pending?.action === "unlink"
                    ? pending.invoice.kind === "subscription"
                      ? t("pipeline.invoices.unlinkConfirmBodySubscription", {
                          defaultValue:
                            "Removes the subscription and its renewals from this deal only. Nothing changes in Stripe; the deal's products, value and customer stay as they are.",
                        })
                      : t("pipeline.invoices.unlinkConfirmBody", {
                          defaultValue:
                            "Removes it from this deal only. Nothing changes in Stripe; the deal's products, value and customer stay as they are.",
                        })
                    : t("pipeline.invoices.cancelConfirmBody", {
                        defaultValue:
                          "It ends immediately. No further invoices will be generated.",
                      })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionMutation.isPending}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              variant={pending?.action === "mark-paid" ? "default" : "destructive"}
              disabled={actionMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!pending) return;
                actionMutation.mutate(pending, { onSettled: () => setPending(null) });
              }}
            >
              {pending?.action === "void"
                ? t("pipeline.invoices.void", { defaultValue: "Void invoice" })
                : pending?.action === "mark-paid"
                  ? t("pipeline.invoices.markPaid", { defaultValue: "Mark as paid" })
                  : pending?.action === "unlink"
                    ? t("pipeline.invoices.unlink", {
                        defaultValue: "Unlink from deal",
                      })
                    : t("pipeline.invoices.cancelSubscription", {
                        defaultValue: "Cancel subscription",
                      })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InvoiceRow({
  invoice,
  canEdit,
  busy,
  stripeAccount,
  livemode,
  onAction,
}: {
  invoice: DealInvoice;
  canEdit: boolean;
  busy: boolean;
  stripeAccount: string | null;
  livemode: boolean | null;
  onAction: (action: Action) => void;
}) {
  const { t } = useTranslation();
  const isSubscription = invoice.kind === "subscription";
  const subscriptionCanceled = invoice.subscription_status === "canceled";
  // Linked drafts exist now; Stripe refuses to email an unfinalized invoice.
  const canSend = invoice.status === "open";
  const sent = !!invoice.sent_at;
  const hosted = invoice.hosted_invoice_url;
  const Icon = invoice.kind === "subscription" ? Repeat : invoice.kind === "renewal" ? RefreshCw : FileText;
  const dashboardHref = stripeDashboardUrl(
    stripeAccount,
    livemode,
    isSubscription && invoice.stripe_subscription_id
      ? `subscriptions/${invoice.stripe_subscription_id}`
      : `invoices/${invoice.stripe_invoice_id}`,
  );

  const open = () => {
    if (hosted) window.open(hosted, "_blank", "noopener");
  };

  return (
    <li className="relative flex items-center gap-3 py-3 pl-5 pr-3 transition-colors hover:bg-muted/40 sm:pl-6 sm:pr-4">
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-[3px]", railClass(invoice))}
      />
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-background">
        <Icon className="h-4 w-4 text-muted-foreground/70" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={open}
            disabled={!hosted}
            className="truncate font-mono text-sm font-medium text-foreground enabled:hover:underline disabled:cursor-default"
          >
            {invoice.number ?? invoice.stripe_invoice_id}
          </button>
          <StatusPill status={invoice.status} kind="invoice" />
          {isSubscription ? (
            <StatusPill status={invoice.subscription_status} kind="subscription" />
          ) : null}
          {invoice.stale ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="shrink-0 text-amber-500">
                  <TriangleAlert className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56 text-center">
                {t("pipeline.invoices.stale", {
                  defaultValue: "Stripe could not refresh this status.",
                })}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {t(`pipeline.invoices.kind.${invoice.kind}`, { defaultValue: invoice.kind })}
          {" · "}
          {formatDateMedium(invoice.created_at)}
          {invoice.due_at && invoice.status === "open"
            ? ` · ${t("pipeline.invoices.due", {
                defaultValue: "Due {{date}}",
                date: formatDateMedium(invoice.due_at),
              })}`
            : ""}
        </p>
      </div>

      <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
        {formatMoneyFromMinor(invoice.total, invoice.currency)}
      </span>

      {sent ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-emerald-500/10 px-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              <Check className="h-3 w-3" />
              {t("pipeline.invoices.sent", { defaultValue: "Sent" })}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-center">
            <p>
              {t("pipeline.invoices.sentTooltip", {
                defaultValue: "Sent {{date}}",
                date: formatDateMedium(invoice.sent_at!),
              })}
              {invoice.sent_by_name
                ? ` ${t("pipeline.invoices.sentBy", {
                    defaultValue: "by {{name}}",
                    name: invoice.sent_by_name,
                  })}`
                : ""}
            </p>
            {invoice.sent_count > 1 ? (
              <p className="text-muted-foreground">
                {t("pipeline.invoices.resentTimes", {
                  defaultValue: "resent {{count}}×",
                  count: invoice.sent_count - 1,
                })}
              </p>
            ) : null}
          </TooltipContent>
        </Tooltip>
      ) : canEdit && canSend ? (
        <Button
          type="button"
          size="sm"
          className="h-7 shrink-0 gap-1.5 text-xs"
          disabled={busy}
          onClick={() => onAction("send")}
        >
          <Send className="h-3.5 w-3.5" />
          {t("pipeline.invoices.send", { defaultValue: "Send" })}
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            aria-label={t("common.actions", { defaultValue: "Actions" })}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {hosted ? (
            <DropdownMenuItem onClick={open}>
              <ExternalLink className="h-4 w-4" />
              {t("pipeline.invoices.openHosted", { defaultValue: "Open invoice page" })}
            </DropdownMenuItem>
          ) : null}
          {invoice.invoice_pdf ? (
            <DropdownMenuItem
              onClick={() => window.open(invoice.invoice_pdf!, "_blank", "noopener")}
            >
              <Download className="h-4 w-4" />
              {t("pipeline.invoices.downloadPdf", { defaultValue: "Download PDF" })}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onClick={() => window.open(dashboardHref, "_blank", "noopener")}
          >
            <ExternalLink className="h-4 w-4" />
            {t("pipeline.invoices.openInStripe", { defaultValue: "Open in Stripe" })}
          </DropdownMenuItem>
          {canEdit ? (
            <>
              <DropdownMenuSeparator />
              {sent && canSend ? (
                <DropdownMenuItem disabled={busy} onClick={() => onAction("send")}>
                  <Send className="h-4 w-4" />
                  {t("pipeline.invoices.resend", { defaultValue: "Resend" })}
                </DropdownMenuItem>
              ) : null}
              {invoice.status === "open" ? (
                <DropdownMenuItem disabled={busy} onClick={() => onAction("mark-paid")}>
                  <Check className="h-4 w-4" />
                  {t("pipeline.invoices.markPaid", { defaultValue: "Mark as paid" })}
                </DropdownMenuItem>
              ) : null}
              {invoice.status === "open" ? (
                <DropdownMenuItem
                  disabled={busy}
                  variant="destructive"
                  onClick={() => onAction("void")}
                >
                  <TriangleAlert className="h-4 w-4" />
                  {t("pipeline.invoices.void", { defaultValue: "Void invoice" })}
                </DropdownMenuItem>
              ) : null}
              {isSubscription && !subscriptionCanceled ? (
                <DropdownMenuItem
                  disabled={busy}
                  variant="destructive"
                  onClick={() => onAction("cancel-subscription")}
                >
                  <Repeat className="h-4 w-4" />
                  {t("pipeline.invoices.cancelSubscription", {
                    defaultValue: "Cancel subscription",
                  })}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                disabled={busy}
                variant="destructive"
                onClick={() => onAction("unlink")}
              >
                <Link2Off className="h-4 w-4" />
                {t("pipeline.invoices.unlink", {
                  defaultValue: "Unlink from deal",
                })}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
