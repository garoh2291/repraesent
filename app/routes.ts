import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("book/:configId", "routes/book.$configId.tsx"),

  layout("routes/_protected.tsx", [
    route("no-workspace", "routes/no-workspace.tsx"),
    route("auth/workspace-picker", "routes/auth.workspace-picker.tsx"),
    route("pending", "routes/pending.tsx"),
    route("closed", "routes/closed.tsx"),
    layout("routes/_onboarding-layout.tsx", [
      route("onboarding/profile", "routes/onboarding.profile.tsx"),
      route("onboarding/workspace", "routes/onboarding.workspace.tsx"),
      route("onboarding/products", "routes/onboarding.products.tsx"),
      route("onboarding/offers", "routes/onboarding.offers.tsx"),
      route("onboarding/billing", "routes/onboarding.billing.tsx"),
    ]),
    layout("routes/_brand-layout.tsx", [
      route("brand", "routes/brand.tsx"),
      route("brand/workspaces", "routes/brand.workspaces.tsx"),
      route("brand/analytics", "routes/brand.analytics.tsx"),
    ]),
    layout("routes/_dashboard-layout.tsx", [
      index("routes/home.tsx"),
      route("products", "routes/products.tsx"),
      route("lead-form", "routes/lead-form.tsx"),
      route("email/confirmation", "routes/lead-form.fallback.tsx"),
      route("lead-form/:leadId", "routes/lead-form.$leadId.tsx"),
      route("appointments", "routes/appointments.tsx"),
      route("analytics", "routes/analytics.tsx"),
      route("email", "routes/email.tsx"),
      route("tasks", "routes/tasks.tsx"),
      route("settings", "routes/settings.tsx"),
      route("instructions", "routes/instructions.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
