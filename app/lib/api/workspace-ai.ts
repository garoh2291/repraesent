import { apiClient } from "./axios-instance";

// ---------------------------------------------------------------------------
// Per-workspace OpenRouter key for AI assistants.
// Mirrors nestjs-monolith/src/modules/workspace-ai.
// ---------------------------------------------------------------------------

export interface WorkspaceAiModel {
  id: string;
  label: string;
}

export interface WorkspaceAiStatus {
  connected: boolean;
  status: "connected" | "error" | "revoked" | null;
  api_key_masked: string | null;
  key_label: string | null;
  last_error: string | null;
  auth_failed_at: string | null;
  connected_at: string | null;
  default_chat_model: string;
  models: WorkspaceAiModel[];
}

export interface WorkspaceAiTestResult {
  ok: boolean;
  key_label: string | null;
  limit: number | null;
  usage: number | null;
}

const BASE = "/workspace-ai/settings";

export async function getWorkspaceAiSettings(): Promise<WorkspaceAiStatus> {
  const r = await apiClient.get<WorkspaceAiStatus>(BASE);
  return r.data;
}

export async function connectWorkspaceAi(
  apiKey: string,
): Promise<WorkspaceAiStatus> {
  const r = await apiClient.put<WorkspaceAiStatus>(BASE, { api_key: apiKey });
  return r.data;
}

export async function updateWorkspaceAiSettings(dto: {
  default_chat_model?: string;
}): Promise<WorkspaceAiStatus> {
  const r = await apiClient.put<WorkspaceAiStatus>(BASE, dto);
  return r.data;
}

export async function testWorkspaceAi(): Promise<WorkspaceAiTestResult> {
  const r = await apiClient.post<WorkspaceAiTestResult>(`${BASE}/test`);
  return r.data;
}

export async function disconnectWorkspaceAi(): Promise<void> {
  await apiClient.delete(BASE);
}

/**
 * Publish, source creation and the widget config answer 409 with this code
 * while the workspace has no key. The UI turns it into a link to /settings/ai
 * instead of a generic error toast.
 */
export function isWorkspaceAiNotConfigured(error: unknown): boolean {
  const e = error as { response?: { data?: { code?: string } } } | null;
  return e?.response?.data?.code === "workspace_ai_not_configured";
}
