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
  /**
   * Whether deals on this board have a working public tracking link. The
   * capability belongs to the pipeline, not the deal: switching it off makes
   * every outstanding link 404 at once, without changing a single token.
   */
  public_tracking_enabled: boolean;
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
  /** Omitted means private — the server defaults it rather than guessing. */
  public_tracking_enabled?: boolean;
}): Promise<Pipeline> {
  const { data } = await apiClient.post<Pipeline>("/pipelines", payload);
  return data;
}

export async function updatePipeline(
  id: string,
  payload: {
    name?: string;
    description?: string | null;
    public_tracking_enabled?: boolean;
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
