import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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

  // Guards
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

  // Fetch existing billing data if stripe customer exists
  const { data: billingData } = useQuery({
    queryKey: ["billing-onboarding", workspaceId],
    queryFn: () => getBillingForWorkspace(workspaceId!),
    enabled: !!workspaceId && hasStripeCustomer,
  });

  // Pre-fill from existing billing data or user profile
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

    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }
    if (!hasStripeCustomer && !company.trim()) {
      setError("Company is required");
      return;
    }
    if (!address.trim()) {
      setError("Address is required");
      return;
    }
    if (!city.trim()) {
      setError("City is required");
      return;
    }
    if (!country) {
      setError("Country is required");
      return;
    }
    if (!postalCode.trim()) {
      setError("Postal code is required");
      return;
    }
    if (!workspaceId) {
      setError("No workspace selected");
      return;
    }

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
    <Card>
      <CardHeader>
        <CardTitle>Billing information</CardTitle>
        <CardDescription>
          Add your billing details so we can create your Stripe customer and
          send invoices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Full name <span className="text-destructive">*</span>
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email <span className="text-destructive">*</span>
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="billing@company.com"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="company" className="text-sm font-medium">
              Company{" "}
              {!hasStripeCustomer ? (
                <span className="text-destructive">*</span>
              ) : (
                <span className="text-muted-foreground font-normal">
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
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium">
              Address <span className="text-destructive">*</span>
            </label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="city" className="text-sm font-medium">
                City <span className="text-destructive">*</span>
              </label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Berlin"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="postalCode" className="text-sm font-medium">
                Postal / ZIP code <span className="text-destructive">*</span>
              </label>
              <Input
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="10115"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="country" className="text-sm font-medium">
              Country <span className="text-destructive">*</span>
            </label>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
              disabled={isSubmitting}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="vatNumber" className="text-sm font-medium">
              VAT number{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <Input
              id="vatNumber"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder="DE123456789"
              disabled={isSubmitting}
            />
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Continue"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
