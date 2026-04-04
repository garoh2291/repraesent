import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Loader2, Database, Play } from "lucide-react";
import axios from "axios";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getHistoricalData,
  createHistoricalData,
} from "~/lib/api/historical-data";

export function DoorboostMigrationBanner() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isDoorboost =
    currentWorkspace?.was_doorboost_client === true &&
    !!currentWorkspace?.doorboost_partner_house_id;

  const { data: record, isLoading } = useQuery({
    queryKey: ["historical-data", currentWorkspace?.id],
    queryFn: getHistoricalData,
    enabled: isDoorboost,
  });

  const createMutation = useMutation({
    mutationFn: createHistoricalData,
    onSuccess: (data) => {
      queryClient.setQueryData(["historical-data", currentWorkspace?.id], data);
      if (data.status === "not_ready") {
        navigate("/sync");
      }
    },
  });

  // Don't render anything if not a doorboost client
  if (!isDoorboost) return null;

  // Still loading
  if (isLoading) return null;

  // Hide if finished, failed, or ignored
  if (
    record?.status === "finished" ||
    record?.status === "failed" ||
    record?.status === "ignored"
  ) {
    return null;
  }

  // Pending state — already submitted
  if (record?.status === "not_synced" || record?.status === "pending") {
    return (
      <div className="mx-3 mt-3 sm:mx-4 sm:mt-4 space-y-2">
        <div className="flex items-center gap-3 rounded-xl border border-sky-400/30 bg-sky-400/8 px-4 py-3">
          <Loader2 className="h-4 w-4 shrink-0 text-sky-500 animate-spin" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sky-900">
              {t("historicalData.bannerPending")}
            </p>
            <p className="text-xs text-sky-700/70 mt-0.5">
              {t("historicalData.bannerPendingDescription")}
            </p>
          </div>
        </div>
        <DevSyncTrigger />
      </div>
    );
  }

  // not_ready — user started but hasn't completed wizard
  if (record?.status === "not_ready") {
    return (
      <div className="mx-3 mt-3 sm:mx-4 sm:mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-indigo-400/30 bg-indigo-400/8 px-4 py-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <Database className="h-4 w-4 shrink-0 text-indigo-500" />
          <p className="text-sm font-medium text-indigo-900">
            {t("historicalData.bannerTitle")}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 h-8 border-indigo-400/40 text-indigo-800 hover:bg-indigo-50 text-xs self-start sm:self-auto"
          onClick={() => navigate("/sync")}
        >
          {t("historicalData.bannerStart")}
          <ArrowRight className="ml-1.5 h-3 w-3" />
        </Button>
      </div>
    );
  }

  // No record yet — show initial prompt
  return (
    <div className="mx-3 mt-3 sm:mx-4 sm:mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-indigo-400/30 bg-indigo-400/8 px-4 py-3">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <Database className="h-4 w-4 shrink-0 text-indigo-500" />
        <div>
          <p className="text-sm font-medium text-indigo-900">
            {t("historicalData.bannerTitle")}
          </p>
          <p className="text-xs text-indigo-700/70 mt-0.5">
            {t("historicalData.bannerDescription")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 h-8 text-indigo-600/60 hover:text-indigo-800 hover:bg-indigo-50 text-xs"
          onClick={() => createMutation.mutate("ignored")}
          disabled={createMutation.isPending}
        >
          {t("historicalData.bannerNotNeeded")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 h-8 border-indigo-400/40 text-indigo-800 hover:bg-indigo-50 text-xs"
          onClick={() => createMutation.mutate("not_ready")}
          disabled={createMutation.isPending}
        >
          {t("historicalData.bannerStart")}
          <ArrowRight className="ml-1.5 h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Dev-only: trigger sync worker manually ─── */

function DevSyncTrigger() {
  const [triggerState, setTriggerState] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  if (!import.meta.env.DEV) return null;

  const handleTrigger = async () => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8001/api";
    const cronKey = import.meta.env.VITE_CRON_API_KEY || "";
    setTriggerState("loading");
    setTriggerResult(null);
    try {
      const res = await axios.post(
        `${apiUrl}/internal/process-historical-sync`,
        {},
        { headers: { "x-cron-api-key": cronKey } },
      );
      setTriggerResult(JSON.stringify(res.data));
      setTriggerState("ok");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? err.message)
        : String(err);
      setTriggerResult(msg);
      setTriggerState("error");
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3.5 space-y-2.5">
      <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
        <Play className="h-3 w-3" /> Dev: run historical sync
      </p>
      <p className="text-[10px] text-amber-600 leading-relaxed">
        Simulates the cron. Set{" "}
        <code className="font-mono bg-amber-100 px-1 rounded">
          VITE_CRON_API_KEY
        </code>{" "}
        in{" "}
        <code className="font-mono bg-amber-100 px-1 rounded">.env</code>.
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={handleTrigger}
        disabled={triggerState === "loading"}
        className="h-7 w-full gap-1.5 text-[11px] border-amber-400 text-amber-800 hover:bg-amber-100"
      >
        {triggerState === "loading" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Play className="h-3 w-3" />
        )}
        Run now
      </Button>
      {triggerResult && (
        <p
          className={cn(
            "text-[10px] font-mono break-all leading-relaxed",
            triggerState === "ok" ? "text-emerald-700" : "text-red-600",
          )}
        >
          {triggerResult}
        </p>
      )}
    </div>
  );
}
