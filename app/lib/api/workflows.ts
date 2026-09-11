import { apiClient } from "./axios-instance";

/**
 * Mirrors `nestjs-monolith/src/modules/workflows/workflow.types.ts`.
 *
 * Kept as a hand-written mirror rather than generated, the same arrangement
 * `app/lib/forms/schema.ts` has with `form-schema.types.ts`. If you change one,
 * change the other.
 */

export const WORKFLOW_ENTITIES = [
  "leads",
  "deals",
  "tasks",
  "contacts",
] as const;
export type WorkflowEntity = (typeof WORKFLOW_ENTITIES)[number];

export type FieldKind =
  "string" | "number" | "boolean" | "date" | "enum" | "uuid" | "json";

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

export interface FieldOption {
  value: string;
  label: string;
  /**
   * Which pipelines a deal-stage key exists in.
   *
   * The value stored in a condition is the stage KEY, and two pipelines can
   * both have one keyed `won` — so the list holds each key once and says where
   * it lives, rather than offering two choices that write the same thing. The
   * builder narrows on this once a `pipeline_id` condition names a pipeline.
   */
  scopes?: string[];
}

export interface CatalogField {
  path: string;
  label: string;
  kind: FieldKind;
  operators: ConditionOperator[];
  options?: FieldOption[];
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
  | "send_customer_email"
  // Actions that change the workspace's own data. Deliberately NOT held by the
  // workflow's send window — a rule firing at 22:00 must still create its task
  // then, or the follow-up is a day late.
  | "create_task"
  | "add_note"
  | "update_record"
  // Outbound, so this one DOES wait for the send window.
  | "notify_team";

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

/**
 * Who a customer email goes to.
 *
 * A named choice, not a template path. `path` is still here as the escape
 * hatch for an address stashed somewhere odd — a metadata key, say — but it
 * lives one level down in the picker and nothing defaults to it.
 */
export type EmailAudience =
  /** The one obvious person: the lead, the contact, the deal's main contact. */
  | { kind: "primary" }
  /** Deals: every contact attached, primary first. One email each. */
  | { kind: "all_contacts" }
  /** Deals: the address on the lead this deal came from. */
  | { kind: "source_lead" }
  /** Leads: the contact this lead was converted into. */
  | { kind: "linked_contact" }
  | { kind: "address"; email: string }
  | { kind: "path"; path: string };

/** What each trigger entity can sensibly be asked for. Mirrors the backend. */
export const AUDIENCES_BY_ENTITY: Record<
  WorkflowEntity,
  EmailAudience["kind"][]
> = {
  deals: ["primary", "all_contacts", "source_lead", "address", "path"],
  leads: ["primary", "linked_contact", "address", "path"],
  contacts: ["primary", "address", "path"],
  tasks: ["primary", "address", "path"],
};

/**
 * What an older step meant.
 *
 * `to_path` was free text and every step in existence holds the same default,
 * so this is a rename for all of them rather than a migration.
 */
export function audienceOf(config: {
  audience?: EmailAudience;
  to_path?: string;
}): EmailAudience {
  if (config.audience) return config.audience;
  const path = config.to_path?.trim();
  if (!path || path === "{{trigger.record.email}}") return { kind: "primary" };
  return { kind: "path", path };
}

export interface ResolvedRecipient {
  email: string;
  contactId: string | null;
  name: string | null;
  /** A key, not prose — the client translates it. */
  why:
    | "primary_contact"
    | "also_on_deal"
    | "the_lead"
    | "linked_contact"
    | "literal_address"
    | "custom_variable";
}

export interface SendCustomerEmailConfig {
  audience?: EmailAudience;
  /** Legacy free-text path; superseded by `audience`, still executed. */
  to_path?: string;
  locale_path?: string;
  email_account_id?: string | null;
  by_locale: LocalizedTemplate;
}

export interface DelayConfig {
  minutes: number;
}

/**
 * Which record an action attaches to. `contact` follows the trigger record's
 * contact, which is what "call the customer about this deal" usually means.
 */
export type ActionTarget = "trigger" | "contact";

export interface CreateTaskConfig {
  title: string;
  description?: string;
  target?: ActionTarget;
  /** Days from the moment the step runs. 0 = today. */
  dueInDays?: number;
  assignee?: { kind: "member"; userId: string } | { kind: "owner" };
}

export interface AddNoteConfig {
  body: string;
  target?: ActionTarget;
}

export interface UpdateRecordConfig {
  /** Column → template. Only the entity's settable fields are offered. */
  set: Record<string, string>;
}

export interface NotifyTeamConfig {
  message: string;
}

/**
 * What `update_record` may set, per entity — mirrors `SETTABLE` in
 * `update-record.node.ts`. Kept here rather than fetched so the picker can be
 * drawn before any request resolves; the backend allowlist is the one that
 * actually enforces it.
 */
export const UPDATABLE_FIELDS: Partial<Record<WorkflowEntity, string[]>> = {
  deals: [
    "title",
    "stage",
    "status",
    "value",
    "assigned_to",
    "expected_close_date",
  ],
  leads: ["status"],
};

export interface ConditionNodeConfig {
  group: ConditionGroup;
}

export type NodeConfig =
  | TriggerConfig
  | ConditionNodeConfig
  | DelayConfig
  | SendInternalEmailConfig
  | SendCustomerEmailConfig
  | CreateTaskConfig
  | AddNoteConfig
  | UpdateRecordConfig
  | NotifyTeamConfig;

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

export interface WorkflowDetail extends Omit<
  WorkflowSummary,
  "entity" | "trigger_type" | "runs_7d" | "failed_7d" | "last_run_at"
> {
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
    /** Inherited from the parent mailbox on a Gmail send-as alias. */
    auth_failed_at: string | null;
    /** Set on a Gmail send-as alias: the mailbox whose grant it sends with. */
    parent_account_id: string | null;
  }[];
  legacyOnly: boolean;
}

