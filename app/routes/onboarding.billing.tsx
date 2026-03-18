import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  createStripeCustomerForWorkspace,
  updateBillingForWorkspace,
  getBillingForWorkspace,
  type CreateStripeCustomerPayload,
} from "~/lib/api/onboarding";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { useAuthContext } from "~/providers/auth-provider";

export function meta() {
  return [
    { title: "Billing information - Repraesent" },
    { name: "description", content: "Add billing details for invoicing" },
  ];
}

const COUNTRIES = [
  { code: "DE", label: "Germany" },
  { code: "GB", label: "United Kingdom" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "AT", label: "Austria" },
];

const inputCls =
  "h-11 border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 focus-visible:ring-1 focus-visible:ring-foreground/25 transition-shadow";

const labelCls =
  "block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground";

const selectCls =
  "flex h-11 w-full rounded-md border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/25 disabled:cursor-not-allowed disabled:opacity-50";

export default function OnboardingBilling() {
  const { user, currentWorkspace, workspaces } = useAuthContext();
  const workspaceId =
    getStoredWorkspaceId() ?? currentWorkspace?.id ?? workspaces[0]?.id;
  const hasStripeCustomer = !!(
    currentWorkspace?.stripe_customer_id ?? workspaces[0]?.stripe_customer_id
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  const { data: billingData } = useQuery({
    queryKey: ["billing-onboarding", workspaceId],
    queryFn: () => getBillingForWorkspace(workspaceId!),
    enabled: !!workspaceId && hasStripeCustomer,
  });

  useEffect(() => {
    if (prefilled) return;
    if (billingData) {
      console.log(billingData);
      if (billingData.name) setName(billingData.name);
      if (billingData.email) setEmail(billingData.email);
      if (billingData.address) setAddress(billingData.address);
      if (billingData.city) setCity(billingData.city);
      if (billingData.country) setCountry(billingData.country);
      if (billingData.postal_code) setPostalCode(billingData.postal_code);
      if (billingData.vat_number) setVatNumber(billingData.vat_number);
      setPrefilled(true);
      return;
    }

    if (currentWorkspace) {
      if (currentWorkspace.name) setCompany(currentWorkspace.name);
    }
    if (!hasStripeCustomer && user) {
      const fullName = [user.first_name, user.last_name]
        .filter(Boolean)
        .join(" ");
      if (fullName) setName(fullName);
      if (user.email) setEmail(user.email);
      setPrefilled(true);
    }
  }, [billingData, user, hasStripeCustomer, prefilled, currentWorkspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError("Name is required"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address"); return;
    }
    if (!hasStripeCustomer && !company.trim()) { setError("Company is required"); return; }
    if (!address.trim()) { setError("Address is required"); return; }
    if (!city.trim()) { setError("City is required"); return; }
    if (!country) { setError("Country is required"); return; }
    if (!postalCode.trim()) { setError("Postal code is required"); return; }
    if (!workspaceId) { setError("No workspace selected"); return; }

    setIsSubmitting(true);
    try {
      if (hasStripeCustomer) {
        await updateBillingForWorkspace(workspaceId, {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          address: address.trim(),
          city: city.trim(),
          country,
          postal_code: postalCode.trim(),
        });
      } else {
        const payload: CreateStripeCustomerPayload = {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          company: company.trim(),
          address: address.trim(),
          city: city.trim(),
          country,
          postal_code: postalCode.trim(),
        };
        if (vatNumber.trim()) payload.vat_number = vatNumber.trim();
        await createStripeCustomerForWorkspace(workspaceId, payload);
      }
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      navigate("/onboarding/products", { replace: true });
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

  return (
    <div className="ob-fade-up ob-fade-up-d1">
      {/* Section heading */}
      <div className="mb-8 space-y-1.5">
        <h1 className="ob-heading text-[26px] font-semibold tracking-tight text-foreground leading-snug">
          Billing information
        </h1>
        <p className="text-sm text-muted-foreground">
          Add your billing details so we can create your Stripe customer and send invoices.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="ob-fade-up rounded-lg border border-destructive/20 bg-destructive/6 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Contact section */}
        <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-5 ob-fade-up ob-fade-up-d2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Contact
          </p>

          <div className="space-y-1.5">
            <label htmlFor="name" className={labelCls}>
              Full name <span className="text-destructive normal-case tracking-normal">*</span>
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
              disabled={isSubmitting}
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className={labelCls}>
              Email <span className="text-destructive normal-case tracking-normal">*</span>
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="billing@company.com"
              required
              disabled={isSubmitting}
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="company" className={labelCls}>
              Company{" "}
              {!hasStripeCustomer ? (
                <span className="text-destructive normal-case tracking-normal">*</span>
              ) : (
                <span className="normal-case tracking-normal font-normal text-muted-foreground/60">
                  (optional)
                </span>
              )}
            </label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Inc."
              required
              disabled={isSubmitting}
              className={inputCls}
            />
          </div>
        </div>

        {/* Address section */}
        <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-5 ob-fade-up ob-fade-up-d3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Address
          </p>

          <div className="space-y-1.5">
            <label htmlFor="address" className={labelCls}>
              Street address <span className="text-destructive normal-case tracking-normal">*</span>
            </label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
              required
              disabled={isSubmitting}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="city" className={labelCls}>
                City <span className="text-destructive normal-case tracking-normal">*</span>
              </label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Berlin"
                required
                disabled={isSubmitting}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="postalCode" className={labelCls}>
                Postal / ZIP <span className="text-destructive normal-case tracking-normal">*</span>
              </label>
              <Input
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="10115"
                required
                disabled={isSubmitting}
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="country" className={labelCls}>
              Country <span className="text-destructive normal-case tracking-normal">*</span>
            </label>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
              disabled={isSubmitting}
              className={selectCls}
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tax section */}
        <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-5 ob-fade-up ob-fade-up-d4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Tax
          </p>

          <div className="space-y-1.5">
            <label htmlFor="vatNumber" className={labelCls}>
              VAT number{" "}
              <span className="normal-case tracking-normal font-normal text-muted-foreground/60">
                (optional)
              </span>
            </label>
            <Input
              id="vatNumber"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder="DE123456789"
              disabled={isSubmitting}
              className={inputCls}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-1 ob-fade-up ob-fade-up-d5">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/onboarding/workspace")}
            disabled={isSubmitting}
            className="h-11 px-6 border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors"
          >
            ← Back
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 px-8 font-medium text-sm transition-all duration-150 hover:opacity-90"
          >
            {isSubmitting ? "Saving…" : "Continue →"}
          </Button>
        </div>
      </form>
    </div>
  );
}
