import type { TFunction } from "i18next";

interface SourceInput {
  source_table: string;
  form_name?: string | null;
  source_label?: string | null;
  source_platform?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Where an inquiry came from, in the owner's words ("Website form",
 * "Facebook ad", "Website chat") — never the table name.
 */
export function leadSourceLabel(lead: SourceInput, t: TFunction): string {
  const m = lead.metadata ?? {};
  const fb = String(m.fb_platform ?? "").toLowerCase();
  switch (lead.source_table) {
    case "workspace_forms":
      return lead.source_label
        ? t("sourceLabel.formNamed", "Form · {{name}}", { name: lead.source_label })
        : t("sourceLabel.form", "Website form");
    case "ai_assistants":
      return t("sourceLabel.chat", "Website chat");
    case "appointment_booking":
      return t("sourceLabel.booking", "Booking");
    case "onboarding_runs":
      return t("sourceLabel.signup", "New signup");
    case "campaigns": {
      const p = String(lead.source_platform ?? m.platform ?? "").toLowerCase();
      if (p === "google") return t("sourceLabel.googleAd", "Google ad");
      if (p === "instagram") return t("sourceLabel.instagramAd", "Instagram ad");
      return t("sourceLabel.facebookAd", "Facebook ad");
    }
    case "urls":
      if (lead.form_name === "facebook_leadgen") {
        return fb === "ig" || fb === "instagram"
          ? t("sourceLabel.instagramAd", "Instagram ad")
          : t("sourceLabel.facebookAd", "Facebook ad");
      }
      if (lead.form_name === "manual") return t("sourceLabel.manual", "Added by hand");
      return t("sourceLabel.website", "Website");
    case "workspaces":
      return t("sourceLabel.manual", "Added by hand");
    default:
      return t("sourceLabel.other", "Other");
  }
}

/** "5 min", "3 h", "2 d" — how long someone has been waiting. */
export function waitingFor(iso: string, locale: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.round(ms / 60_000));
  const fmt = (value: number, unit: Intl.RelativeTimeFormatUnit) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: "unit",
        unit,
        unitDisplay: "narrow",
      }).format(value);
    } catch {
      return `${value}${unit[0]}`;
    }
  };
  if (min < 60) return fmt(min, "minute");
  const h = Math.round(min / 60);
  if (h < 48) return fmt(h, "hour");
  return fmt(Math.round(h / 24), "day");
}
