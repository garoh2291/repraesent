import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { clearDealPaid, markDealPaid } from "~/lib/api/deals";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useInvalidateWork } from "~/lib/hooks/useToday";
import { cn } from "~/lib/utils";
import { useReviewAsk } from "~/components/notebook/review-ask";

/**
 * "Paid" on a won deal (PRODUCT_DOC_LEFTOVERS.md §2): a won deal is a
 * promise, paid is the money in. Not paid → one button. Paid → the date,
 * "via Stripe" when an invoice did it, and Undo. The toast echoes the action
 * and offers Undo, like marking a deal won.
 */
export function DealPaid({
  dealId,
  paidAt,
  paidSource,
  canEdit,
  className,
}: {
  dealId: string;
  paidAt: string | null;
  paidSource: "manual" | "stripe" | null;
  canEdit: boolean;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const invalidateWork = useInvalidateWork();
  const reviewAsk = useReviewAsk();
  const refresh = () => {
    invalidateWork();
    void qc.invalidateQueries({ queryKey: ["deal", dealId] });
    void qc.invalidateQueries({ queryKey: ["deals-pipeline"] });
    void qc.invalidateQueries({ queryKey: ["deal-history", dealId] });
  };
  const fail = (err: unknown) =>
    toast.error(extractErrorMessage(err) || t("common.error", "Something went wrong"));

  const mark = useMutation({
    mutationFn: () => markDealPaid(dealId),
    onSuccess: () => {
      refresh();
      // A project business asks for a Google review once the job is paid.
      reviewAsk.afterDeal(dealId, "paid");
      toast.success(t("pipeline.paid.markedToast", "Marked as paid"), {
        action: {
          label: t("common.undo", "Undo"),
          onClick: () => void clearDealPaid(dealId).then(refresh).catch(fail),
        },
      });
    },
    onError: fail,
  });
  const undo = useMutation({
    mutationFn: () => clearDealPaid(dealId),
    onSuccess: () => {
      refresh();
      toast.success(t("pipeline.paid.clearedToast", "No longer marked as paid"));
    },
    onError: fail,
  });

  if (!paidAt) {
    if (!canEdit) return null;
    return (
      <Button
        size="sm"
        variant="outline"
        className={cn("h-10 gap-1.5 text-xs sm:h-8", className)}
        disabled={mark.isPending}
        onClick={() => mark.mutate()}
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        {t("pipeline.paid.mark", "Mark as paid")}
      </Button>
    );
  }

  const date = new Date(paidAt).toLocaleDateString(i18n.language, { day: "numeric", month: "short" });
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]", className)}>
      <span className="inline-flex items-center gap-1 rounded-full bg-earned/10 px-2 py-0.5 font-medium text-earned">
        <Check className="h-3.5 w-3.5" aria-hidden />
        {paidSource === "stripe"
          ? t("pipeline.paid.onDateStripe", "Paid on {{date}} · via Stripe", { date })
          : t("pipeline.paid.onDate", "Paid on {{date}}", { date })}
      </span>
      {canEdit ? (
        <button
          type="button"
          className="min-h-10 text-[12px] text-muted-foreground underline decoration-foreground/20 underline-offset-4 hover:text-foreground sm:min-h-0"
          disabled={undo.isPending}
          onClick={() => undo.mutate()}
        >
          {t("common.undo", "Undo")}
        </button>
      ) : null}
    </div>
  );
}

/** Small chip for a paid deal on the board. Nothing for unpaid deals. */
export function PaidChip({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-earned/10 px-1.5 py-0.5 text-[10.5px] font-medium text-earned",
        className,
      )}
    >
      <Check className="h-3 w-3" aria-hidden />
      {t("pipeline.paid.chip", "Paid")}
    </span>
  );
}
