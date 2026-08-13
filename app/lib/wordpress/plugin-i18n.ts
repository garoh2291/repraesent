/**
 * Field maps and pack helpers for plugin-settings language overlays.
 * Mirrors re:translate extractors (cookie / maintenance / reappt / site SEO).
 */

import type { TranslateString } from "~/lib/api/wordpress-hub";
import type { ReCookieTranslationLang } from "~/lib/wordpress/plugin-settings-types";

export type PluginI18nLanguage = {
  code: string;
  label: string;
  is_source: boolean;
};

export type PluginI18nState = {
  enabled: boolean;
  source: string;
  languages: PluginI18nLanguage[];
  translatePluginUuid: string | null;
};

export type OverlayStringMap = Record<
  string,
  { id: number; value: string; source_text: string }
>;

/** cookie field_key → nested path inside a language pack. */
export const COOKIE_FIELD_PATHS: Record<string, string[]> = {
  "cookie:banner:title": ["banner", "title"],
  "cookie:banner:description": ["banner", "description"],
  "cookie:banner:privacyPolicy": ["banner", "privacyPolicy"],
  "cookie:buttons:acceptAll": ["buttons", "acceptAll"],
  "cookie:buttons:rejectAll": ["buttons", "rejectAll"],
  "cookie:buttons:customize": ["buttons", "customize"],
  "cookie:buttons:savePreferences": ["buttons", "savePreferences"],
  "cookie:buttons:deny": ["buttons", "deny"],
  "cookie:buttons:manageCookies": ["buttons", "manageCookies"],
  "cookie:modal:title": ["modal", "title"],
  "cookie:modal:description": ["modal", "description"],
  "cookie:categories:functional:title": ["categories", "functional", "title"],
  "cookie:categories:functional:description": [
    "categories",
    "functional",
    "description",
  ],
  "cookie:categories:analytics:title": ["categories", "analytics", "title"],
  "cookie:categories:analytics:description": [
    "categories",
    "analytics",
    "description",
  ],
  "cookie:categories:marketing:title": ["categories", "marketing", "title"],
  "cookie:categories:marketing:description": [
    "categories",
    "marketing",
    "description",
  ],
  "cookie:categories:external_media:title": [
    "categories",
    "external_media",
    "title",
  ],
  "cookie:categories:external_media:description": [
    "categories",
    "external_media",
    "description",
  ],
  "cookie:vendor:description": ["vendor", "description"],
  "cookie:mediaBlocker:message": ["mediaBlocker", "message"],
};

export const MAINTENANCE_FIELDS = {
  "maintenance:message": "message",
  "maintenance:sub_message": "sub_message",
} as const;

export const REAPPT_LABEL_FIELD = "reappt:label";

/** site SEO field_key → short form key used by Site_SEO / re:index. */
export const SITE_SEO_FIELDS: Record<string, string> = {
  "seo:site:blogname": "blogname",
  "seo:site:blogdescription": "blogdescription",
  "seo:site:front_page_desc": "front_page_desc",
  "seo:site:og_description": "og_description",
  "seo:site:format:front_page": "format:front_page",
  "seo:site:format:posts": "format:posts",
  "seo:site:format:pages": "format:pages",
  "seo:site:format:groups": "format:groups",
  "seo:site:format:archives": "format:archives",
};

export function stringsToMap(strings: TranslateString[]): OverlayStringMap {
  const out: OverlayStringMap = {};
  for (const s of strings) {
    if (!s.field_key || !s.id) continue;
    out[s.field_key] = {
      id: s.id,
      value: s.translated_text ?? "",
      source_text: s.source_text ?? "",
    };
  }
  return out;
}

function getPath(obj: unknown, path: string[]): string {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return "";
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "string" ? cur : "";
}

function setPath(
  obj: Record<string, unknown>,
  path: string[],
  value: string,
): void {
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    const next = cur[key];
    if (next == null || typeof next !== "object" || Array.isArray(next)) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[path[path.length - 1]!] = value;
}

export function emptyCookieTree(): ReCookieTranslationLang {
  return {
    banner: { title: "", description: "", privacyPolicy: "" },
    buttons: {
      acceptAll: "",
      rejectAll: "",
      customize: "",
      savePreferences: "",
      deny: "",
      manageCookies: "",
    },
    modal: { title: "", description: "" },
    categories: {
      functional: { title: "", description: "" },
      analytics: { title: "", description: "" },
      marketing: { title: "", description: "" },
      external_media: { title: "", description: "" },
    },
    vendor: { description: "" },
    mediaBlocker: { message: "" },
  };
}

