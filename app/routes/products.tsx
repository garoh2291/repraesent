import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Package, RefreshCw, ShoppingBag } from "lucide-react";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  CATALOG_TABS,
  isStripeNotConnected,
  listCatalogProducts,
  productMatchesSearch,
  productMatchesTab,
  stripeDashboardUrl,
  type CatalogList,
  type CatalogProduct,
  type CatalogTab,
} from "~/lib/api/stripe-catalog";
import {
  useCatalogAccount,
  useStripeCatalog,
  useStripeCatalogSearch,
} from "~/lib/hooks/useStripeCatalog";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { formatDateShort, formatMoneyFromMinor } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import { DataTable } from "~/components/organism/data-table";
import {
  KindBadges,
  ProductDetailsSheet,
} from "~/components/organism/product-details-sheet";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export function meta() {
  return [
    { title: `${i18n.t("stripeProducts.metaTitle")} - Repraesent` },
    {
      name: "description",
      content: i18n.t("stripeProducts.metaDescription"),
    },
  ];
}

const PAGE_SIZES = [20, 50, 100];

/**
 * The connected Stripe catalogue, read-only.
 *
 * One request loads everything; tabs, search and paging are all local, so the
 * page answers at typing speed. Stripe's dashboard is where products change.
 */
export default function Products() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "stripeProducts.metaTitle",
    descriptionKey: "stripeProducts.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const { currentWorkspace } = useAuthContext();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<CatalogTab>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 200);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const accountQuery = useCatalogAccount(!!currentWorkspace);
  const notConnected = isStripeNotConnected(accountQuery.error);

  const catalogQuery = useStripeCatalog(
    { includeArchived },
    !!currentWorkspace && !notConnected,
  );
  const truncated = catalogQuery.data?.truncated ?? false;
  const serverSearch = useStripeCatalogSearch(
    debouncedSearch,
    !!currentWorkspace && !notConnected && truncated,
  );

  const refreshMutation = useMutation({
    mutationFn: () =>
      listCatalogProducts({ include_archived: includeArchived, refresh: true }),
    onSuccess: (data: CatalogList) => {
      queryClient.setQueryData(["stripe-catalog", includeArchived], data);
      toast.success(
        t("stripeProducts.refreshed", { defaultValue: "Catalogue refreshed" }),
      );
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const filtered = useMemo(() => {
    const source =
      truncated && debouncedSearch
        ? (serverSearch.data?.data ?? [])
        : (catalogQuery.data?.data ?? []);
    return source
      .filter((p) => productMatchesTab(p, tab))
      .filter((p) => truncated || productMatchesSearch(p, debouncedSearch))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogQuery.data, serverSearch.data, truncated, debouncedSearch, tab]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * limit, safePage * limit);

  const counts = catalogQuery.data?.counts;
  const account = accountQuery.data ?? null;

  const columns = useMemo<ColumnDef<CatalogProduct, unknown>[]>(() => {
    const cols: ColumnDef<CatalogProduct, unknown>[] = [
      {
        id: "product",
        header: t("stripeProducts.columns.product", { defaultValue: "Product" }),
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-background">
                {p.images[0] ? (
                  <img
                    src={p.images[0]}
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
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {p.name}
                  </span>
                  {!p.active ? (
                    <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("stripeProducts.archived", { defaultValue: "Archived" })}
                    </span>
                  ) : null}
                </div>
                {p.description ? (
                  <p className="max-w-[28rem] truncate text-xs text-muted-foreground">
                    {p.description}
                  </p>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        id: "kind",
        header: t("stripeProducts.columns.kind", { defaultValue: "Type" }),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <KindBadges product={row.original} />
          </div>
        ),
      },
      {
        id: "price",
        header: t("stripeProducts.columns.price", { defaultValue: "Price" }),
        cell: ({ row }) => {
          const p = row.original;
          const price = p.default_price;
          const activeCount = p.prices.filter((x) => x.active).length;
          if (!price) {
            return (
              <span className="text-xs text-muted-foreground">
                {t("stripeProducts.noPrice", { defaultValue: "No price" })}
              </span>
            );
          }
          return (
            <div className="whitespace-nowrap">
              <p className="text-sm font-medium tabular-nums text-foreground">
                {price.billing_scheme === "tiered"
                  ? t("stripeProducts.details.tiered", { defaultValue: "Tiered pricing" })
                  : formatMoneyFromMinor(price.unit_amount, price.currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                {price.interval
                  ? t(`stripeProducts.interval.${price.interval}`, {
                      defaultValue: `per ${price.interval}`,
                    })
                  : t("stripeProducts.oneTime", { defaultValue: "one-time" })}
                {activeCount > 1
                  ? ` · ${t("stripeProducts.morePrices", {
                      defaultValue: "+{{count}} more",
                      count: activeCount - 1,
                    })}`
                  : ""}
              </p>
            </div>
          );
        },
      },
    ];

    if (tab === "physical") {
      cols.push({
        id: "stock",
        header: t("stripeProducts.columns.stock", { defaultValue: "Stock" }),
        cell: ({ row }) => {
          const p = row.original;
          if (p.stock === null) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground">—</span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {t("stripeProducts.stockUnknown", { defaultValue: "No stock recorded" })}
                </TooltipContent>
              </Tooltip>
            );
          }
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    p.stock === 0 ? "text-destructive" : "text-foreground",
                  )}
                >
                  {p.stock}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t("stripeProducts.stockSource", {
                  defaultValue: 'From metadata key "{{key}}"',
                  key: p.stock_key,
                })}
              </TooltipContent>
            </Tooltip>
          );
        },
      });
    }

    cols.push({
      id: "updated",
      header: t("stripeProducts.columns.updated", { defaultValue: "Updated" }),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateShort(row.original.updated * 1000)}
        </span>
      ),
    });

    return cols;
  }, [t, tab]);

  if (notConnected) {
    return <NotConnected />;
  }

  const isLoading =
    catalogQuery.isPending ||
    accountQuery.isPending ||
    (truncated && !!debouncedSearch && serverSearch.isPending);

  return (
    <TooltipProvider>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 app-fade-in">
        <header className="app-fade-up flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {t("stripeProducts.title", { defaultValue: "Products" })}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                {t("stripeProducts.readOnlyHint", {
                  defaultValue:
                    "Read-only. Products are edited in your Stripe dashboard.",
                })}
              </span>
              {account ? (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span>{account.name ?? account.id}</span>
                  {!account.livemode ? (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      {t("stripeProducts.testMode", { defaultValue: "Test mode" })}
                    </span>
                  ) : null}
                </>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
              <Switch
                id="show-archived"
                checked={includeArchived}
                onCheckedChange={(v) => {
                  setIncludeArchived(v);
                  setPage(1);
                }}
              />
              <Label htmlFor="show-archived" className="text-xs font-medium">
                {t("stripeProducts.showArchived", { defaultValue: "Show archived" })}
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={refreshMutation.isPending}
              onClick={() => refreshMutation.mutate()}
            >
              <RefreshCw
                className={cn("h-4 w-4", refreshMutation.isPending && "app-spin")}
              />
              {t("stripeProducts.refresh", { defaultValue: "Refresh from Stripe" })}
            </Button>
            {account ? (
              <Button asChild variant="ghost" size="sm">
                <a
                  href={stripeDashboardUrl(account.id, account.livemode, "products")}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("stripeProducts.openInStripe", { defaultValue: "Open in Stripe" })}
                </a>
              </Button>
            ) : null}
          </div>
        </header>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as CatalogTab);
            setPage(1);
          }}
          className="app-fade-up app-fade-up-d1"
        >
          <TabsList>
            {CATALOG_TABS.map((key) => {
              const count =
                key === "all"
                  ? counts?.all
                  : key === "physical"
                    ? counts?.physical
                    : key === "subscriptions"
                      ? counts?.subscriptions
                      : counts?.one_time;
              return (
                <TabsTrigger key={key} value={key} className="gap-1.5">
                  {t(`stripeProducts.tabs.${key === "one_time" ? "oneTime" : key}`, {
                    defaultValue: {
                      all: "All",
                      physical: "Physical",
                      subscriptions: "Subscriptions",
                      one_time: "One-time",
                    }[key],
                  })}
                  {count !== undefined ? (
                    <span className="rounded-full bg-muted px-1.5 py-px text-[10px] tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {truncated ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
            {t("stripeProducts.truncatedHint", {
              defaultValue:
                "Large catalogue: showing the first 1000 products. Search runs on Stripe.",
            })}
          </p>
        ) : null}

        <div className="app-fade-up app-fade-up-d2">
          <DataTable
            columns={columns}
            data={pageRows}
            isLoading={isLoading}
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            searchPlaceholder={t("stripeProducts.searchPlaceholder", {
              defaultValue: "Search products…",
            })}
            emptyMessage={
              debouncedSearch
                ? t("stripeProducts.noResults", {
                    defaultValue: "No products match that search.",
                  })
                : t("stripeProducts.empty", { defaultValue: "No products yet." })
            }
            pagination={{
              page: safePage,
              limit,
              total,
              totalPages,
              hasNext: safePage < totalPages,
              hasPrev: safePage > 1,
            }}
            onPaginationChange={(nextPage, nextLimit) => {
              setPage(nextPage);
              setLimit(nextLimit);
            }}
            pageSizeOptions={PAGE_SIZES}
            onRowClick={(row) => setSelectedId(row.id)}
            enableSorting={false}
          />
        </div>

        <ProductDetailsSheet
          productId={selectedId}
          open={!!selectedId}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
          account={account}
        />
      </div>
    </TooltipProvider>
  );
}

/**
 * The whole page is a live proxy, so with no connected account there is
 * literally nothing to render — point at the one place that fixes it.
 */
function NotConnected() {
  const { t } = useTranslation();

  return (
    <div className="p-4 sm:p-6 app-fade-in">
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border p-10 text-center">
        <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <h2 className="mt-4 text-base font-semibold text-foreground">
          {t("stripeProducts.notConnectedTitle", {
            defaultValue: "Connect Stripe to see products",
          })}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("stripeProducts.notConnectedBody", {
            defaultValue:
              "This page reads your Stripe catalogue directly. Connect an account to get started.",
          })}
        </p>
        <Button asChild className="mt-5">
          <Link to="/settings/integrations">
            {t("stripeProducts.goToIntegrations", {
              defaultValue: "Go to Integrations",
            })}
          </Link>
        </Button>
      </div>
    </div>
  );
}
