"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateLeadStatus,
  type LeadStatus,
} from "~/lib/api/leads";

export interface UpdateLeadStatusVariables {
  id: string;
  status: LeadStatus;
}

export interface UseUpdateLeadStatusOptions {
  onMutate?: (variables: UpdateLeadStatusVariables) => Promise<unknown>;
  onError?: (err: Error, variables: UpdateLeadStatusVariables, context: unknown) => void;
}

export function useUpdateLeadStatus(opts?: UseUpdateLeadStatusOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: UpdateLeadStatusVariables) =>
      updateLeadStatus(id, status),
    onMutate: opts?.onMutate,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["lead-history", variables.id] });
    },
    onError: opts?.onError,
  });
}
