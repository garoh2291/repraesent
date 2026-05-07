import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Database, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { getHistoricalData } from "~/lib/api/historical-data";
import { useAuthContext } from "~/providers/auth-provider";
import { Button } from "~/components/ui/button";
import { DevSyncTrigger } from "~/components/dev-sync-trigger";

const POLL_INTERVAL_MS = 8000;

export default function OnboardingSyncPending() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthContext();
  const workspaceId = currentWorkspace?.id;

  const { data, error } = useQuery({
    queryKey: ["historical-data", workspaceId, "pending-poll"],
    queryFn: () => getHistoricalData(),
    enabled: !!workspaceId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "finished" || status === "failed") return false;
      return POLL_INTERVAL_MS;
    },
  });

  // Once finished, hard-reload to `/`. A SPA navigation here races with the
  // in-flight auth refetch — `_protected` reads `isFetchingAuth` as `isLoading`
  // and gets stuck on the "Laden..." spinner. A full reload guarantees a clean
  // React Query cache + a fresh auth fetch and lands the user on the dashboard.
  useEffect(() => {
    if (data?.status !== "finished") return;
    if (typeof window === "undefined") return;
    const timer = setTimeout(() => {
      window.location.replace("/");
    }, 600);
    return () => clearTimeout(timer);
  }, [data?.status]);

  if (data?.status === "failed") {
    return (
      <div className="min-h-[80vh] grid place-items-center px-4">
        <div className="max-w-md text-center space-y-4">
          <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="w-7 h-7" />
          </span>
          <h1 className="text-2xl font-bold">
            {t("doorboost_restore.failed_title", "Something went wrong")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.error_reason ||
              error?.message ||
              t("doorboost_restore.unknown_error", "Unknown error")}
          </p>
          <Button onClick={() => navigate("/onboarding/doorboost-restore")}>
            {t("doorboost_restore.failed_retry", "Try again")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] grid place-items-center px-4">
      <div className="max-w-lg text-center space-y-6">
        <div className="relative grid place-items-center w-20 h-20 mx-auto">
          <span className="absolute inset-0 rounded-full bg-amber-400/15 animate-ping" />
          <span className="relative grid place-items-center w-20 h-20 rounded-2xl bg-amber-400/10 text-amber-500">
            <Database className="w-10 h-10" />
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t(
              "doorboost_restore.pending_title",
              "Restoring your Doorboost data",
            )}
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {t(
              "doorboost_restore.pending_subtitle",
              "This usually takes a couple of minutes. We'll email you when it's ready.",
            )}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 inline-flex items-center gap-3 mx-auto">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <div className="text-left">
            <div className="text-sm font-medium capitalize">
              {t(
                `doorboost_restore.status.${data?.status ?? "queued"}`,
                {
                  defaultValue: data?.status
                    ? data.status.replace(/_/g, " ")
                    : "Queued",
                },
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              <Sparkles className="inline w-3 h-3 mr-1 text-amber-400" />
              {t(
                "doorboost_restore.pending_keep_open",
                "Feel free to close this window — we'll send a magic-link email when your data is in.",
              )}
            </div>
          </div>
        </div>

        <div className="max-w-xs mx-auto">
          <DevSyncTrigger />
        </div>
      </div>
    </div>
  );
}
