import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useSearchParams } from "react-router";
import { ChevronDown, Search, X } from "lucide-react";
import { useDebounce } from "~/lib/hooks/useDebounce";
import {
  getBrandWorkspacesOverview,
  getBrandServices,
  type BrandWorkspaceOverviewItem,
  type BrandWorkspaceMemberItem,
} from "~/lib/api/brand";
import { FilterComponent } from "~/components/molecule/filter-component";
import { cn } from "~/lib/utils";
import TooltipContainer from "~/components/tooltip-container";

export function meta() {
  return [{ title: "Workspaces – Repraesent" }];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOnline(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 5 * 60 * 1000;
}

function localizeServiceName(
  service: {
    service_name: string;
    service_name_en?: string | null;
    service_name_de?: string | null;
  },
  lang: string
): string {
  const isDe = lang?.startsWith("de");
  if (isDe)
    return (
      service.service_name_de ?? service.service_name_en ?? service.service_name
    );
  return (
    service.service_name_en ?? service.service_name_de ?? service.service_name
  );
}

function localizeFilterName(
  service: { name: string; name_en?: string | null; name_de?: string | null },
  lang: string
): string {
  const isDe = lang?.startsWith("de");
  if (isDe) return service.name_de ?? service.name_en ?? service.name;
  return service.name_en ?? service.name_de ?? service.name;
}

function formatRelative(iso: string | null | undefined, t: TFunction): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("brand.wsJustNow");
  if (mins < 60) return t("brand.wsMinutesAgo", { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("brand.wsHoursAgo", { count: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 30) return t("brand.wsDaysAgo", { count: days });
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFormName(formName: string, t: TFunction): string {
  if (formName === "appointment_booking") {
    return t("brand.wsAppointmentBookings");
  }
  return formName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function roleOrder(role: string) {
  return role === "admin" ? 0 : role === "editor" ? 1 : 2;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  canceled: "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
  waiting_for_payment:
    "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20",
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  active: "brand.wsStatusActive",
  pending: "brand.wsStatusPendingSetup",
  canceled: "brand.wsStatusCanceled",
  waiting_for_payment: "brand.wsStatusAwaitingPayment",
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cls =
    STATUS_STYLES[status] ?? "bg-white/5 text-white/30 ring-1 ring-white/10";
  const label = STATUS_LABEL_KEYS[status]
    ? t(STATUS_LABEL_KEYS[status])
    : status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0",
        cls
      )}
    >
      {label}
    </span>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_LABEL_KEYS: Record<string, string> = {
  admin: "brand.wsRoleAdmin",
  editor: "brand.wsRoleEditor",
  viewer: "brand.wsRoleViewer",
};

// ── Product pill (light panel) ────────────────────────────────────────────────

const PRODUCT_STYLES: Record<string, string> = {
  "lead-form": "bg-amber-100 text-amber-700 ring-1 ring-amber-200/80",
  appointments: "bg-violet-100 text-violet-700 ring-1 ring-violet-200/80",
  "email-config": "bg-sky-100 text-sky-700 ring-1 ring-sky-200/80",
};

// ── Role badge (light panel) ──────────────────────────────────────────────────

const ROLE_STYLES_LIGHT: Record<string, string> = {
  admin: "bg-amber-100 text-amber-700",
  editor: "bg-sky-100 text-sky-700",
  viewer: "bg-slate-100 text-slate-500",
};

// ── Expanded panel ────────────────────────────────────────────────────────────

function ExpandedPanel({
  ws,
  globalMaxLeads,
}: {
  ws: BrandWorkspaceOverviewItem;
  globalMaxLeads: number;
}) {
  const { t, i18n } = useTranslation();

  const sortedMembers = [...ws.members].sort(
    (a, b) => roleOrder(a.role) - roleOrder(b.role)
  );

  const sortedLeads = [...ws.leads_by_form].sort((a, b) => b.count - a.count);
  const maxLeads = globalMaxLeads;

  return (
    <div className="border-t border-slate-200/60 bg-[#f5f4f1]">
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/70">
        {/* Products */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {t("brand.wsProducts", "Products")}
          </p>
          {ws.services.length === 0 ? (
            <p className="text-xs text-slate-400">
              {t("brand.wsNoProducts", "No products activated")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {ws.services.map((svc) => {
                const cls =
                  PRODUCT_STYLES[svc.service_type ?? ""] ??
                  "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80";
                return (
                  <span
                    key={svc.service_id}
                    className={cn(
                      "inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-medium",
                      cls
                    )}
                  >
                    {localizeServiceName(svc, i18n.language)}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Lead Sources */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {t("brand.wsLeadSources", "Lead Sources")}
          </p>
          {sortedLeads.length === 0 ? (
            <p className="text-xs text-slate-400">
              {t("brand.wsNoLeads", "No leads recorded yet")}
            </p>
          ) : (
            <div className="space-y-2.5">
              {sortedLeads.map((lf) => (
                <div key={lf.form_name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-600 truncate pr-3">
                      {formatFormName(lf.form_name, t)}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-800 tabular-nums shrink-0">
                      {lf.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-[3px] w-full rounded-full bg-black/8 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500/70 transition-all duration-500"
                      style={{ width: `${(lf.count / maxLeads) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Members */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {t("brand.wsTeam", "Team Members")} ({ws.members.length})
          </p>
          {sortedMembers.length === 0 ? (
            <p className="text-xs text-slate-400">
              {t("brand.wsNoMembersAssigned")}
            </p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {sortedMembers.map((m) => (
                <MemberRow key={m.user_id} member={m} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: BrandWorkspaceMemberItem }) {
  const { t } = useTranslation();
  const online = isOnline(member.last_activity_at);
  const name =
    [member.user_first_name, member.user_last_name].filter(Boolean).join(" ") ||
    member.user_email;
  const roleCls =
    ROLE_STYLES_LIGHT[member.role] ?? "bg-slate-100 text-slate-500";
  const roleLabel = ROLE_LABEL_KEYS[member.role]
    ? t(ROLE_LABEL_KEYS[member.role])
    : member.role;

  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      {/* Online indicator */}
      <div className="shrink-0 w-4 flex items-center justify-center">
        {online ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        )}
      </div>

      {/* Role */}
      <span
        className={cn(
          "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest",
          roleCls
        )}
      >
        {roleLabel}
      </span>

      {/* Name */}
      <span
        className="flex-1 truncate text-slate-700"
        title={member.user_email}
      >
        {name}
      </span>

      {/* Activity */}
      <span
        className={cn(
          "shrink-0 tabular-nums",
          online ? "text-emerald-600 font-medium" : "text-slate-400"
        )}
      >
        {online
          ? t("brand.wsOnline")
          : formatRelative(member.last_activity_at, t)}
      </span>
    </div>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[1fr_130px_80px_40px] lg:grid-cols-[1fr_180px_140px_80px_40px] gap-x-6 items-center border-b border-white/6 px-5 py-4 animate-pulse">
      <div className="flex items-center gap-2 pr-4">
        <div className="h-4 w-36 rounded-md bg-black/8" />
        <div className="h-5 w-16 rounded-md bg-black/5" />
      </div>
      <div className="hidden lg:flex gap-1">
        <div className="h-5 w-16 rounded-md bg-black/6" />
        <div className="h-5 w-20 rounded-md bg-black/5" />
      </div>
      <div className="h-3 w-14 rounded bg-black/6" />
      <div className="h-3 w-6 rounded bg-black/6 ml-auto" />
      <div className="h-4 w-4 rounded bg-black/5 ml-auto" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BrandWorkspaces() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const debouncedSearch = useDebounce(searchInput, 400);

  // Read active service filter from URL (FilterComponent writes it automatically)
  const serviceIdParam = searchParams.get("service_id") ?? undefined;

  // Reset page when URL-driven filters change
  const urlPage = Number(searchParams.get("page") ?? 1);
  const effectivePage = urlPage > 0 ? urlPage : page;

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ["brand-services"],
    queryFn: getBrandServices,
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "brand-workspaces-overview",
      effectivePage,
      debouncedSearch,
      serviceIdParam,
    ],
    queryFn: () =>
      getBrandWorkspacesOverview({
        search: debouncedSearch || undefined,
        page: effectivePage,
        limit: 20,
        service_id: serviceIdParam,
      }),
    staleTime: 0,
  });

  const workspaces = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  // Global max lead count across all workspaces' form names — bars are relative to this
  const globalMaxLeads = Math.max(
    ...workspaces.flatMap((ws) => ws.leads_by_form.map((lf) => lf.count)),
    1
  );

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSearch = (val: string) => {
    setSearchInput(val);
    setPage(1);
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 py-10! space-y-6 sm:space-y-8 app-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
            {t("brand.workspacesTitle", "Workspaces")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total > 0
              ? t("brand.wsWorkspacesCount", { count: total })
              : t("brand.workspacesSubtitle")}
          </p>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder={t("brand.wsSearchPlaceholder", "Search workspaces…")}
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-card pl-9 pr-8 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            {searchInput && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <FilterComponent
            additionalFilters={[
              {
                name: "products",
                paramKey: "service_id",
                options: (servicesData ?? []).map((s) => ({
                  key: s.id,
                  label: localizeFilterName(s, i18n.language),
                })),
                isLoading: servicesLoading,
              },
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden border border-border shadow-sm">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_130px_80px_40px] lg:grid-cols-[1fr_180px_140px_80px_40px] gap-x-6 items-center bg-[#dddbd7] border-b border-[#cccac6] px-5 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {t("brand.wsColWorkspace", "Partner House")}
          </span>
          <span className="hidden lg:block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {t("brand.wsColProducts", "Products")}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {t("brand.wsColRecentActivity", "Recent Activity")}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground text-right">
            {t("brand.wsColLeads", "Leads")}
          </span>
          <span />
        </div>

        {/* Rows */}
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : workspaces.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            {debouncedSearch
              ? t("brand.wsNoWorkspacesSearch")
              : t("brand.wsNoWorkspaces")}
          </div>
        ) : (
          workspaces.map((ws) => {
            const isExpanded = expandedRows.has(ws.id);
            return (
              <div
                key={ws.id}
                className="border-b border-white/6 last:border-0"
              >
                {/* Collapsed row */}
                <button
                  type="button"
                  onClick={() => toggleRow(ws.id)}
                  className={cn(
                    "w-full grid grid-cols-[1fr_130px_80px_40px] lg:grid-cols-[1fr_180px_140px_80px_40px] gap-x-6 items-center px-5 py-3.5 text-left transition-colors duration-100",
                    isExpanded
                      ? "bg-[#e3e1dd]"
                      : "bg-[#eceae6] hover:bg-[#e7e5e1]"
                  )}
                >
                  {/* Name + status */}
                  <div className="min-w-0 pr-3 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {ws.name}
                    </span>
                    <StatusBadge status={ws.status} />
                  </div>

                  {/* Products (lg+) */}
                  <div className="hidden lg:flex items-center gap-1 flex-wrap pr-2">
                    {ws.services.slice(0, 2).map((s) => {
                      const cls =
                        PRODUCT_STYLES[s.service_type ?? ""] ??
                        "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80";
                      return (
                        <span
                          key={s.service_id}
                          className={cn(
                            "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
                            cls
                          )}
                        >
                          {localizeServiceName(s, i18n.language)}
                        </span>
                      );
                    })}
                    {ws.services.length > 2 && (
                      <TooltipContainer
                        tooltipContent={ws.services
                          .slice(2)
                          .map((s) => localizeServiceName(s, i18n.language))
                          .join(", ")}
                        showCopyButton={false}
                      >
                        <span className="text-[10px] text-slate-400 font-medium">
                          +{ws.services.length - 2}
                        </span>
                      </TooltipContainer>
                    )}
                  </div>

                  {/* Recent activity */}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatRelative(ws.last_activity_at, t)}
                  </span>

                  {/* Leads count */}
                  <span className="text-sm font-semibold text-foreground tabular-nums text-right">
                    {ws.leads_count.toLocaleString()}
                  </span>

                  {/* Chevron */}
                  <div className="flex items-center justify-center">
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground/50 transition-transform duration-200",
                        isExpanded && "rotate-180 text-amber-400"
                      )}
                    />
                  </div>
                </button>

                {/* Expanded panel — CSS grid-rows animation, no JS height needed */}
                <div
                  style={{
                    gridTemplateRows: isExpanded ? "1fr" : "0fr",
                  }}
                  className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                >
                  <div className="overflow-hidden">
                    <ExpandedPanel ws={ws} globalMaxLeads={globalMaxLeads} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t("brand.wsPaginationPage", { page, total: totalPages })}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
            >
              {t("brand.wsPrevPage")}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
            >
              {t("brand.wsNextPage")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
