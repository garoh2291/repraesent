import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { ArrowLeft, Briefcase, Check, Mail, MessageCircle, MessageSquareText, Phone, SkipForward } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/notebook/empty-state";
import { telHref, whatsappHref } from "~/components/notebook/contact-actions";
import {
  OutcomeBadge,
  OutcomeFields,
  useLeadFlow,
  useOutcomeForm,
  type FlowLead,
} from "~/components/notebook/lead-flow";
import { isoDay } from "~/components/notebook/day-field";
import { CALL_QUEUE_LIMIT, useToday } from "~/lib/hooks/useToday";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { getNotes } from "~/lib/api/notes";
import type { TodayLead, TodayTask } from "~/lib/api/today";
import type { ContactChannel, LeadOutcome } from "~/lib/api/lead-outcomes";
import { leadSourceLabel, waitingFor } from "~/lib/leads/source-label";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface QueueItem {
  lead: TodayLead;
  /** Set for a "no answer" call-back. */
  task?: TodayTask;
}

type Result = { skipped: true } | { outcome: LeadOutcome; again?: string };

interface Tally {
  reached: number;
  no_answer: number;
  not_interested: number;
  fake: number;
  skipped: number;
  /** yyyy-MM-dd of each call-back set, to say "tomorrow" only when true. */
  againDays: string[];
}

const EMPTY_TALLY: Tally = { reached: 0, no_answer: 0, not_interested: 0, fake: 0, skipped: 0, againDays: [] };

function toFlowLead(l: TodayLead): FlowLead {
  return { id: l.id, name: l.name, status: l.status, phone: l.phone, email: l.email };
}

function notesKey(leadId: string) {
  return ["lead-notes", leadId] as const;
}

/**
 * "Start calls" (MOBILE_PACKAGE_PLAN.md C1): everyone waiting on you, one
 * person at a time — call-backs first, then new inquiries, the same order as
 * Today. The list is frozen when you start, so it never reshuffles under you.
 */
