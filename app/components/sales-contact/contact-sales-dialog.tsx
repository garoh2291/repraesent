"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarCheck2, Check, Loader2, Mail, MessageSquareText, Video } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { BookingPanel, type BookedCall, type BookingApi } from "~/components/onboarding-v2/booking";
import { Field, TextArea, TextInput } from "~/components/onboarding-v2/primitives";
import { errorCodeOf } from "~/lib/api/onboarding-v2";
import {
  bookContactCall,
  getContactDays,
  getContactSlots,
  getSalesContactConfig,
  salesContactKey,
  sendContactMessage,
  type SalesContactConfig,
} from "~/lib/api/sales-contact";
import { useAuthContext } from "~/providers/auth-provider";

type View = "book" | "message" | "booked" | "sent";

/**
 * Sidebar → "Contact re:praesent". The same sales-call picker as the end of
 * onboarding (root's sales team, merged free time). Name and email come from
 * the signed-in user; the invite goes to that email. When booking is off or
 * nobody is free, the customer writes a message instead — it reaches sales as
 * a lead in the root workspace.
 */
export function ContactSalesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const config = useQuery({
    queryKey: salesContactKey(currentWorkspace?.id),
    queryFn: getSalesContactConfig,
    enabled: open && !!currentWorkspace?.id,
    staleTime: 30_000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-y-auto overflow-x-hidden rounded-2xl p-0 sm:max-w-[560px] [&>[data-slot=dialog-close]]:focus:ring-foreground/25">
        {config.isPending ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {t("salesContact.loading")}
            <DialogTitle className="sr-only">{t("salesContact.title")}</DialogTitle>
          </div>
        ) : config.isError || !config.data ? (
          <div className="p-6">
            <DialogTitle className="text-lg font-semibold">{t("salesContact.title")}</DialogTitle>
            <p className="mt-2 text-sm text-muted-foreground">{t("salesContact.unavailable")}</p>
          </div>
        ) : (
          <ContactBody config={config.data} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ContactBody({ config, onClose }: { config: SalesContactConfig; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const reduce = useReducedMotion();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useAuthContext();
  const [view, setView] = useState<View>(config.upcoming ? "booked" : config.mode === "booking" ? "book" : "message");
  const [booked, setBooked] = useState<BookedCall | null>(config.upcoming);
  const [note, setNote] = useState("");
  const email = config.requester.email;
  const minutes = config.duration_minutes ?? 30;
  const hostNames = config.hosts.map((h) => h.label).filter((x): x is string => !!x);

  const api: BookingApi = {
    key: `sales-contact:${currentWorkspace?.id ?? ""}`,
    days: getContactDays,
    slots: getContactSlots,
    book: (slot) => bookContactCall(slot, note),
  };

  const onBooked = (b: BookedCall) => {
    setBooked(b);
    setView("booked");
    void queryClient.invalidateQueries({ queryKey: salesContactKey(currentWorkspace?.id) });
  };

  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: reduce ? 0.1 : 0.16 },
  };

  return (
    <>
      <DialogHeader className="space-y-0 border-b border-border px-6 pb-5 pt-6 text-left">
        <div className="flex items-center gap-4">
          <HostStack hosts={config.hosts} />
          <div className="min-w-0">
            <DialogTitle className="text-lg font-semibold tracking-[-0.01em]">{t("salesContact.title")}</DialogTitle>
            <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
              {view === "booked"
                ? t("salesContact.bookedSub")
                : view === "message" || view === "sent"
                ? t("salesContact.messageSub", { email })
                : hostNames.length
                  ? t("salesContact.bookSubNamed", { names: hostNames.slice(0, 2).join(" & "), minutes })
                  : t("salesContact.bookSub", { minutes })}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-w-0 px-6 pb-6 pt-5">
        <AnimatePresence mode="wait" initial={false}>
          {view === "booked" && booked ? (
            <motion.div key="booked" {...fade}>
              <BookedSummary booked={booked} email={email} locale={i18n.language} onClose={onClose} />
            </motion.div>
          ) : view === "sent" ? (
            <motion.div key="sent" {...fade} className="space-y-4 py-2 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                <Check className="size-6" strokeWidth={2.5} aria-hidden />
              </span>
              <h3 className="text-lg font-semibold">{t("salesContact.sentTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("salesContact.sentSub", { email })}</p>
              <div className="pt-2">
                <DoneButton onClick={onClose} label={t("salesContact.done")} />
              </div>
            </motion.div>
          ) : view === "book" ? (
            <motion.div key="book" {...fade} className="space-y-4">
              <BookingPanel
                config={{ timezone: config.timezone, max_days_ahead: config.max_days_ahead, duration_minutes: minutes }}
                api={api}
                onBooked={onBooked}
                beforeConfirm={
                  <Field label={t("salesContact.noteLabel")} optional>
                    {(a) => (
                      <TextArea
                        id={a.id}
                        aria-describedby={a.describedBy}
                        rows={2}
                        maxLength={1000}
                        className="min-h-20"
                        placeholder={t("salesContact.notePlaceholder")}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    )}
                  </Field>
                }
                empty={
                  <div className="space-y-3 rounded-xl bg-muted/60 px-4 py-3.5 text-sm">
                    <p className="text-muted-foreground">{t("salesContact.noTimes")}</p>
                    <SwitchLink icon={<MessageSquareText className="size-4" />} onClick={() => setView("message")} label={t("salesContact.writeInstead")} />
                  </div>
                }
              />
              <div className="border-t border-border pt-3">
                <SwitchLink icon={<MessageSquareText className="size-4" />} onClick={() => setView("message")} label={t("salesContact.preferWrite")} />
              </div>
            </motion.div>
          ) : (
            <motion.div key="message" {...fade}>
              <MessageForm
                onSent={() => setView("sent")}
                onBackToBooking={config.mode === "booking" ? () => setView("book") : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function HostStack({ hosts }: { hosts: SalesContactConfig["hosts"] }) {
  if (!hosts.length) {
    return (
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background" aria-hidden>
        <Mail className="size-5" />
      </span>
    );
  }
  return (
    <div className="flex shrink-0 -space-x-2" aria-hidden>
      {hosts.slice(0, 3).map((h, i) =>
        h.avatar_url ? (
          <img key={i} src={h.avatar_url} alt="" className="size-11 rounded-full bg-muted object-cover ring-1 ring-border outline-2 outline-background" />
        ) : (
          <span key={i} className="flex size-11 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground ring-2 ring-background">
            {(h.label ?? "?").charAt(0)}
          </span>
        ),
      )}
    </div>
  );
}

function BookedSummary({ booked, email, locale, onClose }: { booked: BookedCall; email: string; locale: string; onClose: () => void }) {
  const { t } = useTranslation();
  const start = new Date(booked.start);
  const end = new Date(booked.end);
  const valid = !Number.isNaN(start.getTime());
  const day = valid ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(start) : "";
  const time = valid
    ? `${new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(start)}${
        Number.isNaN(end.getTime()) ? "" : ` – ${new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(end)}`
      }`
    : "";
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#a4dab8]/40 text-[#2f7d4f]" aria-hidden>
          <CalendarCheck2 className="size-5" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] font-medium text-muted-foreground">{t("salesContact.bookedTitle")}</p>
          <p className="text-[15px] font-semibold leading-snug">{day}</p>
          <p className="text-sm tabular-nums text-foreground/80">
            {time}
            {booked.host_label ? ` · ${t("onb.welcome.with", { name: booked.host_label })}` : ""}
          </p>
        </div>
      </div>
      <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
        <Mail className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 break-words">{t("salesContact.inviteAt", { email })}</span>
      </p>
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <DoneButton onClick={onClose} label={t("salesContact.done")} />
        {booked.meet_link ? (
          <a
            href={booked.meet_link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-semibold text-background transition-[transform,opacity] hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 sm:h-10"
          >
            <Video className="size-4" aria-hidden /> {t("salesContact.joinCall")}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function MessageForm({ onSent, onBackToBooking }: { onSent: () => void; onBackToBooking?: () => void }) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError(t("salesContact.messageRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendContactMessage(message, phone);
      onSent();
    } catch (err) {
      setError(errorCodeOf(err) === "TOO_MANY_MESSAGES" ? t("salesContact.tooMany") : t("onb.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label={t("salesContact.messageLabel")} error={error}>
        {(a) => (
          <TextArea
            id={a.id}
            aria-describedby={a.describedBy}
            aria-invalid={a.invalid}
            autoFocus
            rows={4}
            maxLength={1000}
            placeholder={t("salesContact.messagePlaceholder")}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setError(null);
            }}
          />
        )}
      </Field>
      <Field label={t("salesContact.phoneLabel")} optional hint={t("salesContact.phoneHint")}>
        {(a) => (
          <TextInput
            id={a.id}
            aria-describedby={a.describedBy}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={40}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        )}
      </Field>
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        {onBackToBooking ? (
          <SwitchLink icon={<CalendarCheck2 className="size-4" />} onClick={onBackToBooking} label={t("salesContact.bookInstead")} />
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-semibold text-background transition-[transform,opacity] hover:opacity-90 active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 sm:h-10"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t("salesContact.send")}
        </button>
      </div>
    </form>
  );
}

function SwitchLink({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-lg px-1 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
    >
      {icon}
      {label}
    </button>
  );
}

function DoneButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-5 sm:h-10 text-sm font-semibold transition-[transform,border-color] hover:border-foreground/25 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
    >
      {label}
    </button>
  );
}
