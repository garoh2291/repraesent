"use client";

import { useCallback, useMemo, useState } from "react";
import {
  getTranslateContentDetail,
  saveTranslateStrings,
} from "~/lib/api/wordpress-hub";
import { stringsToMap, type OverlayStringMap } from "~/lib/wordpress/plugin-i18n";

/**
 * Load / save a re:translate overlay pack for a plugin object
 * (cookie/0, maintenance/0, site/0, reappt/{id}).
 *
 * Depend on `load` / `save` in effects — not the whole return value —
 * so `loading`/`saving` flips do not retrigger overlay fetches.
 */
export function usePluginOverlayPack(translatePluginUuid: string | null) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (
      objectType: string,
      id: number | string,
      language: string,
    ): Promise<OverlayStringMap> => {
      if (!translatePluginUuid) return {};
      setLoading(true);
      try {
        const detail = await getTranslateContentDetail(
          translatePluginUuid,
          id,
          { language, object_type: objectType },
        );
        return stringsToMap(detail.strings ?? []);
      } finally {
        setLoading(false);
      }
    },
    [translatePluginUuid],
  );

  const save = useCallback(
    async (
      strings: { id: number; translated_text: string; status: string }[],
    ): Promise<void> => {
      if (!translatePluginUuid || strings.length === 0) return;
      setSaving(true);
      try {
        await saveTranslateStrings(translatePluginUuid, strings);
      } finally {
        setSaving(false);
      }
    },
    [translatePluginUuid],
  );

  return useMemo(
    () => ({ load, save, loading, saving }),
    [load, save, loading, saving],
  );
}
