import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  ChevronDown,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  deleteCatalogProduct,
  isStripeNotConnected,
  type CatalogProduct,
} from "~/lib/api/stripe-catalog";
import {
  useCatalogAccount,
  useCatalogProducts,
} from "~/lib/hooks/useStripeCatalog";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { formatMoneyFromMinor } from "~/lib/utils/format";
import { ProductSheet } from "~/components/organism/product-sheet";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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

export function meta() {
  return [
    { title: `${i18n.t("stripeProducts.metaTitle")} - Repraesent` },
    {
      name: "description",
      content: i18n.t("stripeProducts.metaDescription"),
    },
  ];
}

export default function Products() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "stripeProducts.metaTitle",
    descriptionKey: "stripeProducts.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const { currentWorkspace } = useAuthContext();
  const queryClient = useQueryClient();
  const canEdit = currentWorkspace?.member_role !== "viewer";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">(
    "true",
  );
  // Stripe pages by cursor, so "previous" means remembering where we have been.
  const [cursors, setCursors] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CatalogProduct | null>(
    null,
  );

  const accountQuery = useCatalogAccount(!!currentWorkspace);
  const notConnected = isStripeNotConnected(accountQuery.error);

  const productsQuery = useCatalogProducts(
    {
      search: debouncedSearch || undefined,
      active: activeFilter === "all" ? undefined : activeFilter,
      starting_after: cursors[cursors.length - 1],
      limit: 20,
    },
    !!currentWorkspace && !notConnected,
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCatalogProduct(id),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["stripe-products"] });
      setPendingDelete(null);
      toast.success(
        result.deleted
          ? t("stripeProducts.deleted", { defaultValue: "Product deleted" })
          : t("stripeProducts.archivedInstead", {
              defaultValue:
                "Product had prices, so Stripe archived it instead of deleting.",
            }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  function resetPaging() {
    setCursors([]);
  }

  if (notConnected) {
    return <NotConnected />;
  }

  const account = accountQuery.data;
  const products = productsQuery.data?.data ?? [];
  const isLoading = productsQuery.isPending || accountQuery.isPending;
  // Stripe's search index returns a single page; hide paging while searching.
  const canPage = !debouncedSearch;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 app-fade-in">
      <header className="app-fade-up flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {t("stripeProducts.title", { defaultValue: "Products" })}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {t("stripeProducts.subtitle", {
                defaultValue: "Your Stripe catalogue, live.",
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

        {canEdit ? (
          <Button
            onClick={() => {
              setEditingId(null);
              setSheetOpen(true);
            }}
            className="sm:shrink-0"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t("stripeProducts.new", { defaultValue: "New product" })}
          </Button>
        ) : null}
      </header>

      <div className="app-fade-up app-fade-up-d1 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPaging();
            }}
            placeholder={t("stripeProducts.searchPlaceholder", {
              defaultValue: "Search products…",
            })}
            className="pl-9"
          />
        </div>
        <Select
          value={activeFilter}
          onValueChange={(v) => {
            setActiveFilter(v as typeof activeFilter);
            resetPaging();
          }}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">
              {t("stripeProducts.filterActive", { defaultValue: "Active" })}
            </SelectItem>
            <SelectItem value="false">
              {t("stripeProducts.filterArchived", {
                defaultValue: "Archived",
              })}
            </SelectItem>
            <SelectItem value="all">
              {t("stripeProducts.filterAll", { defaultValue: "All" })}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="app-fade-up app-fade-up-d2 overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="space-y-px">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[68px] w-full rounded-none" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              {debouncedSearch
                ? t("stripeProducts.noResults", {
                    defaultValue: "No products match that search.",
                  })
                : t("stripeProducts.empty", {
                    defaultValue: "No products yet.",
                  })}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                canEdit={canEdit}
                onEdit={() => {
                  setEditingId(product.id);
                  setSheetOpen(true);
                }}
                onDelete={() => setPendingDelete(product)}
              />
            ))}
          </ul>
        )}
      </div>

      {canPage && (cursors.length > 0 || productsQuery.data?.has_more) ? (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={cursors.length === 0}
            onClick={() => setCursors((c) => c.slice(0, -1))}
          >
            {t("common.previous", { defaultValue: "Previous" })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!productsQuery.data?.next_cursor}
            onClick={() =>
              setCursors((c) => [...c, productsQuery.data!.next_cursor!])
            }
          >
            {t("common.next", { defaultValue: "Next" })}
            <ChevronDown className="ml-1 h-4 w-4 -rotate-90" />
          </Button>
        </div>
      ) : null}

      <ProductSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        productId={editingId}
        defaultCurrency={account?.default_currency ?? "eur"}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("stripeProducts.deleteTitle", {
                defaultValue: "Delete product?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("stripeProducts.deleteBody", {
                defaultValue:
                  "Stripe cannot delete a product that has prices — those get archived instead, staying on past invoices but no longer sellable. This happens in your Stripe account.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              {deleteMutation.isPending
                ? t("common.loading", { defaultValue: "Loading…" })
                : t("common.delete", { defaultValue: "Delete" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductRow({
  product,
  canEdit,
  onEdit,
  onDelete,
}: {
  product: CatalogProduct;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const price = product.default_price;

  return (
    <li className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5">
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-background">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <Package className="h-5 w-5 text-muted-foreground/60" />
        )}
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {product.name}
          </span>
          {!product.active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              <Archive className="h-3 w-3" />
              {t("stripeProducts.archived", { defaultValue: "Archived" })}
            </span>
          ) : null}
          {product.category ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {product.category}
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {[
            t(`stripeProducts.kinds.${product.kind}`, {
              defaultValue:
                product.kind === "physical"
                  ? "Physical good"
                  : product.kind === "digital"
                    ? "Digital good"
                    : "Service",
            }),
            product.kind === "physical" && product.inventory_count !== null
              ? t("stripeProducts.inStock", {
                  defaultValue: "{{count}} in stock",
                  count: product.inventory_count,
                })
              : null,
            product.description,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </button>

      <div className="hidden shrink-0 text-right sm:block">
        {price ? (
          <>
            <p className="text-sm font-medium tabular-nums text-foreground">
              {formatMoneyFromMinor(price.unit_amount, price.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              {price.interval
                ? t(`stripeProducts.interval.${price.interval}`, {
                    defaultValue: `per ${price.interval}`,
                  })
                : t("stripeProducts.oneTime", { defaultValue: "one-time" })}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("stripeProducts.noPrice", { defaultValue: "No price" })}
          </p>
        )}
      </div>

      {canEdit ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </li>
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
            defaultValue: "Connect Stripe to manage products",
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
