import { apiClient } from "./axios-instance";
import { publicClient } from "./public-client";

/**
 * Appointments (APPOINTMENTS_PLAN.md): Repraesent calendars and the
 * appointment records forms, the website chat and the team all write.
 * Mirrors nestjs-monolith `appointment-book/appointment-book.types.ts`.
 */

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEKDAYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export interface TimeRange {
  start: string;
  end: string;
}

export type WeeklyHours = Record<WeekdayKey, TimeRange[]>;

export const CUSTOMER_MESSAGE_KINDS = ["confirmation", "reminder", "changed", "cancelled"] as const;
export type CustomerMessageKind = (typeof CUSTOMER_MESSAGE_KINDS)[number];
export const MESSAGE_LOCALES = ["en", "de", "fr", "nl", "hy"] as const;
export type MessageLocale = (typeof MESSAGE_LOCALES)[number];

/** The owner's own words for one message in one language. `{name}` etc. are filled on send. */
export interface CustomerMessageCopy {
  subject: string;
  title: string;
  lead: string;
}

/** kind → locale → words. Absent = our default text. */
export type CustomerMessageCopyMap = Partial<
  Record<CustomerMessageKind, Partial<Record<MessageLocale, CustomerMessageCopy>>>
>;

export interface CustomerMessagesSettings {
  confirmation: boolean;
  changes: boolean;
  reminder: { enabled: boolean; minutes_before: number };
  /** Sent = replaces the saved copy; `{}` resets all; omitted = kept. */
  copy?: CustomerMessageCopyMap;
}

export type AppointmentMode = "in_person" | "online";
export type BookingUnit = "slot" | "day";

/** Where a calendar's customer emails come from right now. */
export interface CalendarSender {
  via: "mailbox" | "platform";
  /** The mailbox address; null on the platform or the legacy email setup. */
  email: string | null;
  reason: "ok" | "no_mailbox" | "needs_reconnect";
}

export interface AppointmentCalendar {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string | null;
  mode: AppointmentMode;
  location: string | null;
  meeting_url: string | null;
  timezone: string;
  booking_unit: BookingUnit;
  duration_minutes: number;
  slot_step_minutes: number | null;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_hours: number;
  max_days_ahead: number;
  capacity: number;
  weekly_hours: WeeklyHours;
  owner_user_id: string | null;
  busy_calendar_keys: string[];
  copy_target_key: string | null;
  customer_messages: CustomerMessagesSettings;
  /** Mailbox the emails go out from; null = the workspace's main mailbox. */
  email_account_id: string | null;
  /** Language for customers whose own language is unknown. */
  default_locale: "en" | "de" | "fr" | "nl" | "hy" | null;
  sender: CalendarSender;
  self_service: boolean;
  is_default: boolean;
  status: "active" | "disabled";
  sort_order: number;
  appointment_count: number;
  upcoming_count: number;
  created_at: string;
  updated_at: string;
}

export type SaveCalendarInput = Partial<
  Omit<AppointmentCalendar, "id" | "key" | "is_default" | "status" | "appointment_count" | "upcoming_count" | "created_at" | "updated_at" | "sender">
>;

export interface Closure {
  date: string;
  ranges: TimeRange[] | null;
  note: string | null;
}

export type AppointmentStatus = "scheduled" | "completed" | "no_show" | "cancelled";
export type AppointmentSource =
  | "manual"
  | "form"
  | "ai_assistant"
  | "customer_page"
  | "api"
  | "import"
  | "legacy_booking"
  | "onboarding";

/** Meetings that live in a connected calendar: changed there, synced here. */
export const CALENDAR_SYNCED_SOURCES: readonly AppointmentSource[] = ["onboarding", "import"];

export interface PersonRef {
  id: string;
  name: string | null;
}

