"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWorkspacePluginSettings,
  putWorkspacePluginSettings,
  type WpPluginSettingsGetResponse,
} from "~/lib/api/wordpress-hub";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { mergeRecordWithDefaults } from "~/lib/utils/deep-merge";
import { useWorkspaceWpSite } from "./useWorkspaceWpSite";

/**
 * Cache key for one plugin's settings blob, keyed by the plugin's opaque
 * catalog UUID. Exported because the plugin-specific action hooks (sitemap
 * regenerate, reviews cache) write into the same entry.
 */
export function pluginSettingsKey(pluginUuid: string) {
  return ["workspace-wp-plugin-settings", pluginUuid] as const;
}

/**
 * A plugin's option row on the workspace's WordPress site.
 *
 * Gate this on the site query (`enabled`): the endpoint 404s when the workspace
 * has no WordPress site at all.
 */
export function useWorkspacePluginSettings(
  pluginUuid: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: pluginSettingsKey(pluginUuid),
    queryFn: () => getWorkspacePluginSettings(pluginUuid),
    enabled: enabled && !!pluginUuid,
    // Reading wp_options goes over an SSH tunnel, and the form is uncontrolled
    // from the cache's point of view: never refetch behind someone who is typing.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/**
 * Persist the full settings object. The server's post-merge response becomes the
 * new cache truth, so a later remount reflects exactly what is in wp_options.
 */
export function useWorkspacePluginSettingsMutation(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      putWorkspacePluginSettings(pluginUuid, settings),
    onSuccess: (data) => {
      queryClient.setQueryData<WpPluginSettingsGetResponse>(
        pluginSettingsKey(pluginUuid),
        { found: true, settings: data.settings },
      );
    },
  });
}

/**
 * The scaffolding every plugin settings screen needs: the workspace's site, the
 * plugin's options merged over its defaults, load state, and the load error.
 *
 * All four settings pages had their own copy of this, and the copies were
 * identical — including the seeding rule below, which is subtle enough that four
 * of it was a standing invitation for one to drift and start clobbering edits.
 *
 * Saving is deliberately NOT in here. The pages genuinely differ (re:review PUTs
 * only a two-key subset, re:cookie snapshots for dirty-tracking instead of
 * reseeding), and folding those apart into options would buy one shared function
 * at the cost of a knob per caller. They get the mutation and write their own.
 */
export function useWorkspacePluginSettingsForm<T extends object>(
  pluginUuid: string,
  defaults: T,
  options: {
    /** Transform the server payload on the way into the form. */
    fromApi?: (raw: unknown) => T;
    /** Side-effects a page needs whenever the form is (re)seeded. */
    onSeeded?: (settings: T) => void;
  } = {},
) {
  // Held in refs so a caller passing inline closures cannot re-fire the seed.
  const fromApiRef = useRef(options.fromApi);
  const onSeededRef = useRef(options.onSeeded);
  fromApiRef.current = options.fromApi;
  onSeededRef.current = options.onSeeded;

  const fromApi = useCallback(
    (raw: unknown): T =>
      fromApiRef.current
        ? fromApiRef.current(raw)
        : mergeRecordWithDefaults(defaults, raw),
    [defaults],
  );

  const [settings, setSettings] = useState<T>(() => fromApi(null));
  // The last state known to be on the server, so `dirty` is truthful. Kept in
  // step with `settings` on every seed and reseed (i.e. after a save).
  const [savedSettings, setSavedSettings] = useState<T>(() => fromApi(null));

  const siteQuery = useWorkspaceWpSite(true);
  const hasSite = !!siteQuery.data;
  const settingsQuery = useWorkspacePluginSettings(pluginUuid, hasSite);
  const saveMutation = useWorkspacePluginSettingsMutation(pluginUuid);

  const seededAt = useRef<number | null>(null);
  const skipNext = useRef(false);

  /**
   * Arm (or disarm) suppression of the next seed. A mutation that writes into
   * the settings cache itself — re:index's sitemap regenerate — would otherwise
   * bounce back through the effect below and overwrite the open form. Arm it
   * before firing such a mutation, and disarm on failure.
   */
  const skipNextSeed = useCallback((arm = true) => {
    skipNext.current = arm;
  }, []);

  // Seed from a given server response exactly once. Keying on `dataUpdatedAt`
  // rather than the data object means a refetch returning an identical payload
  // will not reset a form someone is halfway through typing into.
  useEffect(() => {
    const stamp = settingsQuery.dataUpdatedAt;
    if (!settingsQuery.data || stamp === 0 || seededAt.current === stamp) return;
    seededAt.current = stamp;

    if (skipNext.current) {
      skipNext.current = false;
      return;
    }

    const next = fromApi(
      settingsQuery.data.found ? settingsQuery.data.settings : null,
    );
    setSettings(next);
    setSavedSettings(next);
    onSeededRef.current?.(next);
  }, [settingsQuery.data, settingsQuery.dataUpdatedAt, fromApi]);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings],
  );

  const loadError = useMemo(() => {
    if (siteQuery.isError) return extractErrorMessage(siteQuery.error);
    if (settingsQuery.isError) return extractErrorMessage(settingsQuery.error);
    return null;
  }, [
    siteQuery.isError,
    siteQuery.error,
    settingsQuery.isError,
    settingsQuery.error,
  ]);

  return {
    settings,
    setSettings,
    /** Re-apply a server payload to the form (after a save, say). This also
     *  becomes the new "saved" baseline, so `dirty` clears. */
    reseed: useCallback(
      (raw: unknown) => {
        const next = fromApi(raw);
        setSettings(next);
        setSavedSettings(next);
      },
      [fromApi],
    ),
    /** True while the form differs from what's on the server. */
    dirty,
    /** Sync the saved baseline for edits that a server action already
     *  persisted outside the normal save (e.g. re:index sitemap regenerate). */
    setSavedSettings,
    skipNextSeed,
    site: siteQuery.data ?? null,
    hasSite,
    found: settingsQuery.data?.found ?? true,
    // Only the first paint — never swap the whole page for a background refetch
  // after add/save, or the UI goes blank and pops back.
  loading: siteQuery.isLoading || (settingsQuery.isLoading && !settingsQuery.data),
    saving: saveMutation.isPending,
    loadError,
    saveMutation,
  };
}
