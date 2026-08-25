"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPipeline,
  deletePipeline,
  listPipelines,
  updatePipeline,
  type Pipeline,
} from "~/lib/api/pipelines";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { pipelineStagesKey } from "~/lib/hooks/usePipelineStages";

/** Cache key for the workspace's deal pipelines (Default first). */
export function pipelinesKey(workspaceId: string | null) {
  return ["pipelines", workspaceId] as const;
}

export function usePipelinesQuery() {
  const workspaceId = getStoredWorkspaceId();
  return useQuery({
    queryKey: pipelinesKey(workspaceId),
    queryFn: listPipelines,
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });
}

/** The protected Default pipeline (server orders it first). */
export function useDefaultPipeline(): Pipeline | undefined {
  const query = usePipelinesQuery();
  return query.data?.find((p) => p.is_default) ?? query.data?.[0];
}

/**
 * Everything a pipeline change can invalidate: the pipeline list, the stage
 * config (create/delete change the deal stage set), every deals board and the
 * workflow stage options.
 */
export function useInvalidatePipelines() {
  const queryClient = useQueryClient();
  const workspaceId = getStoredWorkspaceId();
  return () => {
    void queryClient.invalidateQueries({
      queryKey: pipelinesKey(workspaceId),
    });
    void queryClient.invalidateQueries({
      queryKey: pipelineStagesKey(workspaceId),
    });
    void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
    void queryClient.invalidateQueries({ queryKey: ["workflow-field-catalog"] });
  };
}

export function useCreatePipeline() {
  const invalidate = useInvalidatePipelines();
  return useMutation({
    mutationFn: (payload: { name: string; description?: string }) =>
      createPipeline(payload),
    onSuccess: invalidate,
  });
}

export function useUpdatePipeline() {
  const invalidate = useInvalidatePipelines();
  return useMutation({
    mutationFn: (args: {
      pipelineId: string;
      payload: { name?: string; description?: string | null };
    }) => updatePipeline(args.pipelineId, args.payload),
    onSuccess: invalidate,
  });
}

export function useDeletePipeline() {
  const invalidate = useInvalidatePipelines();
  return useMutation({
    mutationFn: (pipelineId: string) => deletePipeline(pipelineId),
    onSuccess: invalidate,
  });
}
