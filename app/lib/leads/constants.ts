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

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = {
  website: { value: "urls" as const, label: "Website", sourceTable: "urls" },
  appointment: {
    value: "appointment_booking" as const,
    label: "Appointment",
    sourceTable: "appointment_booking",
  },
} as const;

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new_lead: "bg-blue-500",
  pending: "bg-amber-500",
  in_progress: "bg-violet-500",
  rejected: "bg-red-500",
  on_hold: "bg-orange-500",
  stale: "bg-gray-500",
  success: "bg-emerald-500",
  hidden: "bg-muted",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new_lead: "New Lead",
  pending: "Pending",
  in_progress: "In Progress",
  rejected: "Rejected",
  on_hold: "On Hold",
  stale: "Stale",
  success: "Success",
  hidden: "Hidden",
};
