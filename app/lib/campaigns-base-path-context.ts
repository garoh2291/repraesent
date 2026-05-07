import { createContext, useContext } from "react";
import { DEFAULT_CAMPAIGNS_BASE } from "~/lib/api/campaigns";

export interface CampaignsContextValue {
  /** API mount-point used by getConnectedCampaigns / getCampaignsOverview / etc. */
  basePath: string;
  /**
   * Builds the URL for the "Show leads" deep-link rendered next to each
   * campaign card. Default points at the workspace's /lead-form route.
   * The doorboost_brand view overrides this so it deep-links into the
   * per-retailer leads page instead.
   *
   * Return null to hide the link entirely (e.g., when no destination exists).
   */
  buildLeadsLink: (campaignId: string) => string | null;
}

const DEFAULT_VALUE: CampaignsContextValue = {
  basePath: DEFAULT_CAMPAIGNS_BASE,
  buildLeadsLink: (campaignId) =>
    `/lead-form?platform_campaign_id=${encodeURIComponent(campaignId)}`,
};

export const CampaignsBasePathContext =
  createContext<CampaignsContextValue>(DEFAULT_VALUE);

export function useCampaignsBasePath(): string {
  return useContext(CampaignsBasePathContext).basePath;
}

export function useCampaignsLeadsLink(): (
  campaignId: string,
) => string | null {
  return useContext(CampaignsBasePathContext).buildLeadsLink;
}
