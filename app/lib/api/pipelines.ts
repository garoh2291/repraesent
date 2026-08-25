import { apiClient } from "./axios-instance";

/**
 * A workspace deal pipeline (Pipedrive-style). Each pipeline owns its own
 * deal stage set; every deal belongs to exactly one pipeline. The seeded
 * `is_default` pipeline ("Default") cannot be deleted — it absorbs deals from
 * deleted pipelines and every write that does not name a pipeline.
 */
export interface Pipeline {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  position: number;
  /** Live (non-deleted) deals on this pipeline's board. */
  deal_count: number;
}

export async function listPipelines(): Promise<Pipeline[]> {
  const { data } = await apiClient.get<Pipeline[]>("/pipelines");
  return data;
}

export async function createPipeline(payload: {
  name: string;
  description?: string;
}): Promise<Pipeline> {
  const { data } = await apiClient.post<Pipeline>("/pipelines", payload);
  return data;
}

export async function updatePipeline(
  id: string,
  payload: {
    name?: string;
    description?: string | null;
  },
): Promise<Pipeline> {
  const { data } = await apiClient.patch<Pipeline>(`/pipelines/${id}`, payload);
  return data;
}

export async function deletePipeline(
  id: string,
): Promise<{ success: boolean; moved_deals: number }> {
  const { data } = await apiClient.delete<{
    success: boolean;
    moved_deals: number;
  }>(`/pipelines/${id}`);
  return data;
}
