import { RotateCcw, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export type ReopenConfirmPhase = "confirm" | "saving";

/**
 * Confirms taking a deal back OUT of a won or lost stage.
 *
 * The mirror image of `LeadSuccessConfirmModal`, which guards a lead being
 * dropped INTO a won column — same shape, same phase model, so the two boards
 * feel like one product.
 *
 * The copy names what is actually lost. Moving to a non-terminal stage runs
 * `terminalPatchFor`, which sets `won_at` and `lost_at` to NULL — the date the
 * deal was won is destroyed on the row, not archived. That is the fact worth
 * stopping someone for; "are you sure?" on its own just teaches people to click
 * through without reading.
 */
export function ReopenDealConfirmModal({
  open,
  phase,
  dealName,
  fromCategory,
  toStageLabel,
  outcomeDate,
  onConfirm,
  onClose,
}: {
  open: boolean;
  phase: ReopenConfirmPhase;
  dealName: string;
  /** Which terminal stage it is leaving — decides the wording and the icon. */
  fromCategory: "won" | "lost";
  toStageLabel: string;
  /** The won_at / lost_at about to be cleared, already formatted. */
  outcomeDate: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const isSaving = phase === "saving";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Don't allow dismissing mid-request.
        if (!next && !isSaving) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center gap-1">
          <div className="mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 ring-4 ring-amber-100">
            <RotateCcw className="h-7 w-7 text-amber-500" aria-hidden />
          </div>
          <DialogTitle className="text-lg font-semibold">
            {fromCategory === "won"
              ? t("pipeline.reopenDeal.titleWon", {
                  defaultValue: "Reopen this won deal?",
                })
              : t("pipeline.reopenDeal.titleLost", {
                  defaultValue: "Reopen this lost deal?",
                })}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            {t("pipeline.reopenDeal.description", {
              name: dealName,
              stage: toStageLabel,
              defaultValue:
                "{{name}} moves back to “{{stage}}” and counts as open again.",
            })}
          </DialogDescription>
        </DialogHeader>

        {/* The consequence, said plainly and only when there is one to lose. */}
        {outcomeDate ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
            {fromCategory === "won"
              ? t("pipeline.reopenDeal.clearsWonAt", {
                  date: outcomeDate,
                  defaultValue:
                    "The won date ({{date}}) will be cleared and cannot be restored.",
                })
              : t("pipeline.reopenDeal.clearsLostAt", {
                  date: outcomeDate,
                  defaultValue:
                    "The lost date ({{date}}) will be cleared and cannot be restored.",
                })}
          </p>
        ) : null}

        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full"
            disabled={isSaving}
            onClick={onConfirm}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("pipeline.reopenDeal.confirm", { defaultValue: "Reopen deal" })
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isSaving}
            onClick={onClose}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