export function cookieTreeFromOverlay(
  map: OverlayStringMap,
  fallback?: ReCookieTranslationLang,
): ReCookieTranslationLang {
  const base = structuredClone(fallback ?? emptyCookieTree()) as unknown as Record<
    string,
    unknown
  >;
  for (const [field, path] of Object.entries(COOKIE_FIELD_PATHS)) {
    const row = map[field];
    const value = row?.value || row?.source_text || getPath(base, path);
    setPath(base, path, value);
  }
  return base as unknown as ReCookieTranslationLang;
}

export function cookieTreeToSavePayload(
  tree: ReCookieTranslationLang,
  map: OverlayStringMap,
): { id: number; translated_text: string; status: string }[] {
  const out: { id: number; translated_text: string; status: string }[] = [];
  for (const [field, path] of Object.entries(COOKIE_FIELD_PATHS)) {
    const row = map[field];
    if (!row) continue;
    const text = getPath(tree, path);
    out.push({
      id: row.id,
      translated_text: text,
      status: text.trim() ? "reviewed" : "untranslated",
    });
  }
  return out;
}

export function maintenanceFromOverlay(
  map: OverlayStringMap,
  fallback: { message: string; sub_message: string },
): { message: string; sub_message: string } {
  return {
    message:
      map["maintenance:message"]?.value ||
      map["maintenance:message"]?.source_text ||
      fallback.message,
    sub_message:
      map["maintenance:sub_message"]?.value ||
      map["maintenance:sub_message"]?.source_text ||
      fallback.sub_message,
  };
}

export function maintenanceToSavePayload(
  values: { message: string; sub_message: string },
  map: OverlayStringMap,
): { id: number; translated_text: string; status: string }[] {
  const out: { id: number; translated_text: string; status: string }[] = [];
  for (const [field, short] of Object.entries(MAINTENANCE_FIELDS)) {
    const row = map[field];
    if (!row) continue;
    const text = values[short as keyof typeof values] ?? "";
    out.push({
      id: row.id,
      translated_text: text,
      status: text.trim() ? "reviewed" : "untranslated",
    });
  }
  return out;
}

export function reapptLabelFromOverlay(
  map: OverlayStringMap,
  fallback: string,
): string {
  const row = map[REAPPT_LABEL_FIELD];
  return row?.value || row?.source_text || fallback;
}

export function reapptLabelToSavePayload(
  label: string,
  map: OverlayStringMap,
): { id: number; translated_text: string; status: string }[] {
  const row = map[REAPPT_LABEL_FIELD];
  if (!row) return [];
  return [
    {
      id: row.id,
      translated_text: label,
      status: label.trim() ? "reviewed" : "untranslated",
    },
  ];
}

export type SiteSeoOverlayValues = {
  blogname: string;
  blogdescription: string;
  front_page_desc: string;
  og_description: string;
  formats: {
    front_page: string;
    posts: string;
    pages: string;
    groups: string;
    archives: string;
  };
};

export function siteSeoFromOverlay(
  map: OverlayStringMap,
  fallback: SiteSeoOverlayValues,
): SiteSeoOverlayValues {
  const read = (field: string, fb: string) =>
    map[field]?.value || map[field]?.source_text || fb;

  return {
    blogname: read("seo:site:blogname", fallback.blogname),
    blogdescription: read("seo:site:blogdescription", fallback.blogdescription),
    front_page_desc: read("seo:site:front_page_desc", fallback.front_page_desc),
    og_description: read("seo:site:og_description", fallback.og_description),
    formats: {
      front_page: read(
        "seo:site:format:front_page",
        fallback.formats.front_page,
      ),
      posts: read("seo:site:format:posts", fallback.formats.posts),
      pages: read("seo:site:format:pages", fallback.formats.pages),
      groups: read("seo:site:format:groups", fallback.formats.groups),
      archives: read("seo:site:format:archives", fallback.formats.archives),
    },
  };
}

export function siteSeoToSavePayload(
  values: SiteSeoOverlayValues,
  map: OverlayStringMap,
): { id: number; translated_text: string; status: string }[] {
  const flat: Record<string, string> = {
    "seo:site:blogname": values.blogname,
    "seo:site:blogdescription": values.blogdescription,
    "seo:site:front_page_desc": values.front_page_desc,
    "seo:site:og_description": values.og_description,
    "seo:site:format:front_page": values.formats.front_page,
    "seo:site:format:posts": values.formats.posts,
    "seo:site:format:pages": values.formats.pages,
    "seo:site:format:groups": values.formats.groups,
    "seo:site:format:archives": values.formats.archives,
  };
  const out: { id: number; translated_text: string; status: string }[] = [];
  for (const [field, text] of Object.entries(flat)) {
    const row = map[field];
    if (!row) continue;
    out.push({
      id: row.id,
      translated_text: text,
      status: text.trim() ? "reviewed" : "untranslated",
    });
  }
  return out;
}
