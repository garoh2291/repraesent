import type { WorkflowGraph } from "~/lib/api/workflows";

/**
 * Ready-made workflows for one calendar. Each is created as a DRAFT — the
 * owner reads it, can change the words or the timing, and switches it on
 * themselves. Formal register in every language (Sie / vous / u): these reach
 * the business's customers.
 *
 * Variables are the appointment enricher's (nestjs-monolith
 * workflows/context-enricher.service.ts → enrichAppointment).
 */

type Locale = "en" | "de" | "fr" | "nl";
type Copy = Record<Locale, { subject: string; html: string }>;

const R = "{{trigger.record.";

const REMINDER: Copy = {
  en: {
    subject: `Reminder: your appointment on ${R}date_local}}`,
    html:
      `<p>Hello ${R}customer}},</p>` +
      `<p>This is a reminder of your appointment on <strong>${R}start_local}}</strong>.</p>` +
      `<p>${R}location}}</p>` +
      `<p>Need another time? <a href="${R}manage_url}}">Change or cancel it here</a>.</p>`,
  },
  de: {
    subject: `Erinnerung: Ihr Termin am ${R}date_local}}`,
    html:
      `<p>Guten Tag ${R}customer}},</p>` +
      `<p>wir möchten Sie an Ihren Termin am <strong>${R}start_local}}</strong> erinnern.</p>` +
      `<p>${R}location}}</p>` +
      `<p>Passt es nicht mehr? <a href="${R}manage_url}}">Hier können Sie den Termin ändern oder absagen</a>.</p>`,
  },
  fr: {
    subject: `Rappel : votre rendez-vous le ${R}date_local}}`,
    html:
      `<p>Bonjour ${R}customer}},</p>` +
      `<p>Nous vous rappelons votre rendez-vous le <strong>${R}start_local}}</strong>.</p>` +
      `<p>${R}location}}</p>` +
      `<p>Besoin d’un autre horaire ? <a href="${R}manage_url}}">Modifiez ou annulez ici</a>.</p>`,
  },
  nl: {
    subject: `Herinnering: uw afspraak op ${R}date_local}}`,
    html:
      `<p>Goedendag ${R}customer}},</p>` +
      `<p>Een herinnering aan uw afspraak op <strong>${R}start_local}}</strong>.</p>` +
      `<p>${R}location}}</p>` +
      `<p>Komt het niet uit? <a href="${R}manage_url}}">Wijzig of annuleer hier</a>.</p>`,
  },
};

// No review link variable exists, so the text asks without one — a link the
// owner forgot to fill in would be worse than none.
const THANKS: Copy = {
  en: {
    subject: "Thank you for your visit",
    html:
      `<p>Hello ${R}customer}},</p>` +
      "<p>Thank you for your visit today. We hope you were happy.</p>" +
      "<p>If you were, we would be grateful for a short review on Google — it helps others find us.</p>",
  },
  de: {
    subject: "Vielen Dank für Ihren Besuch",
    html:
      `<p>Guten Tag ${R}customer}},</p>` +
      "<p>vielen Dank für Ihren Besuch heute. Wir hoffen, Sie waren zufrieden.</p>" +
      "<p>Wenn ja, freuen wir uns sehr über eine kurze Bewertung bei Google – so finden auch andere zu uns.</p>",
  },
  fr: {
    subject: "Merci de votre visite",
    html:
      `<p>Bonjour ${R}customer}},</p>` +
      "<p>Merci de votre visite aujourd’hui. Nous espérons que vous avez été satisfait.</p>" +
      "<p>Si c’est le cas, un court avis sur Google nous ferait très plaisir : il aide d’autres personnes à nous trouver.</p>",
  },
  nl: {
    subject: "Bedankt voor uw bezoek",
    html:
      `<p>Goedendag ${R}customer}},</p>` +
      "<p>Bedankt voor uw bezoek vandaag. We hopen dat u tevreden was.</p>" +
      "<p>Zo ja, dan stellen we een korte review op Google zeer op prijs – zo vinden anderen ons ook.</p>",
  },
};

