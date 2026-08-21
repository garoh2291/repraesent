import { apiClient } from "./axios-instance";

export type StageEntity = "lead" | "deal";
export type StageCategory = "open" | "won" | "lost" | "hidden";

/**
 * A workspace pipeline stage. `key` is the immutable machine key stored in
 * leads.status / deals.stage; `label` is the admin-chosen display name (NULL =
 * fall back to the built-in translation for legacy keys); `category` carries
 * the system semantics (won/lost drive terminal flows, hidden is the
 * analytics sink); `count` is the number of records currently in the stage.
 */
export interface PipelineStage {
  id: string;
  workspace_id: string;
  entity: StageEntity;
  key: string;
  label: string | null;
  category: StageCategory;
  is_entry: boolean;
  position: number;
  is_hidden: boolean;
  color: string | null;
  count: number;
}

export async function getPipelineStages(): Promise<PipelineStage[]> {
  const res = await apiClient.get<PipelineStage[]>("/pipeline-stages");
  return res.data;
}

export interface CreatePipelineStagePayload {
  entity: StageEntity;
  label: string;
  category: Exclude<StageCategory, "hidden">;
  color?: string;
}

export async function createPipelineStage(
  payload: CreatePipelineStagePayload,
): Promise<PipelineStage> {
  const res = await apiClient.post<PipelineStage>("/pipeline-stages", payload);
  return res.data;
}

export interface PatchPipelineStagePayload {
  label?: string;
  color?: string | null;
  is_hidden?: boolean;
  is_entry?: boolean;
}

export async function patchPipelineStage(
  stageId: string,
  payload: PatchPipelineStagePayload,
): Promise<PipelineStage> {
  const res = await apiClient.patch<PipelineStage>(
    `/pipeline-stages/${stageId}`,
    payload,
  );
  return res.data;
}

export async function reorderPipelineStages(
  entity: StageEntity,
  orderedIds: string[],
): Promise<PipelineStage[]> {
  const res = await apiClient.put<PipelineStage[]>("/pipeline-stages/reorder", {
    entity,
    ordered_ids: orderedIds,
  });
  return res.data;
}

export async function deletePipelineStage(stageId: string): Promise<void> {
  await apiClient.delete(`/pipeline-stages/${stageId}`);
}
