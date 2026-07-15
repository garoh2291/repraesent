import { toast } from "sonner";
import type {
  ReIndexSettings,
  ReIndexVerification,
} from "~/lib/wordpress/plugin-settings-types";

/** Defaults mirror the plugin / shtemaran hub settings shape. */
export const DEFAULT_SETTINGS: ReIndexSettings = {
  verification: {
    google: "",
    bing: "",
    pinterest: "",
    yandex: "",
    facebook: "",
    linkedin: "",
  },
  stats: { page_count: 0, last_generated: "", last_ping: "" },
  seo: {
    enabled: false,
    formats: {
      front_page: "[site_name] | [tagline]",
      posts: "[page_title] | [site_name]",
      pages: "[page_title] | [site_name]",
      groups: "[page_title] | [site_name]",
      archives: "[page_title] | [site_name]",
    },
    front_page_description: "",
  },
  identity: { enabled: false, site_title: "", tagline: "" },
  og: {
    enabled: false,
    image_id: 0,
    image_url: "",
    og_description: "",
    compressed_url: "",
  },
};

/** Version badge — must track `RE_INDEX_VERSION` in re-index.php. */
export const PLUGIN_VERSION = "1.0.0";

export const FORMAT_KEYS = [
  "front_page",
  "posts",
  "pages",
  "groups",
  "archives",
] as const;

export type FormatKey = (typeof FORMAT_KEYS)[number];

export const FORMAT_META: Record<
  FormatKey,
  { label: string; description: string }
> = {
  front_page: {
    label: "Front Page",
    description: "Your homepage title.",
  },
  posts: {
    label: "Posts",
    description: "Single blog post titles.",
  },
  pages: {
    label: "Pages",
    description: "Static page titles.",
  },
  groups: {
    label: "Categories & Tags",
    description: "Archive pages for categories, tags, and custom taxonomies.",
  },
  archives: {
    label: "Date Archives",
    description: "Monthly, yearly, and author archive pages.",
  },
};

export const PREVIEW_PAGE_TITLE: Record<FormatKey, string> = {
  front_page: "My Site",
  posts: "My First Blog Post",
  pages: "About Us",
  groups: "WordPress News",
  archives: "March 2024",
};

export const VERIFY_ROWS: {
  key: keyof ReIndexVerification;
  label: string;
  placeholder: string;
  /** `name` attribute WordPress outputs in the meta tag. */
  metaName: string;
}[] = [
  {
    key: "google",
    label: "Google Search Console",
    placeholder:
      '<meta name="google-site-verification" content="…" />',
    metaName: "google-site-verification",
  },
  {
    key: "bing",
    label: "Bing Webmaster Tools",
    placeholder: '<meta name="msvalidate.01" content="…" />',
    metaName: "msvalidate.01",
  },
  {
    key: "pinterest",
    label: "Pinterest",
    placeholder: '<meta name="p:domain_verify" content="…" />',
    metaName: "p:domain_verify",
  },
  {
    key: "yandex",
    label: "Yandex Webmaster",
    placeholder: '<meta name="yandex-verification" content="…" />',
    metaName: "yandex-verification",
  },
  {
    key: "facebook",
    label: "Facebook",
    placeholder:
      '<meta name="facebook-domain-verification" content="…" />',
    metaName: "facebook-domain-verification",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: '<meta name="linkedin:domain_verify" content="…" />',
    metaName: "linkedin:domain_verify",
  },
];

/** Pull the content= value out of a pasted meta tag (mirrors the WP plugin). */
export function extractVerificationCode(input: string): string {
  const t = input.trim();
  if (!t) return "";
  const match = t.match(/content=["']([^"']+)["']/i);
  return (match?.[1] ?? t).trim();
}

/** Show the full meta tag in the form when we only have the stored code. */
export function formatVerificationMeta(
  metaName: string,
  stored: string,
): string {
  const raw = stored.trim();
  if (!raw) return "";
  if (/<meta\b/i.test(raw)) return raw;
  const code = extractVerificationCode(raw);
  if (!code) return "";
  return `<meta name="${metaName}" content="${code}" />`;
}

/** Expand every verification field to a full meta tag for the settings form. */
export function verificationForForm(
  verification: ReIndexVerification,
): ReIndexVerification {
  const out = { ...verification };
  for (const row of VERIFY_ROWS) {
    out[row.key] = formatVerificationMeta(row.metaName, verification[row.key]);
  }
  return out;
}

/** True when a verification field has a usable code (bare or full meta). */
export function hasVerificationCode(value: string): boolean {
  return Boolean(extractVerificationCode(value));
}

export const TITLE_TOKENS = [
  ["[site_name]", "site_name"],
  ["[page_title]", "page_title"],
  ["[tagline]", "tagline"],
  ["[sep]", "sep"],
] as const;

export type TabId = "indexing" | "seo";

export type PatchSettings = (
  updater: (prev: ReIndexSettings) => ReIndexSettings,
) => void;

export function applyTitlePreview(
  format: string,
  siteName: string,
  tagline: string,
  pageTitle: string,
): string {
  return format
    .replace(/\[site_name\]/g, siteName || "—")
    .replace(/\[page_title\]/g, pageTitle || "—")
    .replace(/\[tagline\]/g, tagline || "—")
    .replace(/\[sep\]/g, " | ");
}

export function sitemapUrlFromSiteUrl(siteUrl: string | undefined): string {
  if (!siteUrl) return "";
  try {
    const host = new URL(
      siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`,
    ).hostname;
    return `https://${host}/sitemap.xml`;
  } catch {
    return "";
  }
}

export function flash(text: string, type: "success" | "error" = "success") {
  if (type === "error") toast.error(text);
  else toast.success(text);
}
