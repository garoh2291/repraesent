import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format, subDays } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Eye,
  MousePointerClick,
  Target,
  DollarSign,
  Users,
  ChevronDown,
  ChevronRight,
  Filter,
  X,
  Check,
  Search,
  ArrowRight,
  FileText,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { useAuthContext } from "~/providers/auth-provider";
import { cn } from "~/lib/utils";
import {
  formatNumber,
  formatCurrency,
  formatDecimal,
} from "~/lib/utils/format";
import {
  getConnectedCampaigns,
  getCampaignsOverview,
  getCampaignAdSets,
  type DateRange,
  type ConnectedCampaign,
  type AdSetInsight,
} from "~/lib/api/campaigns";
import { CampaignDatePicker } from "./campaign-date-picker";
import TooltipContainer from "~/components/tooltip-container";
import { useDebounce } from "~/lib/hooks/useDebounce";

const ACCENT = {
  cost: "#f59e0b",
  impressions: "#6366f1",
  clicks: "#10b981",
  reach: "#3b82f6",
  conversions: "#ec4899",
  conversions_value: "#8b5cf6",
};

function defaultRange(): DateRange {
  const today = new Date();
  return {
    startDate: format(subDays(today, 6), "yyyy-MM-dd"),
    endDate: format(today, "yyyy-MM-dd"),
  };
}

/* ─── Skeleton Components ─── */

function MetricCardSkeleton({ delay }: { delay: string }) {
  return (
    <div
      className="app-fade-up rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-2"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-muted animate-pulse" />
        <div className="h-3 w-16 rounded bg-muted animate-pulse" />
      </div>
      <div className="h-7 w-20 rounded bg-muted animate-pulse" />
    </div>
  );
}

function ChartSkeleton({ height }: { height: string }) {
  return (
    <div className={cn("flex items-center justify-center", height)}>
      <div className="space-y-3 w-full px-4">
        <div className="flex items-end gap-1 h-24">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-muted animate-pulse rounded-t"
              style={{ height: `${20 + Math.random() * 60}%` }}
            />
          ))}
        </div>
        <div className="h-px bg-muted" />
      </div>
    </div>
  );
}

