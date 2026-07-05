import { apiClient } from "./axios-instance";

export interface WorkspaceDetail {
  id: string;
  name: string;
  url?: { id: string; url: string; type?: string } | null;
  urls?: Array<{ id: string; url: string; type?: string }>;
  services: Array<{
    service_id: string;
    service_name: string;
    service_name_en: string | null;
    service_name_de: string | null;
    service_name_fr: string | null;
    service_name_nl: string | null;
    service_image: string | null;
    service_slug: string | null;
    service_type: string | null;
    service_icon: string | null;
    service_order: number;
    service_config: Record<string, unknown> | null;
  }>;
  members: Array<{
    user_id: string;
    user_email: string;
    user_first_name: string;
    user_last_name: string;
    role: string;
    lead_notification: boolean;
    user_onboarding_completed_at?: string | null;
    has_logged_in?: boolean;
  }>;
}

export async function getWorkspaceDetail(): Promise<WorkspaceDetail> {
  const response = await apiClient.get<WorkspaceDetail>("/users/me/workspace");
  return response.data;
}

export async function getServiceConfig(
  serviceId: string,
): Promise<Record<string, unknown>> {
  const response = await apiClient.get<Record<string, unknown>>(
    `/users/me/workspace/service-config/${serviceId}`,
  );
  return response.data;
}

export async function decryptEmailConfigPassword(
  serviceId: string,
): Promise<{ password: string }> {
  const response = await apiClient.get<{ password: string }>(
    "/users/me/workspace/email-config-password",
    { params: { serviceId } },
  );
  return response.data;
}

export async function updateWorkspaceMember(
  userId: string,
  data: { role?: "admin" | "editor" | "viewer"; lead_notification?: boolean }
): Promise<void> {
  await apiClient.patch(`/users/me/workspace/members/${userId}`, data);
}

export async function removeWorkspaceMember(userId: string): Promise<void> {
  await apiClient.delete(`/users/me/workspace/members/${userId}`);
}

export type InviteMemberStatus =
  | "added"
  | "invited"
  | "already_member"
  | "blocked"
  | "error";

export interface InviteMemberResult {
  email: string;
  status: InviteMemberStatus;
  message?: string;
}

export async function inviteWorkspaceMembers(
  emails: string[],
  role: "admin" | "editor" | "viewer"
): Promise<{ results: InviteMemberResult[] }> {
  const response = await apiClient.post<{ results: InviteMemberResult[] }>(
    "/users/me/workspace/members/invite",
    { emails, role }
  );
  return response.data;
}

export async function resendWorkspaceInvite(userId: string): Promise<void> {
  await apiClient.post(`/users/me/workspace/members/${userId}/resend-invite`);
}

export interface WorkspaceInvoice {
  id: string;
  number?: string | null;
  status: string;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  amount_due?: string | null;
  amount_paid?: string | null;
  currency?: string | null;
  due_date?: string | null;
  paid_at?: number | null;
}

export async function getWorkspaceInvoices(
  workspaceId: string
): Promise<WorkspaceInvoice[]> {
  const response = await apiClient.get<{ invoices: WorkspaceInvoice[] }>(
    `/workspaces/${workspaceId}/invoices`
  );
  return response.data.invoices ?? [];
}

/**
 * Get invoices for current workspace (uses X-Workspace-Id header)
 * Used by settings page
 */
export async function getCurrentWorkspaceInvoices(): Promise<{
  invoices: WorkspaceInvoice[];
}> {
  const response = await apiClient.get<{ invoices: WorkspaceInvoice[] }>(
    "/users/me/workspace/invoices"
  );
  return { invoices: response.data.invoices ?? [] };
}

export interface LeadFallbackSourceConfig {
  enabled: boolean;
  subject: string;
  html: string;
  /** Which workspace_email_accounts row to send this form's confirmation from. Null/omitted = workspace default. */
  email_account_id?: string | null;
}