export interface WorkflowAnalytics {
  runs_by_status: { status: string; count: number }[];
  nodes: {
    node_id: string;
    node_type: string;
    status: string;
    count: number;
  }[];
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
  /** Language new email steps start in. Send the author's current language —
   * the server otherwise falls back to the column default (German). */
  default_locale?: string;
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
  const { data } = await apiClient.patch<WorkflowDetail>(
    `/workflows/${id}`,
    payload,
  );
  return data;
}

export async function publishWorkflow(id: string): Promise<WorkflowDetail> {
  const { data } = await apiClient.post<WorkflowDetail>(
    `/workflows/${id}/publish`,
  );
  return data;
}

export async function setWorkflowStatus(
  id: string,
  status: "active" | "paused",
): Promise<WorkflowDetail> {
  const { data } = await apiClient.patch<WorkflowDetail>(
    `/workflows/${id}/status`,
    {
      status,
    },
  );
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
  const { data } = await apiClient.post<{
    runId: string;
    simulatedPaths: string[];
  }>(`/workflows/${id}/test`, payload);
  return data;
}

export async function getRecentRecords(
  entity: WorkflowEntity,
  search?: string,
): Promise<RecentRecord[]> {
  const { data } = await apiClient.get<RecentRecord[]>(
    "/workflows/recent-records",
    {
      params: { entity, search: search || undefined, limit: 10 },
    },
  );
  return data;
}

/** Render a template against a real record without running the workflow. */
export async function previewTemplate(
  workflowId: string,
  payload: { entity_id: string; template: string; escape?: boolean },
): Promise<{ rendered: string; unresolved: string[] }> {
  const { data } = await apiClient.post<{
    rendered: string;
    unresolved: string[];
  }>(`/workflows/${workflowId}/preview`, payload);
  return data;
}

/**
 * Who a step would actually email, for one real record.
 *
 * Calls the same resolver the send step calls, so the builder cannot promise
 * something different from what the run does.
 */
export async function resolveRecipients(
  workflowId: string,
  payload: { entity_id: string; audience: EmailAudience },
): Promise<{ recipients: ResolvedRecipient[] }> {
  const { data } = await apiClient.post<{ recipients: ResolvedRecipient[] }>(
    `/workflows/${workflowId}/resolve-recipients`,
    payload,
  );
  return data;
}

export async function getFieldCatalog(): Promise<EntityCatalog[]> {
  const { data } = await apiClient.get<EntityCatalog[]>(
    "/workflows/field-catalog",
  );
  return data;
}

export async function getWorkflowCapabilities(): Promise<OutboundCapability> {
  const { data } = await apiClient.get<OutboundCapability>(
    "/workflows/capabilities",
  );
  return data;
}

export async function getWorkflowAnalytics(
  id: string,
): Promise<WorkflowAnalytics> {
  const { data } = await apiClient.get<WorkflowAnalytics>(
    `/workflows/${id}/analytics`,
  );
  return data;
}
