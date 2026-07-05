import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { setDealEmailVisibility, type BccMessage } from "~/lib/api/bcc-logs";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/** Hide / unhide an email for a deal (footer action on EmailCard). */
export function DealEmailCardActions({
  dealId,
  message,
}: {
  dealId: string;
  message: BccMessage;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const hidden = !!message.hidden;

  const mut = useMutation({
    mutationFn: () => setDealEmailVisibility(dealId, message.id, !hidden),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-emails", dealId] });
      toast.success(
        hidden
          ? t("dealEmails.shownToast", { defaultValue: "Email restored." })
          : t("dealEmails.hiddenToast", {
              defaultValue: "Email hidden from deal.",
            }),
      );
    },
    onError: (e) =>
      toast.error(
        t("dealEmails.updateFailed", { defaultValue: "Could not update." }),
        { description: extractErrorMessage(e) },
      ),
  });

  return (
    <>
      {hidden && (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            message.hidden_reason === "rule"
              ? "bg-amber-400/20 text-amber-700 dark:text-amber-300"
              : "bg-slate-400/20 text-slate-600 dark:text-slate-300",
          )}
        >
          {message.hidden_reason === "rule"
            ? t("dealEmails.hiddenByRule", {
                defaultValue: "Excluded by segment",
              })
            : t("dealEmails.hiddenManually", {
                defaultValue: "Hidden manually",
              })}
        </span>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="ml-auto h-8 gap-1.5 text-xs"
        disabled={mut.isPending}
        onClick={() => mut.mutate()}
      >
        {hidden ? (
          <>
            <Eye className="size-3.5" />
            {t("dealEmails.unhide", { defaultValue: "Unhide" })}
          </>
        ) : (
          <>
            <EyeOff className="size-3.5" />
            {t("dealEmails.hide", { defaultValue: "Hide" })}
          </>
        )}
      </Button>
    </>
  );
}
