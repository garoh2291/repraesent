import { apiClient } from "./axios-instance";

/**
 * Mirrors `nestjs-monolith/src/modules/workflows/workflow.types.ts`.
 *
 * Kept as a hand-written mirror rather than generated, the same arrangement
 * `app/lib/forms/schema.ts` has with `form-schema.types.ts`. If you change one,
 * change the other.
 */

export const WORKFLOW_ENTITIES = ["leads", "deals", "tasks", "contacts"] as const;
export type WorkflowEntity = (typeof WORKFLOW_ENTITIES)[number];

export type FieldKind =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "uuid"
  | "json";

export type ConditionOperator =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "contains"
  | "starts_with"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is_empty"
  | "is_not_empty"
  | "changed"
  | "changed_from"
  | "changed_to"
  | "within_last_days"
  | "more_than_days_ago"
  | "within_next_days"
  | "more_than_days_from_now";

/** Operators whose right-hand side is a number of days, not a date. */
export const RELATIVE_DATE_OPERATORS: ConditionOperator[] = [
  "within_last_days",
  "more_than_days_ago",
  "within_next_days",
  "more_than_days_from_now",
];

/** Operators the UI must not render a value input for. */
export const NULLARY_OPERATORS: ConditionOperator[] = [
  "is_empty",
  "is_not_empty",
  "changed",
];

export interface CatalogField {
  path: string;
  label: string;
  kind: FieldKind;
  operators: ConditionOperator[];
  options?: { value: string; label: string }[];
  dynamic?: boolean;
  /** Resolved from a related table (a contact's email), not a column. */
  resolved?: boolean;
}

export interface EntityCatalog {
  entity: WorkflowEntity;
  label: string;
  fields: CatalogField[];
}

export type TriggerType =
  | "record_created"
  | "record_updated"
  | "field_changed_to"
  | "no_change_for"
  | "date_field_relative";

export type NodeType =
  | "trigger"
  | "condition"
  | "delay"
  | "send_internal_email"
  | "send_customer_email";

export interface Condition {
  path: string;
  operator: ConditionOperator;
  value?: string | number | boolean | string[] | null;
  /** Compare against another field instead of a literal. */
  valueField?: string;
}

export interface ConditionGroup {
  match: "all" | "any";
  conditions: Condition[];
  /** Nested groups, for "(A and B) or C". */
  groups?: ConditionGroup[];
}

export interface SendWindow {
  enabled: boolean;
  /** ISO weekdays, 1 = Monday. */
  days: number[];
  start: string;
  end: string;
}

export interface RecentRecord {
  id: string;
  label: string;
  sublabel: string | null;
}

export interface TriggerConfig {
  type: TriggerType;
  entity: WorkflowEntity;
  columns?: string[];
  path?: string;
  value?: string;
  offsetMinutes?: number;
  dateField?: string;
  filter?: ConditionGroup;
}

export type EmailRecipient =
  | { kind: "member"; userId: string }
  | { kind: "role"; role: "admin" | "editor" | "viewer" }
  | { kind: "address"; email: string };

export interface LocalizedTemplate {
  [locale: string]: { subject: string; html: string } | undefined;
}

export interface SendInternalEmailConfig {
  recipients: EmailRecipient[];
  by_locale: LocalizedTemplate;
}

export interface SendCustomerEmailConfig {
  to_path?: string;
  locale_path?: string;
  email_account_id?: string | null;
  by_locale: LocalizedTemplate;
}

export interface DelayConfig {
  minutes: number;
}

export interface ConditionNodeConfig {
  group: ConditionGroup;
}

export type NodeConfig =
  | TriggerConfig
  | ConditionNodeConfig
  | DelayConfig
  | SendInternalEmailConfig
  | SendCustomerEmailConfig;

