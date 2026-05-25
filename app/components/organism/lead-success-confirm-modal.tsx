"use client";

import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

export type SuccessConfirmPhase = "confirm" | "saving" | "done";

interface LeadSuccessConfirmModalProps {
  open: boolean;
  phase: SuccessConfirmPhase;
  leadName: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Two-phase modal shown when a lead is dropped into the "Success" column:
 * first it confirms the action, then — in the same modal — it shows the result.
 */
export function LeadSuccessConfirmModal({
  open,
  phase,
  leadName,
  onConfirm,
  onClose,
}: LeadSuccessConfirmModalProps) {
  const { t } = useTranslation();
  const isDone = phase === "done";
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
          <div
            className={
              isDone
                ? "mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100"
                : "mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 ring-4 ring-amber-100"
            }
          >
            {isDone ? (
              <CheckCircle2 className="h-7 w-7 text-emerald-500" aria-hidden />
            ) : (
              <Trophy className="h-7 w-7 text-amber-500" aria-hidden />
            )}
          </div>
          <DialogTitle className="text-lg font-semibold">
            {isDone
              ? t("leads.markSuccess.doneTitle", {
                  defaultValue: "Lead marked as success",
                })
              : t("leads.markSuccess.title", {
                  defaultValue: "Mark lead as success?",
                })}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            {isDone
              ? t("leads.markSuccess.doneDescription", {
                  name: leadName,
                  defaultValue: "{{name}} has been moved to Success.",
                })
              : t("leads.markSuccess.description", {
                  name: leadName,
                  defaultValue:
                    "This moves {{name}} to the Success column and marks the lead as successful.",
                })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-col">
          {isDone ? (
            <Button type="button" className="w-full" onClick={onClose}>
              {t("leads.markSuccess.close", { defaultValue: "Close" })}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                className="w-full"
                disabled={isSaving}
                onClick={onConfirm}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("leads.markSuccess.confirm", {
                    defaultValue: "Mark as success",
                  })
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
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
