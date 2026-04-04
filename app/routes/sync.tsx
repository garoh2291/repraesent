import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Megaphone,
  Users,
  FileText,
  Sparkles,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getHistoricalData,
  getHistoricalCampaigns,
  getHistoricalLeadsPreview,
  getHistoricalUsers,
  updateHistoricalData,
} from "~/lib/api/historical-data";

export function meta() {
  return [
    { title: "Data Migration - Repraesent" },
    { name: "description", content: "Sync your Doorboost historical data" },
  ];
}

/* ─── Step Indicator ─── */

const STEPS = [
  { key: "campaigns", icon: Megaphone },
  { key: "leads", icon: FileText },
  { key: "users", icon: Users },
] as const;

function StepIndicator({ current }: { current: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
      {STEPS.map((step, i) => {
        const StepIcon = step.icon;
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.key} className="flex items-center gap-1 sm:gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-8 sm:w-12 transition-colors duration-300",
                  done ? "bg-amber-500" : "bg-border",
                )}
              />
            )}
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all duration-300",
                active
                  ? "bg-amber-500/10 border border-amber-500/20"
                  : done
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : "bg-muted/50 border border-transparent",
              )}
            >
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold",
                  active
                    ? "bg-amber-500/20 text-amber-500"
                    : done
                      ? "bg-emerald-500/20 text-emerald-500"
                      : "bg-muted text-muted-foreground/50",
                )}
              >
                {done ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <StepIcon className="h-3 w-3" />
                )}
              </div>
              <span
                className={cn(
                  "hidden sm:inline text-[11px] font-semibold tracking-wide uppercase",
                  active
                    ? "text-amber-500"
                    : done
                      ? "text-emerald-500/70"
                      : "text-muted-foreground/40",
                )}
              >
                {t(`historicalData.step${step.key.charAt(0).toUpperCase() + step.key.slice(1)}`)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Step 1: Campaigns ─── */

function CampaignsStep({
  onNext,
  onCancel,
}: {
  onNext: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["historical-campaigns"],
    queryFn: getHistoricalCampaigns,
  });

  return (
    <div className="space-y-5 app-fade-in">
      <div className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          {t("historicalData.campaignsTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("historicalData.campaignsDescription")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center">
          <Megaphone className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {t("historicalData.noCampaigns")}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("campaigns.campaign")}
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Platform
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("campaigns.status")}
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">
                    {t("campaigns.account")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr
                    key={c.campaign_id}
                    className="border-t border-border/50 hover:bg-muted/30 transition-colors app-fade-up"
                    style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground truncate max-w-[200px]">
                        {c.campaign_name ?? "Untitled"}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                        {c.campaign_id}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {c.platform}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "text-xs capitalize",
                          c.campaign_status?.toLowerCase() === "enabled" ||
                            c.campaign_status?.toLowerCase() === "active"
                            ? "text-emerald-500"
                            : "text-muted-foreground",
                        )}
                      >
                        {c.campaign_status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                      {c.account_name ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-muted-foreground"
        >
          {t("historicalData.cancel")}
        </Button>
        <Button
          size="sm"
          onClick={onNext}
          disabled={campaigns.length === 0}
          className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg"
        >
          {t("historicalData.next")}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Step 2: Leads ─── */

function LeadsStep({
  syncLeads,
  onSyncLeadsChange,
  onNext,
  onBack,
}: {
  syncLeads: boolean;
  onSyncLeadsChange: (v: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["historical-leads-preview"],
    queryFn: getHistoricalLeadsPreview,
  });

  const leads = data?.leads ?? [];
  const total = data?.total ?? 0;
  const remaining = Math.max(0, total - leads.length);

  return (
    <div className="space-y-5 app-fade-in">
      <div className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          {t("historicalData.leadsTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("historicalData.leadsDescription")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {t("historicalData.noLeads")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="max-h-[320px] overflow-y-auto divide-y divide-border/50">
              {leads.map((lead, i) => (
                <div
                  key={lead.id}
                  className="px-4 py-3 app-fade-up hover:bg-muted/20 transition-colors"
                  style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">
                      {lead.full_name ||
                        [lead.first_name, lead.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                        "—"}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {lead.platform}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {lead.email && <span>{lead.email}</span>}
                    {lead.phone_number && (
                      <span className="text-muted-foreground/50">{lead.phone_number}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {remaining > 0 && (
            <p className="text-xs text-muted-foreground/60 text-center font-medium">
              {t("historicalData.leadsMore", { count: remaining })}
            </p>
          )}

          {/* Sync toggle */}
          <button
            onClick={() => onSyncLeadsChange(!syncLeads)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200",
              syncLeads
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-border bg-card hover:border-border/80",
            )}
          >
            <div
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-200",
                syncLeads
                  ? "border-amber-500 bg-amber-500 text-black"
                  : "border-muted-foreground/30",
              )}
            >
              {syncLeads && <Check className="h-3 w-3" />}
            </div>
            <span
              className={cn(
                "text-sm font-medium transition-colors",
                syncLeads ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t("historicalData.leadsCheckbox")}
            </span>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          {t("historicalData.back")}
        </Button>
        <Button
          size="sm"
          onClick={onNext}
          className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg"
        >
          {t("historicalData.next")}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Step 3: Users ─── */

function UsersStep({
  selectedUserIds,
  onSelectionChange,
  notifyUsers,
  onNotifyUsersChange,
  onSync,
  onBack,
  isSyncing,
}: {
  selectedUserIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  notifyUsers: boolean;
  onNotifyUsersChange: (v: boolean) => void;
  onSync: () => void;
  onBack: () => void;
  isSyncing: boolean;
}) {
  const { t } = useTranslation();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["historical-users"],
    queryFn: getHistoricalUsers,
  });

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(selectedUserIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange(next);
    },
    [selectedUserIds, onSelectionChange],
  );

  return (
    <div className="space-y-5 app-fade-in">
      <div className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          {t("historicalData.usersTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("historicalData.usersDescription")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center">
          <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {t("historicalData.noUsers")}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto divide-y divide-border/50">
            {users.map((user, i) => {
              const selected = selectedUserIds.has(user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => toggle(user.id)}
                  className={cn(
                    "flex w-full items-center gap-3.5 px-4 py-3 text-left transition-all duration-150 app-fade-up",
                    selected
                      ? "bg-amber-500/5"
                      : "hover:bg-muted/30",
                  )}
                  style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}
                >
                  <div
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-200",
                      selected
                        ? "border-amber-500 bg-amber-500 text-black"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {[user.first_name, user.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {user.email}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Notify users checkbox */}
      {selectedUserIds.size > 0 && (
        <button
          onClick={() => onNotifyUsersChange(!notifyUsers)}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200",
            notifyUsers
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-border bg-card hover:border-border/80",
          )}
        >
          <div
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-200",
              notifyUsers
                ? "border-amber-500 bg-amber-500 text-black"
                : "border-muted-foreground/30",
            )}
          >
            {notifyUsers && <Check className="h-3 w-3" />}
          </div>
          <span
            className={cn(
              "text-sm font-medium transition-colors",
              notifyUsers ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {t("historicalData.notifyUsers")}
          </span>
        </button>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={isSyncing}
          className="text-muted-foreground"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          {t("historicalData.back")}
        </Button>
        <Button
          size="sm"
          onClick={onSync}
          disabled={isSyncing}
          className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg"
        >
          {isSyncing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {t("historicalData.syncButton")}
        </Button>
      </div>
    </div>
  );
}

/* ─── Main Sync Page ─── */

export default function SyncPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useAuthContext();
  const [step, setStep] = useState(0);
  const [syncLeads, setSyncLeads] = useState(false);
  const [notifyUsers, setNotifyUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );

  // Guard: only allow access when status is "not_ready"
  const { data: record, isLoading: guardLoading } = useQuery({
    queryKey: ["historical-data", currentWorkspace?.id],
    queryFn: getHistoricalData,
    enabled: !!currentWorkspace?.id,
  });

  useEffect(() => {
    if (guardLoading) return;
    if (!record || record.status !== "not_ready") {
      navigate("/", { replace: true });
    }
  }, [record, guardLoading, navigate]);

  const submitMutation = useMutation({
    mutationFn: () =>
      updateHistoricalData({
        metadata: {
          leads: syncLeads,
          campaigns: true,
          users: [...selectedUserIds],
          notify_users: notifyUsers,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["historical-data", currentWorkspace?.id],
      });
      navigate("/");
    },
  });

  // Show nothing while guard is loading or redirecting
  if (guardLoading || !record || record.status !== "not_ready") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[680px] p-4 sm:p-6 py-8 sm:py-12">
      <StepIndicator current={step} />

      {step === 0 && (
        <CampaignsStep
          onNext={() => setStep(1)}
          onCancel={() => navigate("/")}
        />
      )}
      {step === 1 && (
        <LeadsStep
          syncLeads={syncLeads}
          onSyncLeadsChange={setSyncLeads}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <UsersStep
          selectedUserIds={selectedUserIds}
          onSelectionChange={setSelectedUserIds}
          notifyUsers={notifyUsers}
          onNotifyUsersChange={setNotifyUsers}
          onSync={() => submitMutation.mutate()}
          onBack={() => setStep(1)}
          isSyncing={submitMutation.isPending}
        />
      )}
    </div>
  );
}
