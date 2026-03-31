import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  getBrandOrderStripeProducts,
  getBrandOrderWorkspaces,
  getBrandOrderAvailableServices,
  createBrandOrder,
  listMyBrandOrders,
  type BrandOrderStripeProduct,
  type BrandOrderService,
  type BrandOrderWorkspace,
  type CreateBrandOrderPayload,
} from "~/lib/api/brand";
import {
  Building2,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShoppingBag,
  Play,
  Loader2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { formatCurrencyFromCents, formatDateMedium } from "~/lib/utils/format";

type OrderType = "workspace" | "service";
type WizardStep = 1 | 2 | 3;
type Billing = "monthly" | "yearly";

const STATUS_CONFIG: Record<
  string,
  { icon: typeof Clock; color: string; bg: string }
> = {
  new: {
    icon: Sparkles,
    color: "text-blue-600",
    bg: "bg-blue-50 ring-1 ring-blue-200/60",
  },
  pending: {
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50 ring-1 ring-amber-200/60",
  },
  completed: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50 ring-1 ring-emerald-200/60",
  },
  declined: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 ring-1 ring-red-200/60",
  },
};

function formatPrice(amount: number, currency: string): string {
  return formatCurrencyFromCents(amount, currency);
}

function localizeServiceName(
  s: { name: string; name_en: string | null; name_de: string | null },
  lang: string
): string {
  if (lang === "de" && s.name_de) return s.name_de;
  if (lang === "en" && s.name_en) return s.name_en;
  return s.name_en || s.name;
}