const MISSED: Copy = {
  en: {
    subject: "We missed you",
    html:
      `<p>Hello ${R}customer}},</p>` +
      `<p>We had your appointment on ${R}date_local}} in the book, but unfortunately we didn’t see you.</p>` +
      "<p>No problem — just reply to this email or get in touch, and we will find a new time for you.</p>",
  },
  de: {
    subject: "Wir haben Sie vermisst",
    html:
      `<p>Guten Tag ${R}customer}},</p>` +
      `<p>Ihr Termin am ${R}date_local}} stand bei uns im Kalender, leider haben wir Sie nicht gesehen.</p>` +
      "<p>Kein Problem – antworten Sie einfach auf diese E-Mail oder melden Sie sich, und wir finden einen neuen Termin für Sie.</p>",
  },
  fr: {
    subject: "Vous nous avez manqué",
    html:
      `<p>Bonjour ${R}customer}},</p>` +
      `<p>Votre rendez-vous du ${R}date_local}} était bien noté, mais nous ne vous avons malheureusement pas vu.</p>` +
      "<p>Aucun souci : répondez simplement à cet e-mail ou contactez-nous, et nous vous trouverons un nouvel horaire.</p>",
  },
  nl: {
    subject: "We hebben u gemist",
    html:
      `<p>Goedendag ${R}customer}},</p>` +
      `<p>Uw afspraak op ${R}date_local}} stond bij ons in de agenda, maar helaas hebben we u niet gezien.</p>` +
      "<p>Geen probleem – beantwoord deze e-mail of neem contact op, dan zoeken we samen een nieuw moment.</p>",
  },
};

const COME_BACK: Copy = {
  en: {
    subject: "Time for your next appointment?",
    html:
      `<p>Hello ${R}customer}},</p>` +
      "<p>Your last visit was about six weeks ago. Would you like to book your next appointment?</p>" +
      "<p>Just reply to this email and we will find a time that suits you.</p>",
  },
  de: {
    subject: "Zeit für Ihren nächsten Termin?",
    html:
      `<p>Guten Tag ${R}customer}},</p>` +
      "<p>Ihr letzter Besuch ist etwa sechs Wochen her. Möchten Sie Ihren nächsten Termin vereinbaren?</p>" +
      "<p>Antworten Sie einfach auf diese E-Mail, und wir finden eine Zeit, die Ihnen passt.</p>",
  },
  fr: {
    subject: "Et si l’on prévoyait votre prochain rendez-vous ?",
    html:
      `<p>Bonjour ${R}customer}},</p>` +
      "<p>Votre dernière visite remonte à environ six semaines. Souhaitez-vous prendre votre prochain rendez-vous ?</p>" +
      "<p>Répondez simplement à cet e-mail et nous trouverons un horaire qui vous convient.</p>",
  },
  nl: {
    subject: "Tijd voor uw volgende afspraak?",
    html:
      `<p>Goedendag ${R}customer}},</p>` +
      "<p>Uw laatste bezoek is ongeveer zes weken geleden. Wilt u uw volgende afspraak maken?</p>" +
      "<p>Beantwoord deze e-mail en we zoeken een moment dat u past.</p>",
  },
};

type Trigger =
  | { type: "date_field_relative"; dateField: "starts_at" | "ends_at"; offsetMinutes: number; statuses: string[] }
  | { type: "field_changed_to"; path: "status"; value: string };

function graphFor(calendarId: string, trigger: Trigger, copy: Copy): WorkflowGraph {
  const calendar = { path: "calendar_id", operator: "eq", value: calendarId };
  const config =
    trigger.type === "date_field_relative"
      ? {
          type: "date_field_relative",
          entity: "appointments",
          dateField: trigger.dateField,
          // Negative = before the date.
          offsetMinutes: trigger.offsetMinutes,
          filter: {
            match: "all",
            conditions: [
              calendar,
              trigger.statuses.length === 1
                ? { path: "status", operator: "eq", value: trigger.statuses[0] }
                : { path: "status", operator: "in", value: trigger.statuses },
            ],
          },
        }
      : {
          type: "field_changed_to",
          entity: "appointments",
          path: trigger.path,
          value: trigger.value,
          filter: { match: "all", conditions: [calendar] },
        };
  return {
    nodes: [
      { id: "trigger", type: "trigger", config },
      { id: "send", type: "send_customer_email", config: { audience: { kind: "primary" }, by_locale: copy } },
    ],
    edges: [{ from: "trigger", to: "send" }],
  } as unknown as WorkflowGraph;
}

