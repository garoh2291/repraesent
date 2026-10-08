"use client";

import type { PluginI18nState } from "~/lib/wordpress/plugin-i18n";

const OFF: PluginI18nState & { loading: boolean } = {
  enabled: false,
  source: "",
  languages: [],
  translatePluginUuid: null,
  loading: false,
};

/**
 * Languages for the soft-dependent language bars on other plugin settings
 * pages (re:cookie, re:index, re:appointment, re:maintenance).
 *
 * Those bars edited re:translate 1.x's per-language overlay strings. Since
 * 2.0 the plugin translates that copy on the site itself and every sentence
 * is changed on the Translation page, so the bars stay off and each page
 * edits its own copy, as on a site without re:translate.
 */
export function usePluginTranslateLanguages(): PluginI18nState & {
  loading: boolean;
} {
  return OFF;
}
