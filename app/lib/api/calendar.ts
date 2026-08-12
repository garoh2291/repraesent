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

/** A Google account a workspace member connected for calendar access. */
export interface CalendarAccount {
  id: string;
  user_id: string;
  /** Name of the member who connected it — accounts are personal, not shared. */
  user_name: string;
  google_email: string;
  display_name: string;
  /** True once the grant is revoked or expired: the account needs reconnecting. */
  auth_failed: boolean;
  /** True when the account belongs to the requesting user. */
  is_own: boolean;
  calendars: CalendarListEntry[];
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

/**
 * Re-fetch the account's calendar list from Google and store it.
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
export interface UnifiedCalendarEvent {
  id: string;
  calendarKey: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  meetLink: string | null;
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
