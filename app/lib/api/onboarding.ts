import { apiClient } from "./axios-instance";

export interface VisibleStripePrice {
  id: string;
  unit_amount: string | null;
  currency: string | null;
  recurring_interval: string | null;
  type?: string | null;
}

export interface VisibleStripeProduct {
  id: string;
  name: string;
  description: string | null;
  is_featured: boolean;
  display_order: number;
  images: string[];
  prices: VisibleStripePrice[];
}

export const updateOnboardingProfile = async (data: {
  first_name: string;
  last_name: string;
  phone?: string;
}) => {
  const response = await apiClient.patch("/users/me/onboarding/profile", data);
  return response.data;
};

export const createOnboardingWorkspace = async (data: {
  name: string;
  url: string;
  members?: { email: string }[];
}) => {
  const response = await apiClient.post("/workspaces/onboarding", data);
  return response.data;
};

export const getVisibleStripeProducts = async (): Promise<
  VisibleStripeProduct[]
> => {
  const response = await apiClient.get<VisibleStripeProduct[]>(
    "/stripe/products/visible"
  );
  return response.data;
};

export interface CreateStripeCustomerPayload {
  name: string;
  email: string;
  company?: string;
  address?: string;
  city?: string;
  country?: string;
  postal_code?: string;
  vat_number?: string;
}

export const createStripeCustomerForWorkspace = async (
  workspaceId: string,
  data: CreateStripeCustomerPayload
) => {
  const response = await apiClient.post(
    `/workspaces/${workspaceId}/create-stripe-customer`,
    data
  );
  return response.data;
};

export const addProductsToWorkspace = async (
  workspaceId: string,
  products: { stripe_product_id: string; stripe_price_id: string }[]
) => {
  for (const p of products) {
    await apiClient.post(`/workspaces/${workspaceId}/products`, p);
  }
};

export const updateOnboardingWorkspace = async (
  workspaceId: string,
  data: { name: string; url: string; members?: { email: string }[] }
) => {
  await apiClient.patch(`/workspaces/onboarding/${workspaceId}`, data);
};

export interface BillingInfo {
  id: string;
  name: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  postal_code: string | null;
  vat_number: string | null;
}

export const getBillingForWorkspace = async (
  workspaceId: string
): Promise<BillingInfo> => {
  const response = await apiClient.get<BillingInfo>(
    `/workspaces/${workspaceId}/billing`
  );
  return response.data;
};

export const updateBillingForWorkspace = async (
  workspaceId: string,
  data: {
    name: string;
    email: string;
    address?: string;
    city?: string;
    country?: string;
    postal_code?: string;
  }
) => {
  await apiClient.patch(`/workspaces/${workspaceId}/billing`, data);
};
