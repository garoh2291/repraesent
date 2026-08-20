import { toast } from "sonner";
import type {
  ReCookieCategorySlug,
  ReCookieNamedScript,
  ReCookieScriptCategory,
  ReCookieSettings,
  ReCookieTranslationLang,
} from "~/lib/wordpress/plugin-settings-types";

const DEFAULT_TRANSLATION_EN: ReCookieTranslationLang = {
  banner: {
    title: "We use cookies",
    description:
      "We use cookies to improve your experience. You can accept all, reject all, or customize your preferences.",
    privacyPolicy: "Privacy Policy",
  },
  buttons: {
    acceptAll: "Accept all",
    rejectAll: "Reject all",
    customize: "Customize",
    savePreferences: "Save preferences",
    deny: "Deny",
    manageCookies: "Manage cookies",
  },
  modal: {
    title: "Cookie preferences",
    description:
      "Choose which cookies you want to allow. Essential cookies are always enabled.",
  },
  categories: {
    functional: {
      title: "Functional",
      description: "Essential for site functionality.",
    },
    analytics: {
      title: "Analytics",
      description: "Help us understand how you use the site.",
    },
    marketing: {
      title: "Marketing",
      description: "Used for advertising and retargeting.",
    },
    external_media: {
      title: "External Media",
      description:
        "Videos and embedded content from external sources (e.g. YouTube, Vimeo).",
    },
  },
  vendor: {
    description:
      "Part of {category} cookies. Enable the category above to allow this service.",
  },
  mediaBlocker: {
    message: "Media blocked. Please enable External Media cookies.",
  },
};

const DEFAULT_TRANSLATION_DE: ReCookieTranslationLang = {
  banner: {
    title: "Wir verwenden Cookies",
    description:
      "Wir verwenden Cookies, um Ihr Erlebnis zu verbessern. Sie können alle akzeptieren, alle ablehnen oder Ihre Einstellungen anpassen.",
    privacyPolicy: "Datenschutzerklärung",
  },
  buttons: {
    acceptAll: "Alle akzeptieren",
    rejectAll: "Alle ablehnen",
    customize: "Anpassen",
    savePreferences: "Einstellungen speichern",
    deny: "Ablehnen",
    manageCookies: "Cookies verwalten",
  },
  modal: {
    title: "Cookie-Einstellungen",
    description:
      "Wählen Sie aus, welche Cookies Sie zulassen möchten. Wesentliche Cookies sind immer aktiviert.",
  },
  categories: {
    functional: {
      title: "Funktional",
      description: "Wesentlich für die Funktionalität der Website.",
    },
    analytics: {
      title: "Analytik",
      description: "Helfen Sie uns zu verstehen, wie Sie die Website nutzen.",
    },
    marketing: {
      title: "Marketing",
      description: "Wird für Werbung und Retargeting verwendet.",
    },
    external_media: {
      title: "Externe Medien",
      description:
        "Videos und eingebettete Inhalte von externen Quellen (z.B. YouTube, Vimeo).",
    },
  },
  vendor: {
    description:
      "Teil der {category}-Cookies. Aktivieren Sie die Kategorie oben, um diesen Dienst zu erlauben.",
  },
  mediaBlocker: {
    message:
      "Medien blockiert. Bitte aktivieren Sie die Cookies für externe Medien.",
  },
};

/** Defaults — match ConfigRepository::defaults in the WordPress plugin. */
export const DEFAULTS: ReCookieSettings = {
  config_version: 1,
  banner_position: "bottom",
  primary_color: "#000000",
  background_color: "#ffffff",
  text_color: "#1f2937",
  accept_button_color: "#000000",
  reject_button_color: "#6b7280",
  secondary_button_color: "#e5e7eb",
  border_radius: 8,
  show_modal_overlay: true,
  title: "We use cookies",
  description:
    "We use cookies to improve your experience. You can accept all, reject all, or customize your preferences.",
  learn_more_url: "",
  privacy_policy_url: "",
  label_accept: "Accept all",
  label_reject: "Reject all",
  label_customize: "Customize",
  label_save: "Save preferences",
  manage_placement: "bottom-right",
  banner_delay_ms: 0,
  output_buffer_blocker: false,
  consent_logging: false,
  default_language: "de",
  categories: {
    functional: {
      enabled: true,
      title: "Functional",
      description: "Essential for site functionality.",
    },
    analytics: {
      enabled: true,
      title: "Analytics",
      description: "Help us understand how you use the site.",
    },
    marketing: {
      enabled: true,
      title: "Marketing",
      description: "Used for advertising and retargeting.",
    },
    external_media: {
      enabled: true,
      title: "External Media",
      description:
        "Embedded videos and media from external sources (e.g., YouTube).",
    },
  },
  integrations: {
    gtm: { enabled: false, container_id: "" },
    ga4: { enabled: false, measurement_id: "", load_via: "gtag" },
    meta: { enabled: false, pixel_id: "" },
    custom_scripts: {
      functional: { header: "", body: "", footer: "" },
      analytics: { header: "", body: "", footer: "" },
      marketing: { header: "", body: "", footer: "" },
    },
    named_scripts: { functional: [], analytics: [], marketing: [] },
  },
  translations: { en: DEFAULT_TRANSLATION_EN, de: DEFAULT_TRANSLATION_DE },
};

export type TabId = "design" | "functionality" | "content";

export const CATEGORY_SLUGS = [
  "functional",
  "analytics",
  "marketing",
  "external_media",
] as const;

export const CATEGORY_LABELS: Record<ReCookieCategorySlug, string> = {
  functional: "Functional",
  analytics: "Analytics",
  marketing: "Marketing",
  external_media: "External Media",
};

export const NAMED_SCRIPT_CATS = [
  "functional",
  "analytics",
  "marketing",
] as const;

export const NAMED_SCRIPT_LABELS: Record<ReCookieScriptCategory, string> = {
  functional: "Functional",
  analytics: "Performance (Analytics)",
  marketing: "Marketing",
};

export type PatchSettings = (
  updater: (prev: ReCookieSettings) => ReCookieSettings,
) => void;

/**
 * PHP serializes an empty `array()` in a way that can surface as either `[]` or
 * `{}` once unserialized, so never hand a raw option value straight to `.map`.
 */
export function asScriptList(value: unknown): ReCookieNamedScript[] {
  return Array.isArray(value) ? (value as ReCookieNamedScript[]) : [];
}

export function flash(text: string, type: "success" | "error" = "success") {
  if (type === "error") toast.error(text);
  else toast.success(text);
}
