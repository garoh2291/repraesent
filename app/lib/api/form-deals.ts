import { apiClient } from "./axios-instance";
import type { PipelineStage } from "./pipeline-stages";

/**
 * Per-form "create a deal from a resolved checkout" config.
 *
 * Lives outside the form definition on purpose, so it is never frozen into
 * `published_definition` — the pipeline and stages on a live form can be
 * changed without republishing.
 */
export interface FormDealSettings {
  id: string;
  workspace_id: string;
  form_id: string;
  is_enabled: boolean;
  /** Null only on legacy rows; the server stores the resolved pipeline. */
  pipeline_id: string | null;
  won_stage_key: string;
  /** Null means: create nothing when a checkout resolves unpaid. */
  lost_stage_key: string | null;
  assigned_to: string | null;
  title_template: string | null;
}

export interface FormDealOption {
  id: string;
  name: string;
  is_default: boolean;
  stages: PipelineStage[];
}

export interface UpdateFormDealSettingsDto {
  is_enabled: boolean;
  pipeline_id?: string | null;
  won_stage_key: string;
  lost_stage_key?: string | null;
  assigned_to?: string | null;
  title_template?: string | null;
}

export async function getFormDealSettings(
  formId: string,
): Promise<FormDealSettings | null> {
  const res = await apiClient.get<FormDealSettings | null>(
    `/forms/${formId}/deal-settings`,
  );
  return res.data ?? null;
}

export async function getFormDealOptions(
  formId: string,
): Promise<FormDealOption[]> {
  const res = await apiClient.get<FormDealOption[]>(
    `/forms/${formId}/deal-settings/options`,
  );
  return res.data;
}

export async function putFormDealSettings(
  formId: string,
  dto: UpdateFormDealSettingsDto,
): Promise<FormDealSettings> {
  const res = await apiClient.put<FormDealSettings>(
    `/forms/${formId}/deal-settings`,
    dto,
  );
  return res.data;
}

export async function deleteFormDealSettings(formId: string): Promise<void> {
  await apiClient.delete(`/forms/${formId}/deal-settings`);
}