export interface Appointment {
  id: string;
  calendar_id: string | null;
  calendar_key: string;
  calendar: { id: string; name: string; color: string | null } | null;
  title: string | null;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  timezone: string;
  mode: AppointmentMode;
  location: string | null;
  meeting_url: string | null;
  status: AppointmentStatus;
  confirmed_at: string | null;
  completed_at: string | null;
  outcome_note: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  cancelled_by: string | null;
  reschedule_count: number;
  source: AppointmentSource;
  form_id: string | null;
  ai_booking_id: string | null;
  lead: PersonRef | null;
  contact: PersonRef | null;
  company: PersonRef | null;
  deal: { id: string; title: string | null } | null;
  assigned_user: PersonRef | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_locale: string | null;
  /** What the customer's emails go out in right now (their card first). */
  customer_language?: string;
  /** The language on the customer's card; null = not set there yet. */
  card_language?: string | null;
  sms_consent_at: string | null;
  provider: string | null;
  /** The connected calendar's own event id, when the meeting lives there. */
  provider_event_id: string | null;
  /** Who takes it, when not a team member (an onboarding call's host). */
  host_label: string | null;
  display_name: string | null;
  needs_outcome: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentEvent {
  id: string;
  kind: string;
  actor: string;
  actor_name: string | null;
  from_starts_at: string | null;
  to_starts_at: string | null;
  detail: unknown;
  created_at: string;
}

export interface AppointmentMessage {
  id: string;
  channel: "email" | "sms";
  kind: string;
  recipient: string;
  scheduled_for: string;
  status: string;
  sent_at: string | null;
  error: string | null;
  origin: string;
}

export interface SlotsResult {
  slots: string[];
  unavailable: boolean;
}

export interface DayOverview {
  date: string;
  free: number;
  state: "open" | "closed" | "past" | "horizon";
}

export interface DaysResult {
  days: DayOverview[];
  unavailable: boolean;
}

export interface ListAppointmentsParams {
  from?: string;
  to?: string;
  calendar_id?: string;
  status?: AppointmentStatus | "upcoming" | "past";
  assigned_to?: string;
  lead_id?: string;
  contact_id?: string;
  deal_id?: string;
  search?: string;
  needs_outcome?: boolean;
  limit?: number;
}

export interface AppointmentLinks {
  lead_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  deal_id?: string | null;
}

export interface CreateAppointmentInput extends AppointmentLinks {
  calendar_id: string;
  starts_at: string;
  ends_at?: string | null;
  override?: boolean;
  title?: string | null;
  /** The team's first note — saved as a note on the appointment. */
  notes?: string | null;
  assigned_user_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_locale?: string | null;
  sms_consent?: boolean;
  notify_customer?: boolean;
}

export interface UpdateAppointmentInput extends AppointmentLinks {
  title?: string | null;
  location?: string | null;
  meeting_url?: string | null;
  assigned_user_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_locale?: string | null;
  sms_consent?: boolean;
}

// ── keys ─────────────────────────────────────────────────────────────────────

export const appointmentKeys = {
  all: (wsId: string | null | undefined) => ["appointment-book", wsId] as const,
  calendars: (wsId: string | null | undefined) => ["appointment-book", wsId, "calendars"] as const,
  closures: (wsId: string | null | undefined, calendarId: string) =>
    ["appointment-book", wsId, "closures", calendarId] as const,
  list: (wsId: string | null | undefined, params: ListAppointmentsParams) =>
    ["appointment-book", wsId, "list", params] as const,
  one: (wsId: string | null | undefined, id: string) => ["appointment-book", wsId, "one", id] as const,
  events: (wsId: string | null | undefined, id: string) => ["appointment-book", wsId, "events", id] as const,
  messages: (wsId: string | null | undefined, id: string) => ["appointment-book", wsId, "messages", id] as const,
  today: (wsId: string | null | undefined) => ["appointment-book", wsId, "today"] as const,
  forDeal: (wsId: string | null | undefined, dealId: string) => ["appointment-book", wsId, "deal", dealId] as const,
  slots: (wsId: string | null | undefined, calendarId: string, date: string) =>
    ["appointment-book", wsId, "slots", calendarId, date] as const,
  days: (wsId: string | null | undefined, calendarId: string, from: string, to: string) =>
    ["appointment-book", wsId, "days", calendarId, from, to] as const,
  messageDefaults: (wsId: string | null | undefined, calendarId: string) =>
    ["appointment-book", wsId, "message-defaults", calendarId] as const,
  messagePreview: (wsId: string | null | undefined, calendarId: string, kind: string, locale: string, copy: string) =>
    ["appointment-book", wsId, "message-preview", calendarId, kind, locale, copy] as const,
};

function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

// ── calendars ────────────────────────────────────────────────────────────────

export async function listAppointmentCalendars(): Promise<AppointmentCalendar[]> {
  const tz = browserTimezone();
  const { data } = await apiClient.get<AppointmentCalendar[]>("/appointment-calendars", {
    params: tz ? { tz } : undefined,
  });
  return data;
}

export async function createAppointmentCalendar(input: SaveCalendarInput & { name: string }) {
  const { data } = await apiClient.post<AppointmentCalendar>("/appointment-calendars", input);
  return data;
}

export async function updateAppointmentCalendar(id: string, input: SaveCalendarInput) {
  const { data } = await apiClient.patch<AppointmentCalendar>(`/appointment-calendars/${id}`, input);
  return data;
}

export async function setAppointmentCalendarEnabled(id: string, enabled: boolean) {
  const { data } = await apiClient.post<AppointmentCalendar>(
    `/appointment-calendars/${id}/${enabled ? "enable" : "disable"}`,
  );
  return data;
}

export async function makeDefaultAppointmentCalendar(id: string) {
  const { data } = await apiClient.post<AppointmentCalendar>(`/appointment-calendars/${id}/default`);
  return data;
}

export async function deleteAppointmentCalendar(id: string): Promise<void> {
  await apiClient.delete(`/appointment-calendars/${id}`);
}

export async function getCalendarClosures(id: string): Promise<Closure[]> {
  const { data } = await apiClient.get<Closure[]>(`/appointment-calendars/${id}/closures`);
  return data;
}

export async function saveCalendarClosures(id: string, closures: Closure[]): Promise<Closure[]> {
  const { data } = await apiClient.put<Closure[]>(`/appointment-calendars/${id}/closures`, { closures });
  return data;
}

export async function getCalendarSlots(id: string, date: string, exclude?: string): Promise<SlotsResult> {
  const { data } = await apiClient.get<SlotsResult>(`/appointment-calendars/${id}/slots`, {
    params: exclude ? { date, exclude } : { date },
  });
  return data;
}

export async function getCalendarDays(id: string, from: string, to: string): Promise<DaysResult> {
  const { data } = await apiClient.get<DaysResult>(`/appointment-calendars/${id}/days`, { params: { from, to } });
  return data;
}

// ── customer messages (the calendar's own emails) ──────────────────────────

export interface MessageDefaults {
  placeholders: string[];
  copy: Record<CustomerMessageKind, Record<MessageLocale, CustomerMessageCopy>>;
}

export interface MessageRequest {
  kind: CustomerMessageKind;
  locale: MessageLocale;
  /** The words being edited (not saved yet). Omitted = the saved / default words. */
  copy?: CustomerMessageCopy;
}

export async function getMessageDefaults(calendarId: string): Promise<MessageDefaults> {
  const { data } = await apiClient.get<MessageDefaults>(`/appointment-calendars/${calendarId}/messages/defaults`);
  return data;
}

export async function previewCalendarMessage(calendarId: string, body: MessageRequest): Promise<{ subject: string; html: string }> {
  const { data } = await apiClient.post<{ subject: string; html: string }>(
    `/appointment-calendars/${calendarId}/messages/preview`,
    body,
  );
  return data;
}

export async function sendTestCalendarMessage(
  calendarId: string,
  body: MessageRequest,
): Promise<{ sent_to: string; sent_from?: string | null }> {
  const { data } = await apiClient.post<{ sent_to: string; sent_from?: string | null }>(`/appointment-calendars/${calendarId}/messages/test`, body);
  return data;
}

// ── appointments ─────────────────────────────────────────────────────────────

export async function listAppointments(params: ListAppointmentsParams = {}): Promise<Appointment[]> {
  const { data } = await apiClient.get<Appointment[]>("/appointment-records", { params });
  return data;
}

export async function getAppointmentsToday(): Promise<{ today: Appointment[]; needs_outcome: Appointment[] }> {
  const tz = browserTimezone();
  const { data } = await apiClient.get<{ today: Appointment[]; needs_outcome: Appointment[] }>(
    "/appointment-records/today",
    { params: tz ? { tz } : undefined },
  );
  return data;
}

export async function getAppointmentsForDeal(dealId: string): Promise<Appointment[]> {
  const { data } = await apiClient.get<Appointment[]>(`/appointment-records/for-deal/${dealId}`);
  return data;
}

export async function getAppointment(id: string): Promise<Appointment> {
  const { data } = await apiClient.get<Appointment>(`/appointment-records/${id}`);
  return data;
}

export async function getAppointmentEvents(id: string): Promise<AppointmentEvent[]> {
  const { data } = await apiClient.get<AppointmentEvent[]>(`/appointment-records/${id}/events`);
  return data;
}

export async function getAppointmentMessages(id: string): Promise<AppointmentMessage[]> {
  const { data } = await apiClient.get<AppointmentMessage[]>(`/appointment-records/${id}/messages`);
  return data;
}

/** "Add to appointments": a meeting already in a connected Google / Outlook calendar. */
export async function importMeeting(input: {
  calendar_key: string;
  event_id: string;
  contact_id?: string | null;
  deal_id?: string | null;
}): Promise<Appointment> {
  const { data } = await apiClient.post<Appointment>("/appointment-records/import", input);
  return data;
}

export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  const { data } = await apiClient.post<Appointment>("/appointment-records", input);
  return data;
}

