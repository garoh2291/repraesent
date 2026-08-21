import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import { Minus, Package, Plus, Repeat, TriangleAlert, X } from "lucide-react";
import type { DealProduct } from "~/lib/api/deals";
import { useDealProductMutations } from "~/lib/hooks/useDealProducts";
import { subtotalOf } from "~/lib/deals/optimistic";
import { formatMoneyFromMinor } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
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

const MAX_QUANTITY = 100000;

/** "/mo", "/yr", "/3 mo" — the short form used on line items. */
export function formatIntervalShort(
  interval: string | null,
  count: number | null,
  t: TFunction,
): string | null {
  if (!interval) return null;
  const unit = t(`pipeline.products.intervalShort.${interval}`, {
    defaultValue: { day: "day", week: "wk", month: "mo", year: "yr" }[interval] ?? interval,
  });
  return count && count > 1 ? `/${count} ${unit}` : `/${unit}`;
}

/**
 * Stripe catalogue line items on a deal.
 *
 * Mirrors DealContactSection deliberately — attaching a product is the same
 * shape of relationship as attaching a contact, and the deal page should not
 * have two different idioms for it.
 *
 * Every edit here is optimistic: the cached deal is the source of truth for
 * what the row shows, the server confirms in the background, and a failed
 * request rolls the row back. See useDealProductMutations.
 */
export function DealProductsSection({
  dealId,
  products,
  canEdit = false,
}: DealProductsSectionProps) {
  const { t } = useTranslation();
  const [attachOpen, setAttachOpen] = useState(false);
  const { setQuantity, attach, detach } = useDealProductMutations(dealId);

  const hasProducts = products.length > 0;
  const currency = products.find((p) => p.currency)?.currency ?? null;
  // Null totals mean at least one line's amount is unknown, so the subtotal
  // would be a lie. Show a dash rather than a number that is quietly short.
  const subtotal = subtotalOf(products);
  const recurringCount = products.filter(
    (p) => p.price_type === "recurring",
  ).length;
  const oneTimeCount = products.length - recurringCount;

  return (
    <>
      <AttachProductDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        attachedPriceIds={products.map((p) => p.stripe_price_id)}
        dealCurrency={currency}
        onAttach={async (priceId, quantity, optimistic) => {
          await attach.mutateAsync({ priceId, quantity, optimistic });
          toast.success(
            t("pipeline.products.attached", { defaultValue: "Product added." }),
          );
        }}
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
                  product={product}
                  canEdit={canEdit}
                  onQuantity={(qty) => setQuantity(product, qty)}
                  onRemove={() => {
                    detach.mutate(product, {
                      onSuccess: () =>
                        toast.success(
                          t("pipeline.products.removed", {
                            defaultValue: "Product removed.",
                          }),
                        ),
                    });
                  }}
                />
              ))}
            </ul>
            <div className="border-t border-border bg-muted/30 px-4 py-3 sm:px-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("pipeline.products.subtotal", { defaultValue: "Subtotal" })}
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {subtotal === null
                    ? "—"
                    : formatMoneyFromMinor(subtotal, currency)}
                </span>
              </div>
              {recurringCount > 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("pipeline.products.summary", {
                    defaultValue:
                      "{{oneTime}} one-time · {{recurring}} recurring (one period)",
                    oneTime: oneTimeCount,
                    recurring: recurringCount,
                  })}
                </p>
              ) : null}
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
  product,
  canEdit,
  onQuantity,
  onRemove,
}: {
  product: DealProduct;
  canEdit: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const isTemp = product.id.startsWith("temp-");
  const interval =
    product.price_type === "recurring"
      ? formatIntervalShort(
          product.recurring_interval,
          product.recurring_interval_count,
          t,
        )
      : null;
  const overStock =
    product.is_physical === true &&
    product.stock !== null &&
    product.quantity > product.stock;

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5",
        isTemp && "opacity-70",
      )}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-background">
        {product.image ? (
          <img
            src={product.image}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <Package className="h-4 w-4 text-muted-foreground/60" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-foreground">
            {product.name}
          </p>
          {interval ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
              <Repeat className="h-2.5 w-2.5" />
              {interval}
            </span>
          ) : null}
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
        <p className="mt-0.5 truncate text-[11px] tabular-nums text-muted-foreground">
          {formatMoneyFromMinor(product.unit_amount, product.currency)}
          {" × "}
          {product.quantity}
          {overStock ? (
            <span className="ml-1.5 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <TriangleAlert className="h-3 w-3" />
              {t("pipeline.products.stockHint", {
                defaultValue: "only {{count}} in stock",
                count: product.stock ?? 0,
              })}
            </span>
          ) : null}
        </p>
      </div>

      {canEdit ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7"
            disabled={isTemp || product.quantity <= 1}
            onClick={() => onQuantity(product.quantity - 1)}
            aria-label={t("pipeline.products.decrease", {
              defaultValue: "Decrease quantity",
            })}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-7 text-center text-xs tabular-nums text-foreground">
            {product.quantity}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7"
            disabled={isTemp || product.quantity >= MAX_QUANTITY}
            onClick={() => onQuantity(product.quantity + 1)}
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
          disabled={isTemp}
          onClick={onRemove}
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
