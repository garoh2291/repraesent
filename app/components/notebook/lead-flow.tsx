import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Ban,
  Briefcase,
  CheckCircle2,
  PhoneMissed,
  ShieldAlert,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { DayField } from "~/components/notebook/day-field";
import { useContactAttempt, useLeadOutcomeMutation, useMakeDeal } from "~/lib/hooks/useLeadOutcome";
import { useInvalidateWork } from "~/lib/hooks/useToday";
import { useWorkspaceCurrency } from "~/lib/hooks/useWorkspaceCurrency";
import { markLeadNotSpam, updateLeadStatus } from "~/lib/api/leads";
import type { ContactChannel, LeadOutcome } from "~/lib/api/lead-outcomes";
import { parseDealValue } from "~/lib/api/deals";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useComposeEmail } from "~/components/organism/compose-email/use-compose-email";
import { useCanSendEmail } from "~/lib/hooks/useCanSendEmail";

/** The little the flow needs to know about a lead. */
export interface FlowLead {
  id: string;
  name: string;
  status: string;
  phone?: string | null;
  email?: string | null;
}

/** Something to call the person in copy — never an empty "You called ." */
function displayName(
  l: { name?: string | null; email?: string | null; phone?: string | null },
  t: (k: string, d: string) => string,
): string {
  return (
    l.name?.trim() ||
    l.email?.trim() ||
    l.phone?.trim() ||
    t("outcome.thisPerson", "this person")
  );
}

