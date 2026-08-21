import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Check,
  Minus,
  Package,
  Plus,
  Repeat,
  Search,
  TriangleAlert,
} from "lucide-react";
import {
  isStripeNotConnected,
  productMatchesSearch,
  type CatalogPrice,
  type CatalogProduct,
} from "~/lib/api/stripe-catalog";
import {
  useStripeCatalog,
  useStripeCatalogSearch,
} from "~/lib/hooks/useStripeCatalog";
import { useDebounce } from "~/lib/hooks/useDebounce";
import type { OptimisticLine } from "~/lib/hooks/useDealProducts";
import { formatMoneyFromMinor } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { formatIntervalShort } from "./index";

interface AttachProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prices already on the deal — shown as attached, not selectable. */
  attachedPriceIds: string[];
  /** Currency of the lines already on the deal; other currencies are blocked. */
  dealCurrency: string | null;
  onAttach: (
    priceId: string,
    quantity: number,
    optimistic: OptimisticLine,
  ) => Promise<void>;
}

/**
 * Two-step picker: a product list filtered from the cached catalogue, then
 * the chosen product's prices with a quantity. Any active price can go on a
 * deal, not just the default — a yearly plan next to a monthly one is the
 * normal case, not the exception.
 */
export function AttachProductDialog({
  open,
  onOpenChange,
  attachedPriceIds,
  dealCurrency,
  onAttach,
}: AttachProductDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 250);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [priceId, setPriceId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelected(null);
      setPriceId(null);
      setQuantity(1);
    }
  }, [open]);

  const catalog = useStripeCatalog({ includeArchived: false }, open);
  const truncated = catalog.data?.truncated ?? false;
  const serverSearch = useStripeCatalogSearch(
    debounced.trim(),
    open && truncated,
  );

  const attached = useMemo(() => new Set(attachedPriceIds), [attachedPriceIds]);
  const notConnected = isStripeNotConnected(catalog.error);

  const products = useMemo(() => {
    const source =
      truncated && debounced.trim()
        ? (serverSearch.data?.data ?? [])
        : (catalog.data?.data ?? []);
    return source
      .filter((p) => p.active && p.prices.some((pr) => pr.active))
      .filter((p) => truncated || productMatchesSearch(p, debounced))
      .slice(0, 100);
  }, [catalog.data, serverSearch.data, truncated, debounced]);

  const activePrices = selected
    ? selected.prices.filter((p) => p.active)
    : [];

  const selectProduct = (product: CatalogProduct) => {
    setSelected(product);
    const candidates = product.prices.filter(
      (p) => p.active && !attached.has(p.id) && currencyOk(p),
    );
    const preferred =
      candidates.find((p) => p.is_default) ?? candidates[0] ?? null;
    setPriceId(preferred?.id ?? null);
    setQuantity(1);
  };

  const currencyOk = (price: CatalogPrice) =>
    !dealCurrency || price.currency.toLowerCase() === dealCurrency.toLowerCase();

  const chosenPrice = activePrices.find((p) => p.id === priceId) ?? null;
  const overStock =
    !!selected &&
    selected.is_physical &&
    selected.stock !== null &&
    quantity > selected.stock;

  const submit = async () => {
    if (!selected || !chosenPrice) return;
    setSubmitting(true);
    try {
      await onAttach(chosenPrice.id, quantity, {
        stripe_product_id: selected.id,
        name: selected.name,
        image: selected.images[0] ?? null,
        unit_amount: chosenPrice.unit_amount,
        currency: chosenPrice.currency,
        price_type: chosenPrice.type,
        recurring_interval: chosenPrice.interval,
        recurring_interval_count: chosenPrice.interval_count,
        is_physical: selected.is_physical,
        stock: selected.stock,
        stale: false,
        price_active: true,
      });
      onOpenChange(false);
    } catch {
      // The mutation already toasted and rolled back.
    } finally {
      setSubmitting(false);
    }
  };

  const loading =
    catalog.isPending || (truncated && !!debounced.trim() && serverSearch.isPending);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {selected
              ? selected.name
              : t("pipeline.products.attachTitle", {
                  defaultValue: "Add a product",
                })}
          </DialogTitle>
          <DialogDescription>
            {selected
              ? t("pipeline.products.pickPrice", {
                  defaultValue: "Pick a price and a quantity.",
                })
              : t("pipeline.products.attachDescription", {
                  defaultValue:
                    "Search your Stripe catalogue. Adding one recalculates the deal value.",
                })}
          </DialogDescription>
        </DialogHeader>

        {notConnected ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("pipeline.products.notConnected", {
              defaultValue:
                "No Stripe account is connected to this workspace yet.",
            })}
          </p>
        ) : selected ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("common.back", { defaultValue: "Back" })}
            </button>

            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {activePrices.map((price) => {
                const isAttached = attached.has(price.id);
                const wrongCurrency = !currencyOk(price);
                const disabled = isAttached || wrongCurrency;
                const active = priceId === price.id;
                const interval =
                  price.type === "recurring"
                    ? formatIntervalShort(price.interval, price.interval_count, t)
                    : null;
                return (
                  <li key={price.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setPriceId(price.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        active ? "bg-primary/5" : "hover:bg-muted/50",
                        disabled && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {active ? <Check className="h-2.5 w-2.5" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums text-foreground">
                          {formatMoneyFromMinor(price.unit_amount, price.currency)}
                          {interval ? (
                            <span className="inline-flex items-center gap-0.5 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              <Repeat className="h-2.5 w-2.5" />
                              {interval}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {t("stripeProducts.oneTime", { defaultValue: "one-time" })}
                            </span>
                          )}
                          {price.is_default ? (
                            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {t("stripeProducts.defaultPrice", { defaultValue: "Default" })}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {isAttached
                            ? t("pipeline.products.alreadyOnDeal", {
                                defaultValue: "Already on this deal",
                              })
                            : wrongCurrency
                              ? t("pipeline.products.currencyMismatch", {
                                  defaultValue:
                                    "Different currency than the lines already on the deal",
                                })
                              : (price.nickname ?? price.lookup_key ?? price.id)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("pipeline.products.quantity", { defaultValue: "Quantity" })}
                </span>
                <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="h-7 w-7"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={100000}
                    value={quantity}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) {
                        setQuantity(Math.min(100000, Math.max(1, Math.floor(n))));
                      }
                    }}
                    className="h-7 w-14 border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="h-7 w-7"
                    onClick={() => setQuantity((q) => Math.min(100000, q + 1))}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {selected.is_physical && selected.stock !== null ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px]",
                    overStock
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground",
                  )}
                >
                  {overStock ? <TriangleAlert className="h-3 w-3" /> : null}
                  {t("stripeProducts.inStock", {
                    defaultValue: "{{count}} in stock",
                    count: selected.stock,
                  })}
                </span>
              ) : null}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm tabular-nums text-muted-foreground">
                {chosenPrice && chosenPrice.unit_amount !== null
                  ? formatMoneyFromMinor(
                      chosenPrice.unit_amount * quantity,
                      chosenPrice.currency,
                    )
                  : "—"}
              </span>
              <Button
                type="button"
                disabled={!chosenPrice || submitting}
                onClick={() => void submit()}
              >
                {t("pipeline.products.addToDeal", { defaultValue: "Add to deal" })}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("stripeProducts.searchPlaceholder", {
                  defaultValue: "Search products…",
                })}
                className="pl-9"
              />
            </div>

            <div className="max-h-[360px] overflow-y-auto rounded-xl border border-border">
              {loading ? (
                <div className="space-y-px">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-none" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                  {debounced
                    ? t("stripeProducts.noResults", {
                        defaultValue: "No products match that search.",
                      })
                    : t("pipeline.products.nothingToAdd", {
                        defaultValue:
                          "Nothing to add. Products need an active price before they can go on a deal.",
                      })}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {products.map((product) => {
                    const price = product.default_price;
                    const allAttached = product.prices
                      .filter((p) => p.active)
                      .every((p) => attached.has(p.id));
                    return (
                      <li key={product.id}>
                        <button
                          type="button"
                          disabled={allAttached}
                          onClick={() => selectProduct(product)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                        >
                          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-background">
                            {product.images[0] ? (
                              <img
                                src={product.images[0]}
                                alt=""
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.visibility =
                                    "hidden";
                                }}
                              />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground/60" />
                            )}
                          </div>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-medium text-foreground">
                                {product.name}
                              </span>
                              {product.has_recurring ? (
                                <Repeat className="h-3 w-3 shrink-0 text-primary" />
                              ) : null}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {allAttached
                                ? t("pipeline.products.alreadyOnDeal", {
                                    defaultValue: "Already on this deal",
                                  })
                                : product.prices.filter((p) => p.active).length > 1
                                  ? t("pipeline.products.priceCount", {
                                      defaultValue: "{{count}} prices",
                                      count: product.prices.filter((p) => p.active).length,
                                    })
                                  : (product.description ?? "")}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                            {price
                              ? formatMoneyFromMinor(price.unit_amount, price.currency)
                              : "—"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {truncated ? (
              <p className="text-[11px] text-muted-foreground">
                {t("stripeProducts.truncatedHint", {
                  defaultValue:
                    "Large catalogue: showing the first 1000 products. Search runs on Stripe.",
                })}
              </p>
            ) : null}

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
