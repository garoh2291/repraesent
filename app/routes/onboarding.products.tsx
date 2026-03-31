import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import i18n from "~/i18n";
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
import { formatCurrencyFromCents } from "~/lib/utils/format";
import { Check, Star, ChevronLeft, ChevronRight } from "lucide-react";

export function meta() {
  return [
    { title: i18n.t("onboarding.products.metaTitle") },
    { name: "description", content: i18n.t("onboarding.products.metaDescription") },
  ];
}

type Interval = "month" | "year";

const CARD_WIDTH = 280;
const CARD_GAP = 16;
const CARD_STEP = CARD_WIDTH + CARD_GAP;

function formatPrice(amount: string | null, currency: string | null): string {
  if (amount == null) return "—";
  return formatCurrencyFromCents(Number(amount), currency ?? "EUR");
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
  const { t } = useTranslation();
  const price = getPriceForInterval(product, interval);
  const savingPct = interval === "year" ? getSavingPercent(product) : 0;

  return (
    <div
      onClick={onToggle}
      className={[
        "relative flex flex-col rounded-2xl border-2 cursor-pointer select-none",
        "transition-all duration-200 px-6 py-10",
        selected
          ? "border-foreground bg-white dark:bg-zinc-900 shadow-xl shadow-black/8 scale-[1.02]"
          : isCurrent
          ? "border-stone-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 shadow-md hover:border-stone-400 dark:hover:border-zinc-500"
          : "border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 opacity-60 hover:opacity-80",
      ].join(" ")}
      style={{ width: CARD_WIDTH, minHeight: 320 }}
    >
      {/* Recommended badge */}
      {product.is_featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm whitespace-nowrap">
            <Star className="h-3 w-3 fill-white" />
            {t("onboarding.products.recommended")}
          </span>
        </div>
      )}

      <div className="flex flex-col flex-1 gap-3">
        {/* Product icon */}
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-11 w-11 rounded-xl object-cover"
          />
        ) : (
          <div className="h-11 w-11 rounded-xl border border-stone-200 dark:border-zinc-700 flex items-center justify-center bg-stone-100 dark:bg-zinc-800">
            <span className="text-foreground text-base font-bold">
              {product.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Name & description */}
        <div>
          <h3 className="ob-heading font-semibold text-[17px] leading-tight text-foreground">
            {product.name}
          </h3>
          {product.description && (
            <p className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="mt-auto pt-4 border-t border-stone-100 dark:border-zinc-800">
          {price ? (
            <div className="flex items-end gap-2 flex-wrap">
              <span className="text-2xl font-bold text-foreground tracking-tight">
                {formatPrice(price.unit_amount, price.currency)}
              </span>
              <span className="text-sm text-muted-foreground pb-0.5">
                /{interval === "month" ? t("onboarding.products.perMonthShort") : t("onboarding.products.perYearShort")}
              </span>
              {savingPct > 0 && (
                <span className="rounded-full bg-emerald-500/12 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {t("onboarding.products.save", { percent: savingPct })}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              {t("onboarding.products.notAvailable")}
            </span>
          )}
        </div>
      </div>

      {/* Selection indicator */}
      <div
        className={[
          "absolute top-10 right-4 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all duration-200",
          selected
            ? "border-foreground bg-foreground"
            : "border-stone-300 dark:border-zinc-600",
        ].join(" ")}
      >
        {selected && <Check className="h-3.5 w-3.5 text-background" />}
      </div>
    </div>
  );
}

export default function OnboardingProducts() {
  const { t } = useTranslation();
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

  const trackRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (
      availableIntervals.length > 0 &&
      !availableIntervals.includes(interval)
    ) {
      setIntervalState(availableIntervals[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableIntervals.join(",")]);

  useEffect(() => {
    if (products.length === 0) return;
    const featuredIdx = products.findIndex((p) => p.is_featured);
    const startIdx =
      featuredIdx >= 0 ? featuredIdx : Math.floor(products.length / 2);
    setCurrentIndex(startIdx);
  }, [products.length]);

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
      setError(t("onboarding.products.noWorkspaceSelected"));
      return;
    }
    const items = Object.values(selectedProducts);
    if (items.length === 0) {
      setError(t("onboarding.products.selectAtLeastOne"));
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
      setError(err instanceof Error ? err.message : t("common.somethingWentWrong"));
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
      <div className="flex flex-col items-center justify-center py-24 gap-4 ob-fade-in">
        <div className="h-7 w-7 ob-spin-slow rounded-full border-2 border-foreground/20 border-t-foreground" />
        <p className="text-sm text-muted-foreground">{t("onboarding.products.loading")}</p>
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 ob-fade-in">
        <p className="text-sm text-muted-foreground">
          {t("onboarding.products.noPlans")}
        </p>
      </div>
    );
  }

  const maxSaving = Math.max(...products.map(getSavingPercent));
  const selectedCount = Object.keys(selectedProducts).length;

  return (
    <div className="flex flex-col items-center w-full ob-fade-up ob-fade-up-d1">
      {/* Header */}
      <div className="text-center mb-8 space-y-2 px-4 w-full">
        <h1 className="ob-heading text-[26px] font-semibold tracking-tight text-foreground">
          {t("onboarding.products.heading")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("onboarding.products.subtitle")}
        </p>
      </div>

      {/* Interval toggle */}
      {availableIntervals.length > 1 && (
        <div className="mb-8 flex items-center gap-1 rounded-full border border-stone-200 dark:border-zinc-800 bg-stone-100 dark:bg-zinc-900 p-1 ob-fade-up ob-fade-up-d2">
          {availableIntervals.map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => handleIntervalChange(iv)}
              className={[
                "rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
                interval === iv
                  ? "bg-white dark:bg-zinc-800 shadow-sm text-foreground border border-stone-200 dark:border-zinc-700"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {iv === "month" ? t("onboarding.products.monthly") : t("onboarding.products.yearly")}
              {iv === "year" && maxSaving > 0 && (
                <span className="ml-2 rounded-full bg-emerald-500/12 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {t("onboarding.products.saveUpTo", { percent: maxSaving })}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Carousel */}
      <div className="relative w-full flex items-center gap-3 px-10 ob-fade-up ob-fade-up-d3">
        <button
          type="button"
          onClick={goToPrev}
          disabled={currentIndex === 0}
          className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm hover:bg-stone-50 dark:hover:bg-zinc-800 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={t("onboarding.products.ariaPrevious")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 overflow-hidden" style={{ paddingBottom: 20 }}>
          <div
            ref={trackRef}
            className="flex gap-4 overflow-x-scroll"
            style={
              {
                paddingBottom: 20,
                paddingTop: 20,
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              } as React.CSSProperties
            }
          >
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
            <div style={{ flexShrink: 0, width: 1 }} aria-hidden />
          </div>
        </div>

        <button
          type="button"
          onClick={goToNext}
          disabled={currentIndex === products.length - 1}
          className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm hover:bg-stone-50 dark:hover:bg-zinc-800 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={t("onboarding.products.ariaNext")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Dot indicators */}
      {products.length > 1 && (
        <div className="mt-5 flex gap-1.5">
          {products.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={[
                "h-1.5 rounded-full transition-all duration-200",
                idx === currentIndex
                  ? "w-5 bg-foreground"
                  : "w-1.5 bg-stone-300 dark:bg-zinc-600 hover:bg-stone-400 dark:hover:bg-zinc-500",
              ].join(" ")}
              aria-label={t("onboarding.products.ariaGoToProduct", { name: String(idx + 1) })}
            />
          ))}
        </div>
      )}

      {/* Selection summary */}
      {selectedCount > 0 && (
        <div className="ob-fade-up mt-6 mx-4 rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-3 text-sm text-center shadow-sm">
          <span className="font-medium text-foreground">{t("onboarding.products.selected")} </span>
          <span className="text-muted-foreground">
            {Object.keys(selectedProducts)
              .map((id) => products.find((p) => p.id === id)?.name)
              .filter(Boolean)
              .join(", ")}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="ob-fade-up mt-4 mx-4 rounded-lg border border-destructive/20 bg-destructive/6 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex w-full max-w-sm justify-between px-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/onboarding/workspace")}
          disabled={isSubmitting}
          className="h-11 px-6 border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors"
        >
          {t("common.backArrow")}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={selectedCount === 0 || isSubmitting}
          className="h-11 px-8 font-medium text-sm bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          {isSubmitting ? t("common.saving") : t("common.continueArrow")}
        </Button>
      </div>
    </div>
  );
}