export interface LeadFallbackConfig {
  [formName: string]: LeadFallbackSourceConfig | undefined;
}

export interface WorkspaceEmailAccountSummary {
  id: string;
  name: string;
  email: string;
  is_default: boolean;
  smtp_server: string;
  smtp_port_ssl: number | null;
  smtp_port_starttls: number | null;
  smtp_auth_required: boolean;
  smtp_username: string | null;
  imap_server: string | null;
  imap_port_ssl: number | null;
  imap_port_starttls: number | null;
  imap_username: string | null;
}

export async function listEmailAccounts(): Promise<
  WorkspaceEmailAccountSummary[]
> {
  const response = await apiClient.get<WorkspaceEmailAccountSummary[]>(
    "/users/me/workspace/email-accounts"
  );
  return response.data;
}

export async function decryptEmailAccountPassword(
  accountId: string
): Promise<{ password: string }> {
  const response = await apiClient.get<{ password: string }>(
    `/users/me/workspace/email-accounts/${accountId}/password`
  );
  return response.data;
}

export async function getLeadFallbackConfig(): Promise<LeadFallbackConfig> {
  const response = await apiClient.get<LeadFallbackConfig>(
    "/users/me/workspace/lead-fallback-config"
  );
  return response.data;
}

export async function updateLeadFallbackConfig(
  config: LeadFallbackConfig
): Promise<void> {
  await apiClient.put("/users/me/workspace/lead-fallback-config", config);
}

export async function getAppointmentsFallbackConfig(): Promise<LeadFallbackConfig> {
  const response = await apiClient.get<LeadFallbackConfig>(
    "/users/me/workspace/appointments-fallback-config"
  );
  return response.data;
}

export async function updateAppointmentsFallbackConfig(
  config: LeadFallbackConfig
): Promise<void> {
  await apiClient.put("/users/me/workspace/appointments-fallback-config", config);
}

export interface CalDavConfig {
  caldav_username: string;
  caldav_server: string;
  caldav_path: string;
  caldav_port: number;
  caldav_ssl: boolean;
  caldav_full_url: string;
  has_password: boolean;
  service_id: string;
}

export async function getCalDavConfig(): Promise<CalDavConfig | null> {
  const response = await apiClient.get<CalDavConfig | null>(
    "/users/me/workspace/caldav-config"
  );
  return response.data;
}

export type EmailAnalyticsPeriod = "1d" | "7d" | "30d" | "all_time";

export interface EmailAnalytics {
  series: { date: string; success: number; error: number }[];
  total_success: number;
  total_error: number;
}

export async function getEmailAnalytics(
  period: EmailAnalyticsPeriod
): Promise<EmailAnalytics> {
  const res = await apiClient.get<EmailAnalytics>(
    `/users/me/workspace/email-analytics?period=${period}`
  );
  return res.data;
}

export async function decryptCalDavPassword(
  serviceId: string
): Promise<string> {
  const response = await apiClient.get<{ password: string }>(
    `/users/me/workspace/email-config-password?serviceId=${serviceId}`
  );
  return response.data.password;
}

// ─── Plausible Web Analytics ────────────────────────────────────────────────

export type PlausiblePeriod = "1d" | "7d" | "30d" | "all_time";

export interface PlausibleStats {
  site_id: string;
  period: string;
  aggregate: {
    visitors: number;
    pageviews: number;
    visits: number;
    bounce_rate: number;
    visit_duration: number;
  };
  timeseries: { date: string; visitors: number; pageviews: number }[];
  top_sources: { source: string; visitors: number; visits: number }[];
  top_pages: { page: string; visitors: number; pageviews: number }[];
  countries: { country: string; visitors: number }[];
  cities: { city: string; visitors: number }[];
}

export async function getWorkspacePlausibleStats(
  period: PlausiblePeriod
): Promise<PlausibleStats | null> {
  const res = await apiClient.get<PlausibleStats | null>(
    `/users/me/workspace/plausible-stats?period=${period}`
  );
  return res.data;
}
