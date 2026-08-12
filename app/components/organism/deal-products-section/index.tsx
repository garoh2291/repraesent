import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Package, Plus, TriangleAlert, X } from "lucide-react";
import {
  detachDealProduct,
  setDealProductQuantity,
  type DealProduct,
} from "~/lib/api/deals";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { formatMoneyFromMinor } from "~/lib/utils/format";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { AttachProductDialog } from "./attach-product-dialog";

interface DealProductsSectionProps {
  dealId: string;
  products: DealProduct[];
  canEdit?: boolean;
}

/**
 * Stripe catalogue line items on a deal.
 *
 * Mirrors DealContactSection deliberately — attaching a product is the same
 * shape of relationship as attaching a contact, and the deal page should not
 * have two different idioms for it.
 */
export function DealProductsSection({
  dealId,
  products,
  canEdit = false,
}: DealProductsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [attachOpen, setAttachOpen] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["deal"] });
    void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
    void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
  };

  const hasProducts = products.length > 0;
  const currency = products.find((p) => p.currency)?.currency ?? null;
  // Null totals mean at least one line's amount is unknown, so the subtotal
  // would be a lie. Show a dash rather than a number that is quietly short.
  const subtotal = products.some((p) => p.line_total === null)
    ? null
    : products.reduce((sum, p) => sum + (p.line_total ?? 0), 0);

  return (
    <>
      <AttachProductDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        dealId={dealId}
        attachedPriceIds={products.map((p) => p.stripe_price_id)}
      />

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {t("pipeline.products.title", { defaultValue: "Products" })}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("pipeline.products.subtitle", {
                defaultValue:
                  "Line items from Stripe. The deal value follows their total.",
              })}
            </p>
          </div>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1.5 text-xs"
              onClick={() => setAttachOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("pipeline.products.add", { defaultValue: "Add product" })}
            </Button>
          ) : null}
        </header>

        {hasProducts ? (
          <TooltipProvider>
            <ul className="divide-y divide-border">
              {products.map((product) => (
                <ProductRow
                  key={product.id}
                  dealId={dealId}
                  product={product}
                  canEdit={canEdit}
                  onChanged={invalidate}
                />
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3 sm:px-5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("pipeline.products.subtotal", { defaultValue: "Subtotal" })}
              </span>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {subtotal === null
                  ? "—"
                  : formatMoneyFromMinor(subtotal, currency)}
              </span>
            </div>
          </TooltipProvider>
        ) : (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            {t("pipeline.products.empty", {
              defaultValue: "No products on this deal yet.",
            })}
          </div>
        )}
      </section>
    </>
  );
}

function ProductRow({
  dealId,
  product,
  canEdit,
  onChanged,
}: {
  dealId: string;
  product: DealProduct;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();

  const quantityMutation = useMutation({
    mutationFn: (quantity: number) =>
      setDealProductQuantity(dealId, product.id, quantity),
    onSuccess: onChanged,
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const detachMutation = useMutation({
    mutationFn: () => detachDealProduct(dealId, product.id),
    onSuccess: () => {
      onChanged();
      toast.success(
        t("pipeline.products.removed", { defaultValue: "Product removed." }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const busy = quantityMutation.isPending || detachMutation.isPending;

  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-background">
        <Package className="h-4 w-4 text-muted-foreground/60" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-foreground">
            {product.name}
          </p>
          {product.stale || product.price_active === false ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="shrink-0 text-amber-500">
                  <TriangleAlert className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56 text-center">
                {product.stale
                  ? t("pipeline.products.staleHint", {
                      defaultValue:
                        "Stripe could not confirm this line. Showing the price saved when it was added.",
                    })
                  : t("pipeline.products.archivedHint", {
                      defaultValue: "This price is archived in Stripe.",
                    })}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
          {formatMoneyFromMinor(product.unit_amount, product.currency)}
          {" × "}
          {product.quantity}
        </p>
      </div>

      {canEdit ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7"
            disabled={busy || product.quantity <= 1}
            onClick={() => quantityMutation.mutate(product.quantity - 1)}
            aria-label={t("pipeline.products.decrease", {
              defaultValue: "Decrease quantity",
            })}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-6 text-center text-xs tabular-nums text-foreground">
            {product.quantity}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7"
            disabled={busy}
            onClick={() => quantityMutation.mutate(product.quantity + 1)}
            aria-label={t("pipeline.products.increase", {
              defaultValue: "Increase quantity",
            })}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}

      <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
        {formatMoneyFromMinor(product.line_total, product.currency)}
      </span>

      {canEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          disabled={busy}
          onClick={() => detachMutation.mutate()}
          aria-label={t("pipeline.products.remove", {
            defaultValue: "Remove product",
          })}
          title={t("pipeline.products.remove", {
            defaultValue: "Remove product",
          })}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </li>
  );
}