/** Tomorrow 09:00 in the user's own timezone, as an ISO instant. */
export function tomorrowNineIso(days = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

function toDateInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fromDateInput(v: string) {
  const [y, m, d] = v.split("-").map(Number);
  const out = new Date(y, (m ?? 1) - 1, d ?? 1, 9, 0, 0, 0);
  return out.toISOString();
}

// ─── Outcome sheet ──────────────────────────────────────────────────────────

const OUTCOMES: {
  key: LeadOutcome;
  Icon: typeof CheckCircle2;
  tone: string;
}[] = [
  { key: "reached", Icon: CheckCircle2, tone: "text-earned" },
  { key: "no_answer", Icon: PhoneMissed, tone: "text-foreground" },
  { key: "not_interested", Icon: Ban, tone: "text-muted-foreground" },
  { key: "fake", Icon: ShieldAlert, tone: "text-overdue" },
];

function OutcomeSheet({
  lead,
  channel,
  open,
  onOpenChange,
  onMakeDeal,
}: {
  lead: FlowLead | null;
  channel: ContactChannel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMakeDeal: (lead: FlowLead) => void;
}) {
  const { t } = useTranslation();
  const mutation = useLeadOutcomeMutation();
  const invalidate = useInvalidateWork();
  // Fresh state on every open: the provider remounts this sheet (key) each
  // time it opens, so nothing from the previous lead can flash.
  const [choice, setChoice] = useState<LeadOutcome | null>(null);
  const [note, setNote] = useState("");
  const [again, setAgain] = useState(() => toDateInput(tomorrowNineIso()));
  const [reached, setReached] = useState(false);

  if (!lead) return null;
  const who = displayName(lead, t);

  // Optimistic: the owner's answer is recorded the moment they tap Save —
  // the sheet closes (or moves on to "What's next?") right away and a toast
  // reports the result. A round trip to the server never blocks them.
  const save = () => {
    if (!choice) return;
    const picked = choice;
    const toastId = toast.loading(t("outcome.saving", "Saving…"));
    if (picked === "reached") setReached(true);
    else onOpenChange(false);
    mutation
      .mutateAsync({
        leadId: lead.id,
        outcome: picked,
        note: note.trim() || undefined,
        follow_up_due_at: picked === "no_answer" ? fromDateInput(again) : undefined,
        follow_up_title:
          picked === "no_answer"
            ? t("outcome.callAgainTitle", "Call {{name}} again", { name: who }).trim()
            : undefined,
      })
      .then((res) => {
        const undo = async () => {
          try {
            if (picked === "fake") await markLeadNotSpam(lead.id);
            else if (res.to_status) await updateLeadStatus(lead.id, res.from_status);
            invalidate();
          } catch (err) {
            toast.error(extractErrorMessage(err) || t("common.error", "Something went wrong"));
          }
        };
        toast.success(t(`outcome.saved.${picked}`), {
          id: toastId,
          action:
            picked === "fake" || (picked === "not_interested" && res.to_status)
              ? { label: t("common.undo", "Undo"), onClick: () => void undo() }
              : undefined,
        });
      })
      .catch((err) => {
        toast.error(
          extractErrorMessage(err) || t("outcome.saveFailed", "Couldn't save — please try again."),
          { id: toastId },
        );
      });
  };

  if (reached) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={t("outcome.reachedTitle", "Good. What's next with {{name}}?", { name: who })}
        description={t("outcome.reachedBody", "Turn it into a deal so it gets a value and a next step — or just leave it for now.")}
      >
        <div className="grid gap-2 pt-1">
          <Button
            size="lg"
            className="h-12 justify-start gap-3 text-[15px]"
            onClick={() => {
              onOpenChange(false);
              onMakeDeal(lead);
            }}
          >
            <Briefcase className="size-5" />
            {t("makeDeal.cta", "Make a deal")}
          </Button>
          <Button variant="outline" size="lg" className="h-12 justify-start text-[15px]" onClick={() => onOpenChange(false)}>
            {t("outcome.notNow", "Not now")}
          </Button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("outcome.title", "How did it go?")}
      description={
        channel
          ? t(`outcome.sub.${channel}`, { name: who })
          : t("outcome.subGeneric", "Record what happened with {{name}}.", { name: who })
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("outcome.later", "Later")}
          </Button>
          <Button disabled={!choice} onClick={save} className="min-w-28">
            {t("outcome.save", "Save")}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2 pt-1" role="radiogroup">
        {OUTCOMES.map(({ key, Icon, tone }) => {
          const selected = choice === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setChoice(key)}
              className={cn(
                "press flex min-h-[76px] flex-col items-start justify-between gap-2 rounded-xl border p-3 text-left transition-colors",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:border-foreground/30",
              )}
            >
              <Icon className={cn("size-5", selected ? "text-background" : tone)} />
              <span className="text-[14px] font-semibold leading-tight">{t(`outcome.options.${key}`)}</span>
            </button>
          );
        })}
      </div>

      {choice === "no_answer" ? (
        <DayField
          className="mt-4 rounded-xl bg-muted/60 p-3"
          label={t("outcome.callAgainOn", "Call again on")}
          value={again}
          onChange={setAgain}
        />
      ) : null}
      {choice === "fake" ? (
        <p className="mt-4 rounded-lg bg-overdue-soft px-3 py-2.5 text-[13px] text-foreground">
          {t("outcome.fakeHint", "It gets hidden and this sender is blocked. You can undo it.")}
        </p>
      ) : null}
      {choice === "not_interested" ? (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2.5 text-[13px] text-muted-foreground">
          {t("outcome.notInterestedHint", "It moves to your closed inquiries. Nothing is deleted.")}
        </p>
      ) : null}

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("outcome.notePlaceholder", "Add a note (optional)")}
        className="mt-4 min-h-20 bg-card"
      />
    </BottomSheet>
  );
}

// ─── Make a deal ────────────────────────────────────────────────────────────