export interface WorkflowNode {
  id: string;
  type: NodeType;
  config: NodeConfig;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  branch?: "true" | "false";
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused" | "archived";
  reentry: "block" | "allow";
  timezone: string;
  default_locale: string;
  entity: WorkflowEntity | null;
  trigger_type: TriggerType | null;
  has_unpublished_changes: boolean;
  runs_7d: number;
  failed_7d: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowDetail extends Omit<WorkflowSummary, "entity" | "trigger_type" | "runs_7d" | "failed_7d" | "last_run_at"> {
  graph: WorkflowGraph;
  draft_version_id: string | null;
  published_version_id: string | null;
  draft_version: number | null;
  exit_conditions: ConditionGroup | null;
  send_window: SendWindow | null;
}

export interface WorkflowRun {
  id: string;
  status: "running" | "waiting" | "completed" | "failed" | "cancelled";
  entity_table: string;
  entity_id: string;
  dry_run: boolean;
  started_at: string;
  finished_at: string | null;
  resume_at: string | null;
  error_message: string | null;
}

export interface WorkflowRunStep {
  id: string;
  node_id: string;
  node_type: NodeType;
  status: "ok" | "skipped" | "failed";
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface WorkflowRunDetail extends WorkflowRun {
  steps: WorkflowRunStep[];
  context: Record<string, unknown>;
}

export interface OutboundCapability {
  available: boolean;
  reason: "ok" | "no_sending_account" | "account_needs_reconnect";
  accounts: {
    id: string;
    email: string;
    name: string;
    provider: string;
    source: string;
    is_default: boolean;
    auth_failed_at: string | null;
  }[];
  legacyOnly: boolean;
}

export interface WorkflowAnalytics {
  runs_by_status: { status: string; count: number }[];
  nodes: { node_id: string; node_type: string; status: string; count: number }[];
  daily: { day: string; count: number }[];
}

// ---------------------------------------------------------------------------

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  const { data } = await apiClient.get<WorkflowSummary[]>("/workflows");
  return data;
}

export async function getWorkflow(id: string): Promise<WorkflowDetail> {
  const { data } = await apiClient.get<WorkflowDetail>(`/workflows/${id}`);
  return data;
}

export async function createWorkflow(payload: {
  name: string;
  description?: string;
  graph?: WorkflowGraph;
}): Promise<WorkflowDetail> {
  const { data } = await apiClient.post<WorkflowDetail>("/workflows", payload);
  return data;
}

export async function updateWorkflow(
  id: string,
  payload: {
    name?: string;
    description?: string | null;
    graph?: WorkflowGraph;
    reentry?: "block" | "allow";
    timezone?: string;
    default_locale?: string;
    exit_conditions?: ConditionGroup | null;
    send_window?: SendWindow | null;
  },
): Promise<WorkflowDetail> {
  const { data } = await apiClient.patch<WorkflowDetail>(`/workflows/${id}`, payload);
  return data;
}

export async function publishWorkflow(id: string): Promise<WorkflowDetail> {
  const { data } = await apiClient.post<WorkflowDetail>(`/workflows/${id}/publish`);
  return data;
}

export async function setWorkflowStatus(
  id: string,
  status: "active" | "paused",
): Promise<WorkflowDetail> {
  const { data } = await apiClient.patch<WorkflowDetail>(`/workflows/${id}/status`, {
    status,
  });
  return data;
}

export async function deleteWorkflow(id: string): Promise<void> {
  await apiClient.delete(`/workflows/${id}`);
}

export async function listWorkflowRuns(id: string): Promise<WorkflowRun[]> {
  const { data } = await apiClient.get<WorkflowRun[]>(`/workflows/${id}/runs`);
  return data;
}

export async function getWorkflowRun(
  id: string,
  runId: string,
): Promise<WorkflowRunDetail> {
  const { data } = await apiClient.get<WorkflowRunDetail>(
    `/workflows/${id}/runs/${runId}`,
  );
  return data;
}

export async function testWorkflow(
  id: string,
  payload: { entity_id: string; simulate_previous?: Record<string, unknown> },
): Promise<{ runId: string; simulatedPaths: string[] }> {
  const { data } = await apiClient.post<{ runId: string; simulatedPaths: string[] }>(
    `/workflows/${id}/test`,
    payload,
  );
  return data;
}

export async function getRecentRecords(
  entity: WorkflowEntity,
  search?: string,
): Promise<RecentRecord[]> {
  const { data } = await apiClient.get<RecentRecord[]>("/workflows/recent-records", {
    params: { entity, search: search || undefined, limit: 10 },
  });
  return data;
}

/** Render a template against a real record without running the workflow. */
export async function previewTemplate(
  workflowId: string,
  payload: { entity_id: string; template: string; escape?: boolean },
): Promise<{ rendered: string; unresolved: string[] }> {
  const { data } = await apiClient.post<{ rendered: string; unresolved: string[] }>(
    `/workflows/${workflowId}/preview`,
    payload,
  );
  return data;
}

export async function getFieldCatalog(): Promise<EntityCatalog[]> {
  const { data } = await apiClient.get<EntityCatalog[]>("/workflows/field-catalog");
  return data;
}

export async function getWorkflowCapabilities(): Promise<OutboundCapability> {
  const { data } = await apiClient.get<OutboundCapability>("/workflows/capabilities");
  return data;
}

export async function getWorkflowAnalytics(id: string): Promise<WorkflowAnalytics> {
  const { data } = await apiClient.get<WorkflowAnalytics>(
    `/workflows/${id}/analytics`,
  );
  return data;
}
