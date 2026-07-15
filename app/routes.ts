import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  route("health", "routes/health.ts"),
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
      route(
        "onboarding/doorboost-choice",
        "routes/onboarding.doorboost-choice.tsx",
      ),
      route(
        "onboarding/doorboost-restore",
        "routes/onboarding.doorboost-restore.tsx",
      ),
      route("onboarding/sync-pending", "routes/onboarding.sync-pending.tsx"),
    ]),
    layout("routes/_brand-layout.tsx", [
      route("brand", "routes/brand.tsx"),
      route("brand/workspaces", "routes/brand.workspaces.tsx"),
      route("brand/analytics", "routes/brand.analytics.tsx"),
      route("brand/orders", "routes/brand.orders.tsx"),
    ]),
    layout("routes/_dashboard-layout.tsx", [
      index("routes/home.tsx"),
      route("products", "routes/products.tsx"),
      route("lead-form", "routes/lead-form.tsx"),
      route("email/confirmation", "routes/lead-form.fallback.tsx"),
      route("lead-form/:leadId", "routes/lead-form.$leadId.tsx"),
      route("contacts", "routes/contacts.tsx"),
      route("contacts/:contactId", "routes/contacts.$contactId.tsx"),
      route("mail", "routes/mail.tsx"),
      route("pipeline", "routes/pipeline.tsx"),
      route("pipeline/:dealId", "routes/pipeline.$dealId.tsx"),
      route("appointments", "routes/appointments.tsx"),
      route("analytics", "routes/analytics.tsx"),
      route("social-ads", "routes/social-ads.tsx"),
      route("sync", "routes/sync.tsx"),
      route("email", "routes/email.tsx"),
      route("tasks", "routes/tasks.tsx"),
      route("website", "routes/wordpress.tsx"),
      route(
        "website/settings/:settingsKind",
        "routes/wordpress.settings.$settingsKind.tsx",
      ),
      route("settings", "routes/settings._layout.tsx", [
        index("routes/settings._index.tsx"),
        route("profile", "routes/settings.profile.tsx"),
        route("team", "routes/settings.team.tsx"),
        route("bcc", "routes/settings.bcc.tsx"),
      ]),
      route("instructions", "routes/instructions.tsx"),
      route("db-brand", "routes/db-brand._index.tsx"),
      route("brand-retailers", "routes/brand-retailers.tsx"),
      route("brand-campaigns", "routes/brand-campaigns.tsx"),
      route("brand-leads", "routes/brand-leads.tsx"),
      route(
        "db-brand/retailers/:retailerId/social-ads",
        "routes/db-brand.retailers.$retailerId.social-ads.tsx",
      ),
      route(
        "db-brand/retailers/:retailerId/social-ads/:campaignId",
        "routes/db-brand.retailers.$retailerId.social-ads.$campaignId.tsx",
      ),
      route(
        "db-brand/retailers/:retailerId/leads",
        "routes/db-brand.retailers.$retailerId.leads.tsx",
      ),
      route(
        "db-brand/retailers/:retailerId/leads/:leadId",
        "routes/db-brand.retailers.$retailerId.leads.$leadId.tsx",
      ),
    ]),
  ]),
] satisfies RouteConfig;