export function MakeDealSheet({
  lead,
  open,
  onOpenChange,
}: {
  lead: FlowLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { currency } = useWorkspaceCurrency();
  const navigate = useNavigate();
  const mutation = useMakeDeal();
  // Remounted (key) on every open, so these start fresh for this lead.
  const [title, setTitle] = useState(() => lead?.name || "");
  const [value, setValue] = useState("");
  const [task, setTask] = useState(() => t("makeDeal.defaultTask", "Send an offer"));
  const [due, setDue] = useState(() => toDateInput(tomorrowNineIso()));

  if (!lead) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await mutation.mutateAsync({
        leadId: lead.id,
        title: title.trim() || undefined,
        value: value.trim() ? parseDealValue(value) : null,
        currency,
        first_task: task.trim() ? { title: task.trim(), due_date: fromDateInput(due) } : undefined,
      });
      onOpenChange(false);
      toast.success(
        res.existing
          ? t("makeDeal.existing", "This inquiry already has a deal")
          : t("makeDeal.created", "Deal created"),
        {
        action: {
          label: t("makeDeal.open", "Open"),
          onClick: () => navigate(`/pipeline/${res.deal_id}`),
        },
        },
      );
    } catch (err) {
      toast.error(extractErrorMessage(err) || t("common.error", "Something went wrong"));
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("makeDeal.title", "Make a deal")}
      description={t("makeDeal.body", "A deal keeps the value and the next step in one place.")}
    >
      <form id="make-deal-form" onSubmit={(e) => void submit(e)} className="space-y-3 pt-1">
        <label className="block space-y-1.5">
          <span className="text-[12.5px] font-medium text-muted-foreground">{t("makeDeal.what", "What is it?")}</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 bg-card" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[12.5px] font-medium text-muted-foreground">
            {t("makeDeal.value", "Roughly worth ({{currency}})", { currency })}
          </span>
          <Input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className="num h-11 bg-card"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[12.5px] font-medium text-muted-foreground">{t("makeDeal.nextStep", "Next step")}</span>
          <Input value={task} onChange={(e) => setTask(e.target.value)} className="h-11 bg-card" />
        </label>
        <DayField label={t("makeDeal.when", "When")} value={due} onChange={setDue} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="submit" loading={mutation.isPending} className="min-w-32">
            {t("makeDeal.submit", "Create deal")}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

// ─── The flow: tap → attempt → come back → outcome ─────────────────────────

interface LeadFlowApi {
  /** Call / WhatsApp / Email tapped: log the attempt, then ask how it went. */
  contact: (lead: FlowLead, channel: ContactChannel) => void;
  /** Ask for an outcome without a tap (called from another phone, met in person). */
  recordOutcome: (lead: FlowLead) => void;
  makeDeal: (lead: FlowLead) => void;
  /**
   * Email opens our composer (a working mailbox is connected) instead of the
   * mail app. Callers pass it to ContactActions so the mailto: link is held back.
   */
  emailInApp: boolean;
}

const LeadFlowContext = createContext<LeadFlowApi | null>(null);

/**
 * One provider for the whole inquiry loop, so the Today screen, the inquiry
 * list/kanban and the lead sheet all behave the same (NOTEBOOK_UX_PLAN.md §3).
 * The outcome sheet opens when the user comes back to the app from the
 * dialer / WhatsApp (visibilitychange), or right away on a desktop.
 */
export function LeadFlowProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const attempt = useContactAttempt();
  const { openCompose } = useComposeEmail();
  const emailInApp = useCanSendEmail();
  const [lead, setLead] = useState<FlowLead | null>(null);
  const [channel, setChannel] = useState<ContactChannel | null>(null);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [dealLead, setDealLead] = useState<FlowLead | null>(null);
  const [dealOpen, setDealOpen] = useState(false);
  // Bumped on every open: the sheets are keyed by it so they start fresh.
  const [outcomeSession, setOutcomeSession] = useState(0);
  const [dealSession, setDealSession] = useState(0);
  const pending = useRef<{ lead: FlowLead; channel: ContactChannel } | null>(null);

  const openOutcome = useCallback((l: FlowLead, ch: ContactChannel | null) => {
    setLead(l);
    setChannel(ch);
    setOutcomeSession((n) => n + 1);
    setOutcomeOpen(true);
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !pending.current) return;
      const p = pending.current;
      pending.current = null;
      openOutcome(p.lead, p.channel);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [openOutcome]);

  const contact = useCallback<LeadFlowApi["contact"]>(
    (l, ch) => {
      const email = l.email?.trim();
      if (ch === "email" && emailInApp && email) {
        // Sent from our composer: count the attempt only once it actually
        // went out, then ask how it went — nothing to wait for.
        const name = l.name?.trim() || undefined;
        openCompose({
          to: [{ email, name }],
          leadId: l.id,
          contextLabel: t("compose.contextContact", {
            defaultValue: "To {{name}}",
            name: displayName(l, t),
          }),
          invalidateKeys: [
            ["lead-history", l.id],
            ["contact-emails"],
            ["outbound-pending"],
            ["mail-messages"],
          ],
          onSent: () => attempt.mutate({ leadId: l.id, channel: "email" }),
          // After the "Email sent" card is closed, never on top of it.
          onDone: () => openOutcome(l, "email"),
        });
        return;
      }
      attempt.mutate({ leadId: l.id, channel: ch });
      pending.current = { lead: l, channel: ch };
      // On a phone, the dialer / WhatsApp takes over the screen and the sheet
      // opens when the owner comes back (visibilitychange above). WhatsApp
      // and email open a new tab or app on a computer, where the page may
      // never be hidden: ask shortly after. A call from a computer usually
      // goes to a desk phone, so ask then too — but never on a touch device,
      // where the call-confirm popup keeps the page visible before dialling.
      const touch =
        typeof window !== "undefined" &&
        window.matchMedia?.("(pointer: coarse)").matches;
      if (ch === "call" && touch) return;
      window.setTimeout(() => {
        const p = pending.current;
        if (
          p &&
          p.lead.id === l.id &&
          p.channel === ch &&
          document.visibilityState === "visible"
        ) {
          pending.current = null;
          openOutcome(l, ch);
        }
      }, 1600);
    },
    [attempt, openOutcome, openCompose, emailInApp, t],
  );

  const api = useMemo<LeadFlowApi>(
    () => ({
      contact,
      recordOutcome: (l) => openOutcome(l, null),
      makeDeal: (l) => {
        setDealLead(l);
        setDealSession((n) => n + 1);
        setDealOpen(true);
      },
      emailInApp,
    }),
    [contact, openOutcome, emailInApp],
  );

  return (
    <LeadFlowContext.Provider value={api}>
      {children}
      <OutcomeSheet
        key={`outcome-${outcomeSession}`}
        lead={lead}
        channel={channel}
        open={outcomeOpen}
        onOpenChange={setOutcomeOpen}
        onMakeDeal={api.makeDeal}
      />
      <MakeDealSheet
        key={`deal-${dealSession}`}
        lead={dealLead}
        open={dealOpen}
        onOpenChange={setDealOpen}
      />
    </LeadFlowContext.Provider>
  );
}

/** The inquiry loop, or a no-op outside a provider (keeps call sites simple). */
export function useLeadFlow(): LeadFlowApi {
  const ctx = useContext(LeadFlowContext);
  return (
    ctx ?? {
      contact: () => {},
      recordOutcome: () => {},
      makeDeal: () => {},
      emailInApp: false,
    }
  );
}

/** Small label for a lead's last recorded outcome. */
export function OutcomeBadge({
  outcome,
  attempts,
  className,
}: {
  outcome: LeadOutcome | null | undefined;
  attempts?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!outcome && !attempts) return null;
  const label = outcome
    ? t(`outcome.badge.${outcome}`)
    : t("outcome.badge.tried", { count: attempts ?? 0 });
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        outcome === "reached"
          ? "bg-earned-soft text-earned"
          : outcome === "fake"
            ? "bg-overdue-soft text-overdue"
            : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {label}
      {outcome === "no_answer" && attempts && attempts > 1 ? ` ×${attempts}` : ""}
    </span>
  );
}

