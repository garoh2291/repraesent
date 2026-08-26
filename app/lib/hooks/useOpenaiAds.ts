import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getOpenaiAdsConnection,
  getOpenaiConversionsStatus,
  getOpenaiInsights,
  listOpenaiAdGroups,
  listOpenaiAds,
  listOpenaiCampaigns,
  type OpenaiInsightsLevel,
} from "~/lib/api/openai-ads";

/**
 * Server-side proxy caches for 60 s per ad account; staleTime matches so the
 * client neither hammers nor lags it. retry: false everywhere — a
 * disconnected workspace answers 409 on all of these, and retrying three
 * times only delays the empty state.
 *
 * Query keys omit the workspace id like every other query here — switching
 * workspaces invalidates everything except ["auth"] in use-auth.ts.
 */
const PROXY_STALE_MS = 60_000;

export function useOpenaiAdsConnection(enabled = true) {
  return useQuery({
    queryKey: ["openai-ads-connection"],
    queryFn: getOpenaiAdsConnection,
    enabled,
    retry: false,
  });
}

export function useOpenaiCampaigns(enabled = true) {
  return useQuery({
    queryKey: ["openai-ads-campaigns"],
    queryFn: listOpenaiCampaigns,
    enabled,
    retry: false,
    staleTime: PROXY_STALE_MS,
  });
}

export function useOpenaiAdGroups(campaignId: string | null) {
  return useQuery({
    queryKey: ["openai-ads-ad-groups", campaignId],
    queryFn: () => listOpenaiAdGroups(campaignId!),
    enabled: !!campaignId,
    retry: false,
    staleTime: PROXY_STALE_MS,
  });
}

export function useOpenaiAds(adGroupId: string | null) {
  return useQuery({
    queryKey: ["openai-ads-ads", adGroupId],
    queryFn: () => listOpenaiAds(adGroupId!),
    enabled: !!adGroupId,
    retry: false,
    staleTime: PROXY_STALE_MS,
  });
}

export function useOpenaiInsights(
  params: {
    level: OpenaiInsightsLevel;
    entity_id?: string;
    since: string;
    until: string;
    granularity?: "hourly" | "daily" | "monthly" | "none";
  },
  enabled = true,
) {
  return useQuery({
    queryKey: [
      "openai-ads-insights",
      params.level,
      params.entity_id ?? null,
      params.since,
      params.until,
      params.granularity ?? "daily",
    ],
    queryFn: () => getOpenaiInsights(params),
    enabled,
    retry: false,
    staleTime: PROXY_STALE_MS,
  });
}

export function useOpenaiConversionsStatus(enabled = true) {
  return useQuery({
    queryKey: ["openai-ads-conversions-status"],
    queryFn: getOpenaiConversionsStatus,
    enabled,
    retry: false,
  });
}

/** Mirrors the server-side WorkspaceAdminGuard 1:1, like useCanManageIntegrations. */
export function useCanManageOpenaiAds(): boolean {
  const { currentWorkspace } = useAuthContext();
  return currentWorkspace?.member_role === "admin";
}
