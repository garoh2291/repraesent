import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Eye,
  MoreHorizontal,
  MousePointerClick,
  Pause,
  Pencil,
  Play,
  Plus,
  Target,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import i18n from "~/i18n";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  isOpenaiAdsNotConnected,
  openaiEntityAction,
  updateOpenaiCampaignBudget,
  type OpenaiAd,
  type OpenaiAdGroup,
  type OpenaiCampaign,
  type OpenaiEntityAction,
  type OpenaiEntityKind,
} from "~/lib/api/openai-ads";
import {
  useCanManageOpenaiAds,
  useOpenaiAdGroups,
  useOpenaiAds,
  useOpenaiAdsConnection,
  useOpenaiCampaigns,
  useOpenaiInsights,
} from "~/lib/hooks/useOpenaiAds";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { OpenAiMark } from "~/components/icons/openai-mark";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import {
  formatCount,
  formatMicros,
  formatPercent,
  toMicros,
} from "~/components/openai-ads/micros";
import { OpenaiAdsOnboarding } from "~/components/openai-ads/openai-ads-onboarding";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

export function meta() {
  return [
    { title: `${i18n.t("openaiAds.metaTitle")} - Repraesent` },
    { name: "description", content: i18n.t("openaiAds.metaDescription") },
  ];
}

const RANGES = [7, 30, 90] as const;
type RangeDays = (typeof RANGES)[number];

const ACCENT = {
  spend: "#f59e0b",
  impressions: "#6366f1",
  clicks: "#10b981",
  conversions: "#ec4899",
};

