import { apiClient } from "./axios-instance";

/** Activity log (AGENCY_MODE_PLAN.md §5). */
export type ActorKind = "member" | "agency" | "staff" | "system" | "workflow" | "public";

export interface AuditRow {
  id: string;
  occurred_at: string;
  workspace_id: string | null;
  workspace_name: string | null;
  actor_user_id: string | null;
  actor_kind: ActorKind;
  actor_name: string | null;
  actor_email: string | null;
  via_agency_id: string | null;
  via_agency_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  params: Record<string, unknown>;
  diff: Record<string, [unknown, unknown]> | null;
  status: number | null;
}

export interface AuditPage {
  data: AuditRow[];
  next_cursor: string | null;
}

export interface AuditFilters {
  workspace_id?: string;
  actor?: string;
  area?: string;
  from?: string;
}

export interface AuditScopeInfo {
  kind: "workspace" | "agency" | "all";
  workspaces: Array<{ id: string; name: string }>;
  people: Array<{ id: string; name: string | null; email: string | null }>;
  /** Root with a workspace picked: its name (older API: absent). */
  target?: { id: string; name: string } | null;
}

export const AUDIT_AREAS = [
  "deal", "lead", "contact", "task", "note", "member", "form", "pipeline", "workflow",
  "appointment", "email", "website", "ai", "support", "agency", "media", "billing", "settings", "auth",
] as const;

export const auditKeys = {
  list: (ws: string | undefined, f: AuditFilters) => ["audit", ws, f] as const,
  scope: (ws: string | undefined, target: string | undefined) => ["audit-scope", ws, target] as const,
  search: (ws: string | undefined, q: string) => ["audit-workspaces", ws, q] as const,
};

export async function getAudit(f: AuditFilters, cursor?: string) {
  return (await apiClient.get<AuditPage>("/audit", { params: { ...f, cursor, limit: 50 } })).data;
}
export async function getAuditScope(workspace_id?: string) {
  return (await apiClient.get<AuditScopeInfo>("/audit/scope", { params: { workspace_id } })).data;
}
export async function searchAuditWorkspaces(q: string) {
  return (await apiClient.get<Array<{ id: string; name: string }>>("/audit/workspaces", { params: { q } })).data;
}
