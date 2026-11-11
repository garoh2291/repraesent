import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import { Check, Clock, ImageOff, Loader2, Mail, StickyNote } from "lucide-react";
import { EmailCard } from "~/components/organism/email-card";
import type { BccMessage } from "~/lib/api/bcc-logs";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { formatDateIntl } from "~/lib/utils/format";
import { EASE_OUT } from "~/lib/motion";
import type { Side, TicketAttachment, TicketMessage } from "~/lib/api/support-tickets";
import { initials, useAttachmentUrl, useSeverityLabel, useStatusLabel } from "./ticket-bits";

const URL_RE = /(https?:\/\/[^\s<>"')]+[^\s<>"').,;:!?])/g;

/** Plain text with line breaks kept and web addresses clickable. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_RE);
  return (
    <p className={cn("whitespace-pre-wrap break-words [overflow-wrap:anywhere]", className)}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-current/40 underline-offset-2 hover:decoration-current">
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </p>
  );
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function DayDivider({ iso }: { iso: string }) {
  const { t } = useTranslation();
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const label =
    dayKey(iso) === dayKey(today.toISOString())
      ? t("help.thread.today", "Today")
      : dayKey(iso) === dayKey(yesterday.toISOString())
        ? t("help.thread.yesterday", "Yesterday")
        : formatDateIntl(d, { weekday: "short", day: "numeric", month: "short", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
  return (
    <div className="flex items-center gap-3 py-2" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

const time = (iso: string) => formatDateIntl(iso, { hour: "2-digit", minute: "2-digit" });

/**
 * One ticket's history: the customer's words, our replies, internal notes
 * (team view only — the API never sends them to a customer) and the quiet
 * lines that record every status change, so a reopened ticket still tells
 * its whole story.
 */
export function Thread({
  messages,
  viewer,
  teamName,
  className,
}: {
  messages: TicketMessage[];
  viewer: Side;
  /** How the customer sees our side: "re:praesent". */
  teamName: string;
  className?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const count = messages.length;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count]);

  let prevDay = "";
  let prevAuthor = "";
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {messages.map((m) => {
        const day = dayKey(m.created_at);
        const showDay = day !== prevDay;
        prevDay = day;
        const authorKey = `${m.kind}:${m.side}:${m.author.id ?? m.author.name}`;
        const showAuthor = showDay || authorKey !== prevAuthor || m.kind !== "message";
        prevAuthor = authorKey;
        return (
          <Fragment key={m.id}>
            {showDay ? <DayDivider iso={m.created_at} /> : null}
            {m.event?.type === "email" ? (
              <EmailEvent m={m} viewer={viewer} teamName={teamName} />
            ) : m.event ? (
              <EventLine m={m} viewer={viewer} teamName={teamName} />
            ) : m.kind === "note" ? (
              <NoteSlip m={m} />
            ) : (
              <Bubble m={m} viewer={viewer} teamName={teamName} showAuthor={showAuthor} />
            )}
          </Fragment>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

function Appear({ children, className, mine }: { children: ReactNode; className?: string; mine?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, x: mine ? 6 : -6 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: reduce ? 0.15 : 0.28, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

function Bubble({ m, viewer, teamName, showAuthor }: { m: TicketMessage; viewer: Side; teamName: string; showAuthor: boolean }) {
  const { t } = useTranslation();
  const mine = m.side === viewer;
  // The customer sees "Anna · re:praesent"; the team sees the person.
  const who =
    viewer === "client" && m.side === "team"
      ? m.author.name
        ? `${m.author.name} · ${teamName}`
        : teamName
      : m.author.is_me
        ? t("help.thread.you", "You")
        : (m.author.name ?? "—");
  return (
    <Appear mine={mine} className={cn("flex gap-2.5", mine ? "flex-row-reverse" : "flex-row", showAuthor ? "mt-2" : "")}>
      <div className={cn("shrink-0", mine ? "w-0 sm:w-8" : "w-8")}>
        {showAuthor && !mine ? (
          <span
            aria-hidden
            className={cn(
              "flex size-8 items-center justify-center rounded-full text-[11px] font-semibold",
              m.side === "team" ? "bg-foreground text-background" : "bg-muted text-foreground",
            )}
          >
            {viewer === "client" && m.side === "team" ? "re" : initials(m.author.name)}
          </span>
        ) : null}
      </div>
      <div className={cn("flex min-w-0 max-w-[min(85%,560px)] flex-col gap-1", mine ? "items-end" : "items-start")}>
        {showAuthor ? (
          <span className="px-1 text-[12px] font-medium text-muted-foreground">
            {who} <span className="num font-normal text-muted-foreground/70">· {time(m.created_at)}</span>
          </span>
        ) : null}
        {m.body ? (
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed",
              mine ? "rounded-tr-md bg-foreground text-background" : "rounded-tl-md border border-border bg-card text-foreground",
              m.pending && "opacity-60",
            )}
          >
            <RichText text={m.body} />
          </div>
        ) : null}
        {m.attachments.length ? <Shots items={m.attachments} side={viewer} align={mine ? "end" : "start"} /> : null}
        {m.pending ? (
          <span className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden /> {t("help.thread.sending", "Sending…")}
          </span>
        ) : null}
      </div>
    </Appear>
  );
}

function NoteSlip({ m }: { m: TicketMessage }) {
  const { t } = useTranslation();
  return (
    <Appear className="my-2 ml-10 mr-2 sm:mr-10">
      <div className="note-slip rounded-lg px-3.5 py-2.5">
        <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-marker-ink">
          <StickyNote className="size-3.5" aria-hidden />
          {t("support.thread.note", "Internal note")} · {m.author.is_me ? t("help.thread.you", "You") : m.author.name}
          <span className="num font-normal opacity-70">· {time(m.created_at)}</span>
        </p>
        {m.body ? <RichText text={m.body} className="text-[14px] leading-relaxed text-foreground" /> : null}
        {m.attachments.length ? <Shots items={m.attachments} side="team" align="start" /> : null}
      </div>
    </Appear>
  );
}

function EventLine({ m, viewer, teamName }: { m: TicketMessage; viewer: Side; teamName: string }) {
  const { t } = useTranslation();
  const statusLabel = useStatusLabel(viewer);
  const severityLabel = useSeverityLabel(viewer);
  const e = m.event!;
  // The customer always sees our side as "re:praesent", even a teammate who is also a member there.
  const who =
    viewer === "client" && m.side === "team" ? teamName : m.author.is_me ? t("help.thread.you", "You") : (m.author.name ?? "—");
  const text =
    e.type === "reopened"
      ? t("help.event.reopened", "{{who}} opened it again", { who })
      : e.type === "status"
        ? t("help.event.status", "{{who}} set it to “{{status}}”", { who, status: statusLabel(e.to) })
        : e.type === "severity"
          ? t("help.event.severity", "{{who}} changed it to “{{severity}}”", { who, severity: severityLabel(e.to) })
          : e.type === "email"
            ? ""
            : e.to
            ? t("support.event.assigned", "{{who}} handed it to {{name}}", { who, name: e.to_name ?? "—" })
            : t("support.event.unassigned", "{{who}} left it unassigned", { who });
  return (
    <p className="py-1.5 text-center text-[12px] text-muted-foreground">
      {text} <span className="num opacity-70">· {time(m.created_at)}</span>
    </p>
  );
}

/**
 * An email sent from the ticket. The team sees the same card as on a contact
 * page, with "Sent · syncing" until the logged copy is in; the customer gets
 * one line saying where it went (the email itself is in their inbox).
 */
function EmailEvent({ m, viewer, teamName }: { m: TicketMessage; viewer: Side; teamName: string }) {
  const { t, i18n } = useTranslation();
  const e = m.email;
  if (!e) return null;
  if (viewer === "client") {
    return (
      <p className="flex items-center justify-center gap-1.5 py-1.5 text-center text-[12.5px] text-muted-foreground">
        <Mail className="size-3.5 shrink-0" aria-hidden />
        <span>
          {t("help.event.email", "{{who}} emailed you at {{to}}: “{{subject}}”", { who: teamName, to: e.to_emails.join(", "), subject: e.subject })}
          <span className="num opacity-70"> · {time(m.created_at)}</span>
        </span>
      </p>
    );
  }
  const message: BccMessage = {
    id: e.id,
    bcc_log_address_id: "",
    workspace_id: "",
    message_id_header: null,
    subject: e.subject,
    from_address: e.from_email ?? null,
    from_name: e.from_name ?? null,
    sent_at: e.sent_at ?? m.created_at,
    text_body: e.text_body ?? null,
    html_body: e.html_body ?? null,
    ingested_at: e.sent_at ?? m.created_at,
    participants: [
      ...e.to_emails.map((email, i) => ({ id: `${e.id}-to-${i}`, bcc_log_message_id: e.id, kind: "to" as const, email, display_name: null })),
      ...(e.cc_emails ?? []).map((email, i) => ({ id: `${e.id}-cc-${i}`, bcc_log_message_id: e.id, kind: "cc" as const, email, display_name: null })),
    ],
  };
  const chip = e.error ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive" title={e.error}>
      {t("support.email.notSent", "Not sent")}
    </span>
  ) : e.synced ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Check className="size-3" aria-hidden /> {t("support.email.sent", "Sent")}
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
      title={t("compose.syncingHint", "Delivered. It appears here as a normal email once the logged copy is processed — usually a few minutes.")}
    >
      <Clock className="size-3" aria-hidden /> {t("compose.syncing", "Sent · syncing")}
    </span>
  );
  return (
    <Appear mine className="my-2 ml-10 sm:ml-20">
      <p className="mb-1 flex items-center justify-end gap-1.5 px-1 text-[12px] font-medium text-muted-foreground">
        <Mail className="size-3.5" aria-hidden />
        {t("support.email.by", "Email from {{who}}", { who: m.author.is_me ? t("help.thread.you", "You") : (m.author.name ?? "—") })}
        <span className="num font-normal opacity-70">· {time(m.created_at)}</span>
      </p>
      <div className={cn(!e.synced && !e.error && "opacity-90")}>
        <EmailCard message={message} locale={i18n.language} actions={chip} />
      </div>
    </Appear>
  );
}

function Shots({ items, side, align }: { items: TicketAttachment[]; side: Side; align: "start" | "end" }) {
  return (
    <div className={cn("flex flex-wrap gap-2 pt-1", align === "end" ? "justify-end" : "justify-start")}>
      {items.map((a) => (
        <Shot key={a.id} a={a} side={side} />
      ))}
    </div>
  );
}

function Shot({ a, side }: { a: TicketAttachment; side: Side }) {
  const { t } = useTranslation();
  const { url, failed } = useAttachmentUrl(side, a.id);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => url && setOpen(true)}
        className="press relative size-24 overflow-hidden rounded-xl border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 sm:size-28"
        aria-label={t("help.thread.openScreenshot", "Open screenshot")}
      >
        {url ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : failed ? (
          <ImageOff className="m-auto size-5 text-muted-foreground" aria-hidden />
        ) : (
          <span className="absolute inset-0 animate-pulse bg-muted" />
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] w-auto max-w-[min(96vw,1200px)] overflow-auto border-0 bg-transparent p-0 shadow-none sm:max-w-[min(96vw,1200px)]">
          <DialogTitle className="sr-only">{a.file_name ?? t("help.thread.screenshot", "Screenshot")}</DialogTitle>
          {url ? <img src={url} alt={a.file_name ?? ""} className="mx-auto max-h-[88dvh] rounded-xl bg-card object-contain" /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
