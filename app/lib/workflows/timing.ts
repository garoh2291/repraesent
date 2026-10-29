import type {
  TriggerConfig,
  WorkflowEntity,
} from "~/lib/api/workflows";

/**
 * Timing as a sentence: "24 hours before the appointment starts".
 *
 * The trigger stores one signed number, `offsetMinutes` (negative = before).
 * Nobody should have to type `-1440`, so the editor shows the number, a unit
 * and before/after, and these two functions convert both ways without losing
 * anything — 2 hours is 120 minutes, not "0 days".
 */

export type OffsetUnit = "minutes" | "hours" | "days";
export type OffsetDirection = "before" | "after";

export interface OffsetParts {
  amount: number;
  unit: OffsetUnit;
  direction: OffsetDirection;
}

export const UNIT_MINUTES: Record<OffsetUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

/** The largest unit that divides evenly, so 1440 reads "1 day", 90 "90 minutes". */
export function offsetToParts(offsetMinutes: number | null | undefined): OffsetParts {
  const raw = Math.round(Number(offsetMinutes) || 0);
  const direction: OffsetDirection = raw < 0 ? "before" : "after";
  const abs = Math.abs(raw);
  if (abs === 0) return { amount: 0, unit: "hours", direction };
  const unit: OffsetUnit =
    abs % 1440 === 0 ? "days" : abs % 60 === 0 ? "hours" : "minutes";
  return { amount: abs / UNIT_MINUTES[unit], unit, direction };
}

export function partsToOffset(parts: OffsetParts): number {
  const amount = Math.max(0, Math.floor(Number(parts.amount) || 0));
  const minutes = amount * UNIT_MINUTES[parts.unit];
  return parts.direction === "before" ? -minutes : minutes;
}

// ---------------------------------------------------------------------------
// Plain appointment triggers
// ---------------------------------------------------------------------------

/**
 * What an owner means, mapped onto the engine's generic trigger types. Nothing
 * new is stored — "when it's cancelled" is `field_changed_to status=cancelled`.
 */
export const APPOINTMENT_CHOICES = [
  "booked",
  "before",
  "after",
  "moved",
  "cancelled",
] as const;
export type AppointmentChoice = (typeof APPOINTMENT_CHOICES)[number];

/** Which plain choice a trigger is, or null when it is something custom. */
export function appointmentChoiceOf(config: TriggerConfig): AppointmentChoice | null {
  if (config.entity !== "appointments") return null;
  switch (config.type) {
    case "record_created":
      return "booked";
    case "date_field_relative": {
      const anchor = config.dateField ?? "starts_at";
      if (anchor !== "starts_at" && anchor !== "ends_at") return null;
      return (config.offsetMinutes ?? 0) < 0 ? "before" : "after";
    }
    case "record_updated":
      return config.columns?.length === 1 && config.columns[0] === "starts_at"
        ? "moved"
        : null;
    case "field_changed_to":
      return config.path === "status" && config.value === "cancelled"
        ? "cancelled"
        : null;
    default:
      return null;
  }
}

/** The trigger for a plain choice, keeping the filter and any timing already set. */
export function applyAppointmentChoice(
  config: TriggerConfig,
  choice: AppointmentChoice,
): TriggerConfig {
  const base: TriggerConfig = {
    entity: "appointments" as WorkflowEntity,
    type: config.type,
    filter: config.filter,
  };
  const minutes = Math.abs(config.offsetMinutes ?? 0);
  switch (choice) {
    case "booked":
      return { ...base, type: "record_created" };
    case "before":
      return {
        ...base,
        type: "date_field_relative",
        dateField: "starts_at",
        offsetMinutes: -(minutes || 1440),
      };
    case "after":
      return {
        ...base,
        type: "date_field_relative",
        dateField: "ends_at",
        offsetMinutes: minutes || 120,
      };
    case "moved":
      return { ...base, type: "record_updated", columns: ["starts_at"] };
    case "cancelled":
      return {
        ...base,
        type: "field_changed_to",
        path: "status",
        value: "cancelled",
      };
  }
}

/**
 * Picking "after" on an appointment almost always means after it ENDS — a
 * thank-you two hours after it starts lands mid-appointment for a long one.
 */
export function withDirection(
  config: TriggerConfig,
  direction: OffsetDirection,
): TriggerConfig {
  const parts = offsetToParts(config.offsetMinutes);
  const next: TriggerConfig = {
    ...config,
    offsetMinutes: partsToOffset({ ...parts, direction }),
  };
  if (config.entity === "appointments") {
    const anchor = config.dateField ?? "starts_at";
    if (direction === "after" && anchor === "starts_at") next.dateField = "ends_at";
    if (direction === "before" && anchor === "ends_at") next.dateField = "starts_at";
  }
  return next;
}

type T = (key: string, opts?: Record<string, unknown>) => string;

/** "24 hours" / "1 day" / "90 minutes". */
export function durationText(parts: OffsetParts, t: T): string {
  return t(`workflows.timing.amount_${parts.unit}`, { count: parts.amount });
}

/**
 * One line for cards and lists: "24 hours before the appointment",
 * "When someone books", "3 days after Created at".
 */
export function triggerSentence(
  summary: Pick<TriggerConfig, "type" | "entity"> & {
    offsetMinutes?: number | null;
    dateField?: string | null;
    columns?: string[] | null;
    path?: string | null;
    value?: string | null;
  },
  t: T,
  fieldLabel?: (path: string) => string | undefined,
): string {
  // The list endpoint sends nulls where the graph has absent keys.
  const config = Object.fromEntries(
    Object.entries(summary).filter(([, v]) => v !== null),
  ) as unknown as TriggerConfig;
  const choice = appointmentChoiceOf(config);
  if (choice === "booked" || choice === "moved" || choice === "cancelled") {
    return t(`workflows.timing.choice_${choice}`);
  }
  if (config.type === "date_field_relative") {
    const parts = offsetToParts(config.offsetMinutes);
    const anchor = config.dateField ?? "starts_at";
    const isAppt = config.entity === "appointments";
    if (parts.amount === 0) {
      return isAppt && (anchor === "starts_at" || anchor === "ends_at")
        ? t(`workflows.timing.atAppointment_${anchor}`)
        : t("workflows.timing.atField", {
            field: fieldLabel?.(anchor) ?? anchor,
          });
    }
    const duration = durationText(parts, t);
    if (isAppt && (anchor === "starts_at" || anchor === "ends_at")) {
      return t(`workflows.timing.cardAppointment_${parts.direction}`, {
        duration,
      });
    }
    return t(`workflows.timing.cardField_${parts.direction}`, {
      duration,
      field: fieldLabel?.(anchor) ?? anchor,
    });
  }
  if (config.type === "no_change_for") {
    return t("workflows.timing.cardQuiet", {
      duration: durationText(offsetToParts(config.offsetMinutes || 10080), t),
    });
  }
  return t(`workflows.trigger.type_${config.type}`);
}
