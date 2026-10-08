"use client";

import { useCallback, useMemo } from "react";
import type { OverlayStringMap } from "~/lib/wordpress/plugin-i18n";

/**
 * Load / save a re:translate overlay pack for a plugin object
 * (cookie/0, maintenance/0, site/0, reappt/{id}).
 *
 * Overlay packs were re:translate 1.x's strings. Since 2.0 the plugin
 * translates this copy on the site itself and sentences are changed on the
 * Translation page, so there is nothing to load or save here, and
 * usePluginTranslateLanguages never turns the language bars on.
 */
export function usePluginOverlayPack(_translatePluginUuid: string | null) {
  const load = useCallback(
    async (
      _objectType: string,
      _id: number | string,
      _language: string,
    ): Promise<OverlayStringMap> => ({}),
    [],
  );

  const save = useCallback(
    async (
      _strings: { id: number; translated_text: string; status: string }[],
    ): Promise<void> => {},
    [],
  );

  return useMemo(
    () => ({ load, save, loading: false, saving: false }),
    [load, save],
  );
}
