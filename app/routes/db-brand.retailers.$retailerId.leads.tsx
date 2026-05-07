import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Loader2, X } from "lucide-react";
import { DataTable } from "~/components/organism/data-table";
import FilterComponent from "~/components/molecule/filter-component";
import {
  LEAD_FILTER_STATUS_OPTIONS,
  LEAD_FILTER_SOURCE_OPTIONS,
} from "~/lib/leads/filter-presets";
import { LeadSourceIcon } from "~/components/organism/lead-source-icon";
import TooltipContainer from "~/components/tooltip-container";
import { Button } from "~/components/ui/button";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useSearchParamsSelect } from "~/lib/hooks/useQueryParams";
import { formatDate } from "~/lib/utils/format";
import {
  downloadBrandRetailerLeadsXlsx,
  listBrandRetailerCampaigns,
  listBrandRetailerLeads,
  listBrandRetailers,
  type BrandRetailer,
  type BrandRetailerCampaign,
  type RetailerLead,
  type RetailerLeadsResponse,
} from "~/lib/api/doorboost-brand";
import { RetailerTabsLayout } from "~/components/db-brand/retailer-tabs";
import { useAuthContext } from "~/providers/auth-provider";

function parsePage(v: string | null): number {
  const n = parseInt(v ?? "1", 10);
  return isNaN(n) || n < 1 ? 1 : n;
}
function parseLimit(v: string | null): number {
  const n = parseInt(v ?? "10", 10);
  return isNaN(n) || n < 1 ? 10 : Math.min(100, n);
}

