import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HideLeadDialog } from "~/components/organism/lead-spam/hide-lead-dialog";
import { markLeadNotSpam, markLeadSpam, updateLeadStatus, type Lead } from "~/lib/api/leads";
import { useLeadStages } from "~/lib/hooks/usePipelineStages";
import { refreshLeadViews, type HideChoice } from "./hide-choice";

export type HideableLead = Pick<Lead, "id" | "status" | "email" | "phone"> &
  Partial<Pick<Lead, "first_name" | "last_name" | "full_name">>;

/**
 * Asks "just hide, or hide and block the sender?" when a lead moves to a
 * hidden-category stage — from the status dropdown (table, sheet, lead page)
 * or a kanban drag. Plain hiding used to teach the filter nothing, so the same
 * sender's next enquiry landed in the pipeline again.
 *
 * A hook rather than a check in one handler, the same reasoning as deals'
 * `useTerminalStageGuard`: every surface that moves a lead calls
 * `requestStatusChange`, and `proceed` stays that surface's own move (with its
 * own optimistic update), so the card only moves once the person has chosen.
 *
 * Kanban Cmd/Ctrl+Z undo does not come through here: it restores a state the
 * person was in a moment ago.
 */
export function useHideLeadGuard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { byKey } = useLeadStages();
  const [pending, setPending] = useState<{ lead: HideableLead; proceed: () => unknown } | null>(null);
  // What the dialog shows; kept after closing so the exit animation doesn't go blank.
  const [shown, setShown] = useState<{ lead: HideableLead; n: number } | null>(null);

  const undoHide = useCallback(
    async (lead: HideableLead) => {
      try {
        await updateLeadStatus(lead.id, lead.status);
        refreshLeadViews(queryClient, lead.id);
      } catch {
        toast.error(t("leads.spam.error"));
      }
    },
    [queryClient, t],
  );

  const notSpam = useCallback(
    async (leadId: string) => {
      try {
        const res = await markLeadNotSpam(leadId);
        refreshLeadViews(queryClient, leadId);
        toast.success(t("leads.spam.restored"), {
          description: res.alsoRestored ? t("leads.spam.alsoRestored", { count: res.alsoRestored }) : undefined,
        });
      } catch {
        toast.error(t("leads.spam.error"));
      }
    },
    [queryClient, t],
  );

  const block = useCallback(
    async (lead: HideableLead) => {
      try {
        // The lead is already hidden by now; say where it was so Undo can put it back.
        const res = await markLeadSpam(lead.id, lead.status);
        refreshLeadViews(queryClient, lead.id);
        toast.success(t("leads.spam.marked"), {
          description: [
            res.blocked.length ? t("leads.spam.blockedWhat", { what: res.blocked.map((k) => t(`leads.spam.kind.${k}`)).join(", ") }) : null,
            res.alsoHidden ? t("leads.spam.alsoHidden", { count: res.alsoHidden }) : null,
          ]
            .filter(Boolean)
            .join(" "),
          action: { label: t("leads.spam.undo"), onClick: () => void notSpam(lead.id) },
          duration: 8000,
        });
      } catch {
        toast.error(t("leads.spam.error"));
      }
    },
    [notSpam, queryClient, t],
  );

  const apply = useCallback(
    async (lead: HideableLead, proceed: () => unknown, choice: HideChoice) => {
      try {
        await proceed();
      } catch {
        return; // the move itself failed and rolled back; its own handler said so
      }
      if (choice === "block") {
        await block(lead);
        return;
      }
      toast.success(t("leads.hide.hidden"), {
        description: t("leads.hide.hiddenHint"),
        action: { label: t("leads.hide.blockSender"), onClick: () => void block(lead) },
        cancel: { label: t("leads.spam.undo"), onClick: () => void undoHide(lead) },
        duration: 8000,
      });
    },
    [block, t, undoHide],
  );

  const requestStatusChange = useCallback(
    (lead: HideableLead, toStatus: string, proceed: () => unknown) => {
      const hiding =
        lead.status !== toStatus &&
        byKey.get(toStatus)?.category === "hidden" &&
        byKey.get(lead.status)?.category !== "hidden";
      // Nothing to block (no email, no phone): hiding is all there is.
      if (!hiding || (!lead.email && !lead.phone)) {
        try {
          const r = proceed();
          if (r instanceof Promise) r.catch(() => undefined); // its own handler reports failures
        } catch {
          // same: the surface's own error handling already ran
        }
        return;
      }
      setPending({ lead, proceed });
      setShown((prev) => ({ lead, n: (prev?.n ?? 0) + 1 }));
    },
    [apply, byKey],
  );

  const lead = shown?.lead;
  const name =
    lead?.full_name?.trim() ||
    [lead?.first_name, lead?.last_name].filter(Boolean).join(" ").trim() ||
    lead?.email ||
    lead?.phone ||
    t("leads.hide.thisLead");

  const guardModal = (
    <HideLeadDialog
      key={shown?.n ?? 0}
      open={!!pending}
      name={name}
      email={lead?.email ?? null}
      phone={lead?.phone ?? null}
      onCancel={() => setPending(null)}
      onChoose={(choice) => {
        if (!pending) return;
        setPending(null);
        void apply(pending.lead, pending.proceed, choice);
      }}
    />
  );

  return { requestStatusChange, guardModal };
}
