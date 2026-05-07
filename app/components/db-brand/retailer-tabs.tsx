import { Link, useLocation, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BarChart3, Users } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  listBrandRetailers,
  type BrandRetailer,
} from "~/lib/api/doorboost-brand";
import { useAuthContext } from "~/providers/auth-provider";

interface Props {
  children: React.ReactNode;
}

/**
 * Shared chrome for both retailer pages: header + tabs + back-to-brand link.
 */
export function RetailerTabsLayout({ children }: Props) {
  const { retailerId } = useParams<{ retailerId: string }>();
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

  const tabs: { to: string; label: string; Icon: typeof BarChart3 }[] = [
    {
      to: `/db-brand/retailers/${retailerId}/social-ads`,
      label: t("db_brand.tabs.social_ads", "Social Ads"),
      Icon: BarChart3,
    },
    {
      to: `/db-brand/retailers/${retailerId}/leads`,
      label: t("db_brand.tabs.leads", "Leads"),
      Icon: Users,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/db-brand"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {currentWorkspace?.name ?? "Brand"}
        </Link>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {retailer?.retailer_name || retailerId?.split("-").pop()}
          </h1>
          {retailerId && (
            <p className="text-xs font-mono text-muted-foreground/70 mt-1">
              #{retailerId.split("-").pop()}
            </p>
          )}
        </div>
      </div>

      <div className="mb-6 border-b">
        <nav className="-mb-px flex gap-1">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.to;
            const Icon = tab.Icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground/80",
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
