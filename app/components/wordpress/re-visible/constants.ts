import { toast } from "sonner";
import type {
  PromptIntent,
  VisibilityEngine,
} from "~/lib/api/re-visible";

/**
 * WordPress-side settings this page edits, mirroring the option groups in
 * `wp-plugins/re-visible/includes/class-settings.php` and the shape
 * `WordpressReVisibleSettingsService` returns.
 */
export interface ReVisibleSettings {
  entity: {
    name: string;
    type: string;
    address: string;
    phone: string;
    logo_id: number;
    same_as: string[];
  };
  crawlers: {
    allow_search: boolean;
    allow_training: boolean;
    block_ccbot: boolean;
  };
  llms: {
    enabled: boolean;
    intro: string;
    post_types: string[];
  };
  schema: {
    org: boolean;
    website: boolean;
    article: boolean;
    faq: boolean;
    breadcrumb: boolean;
  };
  indexnow: {
    enabled: boolean;
    key: string;
  };
  telemetry: {
    enabled: boolean;
    sample_rate: number;
  };
  answer_block: {
    position: "top" | "bottom" | "manual";
  };
  site: {
    site_title: string;
    tagline: string;
    site_url: string;
  };
}

export const DEFAULT_SETTINGS: ReVisibleSettings = {
  entity: {
    name: "",
    type: "Organization",
    address: "",
    phone: "",
    logo_id: 0,
    same_as: [],
  },
  crawlers: { allow_search: true, allow_training: false, block_ccbot: true },
  llms: { enabled: true, intro: "", post_types: ["page", "post"] },
  schema: { org: true, website: true, article: true, faq: true, breadcrumb: true },
  indexnow: { enabled: true, key: "" },
  telemetry: { enabled: true, sample_rate: 100 },
  answer_block: { position: "top" },
  site: { site_title: "", tagline: "", site_url: "" },
};

/** Schema.org types the plugin offers, in the plugin's own order. */
export const ENTITY_TYPES = [
  "Organization",
  "LocalBusiness",
  "ProfessionalService",
  "Store",
  "Restaurant",
  "MedicalBusiness",
  "HomeAndConstructionBusiness",
  "AutomotiveBusiness",
] as const;

export const TAB_IDS = [
  "overview",
  "prompts",
  "competitors",
  "sources",
  "content",
  "site",
  "settings",
] as const;

export type TabId = (typeof TAB_IDS)[number];

export const TAB_PARAM = "tab";

export function tabFromParam(value: string | null): TabId {
  return TAB_IDS.includes(value as TabId) ? (value as TabId) : "overview";
}

/**
 * Display names for the engines.
 *
 * The value stored is the engine family (`chatgpt`), not the model, because the
 * model behind it is configurable server-side and a client should read "ChatGPT"
 * either way.
 */
export const ENGINE_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  gemini: "Gemini",
};

export function engineLabel(engine: string): string {
  return ENGINE_LABELS[engine] ?? engine;
}

/** Per-engine accent, used consistently across tiles, chart and tables. */
export const ENGINE_COLORS: Record<string, string> = {
  chatgpt: "var(--chart-1)",
  claude: "var(--chart-2)",
  perplexity: "var(--chart-3)",
  gemini: "var(--chart-4)",
};

export function engineColor(engine: string): string {
  return ENGINE_COLORS[engine] ?? "var(--chart-5)";
}

export const ENGINE_ORDER: VisibilityEngine[] = [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
];

/** What each intent is for, shown as the filter's own explanation. */
export const INTENT_LABELS: Record<PromptIntent, string> = {
  category: "Category",
  comparison: "Comparison",
  problem: "Problem",
  pricing: "Pricing",
  branded: "Branded",
  local: "Local",
};

export function intentLabel(intent: string): string {
  return INTENT_LABELS[intent as PromptIntent] ?? intent;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Micro-USD to a human amount. Money is stored as an integer to avoid drift. */
export function formatMicroUsd(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(2)}`;
}

export function flash(text: string, type: "success" | "error" = "success") {
  if (type === "error") toast.error(text);
  else toast.success(text);
}

/**
 * Why a run did nothing, in the user's terms.
 *
 * A spent budget is not a failure, so these are informational: the caller
 * shows them as a plain toast, never as an error.
 */
export function skipReason(
  skipped: string | null,
  t: (key: string, fallback: string) => string,
): string | null {
  switch (skipped) {
    case "no_prompts":
      return t(
        "wordpress.reVisible.skipNoPrompts",
        "Add at least one question first.",
      );
    case "weekly_cap":
      return t(
        "wordpress.reVisible.skipWeeklyCap",
        "This week's run allowance is used up. It resets on Monday.",
      );
    case "monthly_cap":
      return t(
        "wordpress.reVisible.skipMonthlyCap",
        "This month's budget is used up.",
      );
    case "disabled":
      return t(
        "wordpress.reVisible.skipDisabled",
        "Tracking is switched off for now.",
      );
    default:
      return null;
  }
}
