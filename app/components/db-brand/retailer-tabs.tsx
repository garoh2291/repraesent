import { Link, useLocation, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BarChart3, Users } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  listBrandRetailerCampaigns,
  listBrandRetailers,
  type BrandRetailer,
  type BrandRetailerCampaign,
} from "~/lib/api/doorboost-brand";
import { useAuthContext } from "~/providers/auth-provider";

interface Props {
  children: React.ReactNode;
}

/**
 * Shared chrome for both retailer pages: header + tabs + back-to-brand link.
 */
export function RetailerTabsLayout({ children }: Props) {
  const { retailerId, campaignId } = useParams<{
    retailerId: string;
    campaignId?: string;
  }>();
  const location = useLocation();
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();

  const { data: retailers = [] } = useQuery<BrandRetailer[]>({
    queryKey: ["db-brand-retailers", currentWorkspace?.id],
    queryFn: listBrandRetailers,
    enabled: currentWorkspace?.type === "doorboost_brand",
    staleTime: 60_000,
  });
  const retailer = retailers.find((r) => r.retailer_id === retailerId);

  // Campaign scope can come from a path param (/social-ads/:campaignId) or a
  // query param on /leads (?platform_campaign_id=X) — pick whichever exists
  // so switching tabs preserves the scope in both directions.
  const queryCampaignId =
    new URLSearchParams(location.search).get("platform_campaign_id") || "";
  const scopedCampaignId = campaignId || queryCampaignId;

  // Resolve the campaign name so the page header reads as the campaign on
  // campaign-scoped views (and the retailer otherwise). Same cache key the
  // social-ads/$campaignId route already warms.
  const { data: retailerCampaigns = [] } = useQuery<BrandRetailerCampaign[]>({
    queryKey: ["db-brand-retailer-campaigns-list", retailerId],
    queryFn: () => listBrandRetailerCampaigns(retailerId!),
    enabled: !!retailerId && !!scopedCampaignId,
    staleTime: 60_000,
  });
  const scopedCampaign = scopedCampaignId
    ? retailerCampaigns.find((c) => c.campaign_id === scopedCampaignId)
    : undefined;
  const stateCampaignName = (
    location.state as { campaign_name?: string } | null
  )?.campaign_name;
  const campaignDisplayName =
    stateCampaignName ||
    scopedCampaign?.campaign_name ||
    scopedCampaignId ||
    "";

  const socialAdsHref = scopedCampaignId
    ? `/db-brand/retailers/${retailerId}/social-ads/${scopedCampaignId}`
    : `/db-brand/retailers/${retailerId}/social-ads`;
  const leadsHref = scopedCampaignId
    ? `/db-brand/retailers/${retailerId}/leads?platform_campaign_id=${encodeURIComponent(
        scopedCampaignId
      )}`
    : `/db-brand/retailers/${retailerId}/leads`;

  // When the view is campaign-scoped (path-param campaign or platform_campaign_id
  // query), back goes to the same tab on the retailer page (drops the campaign).
  // Otherwise it goes up one level to the brand overview.
  const isOnLeadsTab = location.pathname.includes("/leads");
  const retailerTabBaseHref = `/db-brand/retailers/${retailerId}/social-ads`;
  const backHref = scopedCampaignId ? retailerTabBaseHref : "/db-brand";
  const backLabel = scopedCampaignId
    ? retailer?.retailer_name ||
      retailerId?.split("-").pop() ||
      t("db_brand.back_to_retailer", "Retailer")
    : (currentWorkspace?.name ?? "Brand");

  const tabs: { to: string; label: string; Icon: typeof BarChart3 }[] = [
    {
      to: socialAdsHref,
      label: t("db_brand.tabs.social_ads", "Social Ads"),
      Icon: BarChart3,
    },
    {
      to: leadsHref,
      label: t("db_brand.tabs.leads", "Leads"),
      Icon: Users,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </Link>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {scopedCampaignId
              ? campaignDisplayName
              : retailer?.retailer_name || retailerId?.split("-").pop()}
          </h1>
          {scopedCampaignId ? (
            <p className="text-xs text-muted-foreground/70 mt-1">
              {retailer?.retailer_name || retailerId?.split("-").pop()}
              <span className="ml-2 font-mono">#{scopedCampaignId}</span>
            </p>
          ) : (
            retailerId && (
              <p className="text-xs font-mono text-muted-foreground/70 mt-1">
                #{retailerId.split("-").pop()}
              </p>
            )
          )}
        </div>
      </div>

      <div className="mb-6 border-b">
        <nav className="-mb-px flex gap-1">
          {tabs.map((tab) => {
            // tab.to may include a query string (campaign-scoped leads link)
            // — compare on the path portion only so the active state still
            // works once we navigate there.
            const tabPath = tab.to.split("?")[0];
            const isActive =
              location.pathname === tabPath ||
              location.pathname.startsWith(`${tabPath}/`);
            const Icon = tab.Icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground/80"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
