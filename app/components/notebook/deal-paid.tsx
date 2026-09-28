import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { clearDealPaid, markDealPaid } from "~/lib/api/deals";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useInvalidateWork } from "~/lib/hooks/useToday";
import { cn } from "~/lib/utils";
import { useReviewAsk } from "~/components/notebook/review-ask";
import { CoachHint, hintPrimaryClass, hintSecondaryClass } from "~/components/notebook/coach-hint";

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
      <>
        {/* Won but not paid: this needs you, so it wears the marker. */}
        <Button
          size="sm"
          data-paid-hint=""
          className={cn(
            "h-10 gap-1.5 bg-marker text-xs text-foreground hover:bg-marker/85 sm:h-8",
            className,
          )}
          disabled={mark.isPending}
          onClick={() => mark.mutate()}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          {t("pipeline.paid.mark", "Mark as paid")}
        </Button>
        <PaidHint dealId={dealId} busy={mark.isPending} onMark={() => mark.mutate()} />
      </>
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
/** A won deal with no payment recorded yet: the money is still to collect. */
export function UnpaidChip({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-marker-soft px-1.5 py-0.5 text-[10.5px] font-medium text-marker-ink max-sm:text-[11.5px]",
        className,
      )}
    >
      <Wallet className="h-3 w-3" aria-hidden />
      {t("pipeline.paid.notYetChip", "Not paid yet")}
    </span>
  );
}

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

const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const snoozeKey = (dealId: string) => `rp-paid-hint:${dealId}`;

function snoozed(dealId: string): boolean {
  try {
    const at = Number(window.localStorage.getItem(snoozeKey(dealId)) || 0);
    return at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return true; // Storage blocked: never nag.
  }
}

/**
 * A new customer who hasn't paid yet: point at "Mark as paid" every time the
 * deal opens, until it's paid. "Not yet" rests it for 3 days on this deal; a
 * tap elsewhere only hides it for this visit. Results counts what's still to
 * collect from exactly this.
 */
function PaidHint({ dealId, busy, onMark }: { dealId: string; busy: boolean; onMark: () => void }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  // Decided in an effect: localStorage isn't there during server rendering.
  useEffect(() => {
    setShow(!snoozed(dealId));
  }, [dealId]);
  if (!show) return null;
  return (
    <CoachHint
      selector="[data-paid-hint]"
      delayMs={1000}
      icon={<Wallet className="size-4 text-foreground" aria-hidden />}
      title={t("pipeline.paid.hintTitle", "Paid already?")}
      body={t("pipeline.paid.hintBody", "Mark it here — Results then shows what's still to collect.")}
      onDismiss={() => setShow(false)}
      actions={
        <>
          <button
            type="button"
            className={hintSecondaryClass}
            onClick={() => {
              try {
                window.localStorage.setItem(snoozeKey(dealId), String(Date.now()));
              } catch {
                /* ignore */
              }
              setShow(false);
            }}
          >
            {t("pipeline.paid.hintLater", "Not yet")}
          </button>
          <button
            type="button"
            className={hintPrimaryClass}
            disabled={busy}
            onClick={() => {
              setShow(false);
              onMark();
            }}
          >
            {t("pipeline.paid.mark", "Mark as paid")}
          </button>
        </>
      }
    />
  );
}