export async function updateAppointment(id: string, input: UpdateAppointmentInput): Promise<Appointment> {
  const { data } = await apiClient.patch<Appointment>(`/appointment-records/${id}`, input);
  return data;
}

export async function moveAppointment(
  id: string,
  input: { starts_at: string; ends_at?: string | null; override?: boolean; notify_customer?: boolean },
): Promise<Appointment> {
  const { data } = await apiClient.post<Appointment>(`/appointment-records/${id}/move`, input);
  return data;
}

export async function cancelAppointment(
  id: string,
  input: { reason?: string | null; notify_customer?: boolean },
): Promise<Appointment> {
  const { data } = await apiClient.post<Appointment>(`/appointment-records/${id}/cancel`, input);
  return data;
}

export async function setAppointmentOutcome(
  id: string,
  input: { status: "completed" | "no_show" | "scheduled"; note?: string | null },
): Promise<Appointment> {
  const { data } = await apiClient.post<Appointment>(`/appointment-records/${id}/outcome`, input);
  return data;
}

// ── the customer's link (public) ─────────────────────────────────────────────

export interface PublicAppointment {
  business_name: string;
  calendar_name: string | null;
  customer_name: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  timezone: string;
  mode: AppointmentMode;
  location: string | null;
  meeting_url: string | null;
  status: string;
  confirmed: boolean;
  can_change: boolean;
  change_blocked: "cancelled" | "past" | "too_late" | "not_allowed" | null;
  min_notice_hours: number;
  booking_unit: BookingUnit;
  duration_minutes: number;
  /** The customer's language — Armenian too, when they booked through an Armenian form. */
  locale: "en" | "de" | "fr" | "nl" | "hy";
}

