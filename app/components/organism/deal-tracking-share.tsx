import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Link2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { rotateDealTrackingToken } from "~/lib/api/deals";

/**
 * Hand the customer their tracking link.
 *
 * Rendered only when the deal's pipeline has tracking on — a copy button for a
 * URL that 404s is worse than no button, and the switch lives in
 * /settings/pipelines where it applies to the whole board.
 *
 * Regenerating sits behind a confirm because it is destructive in a way that
 * is invisible from here: the customer may already have the old link in an
 * email, and nothing tells them it stopped working.
 */
export function DealTrackingShare({
  dealId,
  trackingToken,
}: {
  dealId: string;
  trackingToken: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const url =
    typeof window === "undefined"
      ? `/t/${trackingToken}`
      : `${window.location.origin}/t/${trackingToken}`;

  const rotate = useMutation({
    mutationFn: () => rotateDealTrackingToken(dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal", dealId] });
      setConfirmOpen(false);
      toast.success(
        t("pipeline.tracking.rotated", {
          defaultValue: "A new link is ready. The old one no longer works.",
        }),
      );
    },
    onError: (err) =>
      toast.error(
        extractErrorMessage(err) ||
          t("pipeline.tracking.rotateFailed", {
            defaultValue: "Could not issue a new link.",
          }),
      ),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      // Long enough to read, short enough that the button is a button again
      // before anyone wants to press it twice.
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(
        t("pipeline.tracking.copyFailed", {
          defaultValue: "Could not copy. Select the link and copy it manually.",
        }),
      );
    }
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Link2 className="h-3.5 w-3.5" />
            {t("pipeline.tracking.share", { defaultValue: "Customer link" })}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))]">
          <p className="text-sm font-medium">
            {t("pipeline.tracking.title", {
              defaultValue: "Tracking link for this deal",
            })}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("pipeline.tracking.hint", {
              defaultValue:
                "Anyone with this link sees the stage names and what was ordered. No value, no owner, no contact details, no sign-in.",
            })}
          </p>

          <div className="mt-3 flex gap-1.5">
            <Input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="h-8 font-mono text-[11px]"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 shrink-0 px-2"
              onClick={copy}
              aria-label={t("common.copy", { defaultValue: "Copy" })}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              {t("pipeline.tracking.preview", {
                defaultValue: "Open what they see",
              })}
            </a>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
            >
              <RefreshCw className="h-3 w-3" />
              {t("pipeline.tracking.regenerate", {
                defaultValue: "New link",
              })}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("pipeline.tracking.regenerateTitle", {
                defaultValue: "Issue a new link?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("pipeline.tracking.regenerateBody", {
                defaultValue:
                  "The link you already sent stops working immediately, and the customer is not told. Only do this if the current link reached the wrong person.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rotate.isPending}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={rotate.isPending}
              onClick={(e) => {
                e.preventDefault();
                rotate.mutate();
              }}
            >
              {t("pipeline.tracking.regenerateConfirm", {
                defaultValue: "Issue a new link",
              })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
