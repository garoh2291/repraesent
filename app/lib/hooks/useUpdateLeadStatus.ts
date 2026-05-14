"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateLeadStatus, type Lead, type LeadStatus } from "~/lib/api/leads";

export interface UpdateLeadStatusVariables {
  id: string;
  status: LeadStatus;
}

export interface UseUpdateLeadStatusOptions {
  onMutate?: (variables: UpdateLeadStatusVariables) => Promise<unknown>;
  onError?: (
    err: Error,
    variables: UpdateLeadStatusVariables,
    context: unknown
  ) => void;
  /** Fires after cache invalidation when status becomes `success` (lead → customer conversion). */
  onConvertedToSuccess?: (lead: Lead) => void | Promise<void>;
}

export function useUpdateLeadStatus(opts?: UseUpdateLeadStatusOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: UpdateLeadStatusVariables) =>
      updateLeadStatus(id, status),
    onMutate: opts?.onMutate,
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-kanban-column"] });
      queryClient.invalidateQueries({ queryKey: ["leads-kanban-counts"] });
      queryClient.invalidateQueries({ queryKey: ["lead", variables.id] });
      queryClient.invalidateQueries({
        queryKey: ["lead-history", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (variables.status === "success") {
        await opts?.onConvertedToSuccess?.(data);
      }
    },
    onError: opts?.onError,
  });
}
