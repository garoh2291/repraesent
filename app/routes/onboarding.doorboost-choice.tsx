import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sparkles, RefreshCw, Plus, Loader2 } from "lucide-react";
import {
  dismissDoorboostEligibility,
  getDoorboostEligibility,
  type DoorboostEligibility,
} from "~/lib/api/doorboost-restore";
import { useAuthContext } from "~/providers/auth-provider";

export default function OnboardingDoorboostChoice() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refetchAuth } = useAuthContext();

  const { data, isLoading } = useQuery<DoorboostEligibility>({
    queryKey: ["doorboost-eligibility"],
    queryFn: getDoorboostEligibility,
    staleTime: 0,
  });

  // If not eligible (e.g. user reloaded after dismissing), bounce to standard flow.
  useEffect(() => {
    if (!isLoading && data && !data.eligible) {
      navigate("/onboarding/workspace", { replace: true });
    }
  }, [isLoading, data, navigate]);

  const dismissMutation = useMutation({
    mutationFn: dismissDoorboostEligibility,
    onSuccess: () => {
      refetchAuth();
      navigate("/onboarding/workspace", { replace: true });
    },
  });

  if (isLoading || !data?.eligible) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] grid place-items-center px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-amber-400/10 text-amber-500 mb-4">
            <Sparkles className="w-7 h-7" />
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {t("doorboost_restore.choice_title", "Welcome back!")}
          </h1>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto">
            {t("doorboost_restore.choice_subtitle", {
              retailerName: data.retailer?.name ?? "Doorboost",
              defaultValue:
                "We found a Doorboost workspace under {{retailerName}}. What would you like to do?",
            })}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => navigate("/onboarding/doorboost-restore")}
            className="group rounded-2xl border bg-card p-6 text-left hover:border-amber-400/50 transition-all hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-amber-400/10 text-amber-500 mb-4 group-hover:scale-110 transition-transform">
              <RefreshCw className="w-5 h-5" />
            </span>
            <div className="font-semibold text-lg">
              {t(
                "doorboost_restore.choice_restore",
                "Restore my Doorboost workspace",
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {t(
                "doorboost_restore.choice_restore_hint",
                "Bring over your campaigns, leads, users and notes.",
              )}
            </p>
          </button>

          <button
            onClick={() => dismissMutation.mutate()}
            disabled={dismissMutation.isPending}
            className="group rounded-2xl border bg-card p-6 text-left hover:border-foreground/40 transition-all hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-muted text-foreground mb-4 group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5" />
            </span>
            <div className="font-semibold text-lg">
              {t("doorboost_restore.choice_create", "Start fresh")}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {t(
                "doorboost_restore.choice_create_hint",
                "Create a brand new workspace.",
              )}
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
