import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Link2,
  Repeat,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  linkDealInvoice,
  type AvailableInvoice,
  type AvailableInvoiceScope,
  type DealCustomer,
  type DealDetailResponse,
  type DealProduct,
} from "~/lib/api/deals";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { isStripeNotConnected } from "~/lib/api/stripe-catalog";
import { useAvailableDealInvoices } from "~/lib/hooks/useStripeCatalog";
import { useDebounce } from "~/lib/hooks/useDebounce";
import {
  dealValueOf,
  markDealListsStale,
  patchDealInLists,
} from "~/lib/deals/optimistic";
import { formatDateMedium, formatMoneyFromMinor } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { StatusPill } from "./index";

interface LinkInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  customer: DealCustomer | null;
  currentLines: DealProduct[];
}

/**
 * Adopt an invoice that already exists in Stripe.
 *
 * Two steps: pick from the account's newest invoices (scoped to the deal's
 * customer by default), then confirm what linking will do — which customer
 * gets linked, and which lines replace the deal's products. The destructive
 * part is spelled out before the button, not discovered after it.
 */
export function LinkInvoiceDialog({
  open,
  onOpenChange,
  dealId,
  customer,
  currentLines,
}: LinkInvoiceDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const hasUsableCustomer = !!customer && !customer.account_mismatch;
  const [scope, setScope] = useState<AvailableInvoiceScope>("all");
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search.trim().toLowerCase(), 200);
  const [selected, setSelected] = useState<AvailableInvoice | null>(null);
  const [syncProducts, setSyncProducts] = useState(true);

  useEffect(() => {
    if (!open) return;
    setScope(hasUsableCustomer ? "customer" : "all");
    setSearch("");
    setSelected(null);
    setSyncProducts(true);
  }, [open, hasUsableCustomer]);

  const query = useAvailableDealInvoices(dealId, scope, open);
  const notConnected = isStripeNotConnected(query.error);

  const invoices = useMemo(() => {
    const all = query.data ?? [];
    if (!debounced) return all;
    return all.filter((inv) =>
      [inv.number, inv.id, inv.customer?.name, inv.customer?.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(debounced)),
    );
  }, [query.data, debounced]);

  const mutation = useMutation({
    mutationFn: (inv: AvailableInvoice) =>
      linkDealInvoice(dealId, {
        stripe_invoice_id: inv.id,
        sync_products: syncProducts,
      }),
    onSuccess: (detail: DealDetailResponse, inv) => {
      queryClient.setQueryData(["deal", dealId], detail);
      patchDealInLists(queryClient, dealId, { value: dealValueOf(detail) });
      markDealListsStale(queryClient);
      void queryClient.invalidateQueries({
        queryKey: ["deal-history", dealId],
        refetchType: "none",
      });
      void queryClient.invalidateQueries({
        queryKey: ["deal-available-invoices", dealId],
        refetchType: "none",
      });
      toast.success(
        t("pipeline.invoices.link.linked", { defaultValue: "Invoice linked." }),
        {
          action: inv.hosted_invoice_url
            ? {
                label: t("pipeline.invoices.openAction", { defaultValue: "Open" }),
                onClick: () =>
                  window.open(inv.hosted_invoice_url!, "_blank", "noopener"),
              }
            : undefined,
        },
      );
      onOpenChange(false);
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("pipeline.invoices.link.title", {
              defaultValue: "Link an existing invoice",
            })}
          </DialogTitle>
          <DialogDescription>
            {t("pipeline.invoices.link.description", {
              defaultValue:
                "Adopt an invoice from your Stripe account: it appears on this deal, its customer gets linked, and the deal's products can follow its lines.",
            })}
          </DialogDescription>
        </DialogHeader>

        {notConnected ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("pipeline.invoices.link.notConnected", {
              defaultValue:
                "No Stripe account is connected to this workspace yet.",
            })}
          </p>
        ) : selected ? (
          <ConfirmPanel
            invoice={selected}
            dealId={dealId}
            customer={customer}
            currentLines={currentLines}
            syncProducts={syncProducts}
            onSyncChange={setSyncProducts}
            busy={mutation.isPending}
            onBack={() => setSelected(null)}
            onConfirm={() => mutation.mutate(selected)}
          />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("pipeline.invoices.link.searchPlaceholder", {
                    defaultValue: "Number, customer or email…",
                  })}
                  className="pl-9 pr-9"
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
              {hasUsableCustomer ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Switch
                    id="link-invoice-scope"
                    checked={scope === "all"}
                    onCheckedChange={(v) => setScope(v ? "all" : "customer")}
                  />
                  <Label
                    htmlFor="link-invoice-scope"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("pipeline.invoices.link.scopeAll", {
                      defaultValue: "All customers",
                    })}
                  </Label>
                </div>
              ) : null}
            </div>

            <div className="max-h-[360px] overflow-y-auto rounded-xl border border-border">
              {query.isPending ? (
                <div className="space-y-px">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-none" />
                  ))}
                </div>
              ) : invoices.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                  {debounced
                    ? t("pipeline.invoices.link.noResults", {
                        defaultValue: "No invoices match that search.",
                      })
                    : t("pipeline.invoices.link.empty", {
                        defaultValue: "No invoices on this Stripe account yet.",
                      })}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {invoices.map((inv) => {
                    const onThisDeal =
                      inv.linked_via === "invoice" &&
                      inv.linked_deal_id === dealId;
                    const onOtherDeal =
                      !!inv.linked_deal_id && inv.linked_deal_id !== dealId;
                    const disabled = onThisDeal || onOtherDeal;
                    return (
                      <li key={inv.id}>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelected(inv)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate font-mono text-sm font-medium text-foreground">
                                {inv.number ?? inv.id}
                              </span>
                              <StatusPill status={inv.status} kind="invoice" />
                              {inv.subscription_id ? (
                                <Repeat className="h-3 w-3 shrink-0 text-primary" />
                              ) : null}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                              {onThisDeal
                                ? t("pipeline.invoices.link.alreadyOnDeal", {
                                    defaultValue: "Already on this deal",
                                  })
                                : onOtherDeal
                                  ? t("pipeline.invoices.link.linkedTo", {
                                      defaultValue: "Linked to {{title}}",
                                      title:
                                        inv.linked_deal_title ??
                                        inv.linked_deal_id,
                                    })
                                  : [
                                      inv.customer?.name ?? inv.customer?.email,
                                      formatDateMedium(inv.created * 1000),
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                            {formatMoneyFromMinor(inv.total, inv.currency)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.close", { defaultValue: "Close" })}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmPanel({
  invoice,
  dealId,
  customer,
  currentLines,
  syncProducts,
  onSyncChange,
  busy,
  onBack,
  onConfirm,
}: {
  invoice: AvailableInvoice;
  dealId: string;
  customer: DealCustomer | null;
  currentLines: DealProduct[];
  syncProducts: boolean;
  onSyncChange: (v: boolean) => void;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const priceLines = invoice.lines.filter((l) => l.price_id);
  const customLines = invoice.lines.length - priceLines.length;
  const isRenewal =
    invoice.linked_via === "subscription" && invoice.linked_deal_id === dealId;
  const customerChanges =
    !invoice.customer?.deleted &&
    !!invoice.customer &&
    customer?.stripe_customer_id !== invoice.customer.id;

  const Note = ({
    tone,
    children,
  }: {
    tone: "info" | "warn";
    children: React.ReactNode;
  }) => (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
        tone === "warn"
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "bg-primary/5 text-foreground",
      )}
    >
      {tone === "warn" ? (
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : (
        <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      )}
      <span>{children}</span>
    </p>
  );

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("common.back", { defaultValue: "Back" })}
      </button>

      <div className="rounded-xl border border-border px-3 py-2.5">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-sm font-medium text-foreground">
            {invoice.number ?? invoice.id}
          </span>
          <StatusPill status={invoice.status} kind="invoice" />
          <span className="ml-auto text-sm font-semibold tabular-nums text-foreground">
            {formatMoneyFromMinor(invoice.total, invoice.currency)}
          </span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {[
            invoice.customer?.name ?? invoice.customer?.email,
            formatDateMedium(invoice.created * 1000),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {invoice.customer?.deleted ? (
        <Note tone="warn">
          {t("pipeline.invoices.link.customerDeleted", {
            defaultValue:
              "This customer was deleted in Stripe — the deal's customer stays as it is.",
          })}
        </Note>
      ) : customerChanges ? (
        <Note tone={customer ? "warn" : "info"}>
          {customer
            ? t("pipeline.invoices.link.customerWillReplace", {
                defaultValue:
                  "{{name}} will replace {{current}} as this deal's customer.",
                name:
                  invoice.customer?.name ??
                  invoice.customer?.email ??
                  invoice.customer?.id,
                current: customer.name ?? customer.email ?? customer.stripe_customer_id,
              })
            : t("pipeline.invoices.link.customerWillLink", {
                defaultValue: "{{name}} will be linked as this deal's customer.",
                name:
                  invoice.customer?.name ??
                  invoice.customer?.email ??
                  invoice.customer?.id,
              })}
        </Note>
      ) : null}

      {isRenewal ? (
        <Note tone="info">
          {t("pipeline.invoices.link.renewalNote", {
            defaultValue:
              "This deal already tracks the subscription behind this invoice — it will be added as a renewal.",
          })}
        </Note>
      ) : null}

      {invoice.status === "draft" ? (
        <Note tone="warn">
          {t("pipeline.invoices.link.draft", {
            defaultValue:
              "Draft invoice — Stripe cannot email it until it is finalized.",
          })}
        </Note>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("pipeline.invoices.link.linesTitle", { defaultValue: "Products" })}
        </p>
        {priceLines.length ? (
          <>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {priceLines.map((l, i) => (
                <li
                  key={`${l.price_id}-${i}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate text-foreground">
                    {l.description ?? l.product_id}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    × {l.quantity ?? 1}
                  </span>
                </li>
              ))}
            </ul>
            {syncProducts && currentLines.length ? (
              <p className="text-[11px] text-muted-foreground">
                {t("pipeline.invoices.link.linesReplace", {
                  defaultValue:
                    "These replace the {{count}} products currently on the deal.",
                  count: currentLines.length,
                })}
              </p>
            ) : null}
            {customLines > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {t("pipeline.invoices.link.customLinesNote", {
                  defaultValue:
                    "{{count}} custom lines won't become products — the deal value will follow the invoice total.",
                  count: customLines,
                })}
              </p>
            ) : null}
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
            {invoice.total > 0
              ? t("pipeline.invoices.link.noProductLines", {
                  defaultValue:
                    "No catalogue products on this invoice — current products stay; the deal value will be set to {{total}}.",
                  total: formatMoneyFromMinor(invoice.total, invoice.currency),
                })
              : t("pipeline.invoices.link.noProductLinesNoValue", {
                  defaultValue:
                    "No catalogue products on this invoice — products and deal value stay unchanged.",
                })}
          </p>
        )}
        {invoice.lines_truncated ? (
          <p className="text-[11px] text-muted-foreground">
            {t("pipeline.invoices.link.linesTruncated", {
              defaultValue:
                "Showing the first {{count}} lines; every line is synced.",
              count: invoice.lines.length,
            })}
          </p>
        ) : null}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {t("pipeline.invoices.link.sendStateUnknown", {
          defaultValue:
            "Send state unknown — Stripe may already have emailed this invoice.",
        })}
      </p>

      {priceLines.length ? (
        <div className="flex items-center gap-2">
          <Switch
            id="link-invoice-sync"
            checked={syncProducts}
            onCheckedChange={onSyncChange}
          />
          <Label htmlFor="link-invoice-sync" className="text-xs font-medium">
            {t("pipeline.invoices.link.syncProducts", {
              defaultValue: "Sync products from invoice",
            })}
          </Label>
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={onBack}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button disabled={busy} onClick={onConfirm}>
          {busy ? (
            <div className="h-3.5 w-3.5 app-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
          {t("pipeline.invoices.link.confirm", { defaultValue: "Link invoice" })}
        </Button>
      </div>
    </div>
  );
}
