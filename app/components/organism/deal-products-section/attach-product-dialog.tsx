import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, Search } from "lucide-react";
import { attachDealProduct } from "~/lib/api/deals";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { isStripeNotConnected, type CatalogPrice } from "~/lib/api/stripe-catalog";
import { useCatalogProducts } from "~/lib/hooks/useStripeCatalog";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { formatMoneyFromMinor } from "~/lib/utils/format";
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

interface AttachProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  /** Prices already on the deal — hidden from the picker. */
  attachedPriceIds: string[];
}

/**
 * Product picker backed by a live Stripe search.
 *
 * Only a product's default price is offered. A product with several prices is
 * rare here, and asking the user to pick one inside an attach dialog buries the
 * common case — they can still change the default on the Products page.
 */
export function AttachProductDialog({
  open,
  onOpenChange,
  dealId,
  attachedPriceIds,
}: AttachProductDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const productsQuery = useCatalogProducts(
    { search: debouncedSearch || undefined, active: "true", limit: 50 },
    open,
  );

  const attachMutation = useMutation({
    mutationFn: (priceId: string) => attachDealProduct(dealId, priceId, 1),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["deal"] });
      void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
      void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
      onOpenChange(false);
      toast.success(
        t("pipeline.products.attached", { defaultValue: "Product added." }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const attached = new Set(attachedPriceIds);
  const notConnected = isStripeNotConnected(productsQuery.error);

  const options = (productsQuery.data?.data ?? [])
    .filter((p) => p.default_price && !attached.has(p.default_price.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      image: p.images[0] ?? null,
      price: p.default_price as CatalogPrice,
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("pipeline.products.attachTitle", {
              defaultValue: "Add a product",
            })}
          </DialogTitle>
          <DialogDescription>
            {t("pipeline.products.attachDescription", {
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

            <div className="max-h-[320px] overflow-y-auto rounded-xl border border-border">
              {productsQuery.isPending ? (
                <div className="space-y-px">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-none" />
                  ))}
                </div>
              ) : options.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                  {debouncedSearch
                    ? t("stripeProducts.noResults", {
                        defaultValue: "No products match that search.",
                      })
                    : t("pipeline.products.nothingToAdd", {
                        defaultValue:
                          "Nothing left to add. Products need a price before they can go on a deal.",
                      })}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {options.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        disabled={attachMutation.isPending}
                        onClick={() => attachMutation.mutate(option.price.id)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                      >
                        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-background">
                          {option.image ? (
                            <img
                              src={option.image}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (
                                  e.target as HTMLImageElement
                                ).style.visibility = "hidden";
                              }}
                            />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground/60" />
                          )}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {option.name}
                        </span>
                        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                          {formatMoneyFromMinor(
                            option.price.unit_amount,
                            option.price.currency,
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close", { defaultValue: "Close" })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
