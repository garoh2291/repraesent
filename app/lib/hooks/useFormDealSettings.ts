import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteFormDealSettings,
  getFormDealOptions,
  getFormDealSettings,
  putFormDealSettings,
  type UpdateFormDealSettingsDto,
} from "~/lib/api/form-deals";

export const formDealSettingsKey = (formId: string) =>
  ["form-deal-settings", formId] as const;
export const formDealOptionsKey = (formId: string) =>
  ["form-deal-options", formId] as const;

/** The form's config. `data === null` means the feature was never set up. */
export function useFormDealSettings(formId: string | undefined) {
  return useQuery({
    queryKey: formDealSettingsKey(formId ?? ""),
    queryFn: () => getFormDealSettings(formId!),
    enabled: !!formId,
  });
}

/** Pipelines with their visible deal stages, for the two stage selects. */
export function useFormDealOptions(formId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: formDealOptionsKey(formId ?? ""),
    queryFn: () => getFormDealOptions(formId!),
    enabled: !!formId && enabled,
  });
}

export function useSaveFormDealSettings(formId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateFormDealSettingsDto) =>
      putFormDealSettings(formId, dto),
    onSuccess: (row) => {
      // Seed rather than invalidate-and-refetch: the PUT already returned the
      // saved row, and the panel is the only reader.
      queryClient.setQueryData(formDealSettingsKey(formId), row);
    },
  });
}

export function useDeleteFormDealSettings(formId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteFormDealSettings(formId),
    onSuccess: () => {
      queryClient.setQueryData(formDealSettingsKey(formId), null);
    },
  });
}
