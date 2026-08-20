import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Activity,
  CalendarClock,
  ChevronDown,
  FileDown,
  Loader2,
  Store,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { formatNumber, getIntlLocale } from "~/lib/utils/format";
import { CampaignDatePicker } from "~/components/campaigns/campaign-date-picker";
import type { DateRange } from "~/lib/api/campaigns";
import {
  getBrandActivity,
  exportBrandActivityXlsx,
  type BrandActivityHouse,
} from "~/lib/api/brand";
import { useAuthContext } from "~/providers/auth-provider";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

export function meta() {
  return [
    {
      title:
        i18n.t("brandActivity.title", "Partner House Activity") +
        " – Repraesent",
    },
  ];
}

// Same floor as the campaign dashboard's "All time" preset.
function defaultRange(): DateRange {
  const t = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    startDate: "2020-01-01",
    endDate: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`,
  };
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0",
        isActive
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

function TileSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="animate-pulse rounded-md bg-muted h-3 w-20" />
      <div className="animate-pulse rounded-md bg-muted h-8 w-16" />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
      <div className="animate-pulse rounded-md bg-muted h-5 w-48" />
      <div className="animate-pulse rounded-md bg-muted h-3 w-64" />
    </div>
  );
}

function HouseCard({
  house,
  index,
  expanded,
  onToggle,
  fmtDateTime,
}: {
  house: BrandActivityHouse;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  fmtDateTime: (iso: string | null) => string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="app-fade-up rounded-2xl border border-border bg-card overflow-hidden"
      style={{ animationDelay: `${0.04 + index * 0.03}s` }}
    >
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 sm:p-5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
          <Store className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-sm font-semibold text-foreground">
              {house.name}
            </span>
            <StatusBadge status={house.status} />
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {t("brandActivity.activeOf", {
              active: house.activeUsers,
              total: house.users,
            })}
            {house.lastSeen && (
              <span className="hidden sm:inline">
                {" · "}
                {t("brandActivity.colLastSeen")}: {fmtDateTime(house.lastSeen)}
              </span>
            )}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6 shrink-0 tabular-nums">
          <div className="text-right">
            <div className="text-sm font-bold text-foreground">
              {formatNumber(house.sessions)}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("brandActivity.colSessions")}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-foreground">
              {formatNumber(house.activeDays)}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("brandActivity.colActiveDays")}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-foreground">
              {formatNumber(house.requests)}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("brandActivity.colRequests")}
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-border overflow-x-auto">
          {house.members.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {t("brandActivity.noMembers")}
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 sm:px-5 py-2.5 font-semibold">
                    {t("brandActivity.colUser")}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">
                    {t("brandActivity.colRole")}
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-right">
                    {t("brandActivity.colSessions")}
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-right">
                    {t("brandActivity.colActiveDays")}
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-right">
                    {t("brandActivity.colRequests")}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">
                    {t("brandActivity.colFirstSeen")}
                  </th>
                  <th className="px-4 sm:px-5 py-2.5 font-semibold">
                    {t("brandActivity.colLastSeen")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {house.members.map((m) => {
                  const name = [m.first_name, m.last_name]
                    .filter(Boolean)
                    .join(" ");
                  const inactive = m.sessions === 0;
                  return (
                    <tr
                      key={m.user_id}
                      className={cn(
                        "border-t border-border/60",
                        inactive && "text-muted-foreground",
                      )}
                    >
                      <td className="px-4 sm:px-5 py-2.5">
                        <div className="font-medium text-foreground truncate max-w-[260px]">
                          {m.email}
                        </div>
                        {name && (
                          <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                            {name}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 capitalize">{m.role}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatNumber(m.sessions)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatNumber(m.active_days)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatNumber(m.requests)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                        {fmtDateTime(m.first_seen)}
                      </td>
                      <td className="px-4 sm:px-5 py-2.5 whitespace-nowrap text-xs">
                        {fmtDateTime(m.last_seen)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function BrandActivityPage() {
  const { t, i18n: i18next } = useTranslation();
  useDocumentMeta({
    titleKey: "brandActivity.title",
    titleSuffix: " – Repraesent",
  });
  const { brand } = useAuthContext();
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["brand-activity", dateRange.startDate, dateRange.endDate],
    queryFn: () =>
      getBrandActivity({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      }),
  });

  const dtf = useMemo(
    () =>
      new Intl.DateTimeFormat(getIntlLocale(), {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    // Recompute when the UI language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18next.language],
  );
  const fmtDateTime = (iso: string | null) =>
    iso ? dtf.format(new Date(iso)) : t("brandActivity.never");

  const toggleHouse = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportBrandActivityXlsx(
        { start_date: dateRange.startDate, end_date: dateRange.endDate },
        brand?.name ?? "brand",
      );
    } catch {
      toast.error(t("brandActivity.exportError"));
    } finally {
      setIsExporting(false);
    }
  };

  const tiles = [
    { key: "statHouses", icon: Store, value: data?.totals.houses },
    { key: "statUsers", icon: Users, value: data?.totals.users },
    { key: "statActiveUsers", icon: UserCheck, value: data?.totals.activeUsers },
    { key: "statSessions", icon: Zap, value: data?.totals.sessions },
    { key: "statRequests", icon: CalendarClock, value: data?.totals.requests },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 py-10! space-y-6 sm:space-y-8 app-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Activity className="h-3 w-3" />
            {t("brand.navActivity")}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {t("brandActivity.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("brandActivity.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CampaignDatePicker value={dateRange} onChange={setDateRange} />
          <button
            onClick={handleExport}
            disabled={isExporting || isLoading}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-1.5",
              "text-xs font-semibold text-primary-foreground shadow-sm",
              "hover:bg-primary/90 transition-colors",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            )}
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            {isExporting
              ? t("brandActivity.exporting")
              : t("brandActivity.export")}
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <TileSkeleton key={i} />)
          : tiles.map(({ key, icon: Icon, value }) => (
              <div
                key={key}
                className="rounded-xl border border-border bg-muted/30 p-4"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  {t(`brandActivity.${key}`)}
                </div>
                <div className="mt-2 text-3xl font-bold tracking-tight text-foreground tabular-nums">
                  {formatNumber(value ?? 0)}
                </div>
              </div>
            ))}
      </div>

      {/* Houses */}
      {isLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {t("brandActivity.exportError")}
          </p>
        </div>
      ) : !data || data.houses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 sm:p-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
            <Store className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">
            {t("brandActivity.empty")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("brandActivity.emptyDesc")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.houses.map((house, i) => (
            <HouseCard
              key={house.id}
              house={house}
              index={i}
              expanded={expandedIds.has(house.id)}
              onToggle={() => toggleHouse(house.id)}
              fmtDateTime={fmtDateTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}