export default function BrandOrdersPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1);
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [billing, setBilling] = useState<Billing>("monthly");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [view, setView] = useState<"wizard" | "history">("wizard");

  // Data queries
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["brand-order-products"],
    queryFn: getBrandOrderStripeProducts,
    enabled: step === 2 && orderType === "workspace",
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ["brand-order-workspaces"],
    queryFn: getBrandOrderWorkspaces,
    enabled: step === 2 && orderType === "service",
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["brand-order-services", selectedWorkspaceId],
    queryFn: () => getBrandOrderAvailableServices(selectedWorkspaceId!),
    enabled: !!selectedWorkspaceId && orderType === "service",
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["brand-orders-history"],
    queryFn: () => listMyBrandOrders({ limit: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: createBrandOrder,
    onSuccess: () => {
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["brand-orders-history"] });
    },
  });

  // Derived
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const currentPrice = selectedProduct?.prices.find(
    (p) => p.interval === (billing === "monthly" ? "month" : "year")
  );
  const availableServices = services.filter((s) => !s.already_active);
  const selectedWorkspace = workspaces.find(
    (w) => w.id === selectedWorkspaceId
  );

  const canContinueStep1 = !!orderType;
  const canContinueStep2 =
    orderType === "workspace"
      ? !!selectedProductId && !!currentPrice
      : !!selectedWorkspaceId && selectedServiceIds.length > 0;

  function handleSubmit() {
    const payload: CreateBrandOrderPayload = {
      order_type: orderType!,
      ...(orderType === "service" && { workspace_id: selectedWorkspaceId! }),
      metadata: {
        ...(orderType === "workspace" && {
          product_id: selectedProductId!,
          price_id: currentPrice!.id,
          billing,
        }),
        ...(orderType === "service" && {
          service_ids: selectedServiceIds,
        }),
        ...(notes.trim() && { notes: notes.trim() }),
      },
    };
    createMutation.mutate(payload);
  }

  function resetWizard() {
    setStep(1);
    setOrderType(null);
    setBilling("monthly");
    setSelectedProductId(null);
    setSelectedPriceId(null);
    setSelectedWorkspaceId(null);
    setSelectedServiceIds([]);
    setNotes("");
    setShowSuccess(false);
    createMutation.reset();
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 py-10! space-y-6 sm:space-y-8 app-fade-in">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
          {t("brand.navOrders", "Orders")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("brand.ordersSubtitle", "Request new partner houses or services")}
        </p>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/60 w-fit mb-6">
        <button
          onClick={() => setView("wizard")}
          className={cn(
            "px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200",
            view === "wizard"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("brand.orderNewRequest", "New Request")}
        </button>
        <button
          onClick={() => setView("history")}
          className={cn(
            "px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200",
            view === "history"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("brand.orderHistoryTitle", "My Requests")}
          {ordersData && ordersData.total > 0 && (
            <span className="ml-1.5 text-[11px] bg-muted-foreground/10 text-muted-foreground px-1.5 py-0.5 rounded-full">
              {ordersData.total}
            </span>
          )}
        </button>
      </div>

      {view === "wizard" && !showSuccess && (
        <>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300",
                    s < step
                      ? "bg-amber-400 text-amber-950"
                      : s === step
                        ? "bg-foreground text-background ring-4 ring-foreground/10"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {s < step ? <Check className="h-3.5 w-3.5" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={cn(
                      "h-px w-8 sm:w-12 transition-colors duration-300",
                      s < step ? "bg-amber-400" : "bg-border"
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* ── Step 1: Choose Order Type ─────────────────── */}
          {step === 1 && (
            <div className="animate-[app-fade-up_0.4s_ease]">
              <h2 className="text-lg font-semibold mb-1">
                {t("brand.orderStep1Title", "What do you need?")}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t(
                  "brand.orderStep1Desc",
                  "Choose the type of request you'd like to submit."
                )}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <OrderTypeCard
                  icon={Building2}
                  title={t("brand.orderNewWorkspace", "New Partner House")}
                  description={t(
                    "brand.orderNewWorkspaceDesc",
                    "Request a new workspace with a subscription plan"
                  )}
                  selected={orderType === "workspace"}
                  onClick={() => setOrderType("workspace")}
                />
                <OrderTypeCard
                  icon={Plus}
                  title={t("brand.orderAddService", "Add Service")}
                  description={t(
                    "brand.orderAddServiceDesc",
                    "Add a service to an existing partner house"
                  )}
                  selected={orderType === "service"}
                  onClick={() => setOrderType("service")}
                />
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  disabled={!canContinueStep1}
                  onClick={() => setStep(2)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all duration-200",
                    canContinueStep1
                      ? "bg-foreground text-background hover:opacity-90 shadow-sm"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {t("common.continueArrow", "Continue")}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2a: Product Selection ────────────────── */}
          {step === 2 && orderType === "workspace" && (
            <div className="animate-[app-fade-up_0.4s_ease]">
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-lg font-semibold">
                    {t("brand.orderStep2ProductTitle", "Choose a Plan")}
                  </h2>
                </div>
              </div>

              {/* Billing toggle */}
              <div className="flex gap-1 p-1 rounded-xl bg-muted/60 w-fit mb-6">
                <button
                  onClick={() => setBilling("monthly")}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200",
                    billing === "monthly"
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t("brand.orderBillingMonthly", "Monthly")}
                </button>
                <button
                  onClick={() => setBilling("yearly")}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200",
                    billing === "yearly"
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t("brand.orderBillingYearly", "Yearly")}
                </button>
              </div>

              {productsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="h-56 rounded-2xl bg-muted/40 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {products.map((product) => {
                    const price = product.prices.find(
                      (p) =>
                        p.interval ===
                        (billing === "monthly" ? "month" : "year")
                    );
                    const isSelected = selectedProductId === product.id;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => {
                          setSelectedProductId(product.id);
                          if (price) setSelectedPriceId(price.id);
                        }}
                        className={cn(
                          "relative text-left rounded-2xl border-2 p-5 sm:p-6 transition-all duration-200 group",
                          isSelected
                            ? "border-amber-400 bg-amber-400/[0.04] shadow-[0_0_0_3px_rgba(251,191,36,0.12)]"
                            : "border-border hover:border-border/80 hover:shadow-sm bg-card"
                        )}
                      >
                        {/* Radio indicator */}
                        <div
                          className={cn(
                            "absolute top-4 right-4 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                            isSelected
                              ? "border-amber-400 bg-amber-400"
                              : "border-muted-foreground/30"
                          )}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>

                        <h3 className="text-base font-semibold text-foreground mb-1 pr-8">
                          {product.name}
                        </h3>
                        {product.description && (
                          <p className="text-[13px] text-muted-foreground mb-4 line-clamp-2">
                            {product.description}
                          </p>
                        )}

                        {/* Features */}
                        {product.features.length > 0 && (
                          <ul className="space-y-1.5 mb-5">
                            {product.features.map((f, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-[13px] text-muted-foreground"
                              >
                                <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Price */}
                        {price && (
                          <div className="mt-auto pt-3 border-t border-border/50">
                            <span className="text-xl font-bold text-foreground">
                              {formatPrice(price.amount, price.currency)}
                            </span>
                            <span className="text-sm text-muted-foreground ml-1">
                              {billing === "monthly"
                                ? t("brand.orderPerMonth", "/ month")
                                : t("brand.orderPerYear", "/ year")}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  disabled={!canContinueStep2}
                  onClick={() => setStep(3)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all duration-200",
                    canContinueStep2
                      ? "bg-foreground text-background hover:opacity-90 shadow-sm"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {t("common.continueArrow", "Continue")}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2b: Service Selection ────────────────── */}
          {step === 2 && orderType === "service" && (
            <div className="animate-[app-fade-up_0.4s_ease]">
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-lg font-semibold">
                    {t(
                      "brand.orderStep2ServiceTitle",
                      "Select Partner House & Services"
                    )}
                  </h2>
                </div>
              </div>

              {/* Workspace picker */}
              <label className="block text-[13px] font-medium text-foreground mb-2">
                {t("brand.orderSelectWorkspace", "Select partner house")}
              </label>
              <select
                value={selectedWorkspaceId ?? ""}
                onChange={(e) => {
                  setSelectedWorkspaceId(e.target.value || null);
                  setSelectedServiceIds([]);
                }}
                className="w-full sm:w-80 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 mb-6"
              >
                <option value="">
                  {t(
                    "brand.orderSelectWorkspacePlaceholder",
                    "Choose a partner house..."
                  )}
                </option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>

              {/* Services */}
              {selectedWorkspaceId && (
                <div className="mt-2">
                  {servicesLoading ? (
                    <div className="space-y-3">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-14 rounded-xl bg-muted/40 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : availableServices.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {t(
                        "brand.orderNoServices",
                        "All services are already active"
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {services.map((service) => {
                        const isActive = service.already_active;
                        const isChecked = selectedServiceIds.includes(
                          service.id
                        );
                        return (
                          <button
                            key={service.id}
                            type="button"
                            disabled={isActive}
                            onClick={() => {
                              setSelectedServiceIds((prev) =>
                                isChecked
                                  ? prev.filter((id) => id !== service.id)
                                  : [...prev, service.id]
                              );
                            }}
                            className={cn(
                              "flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-left transition-all duration-150",
                              isActive
                                ? "border-border/50 bg-muted/30 opacity-50 cursor-not-allowed"
                                : isChecked
                                  ? "border-amber-400 bg-amber-400/[0.04] shadow-[0_0_0_2px_rgba(251,191,36,0.1)]"
                                  : "border-border hover:border-border/80 bg-card"
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded border-2 shrink-0 transition-colors",
                                isChecked
                                  ? "border-amber-400 bg-amber-400"
                                  : "border-muted-foreground/30"
                              )}
                            >
                              {isChecked && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                {localizeServiceName(service, i18n.language)}
                              </p>
                              {service.type && (
                                <p className="text-xs text-muted-foreground">
                                  {service.type}
                                </p>
                              )}
                            </div>
                            {isActive && (
                              <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-200/60">
                                Active
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  disabled={!canContinueStep2}
                  onClick={() => setStep(3)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all duration-200",
                    canContinueStep2
                      ? "bg-foreground text-background hover:opacity-90 shadow-sm"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {t("common.continueArrow", "Continue")}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Review & Submit ───────────────────── */}
          {step === 3 && (
            <div className="animate-[app-fade-up_0.4s_ease]">
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setStep(2)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-lg font-semibold">
                    {t("brand.orderStep3Title", "Review & Submit")}
                  </h2>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 mb-6">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  {orderType === "workspace" ? (
                    <>
                      <Building2 className="h-4 w-4" />
                      {t("brand.orderTypeWorkspace", "New Partner House")}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      {t("brand.orderTypeService", "Add Service")}
                    </>
                  )}
                </div>

                {orderType === "workspace" &&
                  selectedProduct &&
                  currentPrice && (
                    <div className="space-y-1.5">
                      <p className="text-base font-semibold text-foreground">
                        {selectedProduct.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {billing === "monthly"
                          ? t("brand.orderBillingMonthly", "Monthly")
                          : t("brand.orderBillingYearly", "Yearly")}{" "}
                        &middot;{" "}
                        {formatPrice(
                          currentPrice.amount,
                          currentPrice.currency
                        )}
                        {billing === "monthly"
                          ? t("brand.orderPerMonth", " / month")
                          : t("brand.orderPerYear", " / year")}
                      </p>
                    </div>
                  )}

                {orderType === "service" && selectedWorkspace && (
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="text-muted-foreground">
                        {t("brand.orderSelectWorkspace", "Partner House")}:
                      </span>{" "}
                      <span className="font-medium text-foreground">
                        {selectedWorkspace.name}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedServiceIds.map((sid) => {
                        const svc = services.find((s) => s.id === sid);
                        return svc ? (
                          <span
                            key={sid}
                            className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg ring-1 ring-amber-200/60"
                          >
                            {localizeServiceName(svc, i18n.language)}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-[13px] font-medium text-foreground mb-2">
                  {t("brand.orderNotes", "Notes for admin")}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t(
                    "brand.orderNotesPlaceholder",
                    "Optional notes..."
                  )}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-6 py-2.5 text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
                >
                  {createMutation.isPending ? (
                    <>
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-background/30 border-t-background animate-spin" />
                      {t("common.loading", "Loading...")}
                    </>
                  ) : (
                    <>
                      {t("brand.orderSubmit", "Submit Request")}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>

              {createMutation.isError && (
                <div className="mt-4 rounded-xl bg-red-50 border border-red-200/60 px-4 py-3 text-sm text-red-700">
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : t("common.somethingWentWrong", "Something went wrong")}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Success State ─────────────────────────────────── */}
      {view === "wizard" && showSuccess && (
        <div className="animate-[app-fade-up_0.4s_ease] flex flex-col items-center text-center py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100 mb-5">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {t("brand.orderSubmitted", "Request submitted!")}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            {t("brand.orderSubmittedDesc", "We'll get back to you shortly.")}
          </p>
          <div className="flex gap-3">
            <button
              onClick={resetWizard}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
            >
              {t("brand.orderNewRequest", "New Request")}
            </button>
            <button
              onClick={() => {
                setView("history");
                resetWizard();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-4 py-2 text-[13px] font-semibold hover:opacity-90 transition-opacity"
            >
              {t("brand.orderHistoryTitle", "My Requests")}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Order History ─────────────────────────────────── */}
      {view === "history" && (
        <div className="animate-[app-fade-up_0.4s_ease]">
          {ordersLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-muted/40 animate-pulse"
                />
              ))}
            </div>
          ) : !ordersData?.data?.length ? (
            <div className="flex flex-col items-center text-center py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 mb-4">
                <ShoppingBag className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t("brand.orderNoOrders", "No orders yet")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {ordersData.data.map((order) => {
                const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
                const StatusIcon = status.icon;
                const meta = order.metadata as Record<string, unknown>;
                return (
                  <div
                    key={order.id}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:bg-muted/30"
                  >
                    {/* Icon */}
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 shrink-0">
                      {order.order_type === "workspace" ? (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {order.order_type === "workspace"
                          ? t("brand.orderTypeWorkspace", "New Partner House")
                          : t("brand.orderTypeService", "Add Service")}
                        {order.workspace_name && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            &middot; {order.workspace_name}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDateMedium(order.created_at)}
                      </p>
                    </div>

                    {/* Status */}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg shrink-0",
                        status.bg,
                        status.color
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {t(
                        `brand.orderStatus${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`,
                        order.status
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {import.meta.env.DEV && <DevEmailProcessor />}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function OrderTypeCard({
  icon: Icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start text-left rounded-2xl border-2 p-5 sm:p-6 transition-all duration-200 group",
        selected
          ? "border-amber-400 bg-amber-400/[0.04] shadow-[0_0_0_3px_rgba(251,191,36,0.12)]"
          : "border-border hover:border-border/80 hover:shadow-sm bg-card"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl mb-4 transition-colors",
          selected
            ? "bg-amber-400/15 text-amber-600"
            : "bg-muted text-muted-foreground group-hover:bg-muted/80"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-[13px] text-muted-foreground leading-relaxed">
        {description}
      </p>

      {/* Selection indicator */}
      <div
        className={cn(
          "absolute top-4 right-4 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
          selected
            ? "border-amber-400 bg-amber-400"
            : "border-muted-foreground/30"
        )}
      >
        {selected && <Check className="h-3 w-3 text-white" />}
      </div>
    </button>
  );
}

function DevEmailProcessor() {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">(
    "idle"
  );
  const [result, setResult] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleTrigger = async () => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8001/api";
    const cronKey = import.meta.env.VITE_CRON_API_KEY || "";
    setState("loading");
    setResult(null);
    try {
      const res = await axios.post(
        `${apiUrl}/internal/process-email-queue`,
        {},
        { headers: { "x-cron-api-key": cronKey } }
      );
      setResult(JSON.stringify(res.data));
      setState("ok");
    } catch (err: unknown) {
      setResult(err instanceof Error ? err.message : "Request failed");
      setState("error");
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 z-50 h-10 w-10 flex items-center justify-center rounded-full bg-amber-100 border border-amber-300 text-amber-700 shadow-lg hover:bg-amber-200 transition-colors"
        title="Dev: Email Queue Processor"
      >
        <Play className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-xl border border-dashed border-amber-300 bg-amber-50/95 backdrop-blur-sm p-3.5 space-y-2.5 shadow-xl">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
          <Play className="h-3 w-3" /> Dev: Email Processor
        </p>
        <button
          onClick={() => setExpanded(false)}
          className="text-amber-400 hover:text-amber-600 text-xs leading-none"
        >
          &times;
        </button>
      </div>
      <p className="text-[10px] text-amber-600 leading-relaxed">
        Simulates the cron. Set{" "}
        <code className="font-mono bg-amber-100 px-1 rounded">
          VITE_CRON_API_KEY
        </code>{" "}
        in <code className="font-mono bg-amber-100 px-1 rounded">.env</code>.
      </p>
      <button
        onClick={handleTrigger}
        disabled={state === "loading"}
        className="h-7 w-full flex items-center justify-center gap-1.5 text-[11px] font-medium rounded-md border border-amber-400 text-amber-800 bg-white hover:bg-amber-100 disabled:opacity-50 transition-colors"
      >
        {state === "loading" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : state === "ok" ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        ) : state === "error" ? (
          <XCircle className="h-3 w-3 text-red-500" />
        ) : (
          <Play className="h-3 w-3" />
        )}
        Run now
      </button>
      {result && (
        <p
          className={`text-[10px] font-mono break-all leading-relaxed ${
            state === "ok" ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {result}
        </p>
      )}
    </div>
  );
}
