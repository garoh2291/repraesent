import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Loader2, Database, Play, Sparkles } from "lucide-react";
import axios from "axios";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getHistoricalData,
  createHistoricalData,
} from "~/lib/api/historical-data";

/* ─── Floating sync status messages ─── */

const SYNC_MESSAGES = {
  en: [
    "Connecting your ad campaigns...",
    "Importing lead history...",
    "Syncing team members...",
    "Migrating campaign metrics...",
    "Transferring lead notes...",
    "Building your workspace...",
  ],
  de: [
    "Werbekampagnen werden verbunden...",
    "Lead-Verlauf wird importiert...",
    "Teammitglieder werden synchronisiert...",
    "Kampagnenmetriken werden migriert...",
    "Lead-Notizen werden übertragen...",
    "Dein Workspace wird aufgebaut...",
  ],
};

function FloatingMessages({ lang }: { lang: "en" | "de" }) {
  const messages = SYNC_MESSAGES[lang];
  const [index, setIndex] = useState(0);
  const [animState, setAnimState] = useState<"enter" | "exit">("enter");

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimState("exit");
      setTimeout(() => {
        setIndex((i) => (i + 1) % messages.length);
        setAnimState("enter");
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="relative h-5 overflow-hidden">
      <p
        className={cn(
          "text-xs font-medium transition-all duration-400 ease-out absolute inset-x-0",
          animState === "enter"
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-3"
        )}
        style={{ color: "hsl(var(--muted-foreground) / 0.7)" }}
      >
        {messages[index]}
      </p>
    </div>
  );
}

/* ─── Main Banner ─── */

export function DoorboostMigrationBanner() {
  const { t, i18n } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lang: "en" | "de" = i18n.language?.startsWith("de") ? "de" : "en";

  const isDoorboost =
    currentWorkspace?.was_doorboost_client === true &&
    !!currentWorkspace?.doorboost_partner_house_id;

  const { data: record, isLoading } = useQuery({
    queryKey: ["historical-data", currentWorkspace?.id],
    queryFn: getHistoricalData,
    enabled: isDoorboost,
    refetchInterval: isDoorboost ? 15000 : false,
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

  if (!isDoorboost) return null;
  if (isLoading) return null;
  if (
    record?.status === "finished" ||
    record?.status === "failed" ||
    record?.status === "ignored"
  ) {
    return null;
  }

  // ── Pending / not_synced: animated status banner ──
  if (record?.status === "not_synced" || record?.status === "pending") {
    return (
      <div className="mx-3 mt-3 sm:mx-4 sm:mt-4 space-y-2">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
          {/* Subtle gradient accent line at top */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

          <div className="flex items-center gap-3.5 px-4 py-3.5">
            {/* Animated icon */}
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/15">
              <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
            </div>

            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-sm font-semibold text-foreground tracking-tight">
                {t("historicalData.bannerPending")}
              </p>
              <FloatingMessages lang={lang} />
            </div>

            {/* Subtle spinning indicator */}
            <div className="shrink-0">
              <Loader2 className="h-4 w-4 text-muted-foreground/40 animate-spin" />
            </div>
          </div>
        </div>
        <DevSyncTrigger />
      </div>
    );
  }

  // ── not_ready: resume wizard ──
  if (record?.status === "not_ready") {
    return (
      <div className="mx-3 mt-3 sm:mx-4 sm:mt-4">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/15">
                <Database className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-foreground tracking-tight">
                {t("historicalData.bannerTitle")}
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0 h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs rounded-lg self-start sm:self-auto"
              onClick={() => navigate("/sync")}
            >
              {t("historicalData.bannerContinue")}
              <ArrowRight className="ml-1.5 h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── No record: initial prompt ──
  return (
    <div className="mx-3 mt-3 sm:mx-4 sm:mt-4">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        {/* Accent top line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/15">
              <Database className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground tracking-tight">
                {t("historicalData.bannerTitle")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("historicalData.bannerDescription")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 h-8 text-muted-foreground hover:text-foreground text-xs"
              onClick={() => createMutation.mutate("ignored")}
              disabled={createMutation.isPending}
            >
              {t("historicalData.bannerNotNeeded")}
            </Button>
            <Button
              size="sm"
              className="shrink-0 h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs rounded-lg"
              onClick={() => createMutation.mutate("not_ready")}
              disabled={createMutation.isPending}
            >
              {t("historicalData.bannerStart")}
              <ArrowRight className="ml-1.5 h-3 w-3" />
            </Button>
          </div>
        </div>
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
        { headers: { "x-cron-api-key": cronKey } }
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
    <div className="rounded-xl border border-dashed border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-amber-500/70 flex items-center gap-1.5">
        <Play className="h-3 w-3" /> Dev: run historical sync
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={handleTrigger}
        disabled={triggerState === "loading"}
        className="h-7 w-full gap-1.5 text-[11px] border-amber-500/20 text-amber-500/80 hover:bg-amber-500/10"
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
            triggerState === "ok" ? "text-emerald-500" : "text-red-400"
          )}
        >
          {triggerResult}
        </p>
      )}
    </div>
  );
}
