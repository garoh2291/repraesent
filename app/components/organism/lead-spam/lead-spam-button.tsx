import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "~/components/ui/button";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";
import { markLeadNotSpam, markLeadSpam, type Lead } from "~/lib/api/leads";
import { useLeadStages } from "~/lib/hooks/usePipelineStages";
import { refreshLeadViews } from "~/lib/leads/hide-choice";
import { cn } from "~/lib/utils";

/**
 * "Mark as spam" / "Not spam" for one lead. Spam hides it AND blocks the
 * sender (email + phone) so their next lead goes straight to Hidden; plain
 * stage moves ask (see `useHideLeadGuard`). Reversible from the toast, so no
 * confirm step here.
 */
export function useLeadSpamActions(lead: Pick<Lead, "id" | "status">) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { byKey } = useLeadStages();
  const isHidden = byKey.get(lead.status)?.category === "hidden";

  const refresh = () => refreshLeadViews(queryClient, lead.id);

  const notSpam = useMutation({
    mutationFn: () => markLeadNotSpam(lead.id),
    onSuccess: (res) => {
      refresh();
      toast.success(t("leads.spam.restored"), {
          description: res.alsoRestored ? t("leads.spam.alsoRestored", { count: res.alsoRestored }) : undefined,
        });
    },
    onError: () => toast.error(t("leads.spam.error")),
  });

  const spam = useMutation({
    mutationFn: () => markLeadSpam(lead.id),
    onSuccess: (res) => {
      refresh();
      toast.success(t("leads.spam.marked"), {
        description: [
          res.blocked.length ? t("leads.spam.blockedWhat", { what: res.blocked.map((k) => t(`leads.spam.kind.${k}`)).join(", ") }) : null,
          res.alsoHidden ? t("leads.spam.alsoHidden", { count: res.alsoHidden }) : null,
        ]
          .filter(Boolean)
          .join(" "),
        action: { label: t("leads.spam.undo"), onClick: () => notSpam.mutate() },
      });
    },
    onError: () => toast.error(t("leads.spam.error")),
  });

  const busy = spam.isPending || notSpam.isPending;
  return {
    isHidden,
    busy,
    markSpam: () => spam.mutate(),
    markNotSpam: () => notSpam.mutate(),
  };
}

export function LeadSpamButton({ lead, className, size = "sm" }: { lead: Pick<Lead, "id" | "status">; className?: string; size?: "sm" | "default" }) {
  const { t } = useTranslation();
  const { isHidden, busy, markSpam, markNotSpam } = useLeadSpamActions(lead);
  return isHidden ? (
    <Button type="button" variant="outline" size={size} className={cn("gap-2", className)} disabled={busy} onClick={markNotSpam}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
      {t("leads.spam.notSpam")}
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn("gap-2 text-destructive hover:bg-destructive/5 hover:text-destructive", className)}
      disabled={busy}
      onClick={markSpam}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
      {t("leads.spam.mark")}
    </Button>
  );
}

/**
 * The same action as a ⋯ menu row (phones). Takes the actions from a
 * `useLeadSpamActions` call in the page, so the mutation outlives the menu.
 */
export function LeadSpamMenuItem({ actions }: { actions: ReturnType<typeof useLeadSpamActions> }) {
  const { t } = useTranslation();
  const { isHidden, busy, markSpam, markNotSpam } = actions;
  return isHidden ? (
    <DropdownMenuItem disabled={busy} onSelect={markNotSpam}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
      {t("leads.spam.notSpam")}
    </DropdownMenuItem>
  ) : (
    <DropdownMenuItem variant="destructive" disabled={busy} onSelect={markSpam}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
      {t("leads.spam.mark")}
    </DropdownMenuItem>
  );
}
