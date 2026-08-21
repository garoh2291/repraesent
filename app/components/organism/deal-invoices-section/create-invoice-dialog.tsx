import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Repeat } from "lucide-react";
import {
  createDealInvoice,
  type DealCustomer,
  type DealDetailResponse,
  type DealProduct,
  type InvoiceReadiness,
} from "~/lib/api/deals";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { formatMoneyFromMinor } from "~/lib/utils/format";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { formatIntervalShort } from "~/components/organism/deal-products-section";

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  products: DealProduct[];
  readiness: InvoiceReadiness;
  customer: DealCustomer | null;
}

/**
 * Confirm what Stripe is about to build, set the payment term, decide whether
 * it goes out now. The lines and customer are read-only here — they are edited
 * in their own cards, and this dialog only exists when they are complete.
 */
export function CreateInvoiceDialog({
  open,
  onOpenChange,
  dealId,
  products,
  readiness,
  customer,
}: CreateInvoiceDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const [memo, setMemo] = useState("");
  const [sendNow, setSendNow] = useState(true);
  // One key per dialog open: a retried request replays the same document in
  // Stripe instead of minting a second one.
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    if (!open) return;
    setDays(30);
    setMemo("");
    setSendNow(true);
    setIdempotencyKey(crypto.randomUUID());
  }, [open]);

  const isSubscription = readiness.kind === "subscription";

  const mutation = useMutation({
    mutationFn: () =>
      createDealInvoice(dealId, {
        days_until_due: days,
        send_now: sendNow,
        ...(memo.trim() ? { memo: memo.trim() } : {}),
        idempotency_key: idempotencyKey,
      }),
    onSuccess: (detail: DealDetailResponse) => {
      queryClient.setQueryData(["deal", dealId], detail);
      void queryClient.invalidateQueries({
        queryKey: ["deal-history", dealId],
        refetchType: "none",
      });
      const created = detail.invoices[0];
      toast.success(
        isSubscription
          ? t("pipeline.invoices.createdSubscription", {
              defaultValue: "Subscription created.",
            })
          : t("pipeline.invoices.created", { defaultValue: "Invoice created." }),
        {
          description: sendNow
            ? undefined
            : t("pipeline.invoices.createdNotSent", {
                defaultValue: "Not sent yet — use Send when you're ready.",
              }),
          action: created?.hosted_invoice_url
            ? {
                label: t("pipeline.invoices.openAction", { defaultValue: "Open" }),
                onClick: () =>
                  window.open(created.hosted_invoice_url!, "_blank", "noopener"),
              }
            : undefined,
        },
      );
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err));
      // The document may exist even when the send step failed — show it.
      void queryClient.invalidateQueries({ queryKey: ["deal", dealId] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isSubscription
              ? t("pipeline.invoices.dialog.titleSubscription", {
                  defaultValue: "Create subscription",
                })
              : t("pipeline.invoices.dialog.title", {
                  defaultValue: "Create invoice",
                })}
          </DialogTitle>
          <DialogDescription>
            {t("pipeline.invoices.dialog.description", {
              defaultValue:
                "Built in Stripe from the products on this deal, addressed to the linked customer.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border">
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-xs">
              <span className="font-medium uppercase tracking-wide text-muted-foreground">
                {t("pipeline.invoices.dialog.customer", { defaultValue: "Customer" })}
              </span>
              <span className="truncate text-foreground">
                {customer?.name || customer?.email || customer?.stripe_customer_id}
                {customer?.name && customer.email ? (
                  <span className="text-muted-foreground"> · {customer.email}</span>
                ) : null}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {products.map((line) => {
                const interval =
                  line.price_type === "recurring"
                    ? formatIntervalShort(
                        line.recurring_interval,
                        line.recurring_interval_count,
                        t,
                      )
                    : null;
                return (
                  <li
                    key={line.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {line.name}
                      <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                        × {line.quantity}
                      </span>
                      {interval ? (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          <Repeat className="h-2.5 w-2.5" />
                          {interval}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatMoneyFromMinor(line.line_total, line.currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("pipeline.invoices.dialog.total", { defaultValue: "Total" })}
              </span>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {formatMoneyFromMinor(readiness.total, readiness.currency)}
              </span>
            </div>
          </div>

          {isSubscription ? (
            <p className="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs text-foreground">
              <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              {t("pipeline.invoices.dialog.subscriptionNotice", {
                defaultValue:
                  "This creates a subscription. One-time products are added to its first invoice.",
              })}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invoice-days">
                {t("pipeline.invoices.dialog.daysUntilDue", {
                  defaultValue: "Days until due",
                })}
              </Label>
              <Input
                id="invoice-days"
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setDays(Math.min(365, Math.max(1, Math.floor(n))));
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("pipeline.invoices.dialog.daysHint", {
                  defaultValue: "Payment term shown on the invoice.",
                })}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-send-now">
                {t("pipeline.invoices.dialog.sendNow", { defaultValue: "Send now" })}
              </Label>
              <div className="flex h-9 items-center">
                <Switch
                  id="invoice-send-now"
                  checked={sendNow}
                  onCheckedChange={setSendNow}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("pipeline.invoices.dialog.sendNowHint", {
                  defaultValue:
                    "Stripe emails it to the customer right away. Off keeps it ready to send from this page.",
                })}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invoice-memo">
              {t("pipeline.invoices.dialog.memo", { defaultValue: "Memo (optional)" })}
            </Label>
            <Textarea
              id="invoice-memo"
              value={memo}
              maxLength={500}
              rows={2}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={t("pipeline.invoices.dialog.memoPlaceholder", {
                defaultValue: "Shown on the invoice…",
              })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? (
              <div className="h-3.5 w-3.5 app-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            ) : null}
            {isSubscription
              ? sendNow
                ? t("pipeline.invoices.dialog.confirmSubscriptionSend", {
                    defaultValue: "Create & send",
                  })
                : t("pipeline.invoices.dialog.confirmSubscription", {
                    defaultValue: "Create subscription",
                  })
              : sendNow
                ? t("pipeline.invoices.dialog.confirmSend", {
                    defaultValue: "Create & send",
                  })
                : t("pipeline.invoices.dialog.confirm", {
                    defaultValue: "Create invoice",
                  })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
