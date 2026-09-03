/**
 * Legacy lead-stage keys. Lead statuses are workspace-configurable pipeline
 * stages now (use useLeadStages() from ~/lib/hooks/usePipelineStages for the
 * real set, order, labels and colors) — this list only backs the
 * cross-workspace brand views, where per-workspace config doesn't apply.
 */
export const LEAD_STATUSES = [
  "new_lead",
  "pending",
  "in_progress",
  "rejected",
  "on_hold",
  "stale",
  "success",
  "hidden",
] as const;

export type LeadStatus = string;

export const LEAD_SOURCES = {
  website: { value: "urls" as const, label: "Website", sourceTable: "urls" },
  appointment: {
    value: "appointment_booking" as const,
    label: "Appointment",
    sourceTable: "appointment_booking",
  },
  assistant: {
    value: "ai_assistants" as const,
    label: "AI assistant",
    sourceTable: "ai_assistants",
  },
} as const;

export type LeadSourceValue =
  (typeof LEAD_SOURCES)[keyof typeof LEAD_SOURCES]["value"];