/* ─── Metric Card ─── */

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  delay,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  delay: string;
}) {
  return (
    <div
      className="app-fade-up rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-1.5"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}15` }}
        >
          <span style={{ color }}>
            <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </span>
        </div>
        <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <p className="text-lg sm:text-2xl font-bold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}

/* ─── Chart Tooltip ─── */

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-[13px]">
      <p className="text-muted-foreground mb-1 text-xs">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-semibold text-foreground">
            {typeof p.value === "number" ? formatNumber(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Breakdown Table ─── */

function BreakdownTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: {
    key: string;
    name: string;
    cost: number;
    clicks: number;
    impressions: number;
    conversions: number;
  }[];
  columns: {
    spend: string;
    clicks: string;
    impressions: string;
    conversions: string;
  };
}) {
  if (!rows.length) return null;
  return (
    <div>
      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        {title}
      </p>

      {/* Desktop: table */}
      <div className="hidden sm:block border rounded-lg overflow-x-auto">
        <table className="w-full text-xs table-fixed min-w-[480px]">
          <colgroup>
            <col style={{ width: "40%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "15%" }} />
          </colgroup>
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-1.5 font-medium">Name</th>
              <th className="px-3 py-1.5 font-medium text-right">
                {columns.spend}
              </th>
              <th className="px-3 py-1.5 font-medium text-right">
                {columns.clicks}
              </th>
              <th className="px-3 py-1.5 font-medium text-right">
                {columns.impressions}
              </th>
              <th className="px-3 py-1.5 font-medium text-right">
                {columns.conversions}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border/50">
                <td className="px-3 py-1.5 max-w-0">
                  <TooltipContainer
                    tooltipContent={r.name}
                    showCopyButton={false}
                    delayDuration={200}
                  >
                    <p className="truncate text-foreground">{r.name}</p>
                  </TooltipContainer>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                  {formatCurrency(r.cost)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                  {formatNumber(r.clicks)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                  {formatNumber(r.impressions)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                  {formatNumber(r.conversions)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: card layout */}
      <div className="sm:hidden space-y-2">
        {rows.map((r) => (
          <div
            key={r.key}
            className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5"
          >
            <TooltipContainer
              tooltipContent={r.name}
              showCopyButton={false}
              delayDuration={200}
            >
              <p className="text-[12px] font-medium text-foreground truncate mb-1.5">
                {r.name}
              </p>
            </TooltipContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{columns.spend}</span>
                <span className="tabular-nums text-foreground">{formatCurrency(r.cost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{columns.clicks}</span>
                <span className="tabular-nums text-foreground">{formatNumber(r.clicks)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{columns.impressions}</span>
                <span className="tabular-nums text-foreground">{formatNumber(r.impressions)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{columns.conversions}</span>
                <span className="tabular-nums text-foreground">{formatNumber(r.conversions)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Status helpers ─── */

function getStatusStyle(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s === "enabled" || s === "active")
    return "bg-emerald-500/10 text-emerald-500";
  if (s === "paused") return "bg-amber-500/10 text-amber-500";
  if (s === "removed") return "bg-red-500/10 text-red-500";
  return "bg-muted text-muted-foreground";
}

/* ─── Drilldown loading skeleton ─── */

function DrilldownSkeleton() {
  return (
    <div className="px-4 pb-4 space-y-3">
      <div className="h-3 w-20 rounded bg-muted animate-pulse" />
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/50 h-7" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2 border-t border-border/50"
          >
            <div className="h-3 flex-1 rounded bg-muted animate-pulse" />
            <div className="h-3 w-14 rounded bg-muted animate-pulse" />
            <div className="h-3 w-10 rounded bg-muted animate-pulse" />
            <div className="h-3 w-12 rounded bg-muted animate-pulse" />
            <div className="h-3 w-10 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Campaign Drilldown ─── */

function CampaignDrilldown({ campaign }: { campaign: ConnectedCampaign }) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [expanded, setExpanded] = useState(false);
  const hasLeadForm =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "lead-form" || s.service_slug === "lead-form",
    ) ?? false;

  const { data: adSets, isLoading: adSetsLoading } = useQuery({
    queryKey: ["campaign-ad-sets", campaign.campaign_id],
    queryFn: () => getCampaignAdSets(campaign.campaign_id),
    enabled: expanded,
  });

  const cols = {
    spend: t("campaigns.spend"),
    clicks: t("campaigns.clicks"),
    impressions: t("campaigns.impressions"),
    conversions: t("campaigns.conversions"),
  };

  const adSetRows = (adSets ?? []).map((as: AdSetInsight) => ({
    key: as.ad_set_id,
    name: as.ad_set_name ?? as.ad_set_id,
    cost: as.cost ?? 0,
    clicks: as.clicks ?? 0,
    impressions: as.impressions ?? 0,
    conversions: as.conversions ?? 0,
  }));

  const campaignLabel = campaign.campaign_name ?? campaign.campaign_id;
  const accountLabel = `${campaign.account_name ?? "—"} · ${campaign.platform}`;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0 overflow-hidden">
          <TooltipContainer
            tooltipContent={campaignLabel}
            showCopyButton={false}
            delayDuration={200}
          >
            <p className="font-medium text-[13px] sm:text-sm text-foreground truncate">
              {campaignLabel}
            </p>
          </TooltipContainer>
          <TooltipContainer
            tooltipContent={accountLabel}
            showCopyButton={false}
            delayDuration={200}
          >
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate mt-0.5">
              {accountLabel}
            </p>
          </TooltipContainer>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-medium uppercase tracking-wider shrink-0 ml-1",
            getStatusStyle(campaign.campaign_status)
          )}
        >
          {campaign.campaign_status ?? "—"}
        </span>
      </button>

      {expanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-4">
          {adSetsLoading ? (
            <DrilldownSkeleton />
          ) : adSetRows.length > 0 ? (
            <BreakdownTable
              title={t("campaigns.adSets")}
              rows={adSetRows}
              columns={cols}
            />
          ) : (
            <p className="text-xs text-muted-foreground py-2">
              {t("campaigns.noData")}
            </p>
          )}
          {hasLeadForm && (
            <div className="flex justify-end pt-1">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-[11px] border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
              >
                <Link
                  to={`/lead-form?platform_campaign_id=${encodeURIComponent(campaign.campaign_id)}`}
                >
                  <FileText className="h-3 w-3" />
                  {t("campaigns.showLeads")}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Campaign List Skeleton ─── */

function CampaignListSkeleton() {
  return (
    <div className="px-4 py-6 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-4 w-4 rounded bg-muted animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-48 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-32 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-5 w-14 rounded-full bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/* ─── Campaign List with Tabs (backend-driven) ─── */

function CampaignListSection({ platform }: { platform?: string }) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);

  // Reset page when search or tab changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tab]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "campaign-list",
      currentWorkspace?.id,
      platform,
      tab,
      debouncedSearch,
      page,
    ],
    queryFn: () =>
      getConnectedCampaigns({
        platform,
        status: tab,
        search: debouncedSearch || undefined,
        page,
        limit: 20,
      }),
    enabled: !!currentWorkspace?.id,
    placeholderData: (prev) => prev,
  });

  // Fetch counts for tab badges
  const { data: activeCount } = useQuery({
    queryKey: ["campaign-count-active", currentWorkspace?.id, platform],
    queryFn: () =>
      getConnectedCampaigns({ platform, status: "active", limit: 1 }),
    enabled: !!currentWorkspace?.id,
  });
  const { data: inactiveCount } = useQuery({
    queryKey: ["campaign-count-inactive", currentWorkspace?.id, platform],
    queryFn: () =>
      getConnectedCampaigns({ platform, status: "inactive", limit: 1 }),
    enabled: !!currentWorkspace?.id,
  });

  const campaigns = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div
      className="app-fade-up rounded-2xl border border-border bg-card overflow-hidden"
      style={{ animationDelay: "0.34s" }}
    >
      {/* Header with tabs — stacks on mobile */}
      <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
          {t("campaigns.connectedCampaigns")}
        </p>
        <div className="flex gap-0.5 rounded-lg bg-muted/50 p-0.5 self-start sm:self-auto">
          <button
            onClick={() => setTab("active")}
            className={cn(
              "rounded-md px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-medium transition-all whitespace-nowrap",
              tab === "active"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("campaigns.tabActive")}
            {activeCount != null && (
              <span className="ml-1 text-muted-foreground">
                {activeCount.total}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("inactive")}
            className={cn(
              "rounded-md px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-medium transition-all whitespace-nowrap",
              tab === "inactive"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("campaigns.tabInactive")}
            {inactiveCount != null && (
              <span className="ml-1 text-muted-foreground">
                {inactiveCount.total}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search under tabs */}
      <div className="px-3 sm:px-6 py-2 sm:py-2.5 border-b border-border">
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("campaigns.searchCampaigns")}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          {isFetching && !isLoading && (
            <div className="h-3 w-3 animate-spin rounded-full border border-muted border-t-foreground shrink-0" />
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <CampaignListSkeleton />
      ) : campaigns.length > 0 ? (
        <>
          {campaigns.map((c) => (
            <CampaignDrilldown key={c.campaign_id} campaign={c} />
          ))}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-6 py-2.5 sm:py-3 border-t border-border">
              <p className="text-[10px] sm:text-[11px] text-muted-foreground">
                {t("campaigns.showingOf", {
                  count: campaigns.length,
                  total,
                })}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md px-2 py-1 text-[10px] sm:text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  {t("common.back")}
                </button>
                <span className="text-[10px] sm:text-[11px] text-muted-foreground tabular-nums px-1.5 sm:px-2">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-md px-2 py-1 text-[10px] sm:text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  {t("common.next")}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="px-4 py-8 text-center">
          <p className="text-xs text-muted-foreground">
            {debouncedSearch
              ? t("common.noResults")
              : tab === "active"
                ? t("campaigns.noActiveCampaigns")
                : t("campaigns.noInactiveCampaigns")}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Campaign Filter Dropdown (backend search) ─── */

function CampaignFilterDropdown({
  platform,
  selectedIds,
  selectedNames,
  onChange,
}: {
  platform?: string;
  selectedIds: string[];
  selectedNames: Map<string, string>;
  onChange: (ids: string[], names: Map<string, string>) => void;
}) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus input and reset search on open
  useEffect(() => {
    if (open) {
      setSearch("");
      inputRef.current?.focus();
    }
  }, [open]);

  // Backend search query
  const { data, isLoading: searchLoading } = useQuery({
    queryKey: [
      "campaign-filter-search",
      currentWorkspace?.id,
      platform,
      debouncedSearch,
    ],
    queryFn: () =>
      getConnectedCampaigns({
        platform,
        search: debouncedSearch || undefined,
        limit: 30,
      }),
    enabled: !!currentWorkspace?.id && open,
  });

  const results = data?.data ?? [];
  const isAllSelected = selectedIds.length === 0;

  const toggle = useCallback(
    (c: ConnectedCampaign) => {
      const newNames = new Map(selectedNames);
      if (selectedIds.includes(c.campaign_id)) {
        newNames.delete(c.campaign_id);
        onChange(
          selectedIds.filter((x) => x !== c.campaign_id),
          newNames
        );
      } else {
        newNames.set(c.campaign_id, c.campaign_name ?? c.campaign_id);
        onChange([...selectedIds, c.campaign_id], newNames);
      }
    },
    [selectedIds, selectedNames, onChange]
  );

  const label = isAllSelected
    ? t("campaigns.allCampaigns")
    : selectedIds.length === 1
      ? (selectedNames.get(selectedIds[0]) ?? selectedIds[0])
      : t("campaigns.campaignsSelected", { count: selectedIds.length });

  return (
    <div ref={containerRef} className="relative z-[60]">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5",
          "text-xs font-medium text-foreground hover:bg-muted/50 transition-colors shadow-sm",
          !isAllSelected && "border-primary/30 bg-primary/5"
        )}
      >
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="max-w-[180px] truncate">{label}</span>
        {!isAllSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange([], new Map());
            }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted transition-colors"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-[320px] rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("campaigns.searchCampaigns")}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
              />
              {search && (
                <button onClick={() => setSearch("")}>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
              {searchLoading && (
                <div className="h-3 w-3 animate-spin rounded-full border border-muted border-t-foreground shrink-0" />
              )}
            </div>
          </div>

          {/* All campaigns option */}
          <button
            onClick={() => {
              onChange([], new Map());
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors",
              isAllSelected && "bg-primary/5"
            )}
          >
            <div
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border shrink-0",
                isAllSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              )}
            >
              {isAllSelected && <Check className="h-3 w-3" />}
            </div>
            <span className="font-medium">{t("campaigns.allCampaigns")}</span>
          </button>

          {/* Campaign list */}
          <div className="max-h-[240px] overflow-y-auto border-t border-border">
            {searchLoading && results.length === 0 ? (
              <div className="py-6 flex items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-foreground" />
              </div>
            ) : results.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {t("common.noResults")}
              </p>
            ) : (
              results.map((c) => {
                const selected = selectedIds.includes(c.campaign_id);
                return (
                  <button
                    key={c.campaign_id}
                    onClick={() => toggle(c)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors",
                      selected && "bg-primary/5"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border shrink-0",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      )}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="truncate font-medium">
                        {c.campaign_name ?? c.campaign_id}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {c.account_name} &middot; {c.campaign_status}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Dashboard ─── */

export function CampaignAnalyticsDashboard({
  title,
  platform: fixedPlatform,
}: {
  title: string;
  platform?: string;
}) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [selectedCampaignNames, setSelectedCampaignNames] = useState<
    Map<string, string>
  >(new Map());
  const [platformTab, setPlatformTab] = useState<string>("all");

  // When a fixed platform is provided, use it directly; otherwise use the tab
  const platform =
    fixedPlatform ?? (platformTab === "all" ? undefined : platformTab);

  // Reset campaign filter when platform tab changes
  useEffect(() => {
    setSelectedCampaignIds([]);
    setSelectedCampaignNames(new Map());
  }, [platformTab]);

  // Unfiltered check: does workspace have ANY campaigns at all? (for true empty state)
  const { data: totalCheck, isLoading: totalCheckLoading } = useQuery({
    queryKey: ["campaign-total-check", currentWorkspace?.id],
    queryFn: () => getConnectedCampaigns({ limit: 1 }),
    enabled: !!currentWorkspace?.id,
  });
  const hasAnyCampaigns = (totalCheck?.total ?? 0) > 0;

  // Filtered check: does current platform filter have campaigns?
  const { data: anyCheck, isLoading: anyCheckLoading } = useQuery({
    queryKey: ["campaign-any-check", currentWorkspace?.id, platform],
    queryFn: () =>
      getConnectedCampaigns({ platform: platform ?? undefined, limit: 1 }),
    enabled: !!currentWorkspace?.id && hasAnyCampaigns,
  });

  const hasCampaigns = (anyCheck?.total ?? 0) > 0;
  const filterIds =
    selectedCampaignIds.length > 0 ? selectedCampaignIds : undefined;

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: [
      "campaign-overview",
      currentWorkspace?.id,
      dateRange,
      platform,
      filterIds,
    ],
    queryFn: () => getCampaignsOverview(dateRange, platform, filterIds),
    enabled: !!currentWorkspace?.id && hasCampaigns,
  });

  const isLoading = totalCheckLoading || anyCheckLoading || overviewLoading;
  const totals = overview?.totals;
  const series = overview?.series ?? [];

  const ctr =
    totals && totals.impressions > 0
      ? (totals.clicks / totals.impressions) * 100
      : 0;
  const cpc = totals && totals.clicks > 0 ? totals.cost / totals.clicks : 0;

  const handleFilterChange = useCallback(
    (ids: string[], names: Map<string, string>) => {
      setSelectedCampaignIds(ids);
      setSelectedCampaignNames(names);
    },
    []
  );

  // True empty state — no campaigns connected AT ALL (not just filtered)
  if (!totalCheckLoading && !hasAnyCampaigns) {
    return (
      <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 py-10! app-fade-in">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div
            className="app-fade-up flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 mb-4"
            style={{ animationDelay: "0s" }}
          >
            <TrendingUp className="h-8 w-8 text-amber-500" />
          </div>
          <p
            className="app-fade-up text-muted-foreground max-w-sm"
            style={{ animationDelay: "0.06s" }}
          >
            {t("campaigns.noCampaigns")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 py-10! space-y-6 sm:space-y-8 app-fade-in">
      {/* Header + Filters */}
      <div
        className="app-fade-up flex flex-col gap-3 relative z-[60]"
        style={{ animationDelay: "0s" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <CampaignFilterDropdown
              platform={platform}
              selectedIds={selectedCampaignIds}
              selectedNames={selectedCampaignNames}
              onChange={handleFilterChange}
            />
            <CampaignDatePicker value={dateRange} onChange={setDateRange} />
          </div>
        </div>
        {/* Platform tabs — only when no fixed platform */}
        {!fixedPlatform && (
          <div className="flex gap-0.5 rounded-lg bg-muted/50 p-0.5 w-fit">
            {(
              [
                { key: "all", label: t("campaigns.platformAll") },
                { key: "google", label: "Google" },
                { key: "facebook", label: "Facebook" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPlatformTab(tab.key)}
                className={cn(
                  "rounded-md px-3 py-1 text-[11px] font-medium transition-all whitespace-nowrap",
                  platformTab === tab.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filtered empty state — platform has no campaigns but other platforms do */}
      {!anyCheckLoading && !hasCampaigns && hasAnyCampaigns ? (
        <div className="flex flex-col items-center justify-center py-16 text-center app-fade-in">
          <TrendingUp className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground max-w-sm">
            {t("campaigns.noData")}
          </p>
        </div>
      ) : (<>

      {/* Metric Cards — skeleton or real */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {isLoading || !totals ? (
          <>
            {Array.from({ length: 7 }).map((_, i) => (
              <MetricCardSkeleton key={i} delay={`${0.04 + i * 0.04}s`} />
            ))}
          </>
        ) : (
          <>
            <MetricCard
              label={t("campaigns.spend")}
              value={formatCurrency(totals.cost)}
              icon={DollarSign}
              color={ACCENT.cost}
              delay="0.04s"
            />
            <MetricCard
              label={t("campaigns.impressions")}
              value={formatNumber(totals.impressions)}
              icon={Eye}
              color={ACCENT.impressions}
              delay="0.08s"
            />
            <MetricCard
              label={t("campaigns.clicks")}
              value={formatNumber(totals.clicks)}
              icon={MousePointerClick}
              color={ACCENT.clicks}
              delay="0.12s"
            />
            <MetricCard
              label={t("campaigns.reach")}
              value={formatNumber(totals.reach)}
              icon={Users}
              color={ACCENT.reach}
              delay="0.16s"
            />
            <MetricCard
              label={t("campaigns.conversions")}
              value={formatNumber(totals.conversions)}
              icon={Target}
              color={ACCENT.conversions}
              delay="0.20s"
            />
            <MetricCard
              label={t("campaigns.ctr")}
              value={`${formatDecimal(ctr)}%`}
              icon={MousePointerClick}
              color="#14b8a6"
              delay="0.24s"
            />
            <MetricCard
              label={t("campaigns.cpc")}
              value={formatCurrency(cpc)}
              icon={DollarSign}
              color="#f97316"
              delay="0.28s"
            />
          </>
        )}
      </div>

      {/* Spend Over Time Chart */}
      <div
        className="app-fade-up rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 sm:space-y-5"
        style={{ animationDelay: "0.16s" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("campaigns.spendOverTime")}
        </p>
        {isLoading ? (
          <ChartSkeleton height="h-[200px] sm:h-[280px]" />
        ) : series.length > 0 ? (
          <div className="h-[200px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    const parts = v.split("-");
                    return `${parts[1]}/${parts[2]}`;
                  }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={45}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="cost"
                  name={t("campaigns.spend")}
                  stroke={ACCENT.cost}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-12">
            {t("campaigns.noData")}
          </p>
        )}
      </div>

      {/* Clicks & Impressions Chart */}
      {(isLoading || series.length > 0) && (
        <div
          className="app-fade-up rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 sm:space-y-5"
          style={{ animationDelay: "0.22s" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("campaigns.clicksAndImpressions")}
          </p>
          {isLoading ? (
            <ChartSkeleton height="h-[180px] sm:h-[240px]" />
          ) : (
            <div className="h-[180px] sm:h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => {
                      const parts = v.split("-");
                      return `${parts[1]}/${parts[2]}`;
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={45}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar
                    dataKey="clicks"
                    name={t("campaigns.clicks")}
                    fill={ACCENT.clicks}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={20}
                  />
                  <Bar
                    dataKey="impressions"
                    name={t("campaigns.impressions")}
                    fill={ACCENT.impressions}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={20}
                    opacity={0.5}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Conversions Chart */}
      {(isLoading || series.length > 0) && (
        <div
          className="app-fade-up rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 sm:space-y-5"
          style={{ animationDelay: "0.28s" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("campaigns.conversions")}
          </p>
          {isLoading ? (
            <ChartSkeleton height="h-[160px] sm:h-[200px]" />
          ) : (
            <div className="h-[160px] sm:h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => {
                      const parts = v.split("-");
                      return `${parts[1]}/${parts[2]}`;
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={35}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="conversions"
                    name={t("campaigns.conversions")}
                    stroke={ACCENT.conversions}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Connected Campaigns List with Active/Inactive tabs */}
      <CampaignListSection platform={platform} />
      </>)}
    </div>
  );
}
