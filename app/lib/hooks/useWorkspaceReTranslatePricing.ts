"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bindTranslateFoundAmount,
  getTranslatePricing,
  ignoreTranslateFoundAmount,
  releaseTranslateFoundAmount,
  removeTranslatePriceKey,
  removeTranslateRegion,
  saveTranslatePriceKey,
  saveTranslatePrices,
  saveTranslatePricingSettings,
  saveTranslateRegion,
  scanTranslatePrices,
  setTranslateDefaultRegion,
} from "~/lib/api/wordpress-hub";
import type {
  ReTranslatePriceCellInput,
  ReTranslatePricing,
  ReTranslatePricingResult,
  ReTranslatePricingSettings,
  ReTranslateScanResult,
} from "~/lib/wordpress/plugin-settings-types";

/**
 * Regions and pricing.
 *
 * Deliberately its own query rather than a slice of the settings blob. The
 * amounts are a table, not an option: they have per-cell history, a coverage
 * count that moves whenever anything is written, and a plugin-side cache in
 * front of them. Folding them into the settings form would mean a Switcher edit
 * and a price edit racing for the same `PUT`, and last-writer-wins on money is
 * not a trade worth making.
 *
 * Every mutation returns the site's post-write snapshot, so the cache is
 * *replaced* from the response rather than invalidated. Over a tunnel that is
 * the difference between a grid that updates and a grid that blanks for a
 * second first.
 */

export function translatePricingKey(pluginUuid: string) {
  return ["workspace", "re-translate", "pricing", pluginUuid] as const;
}

export function useTranslatePricing(pluginUuid: string, enabled = true) {
  return useQuery({
    queryKey: translatePricingKey(pluginUuid),
    queryFn: () => getTranslatePricing(pluginUuid),
    enabled: Boolean(pluginUuid) && enabled,
    // The app-wide default is a five-minute staleTime tuned for settings blobs.
    // Amounts are edited by more than one person and the coverage figures are
    // read as fact, so a remount re-asks.
    staleTime: 0,
    refetchOnMount: "always",
    placeholderData: (prev) => prev,
  });
}

/**
 * Shared plumbing for every write.
 *
 * A refusal (`ok: false`) resolves rather than throwing, so every caller has to
 * check it — a duplicate slug or a currency the market does not offer is an
 * answer, not a failure, and `mutateAsync` rejecting would put it in the same
 * bucket as a dead tunnel. The `try`/`catch` around each call is for the
 * tunnel; the `if (!res.ok)` inside it is for the site's own objections.
 *
 * The snapshot is adopted either way. The site reports its real state even when
 * it refuses, and dropping that would leave the grid showing what the failed
 * attempt hoped for.
 */
function usePricingMutation<TVars>(
  pluginUuid: string,
  fn: (vars: TVars) => Promise<ReTranslatePricingResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      const { ok, error, result, scan, ...snapshot } = data;
      void ok;
      void error;
      void result;
      void scan;
      queryClient.setQueryData<ReTranslatePricing>(
        translatePricingKey(pluginUuid),
        snapshot,
      );
    },
  });
}

export function useSaveTranslateRegion(pluginUuid: string) {
  return usePricingMutation(
    pluginUuid,
    (body: {
      slug: string;
      label?: string;
      flag?: string;
      currencies?: string[];
      countries?: string[];
    }) => saveTranslateRegion(pluginUuid, body),
  );
}

export function useRemoveTranslateRegion(pluginUuid: string) {
  return usePricingMutation(
    pluginUuid,
    ({ slug, purge }: { slug: string; purge: boolean }) =>
      removeTranslateRegion(pluginUuid, slug, purge),
  );
}

export function useSetTranslateDefaultRegion(pluginUuid: string) {
  return usePricingMutation(pluginUuid, (slug: string) =>
    setTranslateDefaultRegion(pluginUuid, slug),
  );
}

export function useSaveTranslatePriceKey(pluginUuid: string) {
  return usePricingMutation(
    pluginUuid,
    (body: { slug: string; label?: string; note?: string }) =>
      saveTranslatePriceKey(pluginUuid, body),
  );
}

export function useRemoveTranslatePriceKey(pluginUuid: string) {
  return usePricingMutation(
    pluginUuid,
    ({ slug, purge }: { slug: string; purge: boolean }) =>
      removeTranslatePriceKey(pluginUuid, slug, purge),
  );
}

export function useSaveTranslatePrices(pluginUuid: string) {
  return usePricingMutation(pluginUuid, (cells: ReTranslatePriceCellInput[]) =>
    saveTranslatePrices(pluginUuid, cells),
  );
}

export function useSaveTranslatePricingSettings(pluginUuid: string) {
  return usePricingMutation(
    pluginUuid,
    (pricing: Partial<ReTranslatePricingSettings>) =>
      saveTranslatePricingSettings(pluginUuid, pricing),
  );
}

export function useBindTranslateFoundAmount(pluginUuid: string) {
  return usePricingMutation(
    pluginUuid,
    (body: {
      fingerprint?: string;
      spot_id?: string;
      key?: string;
      label?: string;
      /* The endpoint has always taken one; the caller may pick the slug so it
         can file amounts against the row in the same save. */
      slug?: string;
      region?: string;
    }) => bindTranslateFoundAmount(pluginUuid, body),
  );
}

export function useIgnoreTranslateFoundAmount(pluginUuid: string) {
  return usePricingMutation(pluginUuid, (fingerprint: string) =>
    ignoreTranslateFoundAmount(pluginUuid, fingerprint),
  );
}

export function useReleaseTranslateFoundAmount(pluginUuid: string) {
  return usePricingMutation(pluginUuid, (fingerprint: string) =>
    releaseTranslateFoundAmount(pluginUuid, fingerprint),
  );
}

/**
 * Scan the whole site, one slice at a time.
 *
 * The loop lives here rather than in the panel because it is the awkward part:
 * each call returns a cursor and the next call has to carry it, and a component
 * driving that through mutation state would re-render on every slice. Only the
 * final snapshot is written to the cache — the intermediate ones differ from it
 * only by being less complete, and adopting each in turn would make the queue
 * visibly grow in fits.
 *
 * `onProgress` is for the button's label, not for state the panel keeps.
 */
export function useScanTranslatePrices(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (opts?: {
      onProgress?: (scanned: number) => void;
    }): Promise<ReTranslatePricingResult> => {
      let cursor = 0;
      let scanned = 0;
      let last: ReTranslatePricingResult | null = null;

      // Bounded so a bug on either side cannot spin forever. 200 slices of 100
      // posts is 20,000 pages, well past anything this UI is for.
      for (let slice = 0; slice < 200; slice += 1) {
        const res = await scanTranslatePrices(pluginUuid, {
          after: cursor,
          limit: 100,
        });

        last = res;

        if (!res.ok) break;

        const progress: ReTranslateScanResult | undefined = res.scan;

        if (!progress) break;

        scanned += progress.scanned;
        cursor = progress.cursor;
        opts?.onProgress?.(scanned);

        if (progress.done) break;
      }

      if (!last) throw new Error("The scan did not run.");

      return last;
    },
    onSuccess: (data) => {
      const { ok, error, result, scan, ...snapshot } = data;
      void ok;
      void error;
      void result;
      void scan;
      queryClient.setQueryData<ReTranslatePricing>(
        translatePricingKey(pluginUuid),
        snapshot,
      );
    },
  });
}
