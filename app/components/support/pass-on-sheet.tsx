import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { Checkbox } from "~/components/ui/checkbox";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { cn } from "~/lib/utils";
import { desktopAutoFocus } from "~/lib/utils/touch";
import { SEVERITIES, escalateQueueTicket, queueKeys, type Severity, type TeamTicketDetail } from "~/lib/api/support-tickets";
import { SeverityMark, useAttachmentUrl, useSeverityLabel } from "./ticket-bits";

/**
 * An agency passes one of its businesses' reports on to re:praesent
 * (AGENCY_MODE_PLAN.md §7). It becomes a new report from the agency, linked
 * to this one, and the agency follows it in its own Help & changes. The
 * business only sees it when the box is ticked.
 */
export function PassOnSheet({ open, onOpenChange, ticket }: { open: boolean; onOpenChange: (v: boolean) => void; ticket: TeamTicketDetail }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const severityLabel = useSeverityLabel("team");
  const shots = ticket.messages.filter((m) => m.kind === "message" && m.side === "client").flatMap((m) => m.attachments);
  const [description, setDescription] = useState(ticket.description);
  const [severity, setSeverity] = useState<Severity>(ticket.severity);
  const [visible, setVisible] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  // A fresh form every time it opens: the business's words and screenshots to start from.
  useEffect(() => {
    if (!open) return;
    setDescription(ticket.description);
    setSeverity(ticket.severity);
    setVisible(false);
    setPicked(shots.slice(0, 6).map((a) => a.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticket.id]);
  const tooShort = description.trim().length < 5;

  const pass = useMutation({
    mutationFn: () => escalateQueueTicket(ticket.id, { description: description.trim(), severity, client_visible: visible, attachment_ids: picked }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: queueKeys.ticket("agency-support", ticket.id) });
      onOpenChange(false);
      toast.success(t("support.passOn.done", "Sent to re:praesent as #{{number}}. Follow it in Help & changes.", { number: r.number }), {
        action: { label: t("support.passOn.open", "Open"), onClick: () => navigate(`/help/${r.id}`) },
      });
    },
  });

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("support.passOn.title", "Pass to re:praesent")}
      description={t("support.passOn.subtitle", "re:praesent gets a new report about {{business}}, linked to this one. You follow it in your Help & changes.", {
        business: ticket.client.name,
      })}
      className="sm:max-w-[560px]"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!tooShort && !pass.isPending) pass.mutate();
        }}
        className="space-y-5 pb-1"
      >
        <div className="space-y-2">
          <label htmlFor="pass-desc" className="block text-[13px] font-semibold text-foreground">
            {t("support.passOn.what", "What should re:praesent know?")}
          </label>
          <textarea
            id="pass-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoFocus={desktopAutoFocus()}
            rows={5}
            maxLength={5000}
            className="block w-full resize-y rounded-xl border border-border bg-card px-3.5 py-3 text-[15px] leading-relaxed text-foreground outline-none focus:border-foreground/40 max-sm:text-[16px]"
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-foreground">{t("support.controls.severity", "How bad")}</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={severity === s}
                onClick={() => setSeverity(s)}
                className={cn(
                  "press inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-medium max-sm:h-11",
                  severity === s ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:border-foreground/40",
                )}
              >
                <SeverityMark severity={s} />
                {severityLabel(s)}
              </button>
            ))}
          </div>
        </fieldset>

        {shots.length ? (
          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold text-foreground">{t("support.passOn.shots", "Screenshots to send along")}</legend>
            <div className="flex flex-wrap gap-2">
              {shots.slice(0, 12).map((a) => (
                <ShotToggle
                  key={a.id}
                  id={a.id}
                  name={a.file_name}
                  on={picked.includes(a.id)}
                  disabled={!picked.includes(a.id) && picked.length >= 6}
                  onToggle={() => setPicked((p) => (p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id]))}
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
          <Checkbox checked={visible} onCheckedChange={(v) => setVisible(v === true)} className="mt-0.5" />
          <span className="min-w-0">
            <span className="block text-[14px] font-medium text-foreground">
              {t("help.new.visible", "{{business}} can read and reply", { business: ticket.client.name })}
            </span>
            <span className="block text-[12.5px] text-muted-foreground">
              {t("support.passOn.visibleHint", "They see the new report and re:praesent's answers. Your internal notes stay with you either way.")}
            </span>
          </span>
        </label>

        {pass.isError ? (
          <p role="alert" className="rounded-lg bg-destructive/8 px-3 py-2 text-[13px] text-destructive">
            {extractErrorMessage(pass.error) || t("support.passOn.failed", "It didn't go through. Check your connection and send it again.")}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={tooShort || pass.isPending}
          className="press flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-[15px] font-semibold text-background disabled:opacity-40"
        >
          {pass.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t("support.passOn.send", "Send to re:praesent")}
        </button>
      </form>
    </BottomSheet>
  );
}

function ShotToggle({ id, name, on, disabled, onToggle }: { id: string; name: string | null; on: boolean; disabled: boolean; onToggle: () => void }) {
  const { url } = useAttachmentUrl("team", id, "thumb");
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={name ?? "screenshot"}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "press relative size-20 overflow-hidden rounded-lg border-2 bg-muted disabled:opacity-40",
        on ? "border-foreground" : "border-transparent",
      )}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : null}
      {on ? (
        <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
          <Check className="size-3" aria-hidden />
        </span>
      ) : null}
    </button>
  );
}
