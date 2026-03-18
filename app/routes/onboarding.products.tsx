import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import {
  getVisibleStripeProducts,
  addProductsToWorkspace,
  type VisibleStripeProduct,
  type VisibleStripePrice,
} from "~/lib/api/onboarding";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { useAuthContext } from "~/providers/auth-provider";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Star, ChevronLeft, ChevronRight } from "lucide-react";

export function meta() {
  return [
    { title: "Choose your plan - Repraesent" },
    { name: "description", content: "Select a plan that suits your needs" },
  ];
}

type Interval = "month" | "year";

const CARD_WIDTH = 280;
const CARD_GAP = 16;
const CARD_STEP = CARD_WIDTH + CARD_GAP;

function formatPrice(amount: string | null, currency: string | null): string {
  if (amount == null) return "—";
  const num = Number(amount) / 100;
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: currency?.toUpperCase() ?? "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function getSavingPercent(product: VisibleStripeProduct): number {
  const monthly = product.prices.find((p) => p.recurring_interval === "month");
  const yearly = product.prices.find((p) => p.recurring_interval === "year");
  if (!monthly?.unit_amount || !yearly?.unit_amount) return 0;
  const monthlyTotal = Number(monthly.unit_amount) * 12;
  const yearlyTotal = Number(yearly.unit_amount);
  if (monthlyTotal <= 0) return 0;
  return Math.round((1 - yearlyTotal / monthlyTotal) * 100);
}

function getPriceForInterval(
  product: VisibleStripeProduct,
  interval: Interval
): VisibleStripePrice | undefined {
  return product.prices.find((p) => p.recurring_interval === interval);
}

