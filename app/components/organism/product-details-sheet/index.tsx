import { useTranslation } from "react-i18next";
import { ExternalLink, Package, Repeat, Star } from "lucide-react";
import {
  stripeDashboardUrl,
  type CatalogAccount,
  type CatalogPrice,
  type CatalogProduct,
} from "~/lib/api/stripe-catalog";
import { useCatalogProduct } from "~/lib/hooks/useStripeCatalog";
import { formatDateMedium, formatMoneyFromMinor } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";

interface ProductDetailsSheetProps {
  productId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: CatalogAccount | null;
}

/**
 * Everything Stripe knows about one product, read-only. Opens from the cached
 * list instantly and refreshes in the background to pick up archived prices.
 */
export function ProductDetailsSheet({
  productId,
  open,
  onOpenChange,
  account,
}: ProductDetailsSheetProps) {
  const { t } = useTranslation();
  const query = useCatalogProduct(open ? productId : null);
  const product = query.data ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {product ? (
          <ProductBody product={product} account={account} />
        ) : (
          <div className="space-y-4 p-6">
            <SheetHeader className="p-0">
              <SheetTitle>
                <Skeleton className="h-5 w-48" />
              </SheetTitle>
              <SheetDescription>
                <Skeleton className="h-3 w-64" />
              </SheetDescription>
            </SheetHeader>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
            {query.isError ? (
              <p className="text-sm text-destructive">
                {t("common.somethingWentWrong", { defaultValue: "Something went wrong." })}
              </p>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ProductBody({
  product,
  account,
}: {
  product: CatalogProduct;
  account: CatalogAccount | null;
}) {
  const { t } = useTranslation();
  const metadataEntries = Object.entries(product.metadata);
  const dashboardHref = stripeDashboardUrl(
    account?.id ?? null,
    product.livemode,
    `products/${product.id}`,
  );

  return (
    <>
      {product.images.length ? (
        <div className="flex gap-2 overflow-x-auto border-b border-border bg-muted/30 p-4">
          {product.images.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              className="h-28 w-28 shrink-0 rounded-xl border border-border object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ))}
        </div>
      ) : null}

      <SheetHeader className="space-y-2 p-6 pb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <KindBadges product={product} />
          {!product.active ? (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("stripeProducts.archived", { defaultValue: "Archived" })}
            </span>
          ) : null}
          {!product.livemode ? (
            <span className="rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              {t("stripeProducts.testMode", { defaultValue: "Test mode" })}
            </span>
          ) : null}
        </div>
        <SheetTitle className="text-lg leading-tight">{product.name}</SheetTitle>
        <SheetDescription className="font-mono text-[11px]">{product.id}</SheetDescription>
        {product.description ? (
          <p className="text-sm text-foreground/80">{product.description}</p>
        ) : null}
        {product.is_physical ? (
          <p className="text-xs text-muted-foreground">
            {product.stock !== null
              ? t("stripeProducts.inStock", {
                  defaultValue: "{{count}} in stock",
                  count: product.stock,
                })
              : t("stripeProducts.stockUnknown", { defaultValue: "No stock recorded" })}
            {product.stock_key ? (
              <span className="ml-1 text-muted-foreground/70">
                ·{" "}
                {t("stripeProducts.stockSource", {
                  defaultValue: 'From metadata key "{{key}}"',
                  key: product.stock_key,
                })}
              </span>
            ) : null}
          </p>
        ) : null}
      </SheetHeader>

      <div className="space-y-6 px-6 pb-6">
        <Section title={t("stripeProducts.details.prices", { defaultValue: "Prices" })}>
          {product.prices.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {product.prices.map((price) => (
                <PriceRow key={price.id} price={price} />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("stripeProducts.details.noPrices", {
                defaultValue: "This product has no prices.",
              })}
            </p>
          )}
        </Section>

        <Section title={t("stripeProducts.details.details", { defaultValue: "Details" })}>
          <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-4 gap-y-2 text-sm">
            <Fact label={t("stripeProducts.details.shippable", { defaultValue: "Shippable" })}>
              {product.shippable === null
                ? "—"
                : product.shippable
                  ? t("common.yes", { defaultValue: "Yes" })
                  : t("common.no", { defaultValue: "No" })}
            </Fact>
            {product.package_dimensions ? (
              <>
                <Fact label={t("stripeProducts.details.dimensions", { defaultValue: "Package size" })}>
                  <span className="tabular-nums">
                    {product.package_dimensions.length} × {product.package_dimensions.width} ×{" "}
                    {product.package_dimensions.height} in
                  </span>
                </Fact>
                <Fact label={t("stripeProducts.details.weight", { defaultValue: "Weight" })}>
                  <span className="tabular-nums">{product.package_dimensions.weight} oz</span>
                </Fact>
              </>
            ) : null}
            <Fact label={t("stripeProducts.unitLabel", { defaultValue: "Unit label" })}>
              {product.unit_label ?? "—"}
            </Fact>
            <Fact label={t("stripeProducts.statementDescriptor", { defaultValue: "Statement descriptor" })}>
              {product.statement_descriptor ?? "—"}
            </Fact>
            <Fact label={t("stripeProducts.taxCode", { defaultValue: "Tax category" })}>
              <span className="font-mono text-xs">{product.tax_code ?? "—"}</span>
            </Fact>
            <Fact label={t("stripeProducts.url", { defaultValue: "Product URL" })}>
              {product.url ? (
                <a
                  href={product.url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary hover:underline"
                >
                  {product.url}
                </a>
              ) : (
                "—"
              )}
            </Fact>
            {product.marketing_features.length ? (
              <Fact label={t("stripeProducts.details.features", { defaultValue: "Features" })}>
                <ul className="list-disc space-y-0.5 pl-4">
                  {product.marketing_features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </Fact>
            ) : null}
            <Fact label={t("stripeProducts.details.created", { defaultValue: "Created" })}>
              {formatDateMedium(product.created * 1000)}
            </Fact>
            <Fact label={t("stripeProducts.details.updated", { defaultValue: "Updated" })}>
              {formatDateMedium(product.updated * 1000)}
            </Fact>
          </dl>
        </Section>

        <Section title={t("stripeProducts.details.metadata", { defaultValue: "Metadata" })}>
          {metadataEntries.length ? (
            <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border text-xs">
              {metadataEntries.map(([key, value]) => (
                <div key={key} className="grid grid-cols-[minmax(0,11rem)_1fr] gap-3 px-3 py-2">
                  <dt className="truncate font-mono text-muted-foreground">{key}</dt>
                  <dd className="break-words text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("stripeProducts.details.noMetadata", {
                defaultValue: "No metadata on this product.",
              })}
            </p>
          )}
        </Section>

        <Button asChild variant="outline" className="w-full">
          <a href={dashboardHref} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            {t("stripeProducts.openInStripe", { defaultValue: "Open in Stripe" })}
          </a>
        </Button>
      </div>
    </>
  );
}

export function KindBadges({ product }: { product: CatalogProduct }) {
  const { t } = useTranslation();
  const badges: Array<{ key: string; label: string; className: string; icon?: React.ReactNode }> = [];
  if (product.is_physical) {
    badges.push({
      key: "physical",
      label: t("stripeProducts.kindBadge.physical", { defaultValue: "Physical" }),
      className: "bg-muted text-foreground",
      icon: <Package className="h-2.5 w-2.5" />,
    });
  }
  if (product.has_recurring) {
    badges.push({
      key: "subscription",
      label: t("stripeProducts.kindBadge.subscription", { defaultValue: "Subscription" }),
      className: "bg-primary/10 text-primary",
      icon: <Repeat className="h-2.5 w-2.5" />,
    });
  } else if (product.has_one_time) {
    badges.push({
      key: "one_time",
      label: t("stripeProducts.kindBadge.oneTime", { defaultValue: "One-time" }),
      className: "bg-muted text-muted-foreground",
    });
  }
  return (
    <>
      {badges.map((b) => (
        <span
          key={b.key}
          className={cn(
            "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            b.className,
          )}
        >
          {b.icon}
          {b.label}
        </span>
      ))}
    </>
  );
}

function PriceRow({ price }: { price: CatalogPrice }) {
  const { t } = useTranslation();
  const interval = price.interval
    ? price.interval_count && price.interval_count > 1
      ? `/ ${price.interval_count} ${t(`stripeProducts.interval.${price.interval}`, { defaultValue: price.interval }).replace(/^per\s+/i, "")}`
      : t(`stripeProducts.interval.${price.interval}`, { defaultValue: `per ${price.interval}` })
    : t("stripeProducts.oneTime", { defaultValue: "one-time" });

  return (
    <li className={cn("flex items-center gap-3 px-3 py-2.5", !price.active && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium tabular-nums text-foreground">
          {price.billing_scheme === "tiered"
            ? t("stripeProducts.details.tiered", { defaultValue: "Tiered pricing" })
            : formatMoneyFromMinor(price.unit_amount, price.currency)}
          <span className="text-xs font-normal text-muted-foreground">{interval}</span>
          {price.is_default ? (
            <span className="inline-flex items-center gap-0.5 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
              <Star className="h-2.5 w-2.5 fill-current" />
              {t("stripeProducts.defaultPrice", { defaultValue: "Default" })}
            </span>
          ) : null}
          {!price.active ? (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              {t("stripeProducts.details.archivedPrice", { defaultValue: "Archived" })}
            </span>
          ) : null}
          {price.trial_period_days ? (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {t("stripeProducts.details.trialDays", {
                defaultValue: "{{count}}-day trial",
                count: price.trial_period_days,
              })}
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 truncate font-mono text-[11px] text-muted-foreground">
          <span>{price.id}</span>
          {price.nickname ? <span className="font-sans">{price.nickname}</span> : null}
          {price.lookup_key ? (
            <span>
              {t("stripeProducts.details.lookupKey", { defaultValue: "Lookup key" })}: {price.lookup_key}
            </span>
          ) : null}
        </p>
      </div>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </>
  );
}
