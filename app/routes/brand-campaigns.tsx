import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { Megaphone, X } from "lucide-react";
import { DataTable } from "~/components/organism/data-table";
import FilterComponent from "~/components/molecule/filter-component";
import { LeadSourceIcon } from "~/components/organism/lead-source-icon";
import TooltipContainer from "~/components/tooltip-container";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useSearchParamsSelect } from "~/lib/hooks/useQueryParams";
import { formatDate } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import {
  listBrandCampaignsPage,
  type BrandCampaign,
  type BrandCampaignsPage,
} from "~/lib/api/doorboost-brand";
import { useAuthContext } from "~/providers/auth-provider";

export function meta() {
  return [{ title: "Doorboost Brand Dashboard" }];
}

const lastIdSegment = (id: string) => id.split("-").pop() ?? id;

const ACTIVE_STATUSES = new Set(["ENABLED", "ACTIVE", "Active"]);

function parsePage(v: string | null): number {
  const n = parseInt(v ?? "1", 10);
  return isNaN(n) || n < 1 ? 1 : n;
}
function parseLimit(v: string | null): number {
  const n = parseInt(v ?? "50", 10);
  return isNaN(n) || n < 1 ? 50 : Math.min(100, n);
}

function formatDateCell(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? raw.slice(0, 10) : formatDate(d, "PP");
}

export default function BrandCampaigns() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [searchParams] = useSearchParams();
  const [onSelect] = useSearchParamsSelect();
  const isBrandWs = currentWorkspace?.type === "doorboost_brand";

  const page = useMemo(
    () => parsePage(searchParams.get("page")),
    [searchParams],
  );
  const limit = useMemo(
    () => parseLimit(searchParams.get("limit")),
    [searchParams],
  );
  const urlSearch = searchParams.get("search") ?? "";
  const platformFilter = searchParams.get("platform") ?? "";
  const statusFilter = (searchParams.get("status") ?? "") as
    | ""
    | "active"
    | "inactive";
  const startDateFrom = searchParams.get("start_date_from") ?? "";
  const endDateTo = searchParams.get("end_date_to") ?? "";

  const [search, setSearch] = useState(urlSearch);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (debouncedSearch === urlSearch) return;
    onSelect({ search: debouncedSearch, page: "1" }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery<BrandCampaignsPage>({
    queryKey: [
      "db-brand-campaigns-page",
      currentWorkspace?.id,
      page,
      limit,
      debouncedSearch,
      platformFilter,
      statusFilter,
      startDateFrom,
      endDateTo,
    ],
    queryFn: () =>
      listBrandCampaignsPage({
        page,
        limit,
        search: debouncedSearch || undefined,
        platform: platformFilter || undefined,
        status: statusFilter || undefined,
        start_date_from: startDateFrom || undefined,
        end_date_to: endDateTo || undefined,
      }),
    enabled: isBrandWs,
    placeholderData: (prev) => prev,
  });

  const columns: ColumnDef<BrandCampaign>[] = [
    {
      accessorKey: "campaign_name",
      header: t("db_brand.campaigns.columns.name", "Campaign"),
      cell: ({ row }) => {
        const c = row.original;
        const name = c.campaign_name || c.campaign_id;
        const tag = lastIdSegment(c.campaign_id);
        return (
          <TooltipContainer tooltipContent={c.campaign_id}>
            <div className="min-w-0 max-w-[260px]">
              <div className="truncate font-medium text-foreground">{name}</div>
              <div className="text-[11px] font-mono text-muted-foreground/70 truncate">
                #{tag}
              </div>
            </div>
          </TooltipContainer>
        );
      },
    },
    {
      accessorKey: "retailer_name",
      header: t("db_brand.campaigns.columns.retailer", "Retailer"),
      cell: ({ row }) => (
        <span className="truncate max-w-[180px] block text-foreground">
          {row.original.retailer_name?.trim() ||
            lastIdSegment(row.original.retailer_id)}
        </span>
      ),
    },
    {
      accessorKey: "platform",
      header: t("db_brand.campaigns.columns.platform", "Platform"),
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
      accessorKey: "campaign_status",
      header: t("db_brand.campaigns.columns.status", "Status"),
      cell: ({ row }) => {
        const s = row.original.campaign_status ?? "";
        const isActive = ACTIVE_STATUSES.has(s);
        return (
          <span
            className={cn(
              "inline-block rounded-md px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
              isActive
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {s || "—"}
          </span>
        );
      },
    },
    {
      accessorKey: "account_name",
      header: t("db_brand.campaigns.columns.account", "Account"),
      cell: ({ row }) => (
        <span className="truncate max-w-[160px] block text-muted-foreground">
          {row.original.account_name || row.original.account_id || "—"}
        </span>
      ),
    },
    {
      accessorKey: "start_date",
      header: t("db_brand.campaigns.columns.start", "Started"),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDateCell(row.original.start_date)}
        </span>
      ),
    },
    {
      accessorKey: "end_date",
      header: t("db_brand.campaigns.columns.end", "Ended"),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDateCell(row.original.end_date)}
        </span>
      ),
    },
  ];

  const filters = useMemo(
    () => [
      {
        name: "platform",
        paramKey: "platform",
        options: [
          { key: "facebook", label: "Facebook" },
          { key: "google", label: "Google" },
        ],
        single: true,
      },
      {
        name: "status",
        paramKey: "status",
        options: [
          { key: "active", label: t("db_brand.campaigns.statusActive", "Active") },
          {
            key: "inactive",
            label: t("db_brand.campaigns.statusInactive", "Inactive"),
          },
        ],
        single: true,
      },
      {
        name: "start_date",
        paramKey: "start_date_from",
        options: [],
        type: "date" as const,
      },
      {
        name: "end_date",
        paramKey: "end_date_to",
        options: [],
        type: "date" as const,
      },
    ],
    [t],
  );

  const anyFilter =
    platformFilter || statusFilter || startDateFrom || endDateTo;

  if (!isBrandWs) return null;

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid place-items-center w-12 h-12 rounded-xl bg-amber-400/10 text-amber-400">
          <Megaphone className="w-6 h-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("nav.brand_campaigns", "Campaigns")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "db_brand.campaigns.subtitle",
              "Every platform campaign attached to {{brand}}.",
              { brand: currentWorkspace.name },
            )}
          </p>
        </div>
      </div>

      <DataTable<BrandCampaign, unknown>
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading || isFetching}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t(
          "db_brand.campaigns.search_placeholder",
          "Search name, id or retailer…",
        )}
        additionalElement={
          <div className="flex flex-wrap gap-3 items-center">
            <FilterComponent filters={filters} />
            {anyFilter && (
              <button
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                onClick={() =>
                  onSelect(
                    {
                      platform: "",
                      status: "",
                      start_date_from: "",
                      end_date_to: "",
                      page: "1",
                    },
                    true,
                  )
                }
              >
                {t("leads.clearFilters", "Clear filters")} <X size={12} />
              </button>
            )}
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
          if (Number(l) !== 50) updates.limit = String(l);
          else updates.limit = "";
          onSelect(updates, true);
        }}
        pageSizeOptions={[20, 50, 100]}
        emptyMessage={t(
          "db_brand.campaigns.empty",
          "No campaigns match your filters.",
        )}
      />
    </div>
  );
}