export type WorkflowTemplateId = "reminder_24h" | "reminder_2h" | "thanks_review" | "missed" | "come_back";

export interface WorkflowTemplate {
  id: WorkflowTemplateId;
  /** i18n key + English fallback, for the picker and the workflow's name. */
  labelKey: string;
  label: string;
  hintKey: string;
  hint: string;
  /** A reminder — counts towards "nobody gets two". */
  isReminder: boolean;
  graph: (calendarId: string) => WorkflowGraph;
}

const SIX_WEEKS = 6 * 7 * 24 * 60;

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "reminder_24h",
    labelKey: "appointmentBook.flows.tpl.reminder24",
    label: "Reminder 24 hours before",
    hintKey: "appointmentBook.flows.tpl.reminder24Hint",
    hint: "With the time, the place and a link to change it.",
    isReminder: true,
    graph: (id) => graphFor(id, { type: "date_field_relative", dateField: "starts_at", offsetMinutes: -1440, statuses: ["scheduled"] }, REMINDER),
  },
  {
    id: "reminder_2h",
    labelKey: "appointmentBook.flows.tpl.reminder2",
    label: "Reminder 2 hours before",
    hintKey: "appointmentBook.flows.tpl.reminder2Hint",
    hint: "A short nudge on the day.",
    isReminder: true,
    graph: (id) => graphFor(id, { type: "date_field_relative", dateField: "starts_at", offsetMinutes: -120, statuses: ["scheduled"] }, REMINDER),
  },
  {
    id: "thanks_review",
    labelKey: "appointmentBook.flows.tpl.thanks",
    label: "Thank you + review request",
    hintKey: "appointmentBook.flows.tpl.thanksHint",
    hint: "2 hours after it ends. Not sent if they didn't come.",
    isReminder: false,
    graph: (id) =>
      graphFor(id, { type: "date_field_relative", dateField: "ends_at", offsetMinutes: 120, statuses: ["scheduled", "completed"] }, THANKS),
  },
  {
    id: "missed",
    labelKey: "appointmentBook.flows.tpl.missed",
    label: "Missed appointment — book again",
    hintKey: "appointmentBook.flows.tpl.missedHint",
    hint: "Sent when you mark that they didn't come.",
    isReminder: false,
    graph: (id) => graphFor(id, { type: "field_changed_to", path: "status", value: "no_show" }, MISSED),
  },
  {
    id: "come_back",
    labelKey: "appointmentBook.flows.tpl.comeBack",
    label: "Come back after 6 weeks",
    hintKey: "appointmentBook.flows.tpl.comeBackHint",
    hint: "Asks them to book their next visit.",
    isReminder: false,
    graph: (id) =>
      graphFor(id, { type: "date_field_relative", dateField: "ends_at", offsetMinutes: SIX_WEEKS, statuses: ["scheduled", "completed"] }, COME_BACK),
  },
];

/** Kept for callers of the original single template. */
export function reminderWorkflowGraph(calendarId: string, minutesBefore = 1440): WorkflowGraph {
  return graphFor(calendarId, { type: "date_field_relative", dateField: "starts_at", offsetMinutes: -minutesBefore, statuses: ["scheduled"] }, REMINDER);
}

/** An empty appointment workflow already narrowed to this calendar. */
export function blankCalendarWorkflowGraph(calendarId: string): WorkflowGraph {
  return {
    nodes: [
      {
        id: "trigger",
        type: "trigger",
        config: {
          type: "record_created",
          entity: "appointments",
          filter: { match: "all", conditions: [{ path: "calendar_id", operator: "eq", value: calendarId }] },
        },
      },
    ],
    edges: [],
  } as unknown as WorkflowGraph;
}
