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
  type CampaignPreview,
  type LeadPreview,
  type DoorboostUser,
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
    <div className="flex items-center gap-2 sm:gap-3 mb-8">
      {STEPS.map((step, i) => {
        const StepIcon = step.icon;
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.key} className="flex items-center gap-2 sm:gap-3">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-6 sm:w-10",
                  done ? "bg-emerald-500" : "bg-border",
                )}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  done
                    ? "bg-emerald-500/15 text-emerald-600"
                    : active
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <StepIcon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={cn(
                  "hidden sm:inline text-xs font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
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
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">
          {t("historicalData.campaignsTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("historicalData.campaignsDescription")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("historicalData.noCampaigns")}
        </p>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    {t("campaigns.campaign")}
                  </th>
                  <th className="px-3 py-2 font-medium">Platform</th>
                  <th className="px-3 py-2 font-medium">
                    {t("campaigns.status")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("campaigns.account")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.campaign_id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="font-medium truncate max-w-[220px]">
                        {c.campaign_name ?? "Untitled"}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {c.campaign_id}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                        {c.platform}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground capitalize">
                      {c.campaign_status ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {c.account_name ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t("historicalData.cancel")}
        </Button>
        <Button
          size="sm"
          onClick={onNext}
          disabled={campaigns.length === 0}
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
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">
          {t("historicalData.leadsTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("historicalData.leadsDescription")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("historicalData.noLeads")}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="border rounded-xl overflow-hidden">
            <div className="max-h-[320px] overflow-y-auto divide-y">
              {leads.map((lead) => (
                <div key={lead.id} className="px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {lead.full_name ||
                        [lead.first_name, lead.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                        "—"}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize">
                      {lead.platform}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {lead.email && <span>{lead.email}</span>}
                    {lead.phone_number && <span>{lead.phone_number}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {remaining > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {t("historicalData.leadsMore", { count: remaining })}
            </p>
          )}

          <label className="flex items-center gap-2.5 cursor-pointer py-2">
            <input
              type="checkbox"
              checked={syncLeads}
              onChange={(e) => onSyncLeadsChange(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium">
              {t("historicalData.leadsCheckbox")}
            </span>
          </label>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          {t("historicalData.back")}
        </Button>
        <Button size="sm" onClick={onNext}>
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
  onSync,
  onBack,
  isSyncing,
}: {
  selectedUserIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
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
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">
          {t("historicalData.usersTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("historicalData.usersDescription")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("historicalData.noUsers")}
        </p>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto divide-y">
            {users.map((user) => {
              const selected = selectedUserIds.has(user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => toggle(user.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/30 transition-colors",
                    selected && "bg-primary/5",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                    )}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {[user.first_name, user.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isSyncing}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          {t("historicalData.back")}
        </Button>
        <Button size="sm" onClick={onSync} disabled={isSyncing}>
          {isSyncing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
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
    // Redirect if no record, or record is not in "not_ready" state
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
    <div className="mx-auto w-full max-w-[700px] p-4 sm:p-6 py-8 sm:py-12 app-fade-in">
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
          onSync={() => submitMutation.mutate()}
          onBack={() => setStep(1)}
          isSyncing={submitMutation.isPending}
        />
      )}
    </div>
  );
}