const pub = (token: string) => `/public/appointment-book/${encodeURIComponent(token)}`;

export async function getPublicAppointment(token: string): Promise<PublicAppointment> {
  const { data } = await publicClient.get<PublicAppointment>(pub(token));
  return data;
}

export async function getPublicDays(token: string, from: string, to: string): Promise<DaysResult> {
  const { data } = await publicClient.get<DaysResult>(`${pub(token)}/days`, { params: { from, to } });
  return data;
}

export async function getPublicSlots(token: string, date: string): Promise<SlotsResult> {
  const { data } = await publicClient.get<SlotsResult>(`${pub(token)}/slots`, { params: { date } });
  return data;
}

export async function confirmPublicAppointment(token: string): Promise<PublicAppointment> {
  const { data } = await publicClient.post<PublicAppointment>(`${pub(token)}/confirm`);
  return data;
}

export async function movePublicAppointment(token: string, starts_at: string, ends_at: string) {
  const { data } = await publicClient.post<PublicAppointment>(`${pub(token)}/move`, { starts_at, ends_at });
  return data;
}

export async function cancelPublicAppointment(token: string, reason?: string | null) {
  const { data } = await publicClient.post<PublicAppointment>(`${pub(token)}/cancel`, { reason: reason ?? null });
  return data;
}