export function CallQueue() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const scope = params.get("scope") === "all" ? "all" : "me";
  const q = useToday(scope, true, CALL_QUEUE_LIMIT);
  const qc = useQueryClient();
  const canEdit = useCanEditLeads();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [tally, setTally] = useState<Tally>(EMPTY_TALLY);
  // How many people waited in total when the run started (the queue holds at most CALL_QUEUE_LIMIT).
  const [waitingTotal, setWaitingTotal] = useState(0);

  // Snapshot once: later refetches (every save refreshes Today) are ignored.
  useEffect(() => {
    if (items || !q.data || q.isPlaceholderData) return;
    if (!q.data.supported) {
      setItems([]);
      return;
    }
    const seen = new Set<string>();
    const list: QueueItem[] = [];
    for (const f of q.data.follow_ups ?? []) {
      if (seen.has(f.lead.id)) continue;
      seen.add(f.lead.id);
      list.push({ lead: f.lead, task: f.task });
    }
    for (const l of q.data.new_leads ?? []) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      list.push({ lead: l });
    }
    setItems(list);
    setWaitingTotal((q.data.counts?.new_leads ?? 0) + (q.data.counts?.follow_ups_due ?? 0));
  }, [q.data, q.isPlaceholderData, items]);

  // The next person's last note is ready before their card slides in.
  const next = items?.[index + 1];
  useEffect(() => {
    if (!next) return;
    void qc.prefetchQuery({
      queryKey: notesKey(next.lead.id),
      queryFn: () => getNotes(next.lead.id),
      staleTime: 60_000,
    });
  }, [next, qc]);

  const finish = (r: Result) => {
    setTally((old) => {
      if ("skipped" in r) return { ...old, skipped: old.skipped + 1 };
      return {
        ...old,
        [r.outcome]: old[r.outcome] + 1,
        againDays: r.outcome === "no_answer" && r.again ? [...old.againDays, r.again] : old.againDays,
      };
    });
    setIndex((i) => i + 1);
  };

  if (!items) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-10">
        <div className="size-6 app-spin rounded-full border-2 border-foreground/15 border-t-foreground" />
      </div>
    );
  }

  const total = items.length;
  const done = index >= total;
  const current = done ? null : items[index];

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-3 pb-5 sm:pt-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/"
          className="press -ml-2 inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("calls.backToToday", "Today")}
        </Link>
        {total > 0 && !done ? (
          <span className="num text-[13px] font-medium text-muted-foreground" aria-live="polite">
            {t("calls.progress", "{{n}} of {{total}}", { n: index + 1, total })}
          </span>
        ) : null}
      </div>
      {total > 0 ? (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{ width: `${(Math.min(index, total) / total) * 100}%` }}
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-1 flex-col">
        {total === 0 ? (
          <EmptyState
            className="px-0"
            icon={<Check />}
            title={t("calls.emptyTitle", "Nobody is waiting on a call")}
            body={t("calls.emptyBody", "New inquiries and call-backs show up here. Nothing to do right now.")}
            action={
              <Button asChild variant="outline">
                <Link to="/">{t("calls.backToTodayButton", "Back to Today")}</Link>
              </Button>
            }
          />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {current ? (
              <QueueCard
                key={`${index}-${current.lead.id}`}
                item={current}
                canEdit={canEdit}
                onFinish={finish}
              />
            ) : (
              <DoneCard key="done" tally={tally} moreWaiting={Math.max(0, waitingTotal - total)} />
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ─── One person ────────────────────────────────────────────────────────────

function QueueCard({
  item,
  canEdit,
  onFinish,
}: {
  item: QueueItem;
  canEdit: boolean;
  onFinish: (r: Result) => void;
}) {
  const { t, i18n } = useTranslation();
  const reduced = useReducedMotion();
  const flow = useLeadFlow();
  const { lead, task } = item;
  const fl = useMemo(() => toFlowLead(lead), [lead]);
  const form = useOutcomeForm(fl);
  const [phase, setPhase] = useState<"contact" | "outcome" | "reached">("contact");
  const [channel, setChannel] = useState<ContactChannel | null>(null);
  const name = lead.name || lead.email || lead.phone || t("today.unnamed", "Someone");

  const notes = useQuery({
    queryKey: notesKey(lead.id),
    queryFn: () => getNotes(lead.id),
    staleTime: 60_000,
  });
  const lastNote = notes.data?.[0];

  // ── Swipe left = skip (never records an outcome) ──
  const x = useMotionValue(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x0: number; y0: number; active: boolean } | null>(null);
  const dragged = useRef(false);
  const swipeOn = phase === "contact" && !reduced;

  const skip = () => onFinish({ skipped: true });

  const onPointerDown = (e: React.PointerEvent) => {
    dragged.current = false;
    if (!swipeOn || e.pointerType === "mouse") return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, active: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        drag.current = null; // a scroll, not a swipe
        return;
      }
      if (Math.abs(dx) < 10) return;
      d.active = true;
      dragged.current = true;
      // Start from where the threshold was crossed: no jump.
      d.x0 += dx > 0 ? 10 : -10;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    const off = e.clientX - d.x0;
    // Only left means something; right rubber-bands.
    x.set(off > 0 ? off * 0.25 : off);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.active || d.id !== e.pointerId) return;
    const w = cardRef.current?.offsetWidth || 320;
    const v = x.getVelocity();
    if (x.get() < -w * 0.3 || v < -600) {
      void animate(x, -w * 1.15, { type: "spring", stiffness: 380, damping: 40, velocity: v }).then(skip);
    } else {
      void animate(x, 0, { type: "spring", stiffness: 520, damping: 38, velocity: v });
    }
  };

  const contact = (ch: ContactChannel) => {
    flow.contact(fl, ch, { inline: true });
    setChannel(ch);
    if (canEdit) setPhase("outcome");
  };

  const save = () => {
    form.save((picked, again) => {
      try {
        navigator.vibrate?.(8);
      } catch {
        /* iOS has no vibrate */
      }
      if (picked === "reached") setPhase("reached");
      else onFinish({ outcome: picked, again });
    });
  };

  const phone = lead.phone?.trim() || null;
  const email = lead.email?.trim() || null;
  const wa = phone ? whatsappHref(phone) : null;
  const channels: { ch: ContactChannel; href: string; label: string; Icon: typeof Phone; external?: boolean }[] = [];
  if (phone) channels.push({ ch: "call", href: telHref(phone), label: t("outcome.call", "Call"), Icon: Phone });
  if (wa) channels.push({ ch: "whatsapp", href: wa, label: t("outcome.whatsapp", "WhatsApp"), Icon: MessageCircle, external: true });
  if (email) channels.push({ ch: "email", href: `mailto:${email}`, label: t("outcome.email", "Email"), Icon: Mail });

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE_OUT } }}
      exit={{ opacity: 0, x: reduced ? 0 : -24, transition: { duration: 0.16, ease: EASE_OUT } }}
      className="flex flex-1 flex-col"
    >
      <motion.div
        ref={cardRef}
        style={{ x }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // A swipe that ends over a button must not also tap it.
        onClickCapture={(e) => {
          if (dragged.current) {
            e.preventDefault();
            e.stopPropagation();
            dragged.current = false;
          }
        }}
        className={cn(
          "flex flex-1 flex-col rounded-2xl border border-border bg-card p-5 shadow-[0_1px_0_rgba(20,21,22,0.04)]",
          swipeOn && "touch-pan-y",
        )}
      >
        {/* Who — an ink band, like the sidebar and the start screen, so the
            person reads first and the card never looks empty. */}
        <div className="-mx-5 -mt-5 rounded-t-2xl bg-foreground px-5 pt-5 pb-4 text-background">
          <div className="min-w-0">
            <Link
              to={`/lead-form/${lead.id}`}
              className="title-display block truncate text-[26px] font-semibold leading-tight text-background hover:underline hover:decoration-background/40 hover:underline-offset-4"
            >
              {name}
            </Link>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-background/65">
              <span>{leadSourceLabel(lead, t)}</span>
              <span aria-hidden>·</span>
              {task ? (
                <span
                  className={cn(
                    task.urgency === "overdue" &&
                      "rounded-md bg-overdue px-1.5 py-0.5 text-[11.5px] font-semibold text-white",
                  )}
                >
                  {t("today.callAgainDue", "Call again")}
                </span>
              ) : (
                <span className="num">
                  {t("today.waiting", "waiting {{time}}", { time: waitingFor(lead.created_at, i18n.language) })}
                </span>
              )}
              {task || lead.attempts ? (
                <OutcomeBadge
                  outcome={task ? "no_answer" : null}
                  attempts={lead.attempts}
                  className="bg-marker text-foreground"
                />
              ) : null}
            </p>
          </div>

          {/* How to reach them — seen before tapping, like a notebook entry */}
          {phase !== "outcome" && (lead.phone || lead.email) ? (
            <div className="mt-3 space-y-0.5 text-[14px] text-background/85">
              {lead.phone ? <p className="num truncate">{lead.phone}</p> : null}
              {lead.email ? <p className="truncate text-background/65">{lead.email}</p> : null}
            </div>
          ) : null}
        </div>

        {/* Last note */}
        {phase !== "outcome" ? (
          <div className="mt-4 flex-1 rounded-xl bg-muted/60 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t("calls.lastNote", "Last note")}
            </p>
            <p className="mt-1 line-clamp-4 whitespace-pre-line text-[14px] leading-relaxed text-foreground">
              {notes.isLoading
                ? "…"
                : lastNote?.content?.trim() || (
                    <span className="text-muted-foreground">{t("calls.noNote", "No notes yet.")}</span>
                  )}
            </p>
          </div>
        ) : null}

        {phase === "contact" ? (
          <div className="mt-auto pt-6">
            {channels.length === 0 ? (
              <p className="mb-3 text-[13px] text-muted-foreground">
                {t("calls.noChannel", "No phone or email on file. Open the inquiry to add one.")}
              </p>
            ) : (
              <div className="grid gap-2">
                {channels.map(({ ch, href, label, Icon, external }) => (
                  <a
                    key={ch}
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    onClick={(e) => {
                      if (ch === "email" && flow.emailInApp) e.preventDefault();
                      contact(ch);
                    }}
                    className={cn(
                      "press flex h-14 items-center justify-center gap-2.5 rounded-xl border text-[16px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
                      ch === "call"
                        ? "border-foreground bg-foreground text-background hover:bg-foreground/90"
                        : "border-border bg-card text-foreground hover:border-foreground/30 hover:bg-accent",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {label}
                  </a>
                ))}
              </div>
            )}
            {/* Skip on the left, "How did it go?" on the right (under the thumb). */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-12 gap-2 text-[14px]" onClick={skip}>
                <SkipForward className="size-4" aria-hidden />
                {t("calls.skip", "Skip")}
              </Button>
              {canEdit ? (
                <Button
                  variant="ghost"
                  className="h-12 gap-2 text-[14px]"
                  onClick={() => {
                    setChannel(null);
                    setPhase("outcome");
                  }}
                >
                  <MessageSquareText className="size-4" aria-hidden />
                  {t("calls.record", "How did it go?")}
                </Button>
              ) : (
                <span />
              )}
            </div>
            {swipeOn ? (
              <p className="mt-2 text-center text-[11.5px] text-muted-foreground pointer-fine:hidden">
                {t("calls.swipeHint", "Swipe left to skip")}
              </p>
            ) : null}
          </div>
        ) : null}

        {phase === "outcome" ? (
          <div className="mt-4 flex flex-1 flex-col">
            <p className="title-display text-[20px] font-semibold text-foreground">
              {t("outcome.title", "How did it go?")}
            </p>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              {channel
                ? t(`outcome.sub.${channel}`, { name })
                : t("outcome.subGeneric", "Record what happened with {{name}}.", { name })}
            </p>
            <div className="mt-3">
              <OutcomeFields form={form} lead={fl} />
            </div>
            <div className="mt-auto grid grid-cols-[auto_1fr] gap-2 pt-5">
              <Button variant="ghost" className="h-12 px-4 text-[14px]" onClick={skip}>
                {t("calls.later", "Later")}
              </Button>
              <Button className="h-12 text-[15px]" disabled={!form.choice} onClick={save}>
                {t("calls.saveNext", "Save · next")}
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "reached" ? (
          <div className="mt-auto pt-6">
            <p className="title-display text-[20px] font-semibold text-foreground">
              {t("outcome.reachedTitle", "Good. What's next with {{name}}?", { name })}
            </p>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              {t("outcome.reachedBody", "Turn it into a deal so it gets a value and a next step — or just leave it for now.")}
            </p>
            <div className="mt-4 grid gap-2">
              <Button
                className="h-14 gap-2.5 text-[16px]"
                onClick={() => {
                  flow.makeDeal(fl, form.dealDraft ?? undefined);
                  onFinish({ outcome: "reached" });
                }}
              >
                <Briefcase className="size-5" aria-hidden />
                {t("makeDeal.cta", "Make a deal")}
              </Button>
              <Button variant="outline" className="h-12 text-[15px]" onClick={() => onFinish({ outcome: "reached" })}>
                {t("calls.notNowNext", "Not now · next")}
              </Button>
            </div>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

// ─── The end ───────────────────────────────────────────────────────────────

function DoneCard({ tally, moreWaiting = 0 }: { tally: Tally; moreWaiting?: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const parts: string[] = [];
  if (tally.reached) parts.push(t("calls.done.reached", "{{count}} reached", { count: tally.reached }));
  if (tally.no_answer) parts.push(t("calls.done.noAnswer", "{{count}} no answer", { count: tally.no_answer }));
  if (tally.not_interested)
    parts.push(t("calls.done.notInterested", "{{count}} not interested", { count: tally.not_interested }));
  if (tally.fake) parts.push(t("calls.done.fake", "{{count}} spam", { count: tally.fake }));
  if (tally.skipped) parts.push(t("calls.done.skipped", "{{count}} skipped", { count: tally.skipped }));

  const d = new Date();
  d.setDate(d.getDate() + 1);
  const tomorrow = isoDay(d);
  const callBacks =
    tally.no_answer > 0
      ? tally.againDays.length > 0 && tally.againDays.every((x) => x === tomorrow)
        ? t("calls.done.callBacksTomorrow", "Call-backs are set for tomorrow.")
        : t("calls.done.callBacks", "Call-backs are set.")
      : null;

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } }}
      exit={{ opacity: 0, transition: { duration: 0.16 } }}
      role="status"
      aria-live="polite"
      className="mt-6 flex flex-col items-center rounded-2xl border border-border bg-card p-6 text-center"
    >
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-earned-soft">
        <Check className="size-6 text-earned" strokeWidth={2.5} aria-hidden />
      </span>
      <p className="text-lg font-semibold tracking-tight text-foreground">{t("calls.done.title", "Done")}</p>
      {parts.length ? <p className="mt-1 text-sm text-foreground">{parts.join(" · ")}</p> : null}
      {callBacks ? <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">{callBacks}</p> : null}
      {tally.skipped ? (
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          {t("calls.done.skippedStay", "Anyone you skipped is still on Today.")}
        </p>
      ) : null}
      {moreWaiting > 0 ? (
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          {t("calls.done.moreWaiting", "{{count}} more people are still waiting on Today.", { count: moreWaiting })}
        </p>
      ) : null}
      <Button type="button" className="mt-5 h-11 w-full sm:h-10" onClick={() => navigate("/")} autoFocus>
        {t("calls.backToTodayButton", "Back to Today")}
      </Button>
    </motion.div>
  );
}
