import { apiClient } from "./axios-instance";

/** What the grant on a Google calendar allows us to do with it. */
export type CalendarAccessRole =
  | "owner"
  | "writer"
  | "reader"
  | "freeBusyReader";

/** One calendar inside a connected Google account, straight from Google's list. */
export interface CalendarListEntry {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor: string | null;
  accessRole: CalendarAccessRole;
  timeZone: string | null;
}

export type CalendarProvider = "google" | "caldav";

/** A Google or CalDAV account a workspace member connected for calendar access. */
export interface CalendarAccount {
  id: string;
  user_id: string;
  /** Name of the member who connected it — accounts are personal, not shared. */
  user_name: string;
  provider: CalendarProvider;
  /** For caldav accounts this holds the CalDAV username instead. */
  google_email: string;
  display_name: string;
  caldav_server_url: string | null;
  /** True once the grant is revoked or expired: the account needs reconnecting. */
  auth_failed: boolean;
  /** True when the account belongs to the requesting user. */
  is_own: boolean;
  calendars: CalendarListEntry[];
}

/**
 * Build the cross-source key for one calendar in an account:
 * `google:<accountId>:<calendarId>` or `caldav:<accountId>:<encoded URL>`.
 *
 * The caldav third segment is percent-encoded on purpose: keys travel
 * comma-joined in query strings, and a calendar's id is its collection URL,
 * which contains ':' and can contain ','. The backend's parseKey
 * (calendar-events.service.ts) decodes that segment again — keep the two in
 * sync. Every key built in the app must go through this helper.
 */
export function calendarKeyFor(
  account: Pick<CalendarAccount, "id" | "provider">,
  calendarId: string,
): string {
  return account.provider === "caldav"
    ? `caldav:${account.id}:${encodeURIComponent(calendarId)}`
    : `google:${account.id}:${calendarId}`;
}

/** An admin-provisioned Baikal booking calendar. Read-only on this page. */
export interface BaikalConfig {
  id: string;
  user_id: string;
  user_name: string;
  provider_name: string | null;
  provider_email: string | null;
  timezone: string;
  company_color: string;
}

export interface CalendarAccountsResponse {
  accounts: CalendarAccount[];
  baikal_configs: BaikalConfig[];
}

export interface CalendarSummary {
  google_account_count: number;
  baikal_config_count: number;
}

/** Both calendar sources for the workspace: Google accounts and Baikal configs. */
export async function listCalendarAccounts(): Promise<CalendarAccountsResponse> {
  const { data } = await apiClient.get<CalendarAccountsResponse>(
    "/calendar-accounts",
  );
  return data;
}

export async function getCalendarSummary(): Promise<CalendarSummary> {
  const { data } = await apiClient.get<CalendarSummary>(
    "/calendar-accounts/summary",
  );
  return data;
}

/**
 * Ask the API for a Google consent URL, then navigate to it.
 *
 * The API returns the URL instead of redirecting because a top-level browser
 * navigation carries no bearer token, so the server could not tell who is
 * connecting. Same handoff the email-accounts page uses.
 */
export async function getCalendarAuthorizeUrl(): Promise<string> {
  const { data } = await apiClient.get<{ url: string }>(
    "/google-calendar/authorize-url",
  );
  return data.url;
}

export interface ConnectCaldavPayload {
  /** Display name for the account row. */
  name: string;
  server_url: string;
  username: string;
  password: string;
}

/**
 * Connect a CalDAV account. The server verifies the credentials by fetching
 * the calendar list before storing anything, so an error here means the
 * server/username/password combination genuinely does not work.
 */
export async function connectCaldavAccount(
  payload: ConnectCaldavPayload,
): Promise<{ id: string }> {
  const { data } = await apiClient.post<{ id: string }>(
    "/calendar-accounts/caldav",
    payload,
  );
  return data;
}

/**
 * Re-fetch the account's calendar list from its provider and store it.
 *
 * The stored list only refreshes on demand — Google does not push changes to
 * us — so a calendar created after connecting won't appear until this runs.
 */
export async function refreshAccountCalendars(
  id: string,
): Promise<CalendarListEntry[]> {
  const { data } = await apiClient.post<CalendarListEntry[]>(
    `/calendar-accounts/${id}/refresh-calendars`,
  );
  return data;
}

/**
 * Disconnect a Google calendar account.
 *
 * The server enforces who may do this: the member who connected it, or a
 * workspace admin.
 */
export async function disconnectCalendarAccount(id: string): Promise<void> {
  await apiClient.delete(`/calendar-accounts/${id}`);
}

/**
 * One event on the unified team calendar, whatever its source.
 *
 * `calendarKey` identifies the source: `google:<accountId>:<calendarId>` or
 * `baikal:<configId>` — the same keys the preferences endpoint stores.
 */
export type CalendarRsvpStatus =
  | "accepted"
  | "declined"
  | "tentative"
  | "needsAction";

export interface UnifiedCalendarEvent {
  id: string;
  calendarKey: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  meetLink: string | null;
  /** The source account's own RSVP; null for Baikal and self-organized events. */
  rsvp: CalendarRsvpStatus | null;
}

/** A source that failed while fetching events; the rest still came through. */
export interface CalendarSourceError {
  calendarKey: string;
  code: "auth_failed" | "fetch_failed";
}

export interface CalendarEventsResponse {
  events: UnifiedCalendarEvent[];
  errors: CalendarSourceError[];
}

/**
 * Events for the given sources in [start, end). Range max is 62 days.
 *
 * With no keys there is nothing to fetch, so we skip the round-trip entirely
 * rather than asking the server for an empty answer.
 */
export async function getCalendarEvents(
  startISO: string,
  endISO: string,
  keys: string[],
): Promise<CalendarEventsResponse> {
  if (keys.length === 0) {
    return { events: [], errors: [] };
  }
  const { data } = await apiClient.get<CalendarEventsResponse>(
    "/calendar/events",
    { params: { start: startISO, end: endISO, keys: keys.join(",") } },
  );
  return data;
}

export interface CreateCalendarEventPayload {
  /** Where to create the event: `google:<accountId>:<calendarId>` or `baikal:<configId>`. */
  targetKey: string;
  title: string;
  description?: string;
  startISO: string;
  endISO: string;
  /** IANA zone the times were entered in. */
  timezone: string;
  /** Guest emails — Google targets only; the server rejects them for Baikal. */
  guests?: string[];
  /** Attach a Google Meet link — Google targets only. */
  withMeet?: boolean;
}

/**
 * Create an event on one of the workspace's calendars.
 *
 * The server enforces the target rules: Google targets must be the caller's
 * own account and a writable calendar; Baikal targets accept no guests or
 * Meet link.
 */
export async function createCalendarEvent(
  payload: CreateCalendarEventPayload,
): Promise<UnifiedCalendarEvent> {
  const { data } = await apiClient.post<UnifiedCalendarEvent>(
    "/calendar/events",
    payload,
  );
  return data;
}

export interface CalendarPreferences {
  hidden_calendar_keys: string[];
}

/** Which sources the current user unchecked on the Calendar page. */
export async function getCalendarPreferences(): Promise<CalendarPreferences> {
  const { data } = await apiClient.get<CalendarPreferences>(
    "/calendar/preferences",
  );
  return data;
}

export async function updateCalendarPreferences(
  hiddenKeys: string[],
): Promise<CalendarPreferences> {
  const { data } = await apiClient.put<CalendarPreferences>(
    "/calendar/preferences",
    { hidden_calendar_keys: hiddenKeys },
  );
  return data;
}
