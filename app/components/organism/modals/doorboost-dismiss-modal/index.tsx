import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Megaphone, UserRound, Layers } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { useAuthContext } from "~/providers/auth-provider";
import { getHistoricalDataCounts } from "~/lib/api/historical-data";

export default function DoorboostDismissModal({
  setIsOpen,
  onConfirm,
  isPending,
}: {
  setIsOpen?: (isOpen: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();

  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["historical-data-counts", currentWorkspace?.id],
    queryFn: getHistoricalDataCounts,
    staleTime: 5 * 60_000,
  });

  const items = [
    {
      icon: <Megaphone className="h-3.5 w-3.5" />,
      text: countsLoading
        ? "\u2014"
        : t("historicalData.modalCampaigns", {
            count: counts?.campaigns ?? 0,
          }),
    },
    {
      icon: <UserRound className="h-3.5 w-3.5" />,
      text: countsLoading
        ? "\u2014"
        : t("historicalData.modalLeads", { count: counts?.leads ?? 0 }),
    },
    {
      icon: <Layers className="h-3.5 w-3.5" />,
      text: countsLoading
        ? "\u2014"
        : t("historicalData.modalUsers", { count: counts?.users ?? 0 }),
    },
  ];

  function handleConfirm() {
    onConfirm();
    setIsOpen?.(false);
  }

  return (
    <DialogContent
      showCloseButton={false}
      className="flex w-[calc(100vw-2rem)] sm:min-w-[420px] sm:max-w-[440px] flex-col gap-0 p-0 overflow-hidden"
    >
      {/* Amber accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

      <div className="p-6">
        {/* Warning header */}
        <DialogHeader className="flex-row items-start gap-3.5 mb-5 text-left">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-5 w-5 text-red-500/90" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-[15px] font-bold leading-tight mb-1">
              {t("historicalData.modalTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("historicalData.modalSubtitle")}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Loss list */}
        <div className="rounded-xl border border-red-500/12 bg-red-500/5 p-3.5 space-y-2.5 mb-4">
          {items.map(({ icon, text }, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="text-red-500/60 flex shrink-0">{icon}</span>
              <span className="text-xs font-semibold text-foreground/75">
                {text}
              </span>
            </div>
          ))}
        </div>

        {/* Warning text */}
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed mb-5">
          {t("historicalData.modalWarning")}
        </p>

        {/* Actions */}
        <DialogFooter className="flex-row gap-2.5 sm:flex-row">
          <Button
            variant="outline"
            className="flex-1 h-10 rounded-xl text-xs font-semibold"
            onClick={() => setIsOpen?.(false)}
          >
            {t("historicalData.modalCancel")}
          </Button>
          <Button
            variant="destructive"
            className="flex-[1.6] h-10 rounded-xl text-xs font-bold"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {t("historicalData.modalConfirm")}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  );
}
