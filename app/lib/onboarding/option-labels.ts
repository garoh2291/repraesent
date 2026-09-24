import type { TFunction } from "i18next";

/**
 * Human label for a form answer option (`sales.ads_running` + `ads_none` →
 * "No ads"), reusing the wizard's own i18n keys so settings and form agree.
 */
const PREFIX: Record<string, string> = {
  "identity.legal_form": "onb.legalForms.{v}",
  "identity.industry": "clientTypes.{v}_one",
  "presence.kind": "onb.presence.{v}.title",
  "offer.price_segment": "onb.priceSegment.{v}",
  "offer.customer_type": "onb.customerType.{v}",
  "goals.primary_goals": "onb.goals.options.{v}",
  "goals.lead_channels": "onb.goals.channelOptions.{v}",
  "goals.monthly_inquiries": "onb.goals.volumeOptions.{v}",
  "interests.website_plan": "onb.growth.plan.{v}.title",
  "interests.ai_visibility": "onb.growth.ai.{v}",
  "sales.go_live": "onb.sales.goLive.{v}",
  "sales.heard_from": "onb.sales.heard.{v}",
  "sales.ads_running": "onb.sales.ads.{v}",
  "sales.ads_budget": "onb.sales.budget.{v}",
  "sales.enquiry_handler": "onb.sales.handler.{v}",
  "sales.reply_time": "onb.sales.reply.{v}",
  "domain.registrar": "onb.domain.registrars.{v}",
  "domain.transfer": "onb.domain.transfer.{v}",
  "domain.login_access": "onb.domain.login.{v}",
  "domain.site_caretaker": "onb.domain.caretaker.{v}",
  "domain.hosting_contract": "onb.domain.contract.{v}",
  "notifications.keys": "onb.notif.kinds.{v}.title",
};

const SPECIAL: Record<string, Record<string, string>> = {
  "google_business.status": { has: "onb.yes", none: "onb.no", unknown: "onb.notSure" },
  "socials.facebook_status": { has: "onb.yes", none: "onb.no", unknown: "onb.notSure" },
  "email_setup.provider": { google_workspace: "onb.email.google", microsoft_365: "onb.email.microsoft", other: "onb.email.other", none: "onb.email.none" },
  "notifications.audience": { all_members: "onb.notif.everyone", selected: "onb.notif.pick" },
};

const humanize = (v: string) => (v.charAt(0).toUpperCase() + v.slice(1)).replace(/_/g, " ");

export function optionLabel(t: TFunction, path: string, value: string): string {
  const key = SPECIAL[path]?.[value] ?? PREFIX[path]?.replace("{v}", value);
  if (!key) return humanize(value);
  const label = t(key, { symbol: "€", defaultValue: "" }) as string;
  if (!label) return humanize(value);
  return path === "identity.industry" ? label.charAt(0).toUpperCase() + label.slice(1) : label;
}