export default function DbBrandRetailerLeads() {
  const { retailerId } = useParams<{ retailerId: string }>();
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [searchParams] = useSearchParams();
  const [onSelect] = useSearchParamsSelect();
  const [downloading, setDownloading] = useState(false);

  const page = useMemo(
    () => parsePage(searchParams.get("page")),
    [searchParams]
  );
  const limit = useMemo(
    () => parseLimit(searchParams.get("limit")),
    [searchParams]
  );
  const urlSearch = searchParams.get("search") ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const sourceFilter = searchParams.get("source") ?? "";
  const campaignFilter = searchParams.get("platform_campaign_id") ?? "";

  // Local input state keeps typing snappy; URL is updated after debounce so we
  // don't pollute history and the query only refires once the user pauses.
  const [search, setSearch] = useState(urlSearch);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (debouncedSearch === urlSearch) return;
    onSelect({ search: debouncedSearch, page: "1" }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const { data: retailers = [] } = useQuery<BrandRetailer[]>({
    queryKey: ["db-brand-retailers", currentWorkspace?.id],
    queryFn: listBrandRetailers,
    enabled: currentWorkspace?.type === "doorboost_brand",
    staleTime: 60_000,
  });
  const retailerName = retailers.find(
    (r) => r.retailer_id === retailerId
  )?.retailer_name;

  const { data: campaigns = [] } = useQuery<BrandRetailerCampaign[]>({
    queryKey: ["db-brand-retailer-campaigns-list", retailerId],
    queryFn: () => listBrandRetailerCampaigns(retailerId!),
    enabled: !!retailerId,
    staleTime: 60_000,
  });

  const campaignFilterOptions = useMemo(
    () =>
      campaigns.map((c) => ({
        key: c.campaign_id,
        label: c.campaign_name || c.campaign_id,
      })),
    [campaigns]
  );

  const { data, isLoading, isFetching } = useQuery<RetailerLeadsResponse>({
    queryKey: [
      "db-brand-retailer-leads",
      retailerId,
      page,
      limit,
      debouncedSearch,
      statusFilter,
      sourceFilter,
      campaignFilter,
    ],
    queryFn: () =>
      listBrandRetailerLeads(retailerId!, {
        page,
        limit,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        platform: sourceFilter || undefined,
        platform_campaign_id: campaignFilter || undefined,
      }),
    enabled: !!retailerId,
    placeholderData: (prev) => prev,
  });

  async function handleExport() {
    if (!retailerId) return;
    setDownloading(true);
    try {
      await downloadBrandRetailerLeadsXlsx(retailerId, retailerName, {
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        platform: sourceFilter || undefined,
        platform_campaign_id: campaignFilter || undefined,
      });
    } finally {
      setDownloading(false);
    }
  }

  const columns: ColumnDef<RetailerLead>[] = [
    {
      accessorKey: "full_name",
      header: t("leads.columns.fullName", "Full name"),
      cell: ({ row }) => {
        const name =
          row.original.full_name ||
          [row.original.first_name, row.original.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          "—";
        return (
          <TooltipContainer tooltipContent={name}>
            <span className="truncate max-w-[180px] block font-medium text-foreground">
              {name}
            </span>
          </TooltipContainer>
        );
      },
    },
    {
      accessorKey: "email",
      header: t("leads.columns.email", "Email"),
      cell: ({ row }) => {
        const email = row.original.email ?? "—";
        return (
          <TooltipContainer tooltipContent={email}>
            <span className="truncate max-w-[200px] block text-muted-foreground">
              {email}
            </span>
          </TooltipContainer>
        );
      },
    },
    {
      accessorKey: "phone_number",
      header: t("leads.columns.phone", "Phone"),
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.phone_number ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "platform",
      header: t("leads.columns.source", "Source"),
      cell: ({ row }) => (
        <LeadSourceIcon
          source={row.original.platform}
          fallbackSource="form"
          platform={row.original.platform}
          size={18}
        />
      ),
    },
    {
      accessorKey: "status",
      header: t("leads.columns.status", "Status"),
      cell: ({ row }) => (
        <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
          {row.original.status || "—"}
        </span>
      ),
    },
    {
      accessorKey: "created_at",
      header: t("leads.columns.createdAt", "Created"),
      cell: ({ row }) => {
        const ts = row.original.created_at || row.original.platform_created_at;
        if (!ts) return "—";
        // ClickHouse format `YYYY-MM-DD HH:MM:SS` is parseable by Date.
        const d = new Date(ts.replace(" ", "T"));
        return Number.isNaN(d.getTime()) ? (
          <span className="text-muted-foreground text-sm">
            {ts.slice(0, 10)}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">
            {formatDate(d, "PP")}
          </span>
        );
      },
    },
  ];

  const filters = useMemo(
    () => [
      {
        name: "status",
        paramKey: "status",
        options: LEAD_FILTER_STATUS_OPTIONS,
        single: true,
      },
      {
        name: "campaigns",
        paramKey: "platform_campaign_id",
        options: campaignFilterOptions,
        single: true,
      },
    ],
    [campaignFilterOptions]
  );

  return (
    <RetailerTabsLayout>
      <DataTable<RetailerLead, unknown>
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading || isFetching}
        searchValue={search}
        searchPlaceholder={t(
          "db_brand.leads.search_placeholder",
          "Name, email or phone…"
        )}
        onSearchChange={setSearch}
        additionalElement={
          <div className="flex flex-wrap gap-3 items-center">
            <FilterComponent filters={filters} />
            {(statusFilter || sourceFilter || campaignFilter) && (
              <button
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                onClick={() =>
                  onSelect(
                    {
                      status: "",
                      source: "",
                      platform_campaign_id: "",
                      page: "1",
                    },
                    true
                  )
                }
              >
                {t("leads.clearFilters", "Clear filters")} <X size={12} />
              </button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={downloading || (data?.total ?? 0) === 0}
              className="h-9 gap-1.5 text-xs"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {t("db_brand.leads.export", "Export Excel")}
            </Button>
          </div>
        }
        pagination={
          data
            ? {
                page: data.page,
                limit: data.limit,
                total: data.total,
                totalPages: data.totalPages,
                hasNext: data.hasNext,
                hasPrev: data.hasPrev,
              }
            : undefined
        }
        onPaginationChange={(p, l) => {
          const updates: Record<string, string> = { page: String(p) };
          if (Number(l) !== 10) updates.limit = String(l);
          onSelect(updates, true);
        }}
        emptyMessage={t("db_brand.leads.empty", "No leads match your filters.")}
      />
    </RetailerTabsLayout>
  );
}
