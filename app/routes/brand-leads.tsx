import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { BrandLeadsTable } from "~/components/db-brand/brand-leads-table";

export function meta() {
  return [{ title: "Doorboost Brand Dashboard" }];
}

export default function BrandLeads() {
  const { currentWorkspace } = useAuthContext();
  const { t } = useTranslation();
  const isBrandWs = currentWorkspace?.type === "doorboost_brand";

  if (!isBrandWs) return null;

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid place-items-center w-12 h-12 rounded-xl bg-amber-400/10 text-amber-400">
          <Users className="w-6 h-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("nav.brand_leads", "Leads")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "db_brand.leads.subtitle_page",
              "Every lead across {{brand}}'s retailers. Filter by retailer, campaign, status or source.",
              { brand: currentWorkspace.name },
            )}
          </p>
        </div>
      </div>

      <BrandLeadsTable />
    </div>
  );
}