function ProductCard({
  product,
  interval,
  selected,
  onToggle,
  isCurrent,
}: {
  product: VisibleStripeProduct;
  interval: Interval;
  selected: boolean;
  onToggle: () => void;
  isCurrent: boolean;
}) {
  const price = getPriceForInterval(product, interval);
  const savingPct = interval === "year" ? getSavingPercent(product) : 0;

  return (
    <div
      onClick={onToggle}
      className={`relative flex flex-col rounded-2xl border-2 cursor-pointer transition-all duration-200 px-6 py-10 bg-background select-none
        ${
          selected
            ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]"
            : isCurrent
              ? "border-border shadow-md hover:border-primary/50"
              : "border-border/50 opacity-60 hover:opacity-80"
        }`}
      style={{ width: CARD_WIDTH, minHeight: 320 }}
    >
      {product.is_featured && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white shadow-sm whitespace-nowrap">
            <Star className="h-3 w-3 fill-white" />
            Recommended
          </span>
        </div>
      )}

      <div className="flex flex-col flex-1 gap-3">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-12 w-12 rounded-xl object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="text-primary text-lg font-bold">
              {product.name.charAt(0)}
            </span>
          </div>
        )}

        <div>
          <h3 className="font-bold text-lg leading-tight">{product.name}</h3>
          {product.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
              {product.description}
            </p>
          )}
        </div>

        <div className="mt-auto pt-4 border-t border-border">
          {price ? (
            <div className="flex items-end gap-2 flex-wrap">
              <span className="text-2xl font-bold">
                {formatPrice(price.unit_amount, price.currency)}
              </span>
              <span className="text-sm text-muted-foreground pb-0.5">
                /{interval === "month" ? "mo" : "yr"}
              </span>
              {savingPct > 0 && (
                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">
                  Save {savingPct}%
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              Not available for this billing period
            </span>
          )}
        </div>
      </div>

      <div
        className={`absolute top-10 right-4 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors
          ${
            selected
              ? "border-primary bg-primary"
              : "border-muted-foreground/40"
          }`}
      >
        {selected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
      </div>
    </div>
  );
}

export default function OnboardingProducts() {
  const { user, currentWorkspace, workspaces } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const workspaceId =
    getStoredWorkspaceId() ?? currentWorkspace?.id ?? workspaces[0]?.id;

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["stripe-products-visible"],
    queryFn: getVisibleStripeProducts,
  });

  const availableIntervals = (() => {
    const set = new Set<Interval>();
    products.forEach((p) => {
      p.prices.forEach((pr) => {
        console.log(pr);
        if (pr.recurring_interval === "month") set.add("month");
        if (pr.recurring_interval === "year") set.add("year");
      });
    });
    return Array.from(set) as Interval[];
  })();

  const [interval, setIntervalState] = useState<Interval>("month");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedProducts, setSelectedProducts] = useState<
    Record<string, { productId: string; priceId: string }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Scroll track ref for programmatic scrolling
  const trackRef = useRef<HTMLDivElement>(null);

  // Scroll to center the current card
  const scrollToCard = useCallback((idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const containerWidth = track.offsetWidth;
    const targetScrollLeft =
      idx * CARD_STEP - (containerWidth / 2 - CARD_WIDTH / 2);
    track.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToCard(currentIndex);
  }, [currentIndex, scrollToCard]);

  // Set initial interval once products load
  useEffect(() => {
    if (
      availableIntervals.length > 0 &&
      !availableIntervals.includes(interval)
    ) {
      setIntervalState(availableIntervals[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableIntervals.join(",")]);

  // Set initial carousel position to featured product
  useEffect(() => {
    if (products.length === 0) return;
    const featuredIdx = products.findIndex((p) => p.is_featured);
    const startIdx =
      featuredIdx >= 0 ? featuredIdx : Math.floor(products.length / 2);
    setCurrentIndex(startIdx);
  }, [products.length]);

  // Auth guards
  useEffect(() => {
    if (!user) return;
    if (!user.first_name?.trim() || !user.last_name?.trim()) {
      navigate("/onboarding/profile", { replace: true });
      return;
    }
    if (!workspaces?.length) {
      navigate("/onboarding/workspace", { replace: true });
    }
  }, [user, workspaces, navigate]);

  const toggleProduct = (product: VisibleStripeProduct) => {
    const price = getPriceForInterval(product, interval);
    if (!price) return;
    setSelectedProducts((prev) => {
      if (prev[product.id]?.priceId === price.id) {
        const next = { ...prev };
        delete next[product.id];
        return next;
      }
      return {
        ...prev,
        [product.id]: { productId: product.id, priceId: price.id },
      };
    });
  };

  const handleIntervalChange = (newInterval: Interval) => {
    setIntervalState(newInterval);
    // Re-map selections to prices in the new interval (drop if no matching price)
    setSelectedProducts((prev) => {
      const next: typeof prev = {};
      for (const [productId] of Object.entries(prev)) {
        const product = products.find((p) => p.id === productId);
        if (!product) continue;
        const newPrice = getPriceForInterval(product, newInterval);
        if (newPrice) next[productId] = { productId, priceId: newPrice.id };
      }
      return next;
    });
  };

  const goToPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goToNext = () =>
    setCurrentIndex((i) => Math.min(products.length - 1, i + 1));

  const handleSubmit = async () => {
    setError(null);
    if (!workspaceId) {
      setError("No workspace selected");
      return;
    }
    const items = Object.values(selectedProducts);
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
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      navigate("/pending", { replace: true });
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
  if (!(ws as { stripe_customer_id?: string | null })?.stripe_customer_id) {
    navigate("/onboarding/billing", { replace: true });
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Loading plans...</p>
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-muted-foreground">
          No plans available. Please contact support.
        </p>
      </div>
    );
  }

  const maxSaving = Math.max(...products.map(getSavingPercent));

  return (
    <div className="flex flex-col items-center w-full py-8">
      {/* Header */}
      <div className="text-center mb-8 space-y-2 px-4">
        <h1 className="text-3xl font-bold tracking-tight">Choose your plan</h1>
        <p className="text-muted-foreground">
          Select one or more products. Our team will set up your subscription.
        </p>
      </div>

      {/* Interval tabs */}
      {availableIntervals.length > 1 && (
        <div className="mb-8 flex items-center gap-1 rounded-full border bg-muted p-1">
          {availableIntervals.map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => handleIntervalChange(iv)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all
                ${
                  interval === iv
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {iv === "month" ? "Monthly" : "Yearly"}
              {iv === "year" && maxSaving > 0 && (
                <span className="ml-2 rounded-full bg-green-500/15 px-1.5 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">
                  Save up to {maxSaving}%
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Carousel */}
      <div className="relative w-full flex items-center gap-3 px-10">
        {/* Prev */}
        <button
          type="button"
          onClick={goToPrev}
          disabled={currentIndex === 0}
          className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-md hover:bg-muted transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Scrollable track — scrollbar hidden via padding trick */}
        <div className="flex-1 overflow-hidden" style={{ paddingBottom: 20 }}>
          <div
            ref={trackRef}
            className="flex gap-4 overflow-x-scroll"
            style={
              {
                paddingBottom: 20, // extra space so scrollbar is hidden by parent overflow:hidden
                paddingTop: 20,
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              } as React.CSSProperties
            }
          >
            {/* Leading padding to allow centering the first card */}
            <div style={{ flexShrink: 0, width: 1 }} aria-hidden />
            {products.map((product, idx) => (
              <div key={product.id} style={{ flexShrink: 0 }}>
                <ProductCard
                  product={product}
                  interval={interval}
                  selected={!!selectedProducts[product.id]}
                  onToggle={() => {
                    toggleProduct(product);
                    setCurrentIndex(idx);
                  }}
                  isCurrent={idx === currentIndex}
                />
              </div>
            ))}
            {/* Trailing padding */}
            <div style={{ flexShrink: 0, width: 1 }} aria-hidden />
          </div>
        </div>

        {/* Next */}
        <button
          type="button"
          onClick={goToNext}
          disabled={currentIndex === products.length - 1}
          className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-md hover:bg-muted transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Dot indicators */}
      {products.length > 1 && (
        <div className="mt-6 flex gap-1.5">
          {products.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentIndex
                  ? "w-6 bg-primary"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              aria-label={`Go to product ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Selection summary */}
      {Object.keys(selectedProducts).length > 0 && (
        <div className="mt-6 mx-4 rounded-xl border bg-primary/5 px-5 py-3 text-sm text-center">
          <span className="font-medium">Selected: </span>
          {Object.keys(selectedProducts)
            .map((id) => products.find((p) => p.id === id)?.name)
            .filter(Boolean)
            .join(", ")}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 mx-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="mt-8 flex w-full max-w-sm justify-between px-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/onboarding/workspace")}
          disabled={isSubmitting}
        >
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={Object.keys(selectedProducts).length === 0 || isSubmitting}
        >
          {isSubmitting ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