const STATUS_STYLES: Record<string, string> = {
  active:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  paused:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  archived: "bg-muted text-muted-foreground border-border",
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        STATUS_STYLES[status] ?? STATUS_STYLES.archived
      }`}
    >
      {t(`openaiAds.status.${status}`, { defaultValue: status })}
    </span>
  );
}

export default function OpenaiAdsPage() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "openaiAds.metaTitle",
    descriptionKey: "openaiAds.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const connection = useOpenaiAdsConnection();

  if (connection.isPending) {
    return (
      <PageShell>
        <div className="space-y-4">
          <Skeleton className="h-[104px] w-full rounded-2xl" />
          <Skeleton className="h-[280px] w-full rounded-2xl" />
          <Skeleton className="h-[320px] w-full rounded-2xl" />
        </div>
      </PageShell>
    );
  }

  if (!connection.data?.connected) {
    return (
      <PageShell>
        {connection.data?.status === "revoked" ? <RevokedBanner /> : null}
        <OpenaiAdsOnboarding />
      </PageShell>
    );
  }

  return (
    <PageShell accountName={connection.data.ad_account_name}>
      <Dashboard currency={connection.data.currency ?? "EUR"} />
    </PageShell>
  );
}

function PageShell({
  children,
  accountName,
}: {
  children: React.ReactNode;
  accountName?: string | null;
}) {
  const { t } = useTranslation();
  const canManage = useCanManageOpenaiAds();

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 py-10! sm:space-y-8 sm:p-6 app-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <OpenAiMark className="h-5 w-5 text-muted-foreground" />
            {t("openaiAds.metaTitle", { defaultValue: "OpenAI Ads" })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {accountName
              ? t("openaiAds.accountSubtitle", {
                  defaultValue: "Connected account: {{name}}",
                  name: accountName,
                })
              : t("openaiAds.metaDescription", {
                  defaultValue:
                    "Campaigns, spend and conversions from your OpenAI Ads account.",
                })}
          </p>
        </div>
        {canManage && accountName !== undefined ? (
          <Button size="sm" asChild>
            <Link to="/openai-ads/new">
              <Plus className="mr-1.5 h-4 w-4" />
              {t("openaiAds.newCampaign", { defaultValue: "New campaign" })}
            </Link>
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function RevokedBanner() {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {t("openaiAds.revokedBanner", {
          defaultValue:
            "OpenAI rejected the stored API key. Reconnect with a fresh key from your Ads Manager.",
        })}{" "}
        <Link to="/settings/openai-ads" className="font-medium underline">
          {t("openaiAds.revokedBannerCta", { defaultValue: "Open settings" })}
        </Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function Dashboard({ currency }: { currency: string }) {
  const { t } = useTranslation();
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);

  const { since, until } = useMemo(() => {
    const now = new Date();
    return {
      since: format(subDays(now, rangeDays - 1), "yyyy-MM-dd"),
      until: format(now, "yyyy-MM-dd"),
    };
  }, [rangeDays]);

  const insights = useOpenaiInsights({
    level: "ad_account",
    since,
    until,
    granularity: "daily",
  });

  const summary = insights.data?.summary;

  // The chart spans the WHOLE selected range, Ads-Manager style: days without
  // delivery plot as zero instead of being skipped, so a 3-day-old campaign on
  // the 30-day view reads as a flat line with a spike — not a 3-point chart.
  const chartData = useMemo(() => {
    const byDate = new Map((insights.data?.rows ?? []).map((r) => [r.date, r]));
    const out: Array<{
      date: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
    }> = [];
    const start = new Date(since + "T00:00:00Z");
    const end = new Date(until + "T00:00:00Z");
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const row = byDate.get(key);
      out.push({
        date: key,
        spend: row ? row.spend_micros / 1_000_000 : 0,
        impressions: row?.impressions ?? 0,
        clicks: row?.clicks ?? 0,
        conversions: row?.conversions ?? 0,
      });
    }

    // Each line is normalized to its own maximum, Ads-Manager style: spend in
    // single currency units and impressions in the hundreds share one canvas,
    // so every series shows its own SHAPE. The tooltip reports true values.
    const max = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    for (const r of out) {
      max.spend = Math.max(max.spend, r.spend);
      max.impressions = Math.max(max.impressions, r.impressions);
      max.clicks = Math.max(max.clicks, r.clicks);
      max.conversions = Math.max(max.conversions, r.conversions);
    }
    return out.map((r) => ({
      ...r,
      spend_n: max.spend ? r.spend / max.spend : 0,
      impressions_n: max.impressions ? r.impressions / max.impressions : 0,
      clicks_n: max.clicks ? r.clicks / max.clicks : 0,
      conversions_n: max.conversions ? r.conversions / max.conversions : 0,
    }));
  }, [insights.data, since, until]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {RANGES.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setRangeDays(days)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                rangeDays === days
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("openaiAds.rangeDays", {
                defaultValue: "{{count}} days",
                count: days,
              })}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {since} — {until}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          icon={Wallet}
          label={t("openaiAds.metrics.spend", { defaultValue: "Spend" })}
          value={summary ? formatMicros(summary.spend_micros, currency) : null}
          pending={insights.isPending}
        />
        <Kpi
          icon={Eye}
          label={t("openaiAds.metrics.impressions", {
            defaultValue: "Impressions",
          })}
          value={summary ? formatCount(summary.impressions) : null}
          pending={insights.isPending}
        />
        <Kpi
          icon={MousePointerClick}
          label={t("openaiAds.metrics.clicks", { defaultValue: "Clicks" })}
          value={summary ? formatCount(summary.clicks) : null}
          pending={insights.isPending}
        />
        <Kpi
          label={t("openaiAds.metrics.ctr", { defaultValue: "CTR" })}
          value={summary ? formatPercent(summary.ctr) : null}
          pending={insights.isPending}
        />
        <Kpi
          label={t("openaiAds.metrics.cpc", { defaultValue: "CPC" })}
          value={summary ? formatMicros(summary.cpc_micros, currency) : null}
          pending={insights.isPending}
        />
        <Kpi
          icon={Target}
          label={t("openaiAds.metrics.conversions", {
            defaultValue: "Conversions",
          })}
          value={summary ? formatCount(summary.conversions) : null}
          pending={insights.isPending}
        />
      </div>

      {/* Performance trend */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("openaiAds.performanceTrend", {
            defaultValue: "Performance trend",
          })}
        </p>
        {insights.isPending ? (
          <Skeleton className="h-[220px] w-full rounded-xl" />
        ) : (
          <div className="h-[220px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
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
                  tickFormatter={(v: string) => v.slice(5)}
                  interval="preserveStartEnd"
                />
                <Tooltip content={<TrendTooltip currency={currency} />} />
                <Legend
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="spend_n"
                  name={t("openaiAds.metrics.spend", { defaultValue: "Spend" })}
                  stroke={ACCENT.spend}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="impressions_n"
                  name={t("openaiAds.metrics.impressions", {
                    defaultValue: "Impressions",
                  })}
                  stroke={ACCENT.impressions}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="clicks_n"
                  name={t("openaiAds.metrics.clicks", {
                    defaultValue: "Clicks",
                  })}
                  stroke={ACCENT.clicks}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="conversions_n"
                  name={t("openaiAds.metrics.conversions", {
                    defaultValue: "Conversions",
                  })}
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

      <CampaignsTable since={since} until={until} currency={currency} />
    </>
  );
}

/**
 * True values for the normalized trend lines: the plotted series are each
 * scaled to their own maximum, so the tooltip reads from the row's raw fields
 * instead of the plotted numbers.
 */
function TrendTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name: string; color: string; dataKey: string }>;
  label?: string;
  currency: string;
}) {
  const raw = (
    payload?.[0] as unknown as
      | {
          payload: {
            spend: number;
            impressions: number;
            clicks: number;
            conversions: number;
          };
        }
      | undefined
  )?.payload;
  if (!active || !payload?.length || !raw) return null;

  const value = (dataKey: string) => {
    if (dataKey === "spend_n")
      return formatMicros(raw.spend * 1_000_000, currency);
    if (dataKey === "impressions_n") return raw.impressions.toLocaleString();
    if (dataKey === "clicks_n") return raw.clicks.toLocaleString();
    return raw.conversions.toLocaleString();
  };

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-[13px] shadow-lg">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums text-foreground">
            {value(p.dataKey)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  pending,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  pending: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </p>
      {pending ? (
        <Skeleton className="mt-2 h-7 w-20 rounded" />
      ) : (
        <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
          {value ?? "—"}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaigns table with drill-down
// ---------------------------------------------------------------------------

function CampaignsTable({
  since,
  until,
  currency,
}: {
  since: string;
  until: string;
  currency: string;
}) {
  const { t } = useTranslation();
  const canManage = useCanManageOpenaiAds();
  const campaigns = useOpenaiCampaigns();
  const { ref: searchRef, withHint } = useSearchShortcut();

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [budgetEdit, setBudgetEdit] = useState<OpenaiCampaign | null>(null);
  const [pendingArchive, setPendingArchive] = useState<{
    kind: OpenaiEntityKind;
    id: string;
    name: string;
  } | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = campaigns.data?.data ?? [];
    if (!needle) return list;
    return list.filter((c) => c.name.toLowerCase().includes(needle));
  }, [campaigns.data, search]);

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("openaiAds.campaignsTitle", { defaultValue: "Campaigns" })}
        </p>
        <Input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={withHint(
            t("openaiAds.searchPlaceholder", {
              defaultValue: "Search campaigns…",
            }),
          )}
          className="h-8 w-full sm:w-64"
        />
      </div>

      {campaigns.data?.truncated ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {t("openaiAds.truncated", {
            defaultValue:
              "This account has more campaigns than can be listed at once — showing the first pages.",
          })}
        </p>
      ) : null}

      {campaigns.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : !filtered.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {search
            ? t("openaiAds.noSearchResults", {
                defaultValue: "No campaigns match this search.",
              })
            : t("openaiAds.noCampaigns", {
                defaultValue:
                  "No campaigns yet. Create your first one to start serving ads.",
              })}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="w-8 pb-2" />
                <th className="pb-2 font-medium">
                  {t("openaiAds.table.name", { defaultValue: "Campaign" })}
                </th>
                <th className="pb-2 font-medium">
                  {t("openaiAds.table.status", { defaultValue: "Status" })}
                </th>
                <th className="pb-2 font-medium">
                  {t("openaiAds.table.bidding", { defaultValue: "Bidding" })}
                </th>
                <th className="pb-2 text-right font-medium">
                  {t("openaiAds.table.budget", {
                    defaultValue: "Lifetime budget",
                  })}
                </th>
                <th className="pb-2 text-right font-medium">
                  {t("openaiAds.metrics.spend", { defaultValue: "Spend" })}
                </th>
                <th className="pb-2 text-right font-medium">
                  {t("openaiAds.metrics.conversions", {
                    defaultValue: "Conversions",
                  })}
                </th>
                <th className="w-10 pb-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((campaign) => (
                <CampaignRow
                  currency={currency}
                  key={campaign.id}
                  campaign={campaign}
                  since={since}
                  until={until}
                  canManage={canManage}
                  expanded={expanded === campaign.id}
                  onToggle={() =>
                    setExpanded(expanded === campaign.id ? null : campaign.id)
                  }
                  onEditBudget={() => setBudgetEdit(campaign)}
                  onArchive={() =>
                    setPendingArchive({
                      kind: "campaigns",
                      id: campaign.id,
                      name: campaign.name,
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BudgetDialog
        campaign={budgetEdit}
        currency={currency}
        onClose={() => setBudgetEdit(null)}
      />
      <ArchiveDialog
        pending={pendingArchive}
        onClose={() => setPendingArchive(null)}
      />
    </div>
  );
}

function useEntityActionMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      kind,
      id,
      action,
    }: {
      kind: OpenaiEntityKind;
      id: string;
      action: OpenaiEntityAction;
    }) => openaiEntityAction(kind, id, action),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("openai-ads"),
      });
      toast.success(
        t(`openaiAds.actions.${vars.action}Done`, {
          defaultValue:
            vars.action === "activate"
              ? "Activated"
              : vars.action === "pause"
                ? "Paused"
                : "Archived",
        }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}

function EntityActionsMenu({
  kind,
  id,
  status,
  onEditBudget,
  onArchive,
}: {
  kind: OpenaiEntityKind;
  id: string;
  status: string;
  onEditBudget?: () => void;
  onArchive: () => void;
}) {
  const { t } = useTranslation();
  const actionMutation = useEntityActionMutation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={t("openaiAds.actions.menu", { defaultValue: "Actions" })}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status !== "active" ? (
          <DropdownMenuItem
            disabled={actionMutation.isPending}
            onClick={() =>
              actionMutation.mutate({ kind, id, action: "activate" })
            }
          >
            <Play className="mr-2 h-4 w-4" />
            {t("openaiAds.actions.activate", { defaultValue: "Activate" })}
          </DropdownMenuItem>
        ) : null}
        {status === "active" ? (
          <DropdownMenuItem
            disabled={actionMutation.isPending}
            onClick={() => actionMutation.mutate({ kind, id, action: "pause" })}
          >
            <Pause className="mr-2 h-4 w-4" />
            {t("openaiAds.actions.pause", { defaultValue: "Pause" })}
          </DropdownMenuItem>
        ) : null}
        {onEditBudget ? (
          <DropdownMenuItem onClick={onEditBudget}>
            <Pencil className="mr-2 h-4 w-4" />
            {t("openaiAds.actions.editBudget", { defaultValue: "Edit budget" })}
          </DropdownMenuItem>
        ) : null}
        {status !== "archived" ? (
          <DropdownMenuItem variant="destructive" onClick={onArchive}>
            <Archive className="mr-2 h-4 w-4" />
            {t("openaiAds.actions.archive", { defaultValue: "Archive" })}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CampaignRow({
  campaign,
  currency,
  since,
  until,
  canManage,
  expanded,
  onToggle,
  onEditBudget,
  onArchive,
}: {
  campaign: OpenaiCampaign;
  currency: string;
  since: string;
  until: string;
  canManage: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEditBudget: () => void;
  onArchive: () => void;
}) {
  const { t } = useTranslation();
  const insights = useOpenaiInsights(
    {
      level: "campaign",
      entity_id: campaign.id,
      since,
      until,
      granularity: "none",
    },
    // Metric fan-out is deliberate but bounded: one summary call per visible
    // campaign row, cached 60 s server-side.
    true,
  );
  const summary = insights.data?.summary;

  return (
    <>
      <tr className="border-b border-border/60 last:border-0">
        <td className="py-2.5 align-middle">
          <button
            type="button"
            onClick={onToggle}
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted"
            aria-label={t("openaiAds.table.expand", {
              defaultValue: "Show ad groups",
            })}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </td>
        <td className="max-w-[280px] truncate py-2.5 pr-3 font-medium text-foreground">
          {campaign.name}
        </td>
        <td className="py-2.5 pr-3">
          <StatusBadge status={campaign.status} />
        </td>
        <td className="py-2.5 pr-3 text-xs text-muted-foreground">
          {campaign.bidding_type
            ? t(`openaiAds.bidding.${campaign.bidding_type}`, {
                defaultValue: campaign.bidding_type,
              })
            : "—"}
        </td>
        <td className="py-2.5 pr-3 text-right tabular-nums">
          {campaign.budget?.lifetime_spend_limit_micros != null
            ? formatMicros(
                campaign.budget.lifetime_spend_limit_micros,
                currency,
              )
            : campaign.budget?.daily_spend_limit_micros != null
              ? `${formatMicros(campaign.budget.daily_spend_limit_micros, currency)}${t(
                  "openaiAds.perDay",
                  { defaultValue: "/day" },
                )}`
              : "—"}
        </td>
        <td className="py-2.5 pr-3 text-right tabular-nums">
          {insights.isPending ? (
            <Skeleton className="ml-auto h-4 w-14 rounded" />
          ) : (
            formatMicros(summary?.spend_micros, currency)
          )}
        </td>
        <td className="py-2.5 pr-3 text-right tabular-nums">
          {insights.isPending ? (
            <Skeleton className="ml-auto h-4 w-8 rounded" />
          ) : (
            formatCount(summary?.conversions)
          )}
        </td>
        <td className="py-2.5 text-right">
          {canManage ? (
            <EntityActionsMenu
              kind="campaigns"
              id={campaign.id}
              status={campaign.status}
              onEditBudget={onEditBudget}
              onArchive={onArchive}
            />
          ) : null}
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-border/60 last:border-0">
          <td colSpan={8} className="bg-muted/30 px-3 py-3 sm:px-6">
            <AdGroups
              campaignId={campaign.id}
              currency={currency}
              canManage={canManage}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function AdGroups({
  campaignId,
  currency,
  canManage,
}: {
  campaignId: string;
  currency: string;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const adGroups = useOpenaiAdGroups(campaignId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<{
    kind: OpenaiEntityKind;
    id: string;
    name: string;
  } | null>(null);

  if (adGroups.isPending) {
    return <Skeleton className="h-10 w-full rounded-lg" />;
  }
  if (!adGroups.data?.data.length) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("openaiAds.noAdGroups", {
          defaultValue: "No ad groups in this campaign yet.",
        })}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {adGroups.data.data.map((group) => (
        <AdGroupRow
          currency={currency}
          key={group.id}
          group={group}
          canManage={canManage}
          expanded={expanded === group.id}
          onToggle={() => setExpanded(expanded === group.id ? null : group.id)}
          onArchive={() =>
            setPendingArchive({
              kind: "ad-groups",
              id: group.id,
              name: group.name,
            })
          }
        />
      ))}
      <ArchiveDialog
        pending={pendingArchive}
        onClose={() => setPendingArchive(null)}
      />
    </div>
  );
}

function AdGroupRow({
  group,
  currency,
  canManage,
  expanded,
  onToggle,
  onArchive,
}: {
  group: OpenaiAdGroup;
  currency: string;
  canManage: boolean;
  expanded: boolean;
  onToggle: () => void;
  onArchive: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border/60 bg-card">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted"
          aria-label={t("openaiAds.table.expandAds", {
            defaultValue: "Show ads",
          })}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {group.name}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {group.bidding_config?.billing_event_type
            ? t(
                `openaiAds.billing.${group.bidding_config.billing_event_type}`,
                {
                  defaultValue: group.bidding_config.billing_event_type,
                },
              )
            : null}
          {group.bidding_config?.max_bid_micros
            ? ` · ${t("openaiAds.maxBid", { defaultValue: "max bid" })} ${formatMicros(group.bidding_config.max_bid_micros, currency)}`
            : null}
        </span>
        <StatusBadge status={group.status} />
        {canManage ? (
          <EntityActionsMenu
            kind="ad-groups"
            id={group.id}
            status={group.status}
            onArchive={onArchive}
          />
        ) : null}
      </div>
      {expanded ? (
        <div className="border-t border-border/60 px-3 py-2.5">
          <Ads adGroupId={group.id} canManage={canManage} />
        </div>
      ) : null}
    </div>
  );
}

function Ads({
  adGroupId,
  canManage,
}: {
  adGroupId: string;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const ads = useOpenaiAds(adGroupId);
  const [pendingArchive, setPendingArchive] = useState<{
    kind: OpenaiEntityKind;
    id: string;
    name: string;
  } | null>(null);

  if (ads.isPending) return <Skeleton className="h-9 w-full rounded-lg" />;
  if (!ads.data?.data.length) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("openaiAds.noAds", {
          defaultValue: "No ads in this ad group yet.",
        })}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {ads.data.data.map((ad) => (
        <AdLine
          key={ad.id}
          ad={ad}
          canManage={canManage}
          onArchive={() =>
            setPendingArchive({ kind: "ads", id: ad.id, name: ad.name })
          }
        />
      ))}
      <ArchiveDialog
        pending={pendingArchive}
        onClose={() => setPendingArchive(null)}
      />
    </div>
  );
}

function AdLine({
  ad,
  canManage,
  onArchive,
}: {
  ad: OpenaiAd;
  canManage: boolean;
  onArchive: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 rounded-md px-1 py-1">
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {ad.creative?.title ?? ad.name}
        {ad.creative?.body ? (
          <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
            {ad.creative.body}
          </span>
        ) : null}
      </span>
      {ad.review_status && ad.review_status !== "approved" ? (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
            ad.review_status === "rejected"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400"
          }`}
        >
          {t(`openaiAds.review.${ad.review_status}`, {
            defaultValue: ad.review_status,
          })}
        </span>
      ) : null}
      <StatusBadge status={ad.status} />
      {canManage ? (
        <EntityActionsMenu
          kind="ads"
          id={ad.id}
          status={ad.status}
          onArchive={onArchive}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

function BudgetDialog({
  campaign,
  currency,
  onClose,
}: {
  campaign: OpenaiCampaign | null;
  currency: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");

  const mutation = useMutation({
    mutationFn: ({ id, micros }: { id: string; micros: number }) =>
      updateOpenaiCampaignBudget(id, micros),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("openai-ads"),
      });
      toast.success(
        t("openaiAds.budgetUpdated", { defaultValue: "Budget updated" }),
      );
      onClose();
      setValue("");
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const micros = toMicros(value);
  const current = campaign?.budget?.lifetime_spend_limit_micros;

  return (
    <Dialog open={!!campaign} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("openaiAds.editBudgetTitle", {
              defaultValue: "Edit lifetime budget",
            })}
          </DialogTitle>
          <DialogDescription>
            {t("openaiAds.editBudgetDescription", {
              defaultValue:
                "The total this campaign may spend over its lifetime. Current: {{current}}",
              current: formatMicros(current, currency),
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="budget-amount">
            {t("openaiAds.budgetLabel", { defaultValue: "Amount" })}
          </Label>
          <Input
            id="budget-amount"
            inputMode="decimal"
            value={value}
            placeholder="500"
            onChange={(e) => setValue(e.target.value)}
          />
          {value && (micros == null || micros < 1_000_000) ? (
            <p className="text-xs text-destructive">
              {t("openaiAds.budgetInvalid", {
                defaultValue: "Enter an amount of at least 1.",
              })}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            disabled={
              mutation.isPending || micros == null || micros < 1_000_000
            }
            onClick={() => {
              if (campaign && micros != null) {
                mutation.mutate({ id: campaign.id, micros });
              }
            }}
          >
            {mutation.isPending
              ? t("common.loading", { defaultValue: "Loading…" })
              : t("common.save", { defaultValue: "Save" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveDialog({
  pending,
  onClose,
}: {
  pending: { kind: OpenaiEntityKind; id: string; name: string } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const actionMutation = useEntityActionMutation();

  return (
    <AlertDialog open={!!pending} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("openaiAds.archiveTitle", {
              defaultValue: "Archive “{{name}}”?",
              name: pending?.name ?? "",
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("openaiAds.archiveDescription", {
              defaultValue:
                "Archived items stop serving and cannot be reactivated from here.",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={actionMutation.isPending}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={actionMutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              if (!pending) return;
              actionMutation.mutate(
                { kind: pending.kind, id: pending.id, action: "archive" },
                { onSuccess: onClose },
              );
            }}
          >
            {actionMutation.isPending
              ? t("common.loading", { defaultValue: "Loading…" })
              : t("openaiAds.actions.archive", { defaultValue: "Archive" })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
