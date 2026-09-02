import { ArrowLeft, Check, Package, Repeat, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { formatIntervalShort } from "~/components/organism/deal-products-section";
import {
  isStripeNotConnected,
  productMatchesSearch,
  type CatalogPrice,
  type CatalogProduct,
} from "~/lib/api/stripe-catalog";
import { useDebounce } from "~/lib/hooks/useDebounce";
import {
  useStripeCatalog,
  useStripeCatalogSearch,
} from "~/lib/hooks/useStripeCatalog";
import { formatMoneyFromMinor } from "~/lib/utils/format";
import { cn } from "~/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludedPriceIds: string[];
  /** Currency the bundle already uses; other currencies are blocked. */
  currency: string | null;
  /** Interval the bundle's recurring lines already use; others are blocked. */
  recurringInterval: { interval: string; count: number } | null;
  onPick: (product: CatalogProduct, price: CatalogPrice) => void;
}

/**
 * Two-step picker adapted from the deal's attach-product dialog: a product
 * list from the cached catalogue, then that product's prices. No quantity
 * here — how many a buyer may take is a property of the bundle line, set on
 * the Products tab after adding.
 */
export function ProductPickerDialog({
  open,
  onOpenChange,
  excludedPriceIds,
  currency,
  recurringInterval,
  onPick,
}: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 250);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [priceId, setPriceId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelected(null);
      setPriceId(null);
    }
  }, [open]);

  const catalog = useStripeCatalog({ includeArchived: false }, open);
  const truncated = catalog.data?.truncated ?? false;
  const serverSearch = useStripeCatalogSearch(
    debounced.trim(),
    open && truncated,
  );
  const excluded = useMemo(() => new Set(excludedPriceIds), [excludedPriceIds]);
  const notConnected = isStripeNotConnected(catalog.error);

  const products = useMemo(() => {
    const source =
      truncated && debounced.trim()
        ? (serverSearch.data?.data ?? [])
        : (catalog.data?.data ?? []);
    return source
      .filter(
        (p) =>
          p.active && p.prices.some((pr) => pr.active && !excluded.has(pr.id)),
      )
      .filter((p) => truncated || productMatchesSearch(p, debounced))
      .slice(0, 100);
  }, [catalog.data, serverSearch.data, truncated, debounced, excluded]);

  const reasonFor = (price: CatalogPrice): string | null => {
    if (excluded.has(price.id)) return t("forms.products.picker.inBundle");
    if (currency && price.currency.toLowerCase() !== currency.toLowerCase()) {
      return t("forms.products.picker.currencyMismatch");
    }
    if (
      price.type === "recurring" &&
      recurringInterval &&
      (price.interval !== recurringInterval.interval ||
        (price.interval_count ?? 1) !== recurringInterval.count)
    ) {
      return t("forms.products.picker.intervalMismatch");
    }
    return null;
  };

  const selectProduct = (product: CatalogProduct) => {
    setSelected(product);
    const candidates = product.prices.filter((p) => p.active && !reasonFor(p));
    setPriceId(
      (candidates.find((p) => p.is_default) ?? candidates[0])?.id ?? null,
    );
  };

  const activePrices = selected ? selected.prices.filter((p) => p.active) : [];
  const chosen = activePrices.find((p) => p.id === priceId) ?? null;
  const loading =
    catalog.isPending ||
    (truncated && !!debounced.trim() && serverSearch.isPending);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {selected ? selected.name : t("forms.products.picker.title")}
          </DialogTitle>
          <DialogDescription>
            {selected
              ? t("forms.products.picker.pickPrice")
              : t("forms.products.picker.hint")}
          </DialogDescription>
        </DialogHeader>

        {notConnected ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("forms.products.notConnectedTitle")}
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

            <ul className="divide-y overflow-hidden rounded-xl border">
              {activePrices.map((price) => {
                const reason = reasonFor(price);
                const active = priceId === price.id;
                const interval =
                  price.type === "recurring"
                    ? formatIntervalShort(
                        price.interval,
                        price.interval_count,
                        t,
                      )
                    : null;
                return (
                  <li key={price.id}>
                    <button
                      type="button"
                      disabled={!!reason}
                      onClick={() => setPriceId(price.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        active ? "bg-primary/5" : "hover:bg-muted/50",
                        reason && "cursor-not-allowed opacity-60",
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
                        <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
                          {formatMoneyFromMinor(
                            price.unit_amount,
                            price.currency,
                          )}
                          {interval ? (
                            <span className="inline-flex items-center gap-0.5 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              <Repeat className="h-2.5 w-2.5" />
                              {interval}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {t("stripeProducts.oneTime", {
                                defaultValue: "one-time",
                              })}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {reason ??
                            price.nickname ??
                            price.lookup_key ??
                            price.id}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex justify-end">
              <Button
                disabled={!chosen}
                onClick={() => {
                  if (selected && chosen) {
                    onPick(selected, chosen);
                    onOpenChange(false);
                  }
                }}
              >
                {t("forms.products.picker.addToBundle")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("forms.products.picker.search")}
                className="pl-9"
              />
            </div>
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("forms.products.picker.nothingToAdd")}
              </p>
            ) : (
              <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-xl border">
                {products.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => selectProduct(product)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                    >
                      {product.images[0] ? (
                        <img
                          src={product.images[0]}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                          <Package className="h-4 w-4" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {product.name}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {product.description ||
                            t("forms.products.picker.priceCount", {
                              count: product.prices.filter((p) => p.active)
                                .length,
                            })}
                        </span>
                      </span>
                      {product.default_price ? (
                        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                          {formatMoneyFromMinor(
                            product.default_price.unit_amount,
                            product.default_price.currency,
                          )}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
