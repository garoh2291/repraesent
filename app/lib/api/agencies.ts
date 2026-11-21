import { apiClient } from "./axios-instance";
import type { AgencyStatus, WebsiteState } from "./auth";

/** Agency mode (AGENCY_MODE_PLAN.md): the business's own side. */
export type AgencyIneligibleReason = "root" | "demo" | "doorboost" | "brand" | "managed" | "deleted";

export interface AgencyStatusResponse {
  /** false until the database part is there */
  available: boolean;
  eligible: boolean;
  reason: AgencyIneligibleReason | null;
  agency: {
    status: AgencyStatus;
    child_limit: number | null;
    child_count: number;
    request_note: string | null;
    decision_note: string | null;
    requested_at: string;
    decided_at: string | null;
  } | null;
}

export async function getAgencyStatus() {
  return (await apiClient.get<AgencyStatusResponse>("/agency/status")).data;
}

export async function requestAgency(note: string | null) {
  return (await apiClient.post<AgencyStatusResponse>("/agency/request", { note: note || undefined })).data;
}

export async function withdrawAgencyRequest() {
  return (await apiClient.delete<AgencyStatusResponse>("/agency/request")).data;
}

/** Root workspace side. */
export interface RootAgencyRow {
  workspace_id: string;
  name: string;
  status: AgencyStatus;
  child_limit: number | null;
  child_count: number;
  request_note: string | null;
  decision_note: string | null;
  requested_at: string;
  requested_by_name: string | null;
  decided_at: string | null;
}

export interface RootAgencyDetail extends RootAgencyRow {
  children: Array<{
    id: string;
    name: string;
    origin: "created" | "attached";
    attached_at: string;
    website_state: WebsiteState;
  }>;
  /** Only on attach: the agency now has more businesses than its limit. */
  over_limit?: boolean;
}

export interface AttachCandidate {
  id: string;
  name: string;
  blocked: "agency" | "managed" | "doorboost" | "demo" | "root" | null;
  managed_by: string | null;
}

export const rootAgencyKeys = {
  all: ["root-agencies"] as const,
  detail: (id: string) => ["root-agencies", id] as const,
  candidates: (q: string) => ["root-agencies", "candidates", q] as const,
};

export async function listAgencies() {
  return (await apiClient.get<RootAgencyRow[]>("/root-agencies")).data;
}
export async function getAgency(id: string) {
  return (await apiClient.get<RootAgencyDetail>(`/root-agencies/${id}`)).data;
}
export async function approveAgency(id: string, child_limit: number | null, note?: string) {
  return (await apiClient.post<RootAgencyDetail>(`/root-agencies/${id}/approve`, { child_limit, note })).data;
}
export async function rejectAgency(id: string, note?: string) {
  return (await apiClient.post<RootAgencyDetail>(`/root-agencies/${id}/reject`, { note })).data;
}
export async function setAgencyLimit(id: string, child_limit: number | null) {
  return (await apiClient.patch<RootAgencyDetail>(`/root-agencies/${id}`, { child_limit })).data;
}
export async function suspendAgency(id: string) {
  return (await apiClient.post<RootAgencyDetail>(`/root-agencies/${id}/suspend`)).data;
}
export async function resumeAgency(id: string) {
  return (await apiClient.post<RootAgencyDetail>(`/root-agencies/${id}/resume`)).data;
}
export async function endAgency(id: string) {
  return (await apiClient.post<RootAgencyDetail>(`/root-agencies/${id}/end`)).data;
}
export async function searchAttachCandidates(q: string) {
  return (await apiClient.get<AttachCandidate[]>("/root-agencies/candidates", { params: { q } })).data;
}
export async function attachToAgency(id: string, workspaceId: string) {
  return (await apiClient.post<RootAgencyDetail>(`/root-agencies/${id}/children`, { workspace_id: workspaceId })).data;
}
export async function detachFromAgency(id: string, childId: string) {
  return (await apiClient.delete<RootAgencyDetail>(`/root-agencies/${id}/children/${childId}`)).data;
}

/** The server's machine-readable error code, if any. */
export function errorCode(err: unknown): string | null {
  const c = (err as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code;
  return typeof c === "string" ? c : null;
}

/** Your businesses (agency mode, phase 3). */
export type SetupKind = "website" | "email" | "domain" | "other";

export interface BusinessOverviewRow {
  id: string;
  name: string;
  avatar_key: string | null;
  origin: "created" | "attached";
  website_state: WebsiteState;
  open_setup: SetupKind[];
  waiting: number;
  inquiries_30d: number;
  new_customers_30d: number;
  /** Reports waiting for your reply in Support. Older API: absent. */
  open_reports?: number;
  /** The background set-up after "Add a business" (invites, profile, re:praesent's deal). Older API: absent. */
  setup_state?: "ready" | "setting_up" | "needs_look";
}

export interface BusinessesOverview {
  child_limit: number | null;
  count: number;
  businesses: BusinessOverviewRow[];
}

export interface CreateBusinessInput {
  name: string;
  industry?: string;
  /** With industry "other": the type in words (2–60 chars). */
  industry_other?: string;
  currency?: string;
  phone?: string;
  email?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  timezone?: string;
  members?: Array<{ email: string; role: "admin" | "editor" | "viewer" }>;
  website: { mode: "existing" | "new" | "none"; url?: string; note?: string };
  services?: {
    email?: { wanted: boolean; mailboxes?: string[]; note?: string };
    domain?: { wanted: boolean; name?: string; note?: string };
    other?: string;
  };
  note?: string;
}

export interface SetupStatus {
  website_state: WebsiteState;
  items: Array<{
    id: string;
    kind: SetupKind;
    requested_url: string | null;
    status: "requested" | "in_progress" | "done" | "cancelled";
    created_at: string;
    closed_at: string | null;
  }>;
}

export const businessKeys = {
  overview: (agencyId: string | undefined) => ["agency-businesses", agencyId] as const,
  setup: (workspaceId: string | undefined) => ["agency-setup", workspaceId] as const,
};

export async function getBusinessesOverview() {
  return (await apiClient.get<BusinessesOverview>("/agency/businesses")).data;
}
export async function createBusiness(input: CreateBusinessInput) {
  return (await apiClient.post<{ id: string; name: string; setup: SetupKind[] }>("/agency/businesses", input)).data;
}
export async function getSetupStatus() {
  return (await apiClient.get<SetupStatus>("/agency/setup")).data;
}
