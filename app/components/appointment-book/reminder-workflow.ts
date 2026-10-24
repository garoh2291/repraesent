import type { WorkflowGraph } from "~/lib/api/workflows";

/**
 * A ready-made workflow: "remind the customer one day before", for one
 * calendar. Created as a DRAFT — the owner reads it, can change the words or
 * the timing, and publishes it themselves. Formal register in every language.
 *
 * Variables are the appointment enricher's (nestjs-monolith
 * workflows/context-enricher.service.ts → enrichAppointment).
 */
const COPY: Record<"en" | "de" | "fr" | "nl", { subject: string; html: string }> = {
  en: {
    subject: "Reminder: your appointment on {{trigger.record.date_local}}",
    html:
      "<p>Hello {{trigger.record.customer}},</p>" +
      "<p>This is a reminder of your appointment on <strong>{{trigger.record.start_local}}</strong>.</p>" +
      "<p>{{trigger.record.location}}</p>" +
      "<p>Need another time? <a href=\"{{trigger.record.manage_url}}\">Change or cancel it here</a>.</p>",
  },
  de: {
    subject: "Erinnerung: Ihr Termin am {{trigger.record.date_local}}",
    html:
      "<p>Guten Tag {{trigger.record.customer}},</p>" +
      "<p>wir möchten Sie an Ihren Termin am <strong>{{trigger.record.start_local}}</strong> erinnern.</p>" +
      "<p>{{trigger.record.location}}</p>" +
      "<p>Passt es nicht mehr? <a href=\"{{trigger.record.manage_url}}\">Hier können Sie den Termin ändern oder absagen</a>.</p>",
  },
  fr: {
    subject: "Rappel : votre rendez-vous le {{trigger.record.date_local}}",
    html:
      "<p>Bonjour {{trigger.record.customer}},</p>" +
      "<p>Nous vous rappelons votre rendez-vous le <strong>{{trigger.record.start_local}}</strong>.</p>" +
      "<p>{{trigger.record.location}}</p>" +
      "<p>Besoin d’un autre horaire ? <a href=\"{{trigger.record.manage_url}}\">Modifiez ou annulez ici</a>.</p>",
  },
  nl: {
    subject: "Herinnering: uw afspraak op {{trigger.record.date_local}}",
    html:
      "<p>Goedendag {{trigger.record.customer}},</p>" +
      "<p>Een herinnering aan uw afspraak op <strong>{{trigger.record.start_local}}</strong>.</p>" +
      "<p>{{trigger.record.location}}</p>" +
      "<p>Komt het niet uit? <a href=\"{{trigger.record.manage_url}}\">Wijzig of annuleer hier</a>.</p>",
  },
};

export function reminderWorkflowGraph(calendarId: string, minutesBefore = 1440): WorkflowGraph {
  return {
    nodes: [
      {
        id: "trigger",
        type: "trigger",
        config: {
          type: "date_field_relative",
          entity: "appointments",
          dateField: "starts_at",
          // Negative = before the date.
          offsetMinutes: -minutesBefore,
          filter: {
            match: "all",
            conditions: [
              { path: "calendar_id", operator: "eq", value: calendarId },
              { path: "status", operator: "eq", value: "scheduled" },
            ],
          },
        },
      },
      {
        id: "remind",
        type: "send_customer_email",
        config: { audience: { kind: "primary" }, by_locale: COPY },
      },
    ],
    edges: [{ from: "trigger", to: "remind" }],
  } as unknown as WorkflowGraph;
}
