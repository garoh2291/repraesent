import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "~/components/ui/button";
import { markLeadNotSpam, markLeadSpam, type Lead } from "~/lib/api/leads";
import { useLeadStages } from "~/lib/hooks/usePipelineStages";
import { cn } from "~/lib/utils";

/**
 * "Mark as spam" / "Not spam" for one lead. Spam hides it AND blocks the
 * sender (email + phone) so their next lead goes straight to Hidden; plain
 * stage moves still just move. Reversible from the toast, so no confirm step.
 */
export function LeadSpamButton({ lead, className, size = "sm" }: { lead: Pick<Lead, "id" | "status">; className?: string; size?: "sm" | "default" }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { byKey } = useLeadStages();
  const isHidden = byKey.get(lead.status)?.category === "hidden";

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["lead", lead.id] });
    void queryClient.invalidateQueries({ queryKey: ["lead-blocklist"] });
  };

  const notSpam = useMutation({
    mutationFn: () => markLeadNotSpam(lead.id),
    onSuccess: () => {
      refresh();
      toast.success(t("leads.spam.restored"));
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
  return isHidden ? (
    <Button type="button" variant="outline" size={size} className={cn("gap-2", className)} disabled={busy} onClick={() => notSpam.mutate()}>
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
      onClick={() => spam.mutate()}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
      {t("leads.spam.mark")}
    </Button>
  );
}
