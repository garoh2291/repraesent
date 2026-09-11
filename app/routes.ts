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
  route("demo", "routes/demo.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("book/:configId", "routes/book.$configId.tsx"),
  route("f/:formId", "routes/f.$formId.tsx"),
  // Hosted AI assistant page (widget_type "page"). Public, noindex.
  route("a/:assistantId", "routes/a.$assistantId.tsx"),
  // Product forms: where Stripe Checkout sends the buyer back.
  route("f/:formId/thanks", "routes/f.$formId.thanks.tsx"),
  // Campaign-email unsubscribe landing. Public: the token in the path is the
  // capability, and recipients are rarely logged-in users.
  route("unsubscribe/:token", "routes/unsubscribe.$token.tsx"),
  // Public order tracking. Above _protected on purpose: a customer following
  // this link from an email has no session and must never meet the login page.
  route("t/:token", "routes/t.$token.tsx"),

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
      route("brand/social-ads", "routes/brand.social-ads.tsx"),
      route("brand/activity", "routes/brand.activity.tsx"),
      route("brand/orders", "routes/brand.orders.tsx"),
    ]),
    layout("routes/_dashboard-layout.tsx", [
      index("routes/home.tsx"),
      // Workspace subscription + invoices. Moved off /products so the Stripe
      // catalogue can take that path; the sidebar already called it Billing.
      route("billing", "routes/billing.tsx"),
      // Live proxy over the workspace's connected Stripe catalogue.
      route("products", "routes/products.tsx"),
      route("forms", "routes/forms._index.tsx"),
      route("forms/:formId", "routes/forms.$formId.tsx"),
      // Website AI assistant (pilot flag `aiAssistant`).
      route("ai-assistants", "routes/ai-assistants._index.tsx"),
      route(
        "ai-assistants/:assistantId",
        "routes/ai-assistants.$assistantId.tsx",
      ),
      route("lead-form", "routes/lead-form.tsx"),
      route("email/confirmation", "routes/lead-form.fallback.tsx"),
      route("lead-form/:leadId", "routes/lead-form.$leadId.tsx"),
      route("contacts", "routes/contacts.tsx"),
      route("contacts/:contactId", "routes/contacts.$contactId.tsx"),
      route("mail", "routes/mail.tsx"),
      route("pipeline", "routes/pipeline.tsx"),
      route("pipeline/:dealId", "routes/pipeline.$dealId.tsx"),
      route("appointments", "routes/appointments.tsx"),
      route("calendar", "routes/calendar.tsx"),
      route("analytics", "routes/analytics.tsx"),
      route("social-ads", "routes/social-ads.tsx"),
      // Live proxy over the workspace's connected OpenAI Ads account.
      route("openai-ads", "routes/openai-ads.tsx"),
      route("openai-ads/new", "routes/openai-ads.new.tsx"),
      route("sync", "routes/sync.tsx"),
      route("email", "routes/email.tsx"),
      route("tasks", "routes/tasks.tsx"),
      route("website", "routes/wordpress.tsx"),
      route(
        "website/settings/:pluginUuid",
        "routes/wordpress.settings.$settingsKind.tsx",
      ),
      route("workflows", "routes/workflows._index.tsx"),
      route("workflows/:workflowId", "routes/workflows.$workflowId.tsx"),
      // Email marketing (pilot flag `emailCampaigns`). `/campaigns` is free —
      // the ad-analytics feature lives at /brand-campaigns and /social-ads.
      route("campaigns", "routes/campaigns._index.tsx"),
      route("campaigns/new", "routes/campaigns.new.tsx"),
      route("campaigns/:campaignId", "routes/campaigns.$campaignId.tsx"),
      route("segments", "routes/segments._index.tsx"),
      route("segments/:segmentId", "routes/segments.$segmentId.tsx"),
      route("email-templates", "routes/email-templates._index.tsx"),
      route(
        "email-templates/:templateId",
        "routes/email-templates.$templateId.tsx",
      ),
      route("media/:view?", "routes/media.tsx"),
      route("settings", "routes/settings._layout.tsx", [
        index("routes/settings._index.tsx"),
        route("profile", "routes/settings.profile.tsx"),
        route("team", "routes/settings.team.tsx"),
        route("email-accounts", "routes/settings.email-accounts.tsx"),
        route("integrations", "routes/settings.integrations.tsx"),
        route("openai-ads", "routes/settings.openai-ads.tsx"),
        route("ai", "routes/settings.ai.tsx"),
        route("notifications", "routes/settings.notifications.tsx"),
        route("calendars", "routes/settings.calendars.tsx"),
        route("bcc", "routes/settings.bcc.tsx"),
        route("pipelines", "routes/settings.pipelines.tsx"),
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
