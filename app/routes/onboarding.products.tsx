import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  getVisibleStripeProducts,
  addProductsToWorkspace,
  type VisibleStripeProduct,
  type VisibleStripePrice,
} from "~/lib/api/onboarding";
import { formatBillingInterval } from "~/lib/utils/stripe";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { useAuthContext } from "~/providers/auth-provider";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Star } from "lucide-react";

export function meta() {
  return [
    { title: "Choose your products - Repraesent" },
    { name: "description", content: "Select products and plans" },
  ];
}

function formatPrice(amount: string | null, currency: string | null) {
  if (amount == null) return "—";
  const num = Number(amount) / 100;
  return `€${num.toFixed(2)}${currency ? ` ${currency.toUpperCase()}` : ""}`;
}

function SavingBadge({
  monthlyPrice,
  yearlyPrice,
}: {
  monthlyPrice: number;
  yearlyPrice: number;
}) {
  if (monthlyPrice <= 0) return null;
  const yearlyFromMonthly = monthlyPrice * 12;
  const pct = Math.round((1 - yearlyPrice / yearlyFromMonthly) * 100);
  if (pct <= 0) return null;
  return (
    <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
      Save {pct}%
    </span>
  );
}

export default function OnboardingProducts() {
  const { user, currentWorkspace, workspaces } = useAuthContext();
  const navigate = useNavigate();
  const [selections, setSelections] = useState<
    Record<string, { productId: string; priceId: string; price: VisibleStripePrice }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const workspaceId =
    getStoredWorkspaceId() ?? currentWorkspace?.id ?? workspaces[0]?.id;

  const { data: products, isLoading } = useQuery({
    queryKey: ["stripe-products-visible"],
    queryFn: getVisibleStripeProducts,
  });

  const toggleProduct = (
    product: VisibleStripeProduct,
    price: VisibleStripePrice
  ) => {
    setSelections((prev) => {
      if (prev[product.id]?.priceId === price.id) {
        const next = { ...prev };
        delete next[product.id];
        return next;
      }
      return {
        ...prev,
        [product.id]: { productId: product.id, priceId: price.id, price },
      };
    });
  };

  const isSelected = (productId: string, priceId: string) =>
    selections[productId]?.priceId === priceId;

  useEffect(() => {
    if (!user) return;
    const hasProfile = !!(user.first_name?.trim() && user.last_name?.trim());
    if (!hasProfile) {
      navigate("/onboarding/profile", { replace: true });
      return;
    }
    if (!workspaces?.length) {
      navigate("/onboarding/workspace", { replace: true });
      return;
    }
  }, [user, workspaces, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!workspaceId) {
      setError("No workspace selected");
      return;
    }
    const items = Object.values(selections);
    if (items.length === 0) {
      setError("Please select at least one product");
      return;
    }
    setIsSubmitting(true);
    try {
      await addProductsToWorkspace(
        workspaceId,
        items.map((s) => ({
          stripe_product_id: s.productId,
          stripe_price_id: s.priceId,
        }))
      );
      navigate("/pending", { replace: true });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!workspaceId) {
    navigate("/onboarding/workspace", { replace: true });
    return null;
  }

  const ws = currentWorkspace ?? workspaces[0];
  const hasStripeCustomer = !!(ws as { stripe_customer_id?: string | null })
    ?.stripe_customer_id;
  if (!hasStripeCustomer) {
    navigate("/onboarding/billing", { replace: true });
    return null;
  }

  if (isLoading || !products?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p>Loading products...</p>
            </div>
          ) : (
            <p>No products available. Please contact support.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose your products</CardTitle>
        <CardDescription>
          Select products and plans. Our team will set up your subscription.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="rounded-lg border-2 border-border p-4"
              >
                <div className="flex items-start gap-3">
                  {product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-16 w-16 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded bg-muted shrink-0 flex items-center justify-center text-muted-foreground text-xs">
                      No img
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{product.name}</h3>
                      {product.is_featured && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                          <Star className="h-3 w-3" />
                          Recommended
                        </span>
                      )}
                    </div>
                    {product.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {product.description}
                      </p>
                    )}
                    <div className="mt-3 space-y-2">
                      {product.prices.map((price) => {
                        const amount = price.unit_amount
                          ? Number(price.unit_amount) / 100
                          : 0;
                        const intervalLabel = formatBillingInterval(
                          price.recurring_interval,
                          price.type
                        );
                        const interval = price.recurring_interval ?? "one-time";
                        const monthlyPrice = product.prices.find(
                          (p) => p.recurring_interval === "month"
                        )?.unit_amount
                          ? Number(
                              product.prices.find(
                                (p) => p.recurring_interval === "month"
                              )!.unit_amount
                            ) / 100
                          : 0;
                        const yearlyPrice =
                          interval === "year" ? amount : amount * 12;
                        const selected = isSelected(product.id, price.id);
                        const suffix =
                          interval === "month"
                            ? "mo"
                            : interval === "year"
                              ? "yr"
                              : interval === "day"
                                ? "day"
                                : interval === "week"
                                  ? "wk"
                                  : "";
                        return (
                          <div
                            key={price.id}
                            onClick={() => toggleProduct(product, price)}
                            className={`flex items-center justify-between cursor-pointer rounded-md border-2 p-3 transition-colors ${
                              selected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {selected ? (
                                <Check className="h-5 w-5 text-primary shrink-0" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-muted-foreground shrink-0" />
                              )}
                              <span className="font-medium">
                                {intervalLabel}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold">
                                {formatPrice(price.unit_amount, price.currency)}
                              </span>
                              <span className="text-muted-foreground">
                                /{suffix}
                              </span>
                              {interval === "year" &&
                                monthlyPrice > 0 &&
                                yearlyPrice < monthlyPrice * 12 && (
                                  <div className="mt-1">
                                    <SavingBadge
                                      monthlyPrice={monthlyPrice}
                                      yearlyPrice={yearlyPrice}
                                    />
                                  </div>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/onboarding/workspace")}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={Object.keys(selections).length === 0 || isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Continue"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
