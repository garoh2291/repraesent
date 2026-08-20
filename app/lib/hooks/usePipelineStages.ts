"use client";

import { useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  createPipelineStage,
  deletePipelineStage,
  getPipelineStages,
  patchPipelineStage,
  reorderPipelineStages,
  type CreatePipelineStagePayload,
  type PatchPipelineStagePayload,
  type PipelineStage,
  type StageEntity,
} from "~/lib/api/pipeline-stages";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";

/** Cache key for the workspace's stage config (both entities in one list). */
export function pipelineStagesKey(workspaceId: string | null) {
  return ["pipeline-stages", workspaceId] as const;
}

export function usePipelineStagesQuery(): UseQueryResult<PipelineStage[]> {
  const workspaceId = getStoredWorkspaceId();
  return useQuery({
    queryKey: pipelineStagesKey(workspaceId),
    queryFn: getPipelineStages,
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });
}

export interface EntityStages {
  /** All stages of the entity, position-ordered, hidden included. */
  all: PipelineStage[];
  /** Stages the boards and pickers show. */
  visible: PipelineStage[];
  /** Where newly created records land. */
  entry: PipelineStage | undefined;
  byKey: Map<string, PipelineStage>;
  isLoading: boolean;
}

function useEntityStages(entity: StageEntity): EntityStages {
  const query = usePipelineStagesQuery();
  const data = query.data;
  return useMemo(() => {
    const all = (data ?? []).filter((s) => s.entity === entity);
    return {
      all,
      visible: all.filter((s) => !s.is_hidden),
      entry: all.find((s) => s.is_entry),
      byKey: new Map(all.map((s) => [s.key, s])),
      isLoading: query.isLoading,
    };
  }, [data, entity, query.isLoading]);
}

export function useLeadStages(): EntityStages {
  return useEntityStages("lead");
}

export function useDealStages(): EntityStages {
  return useEntityStages("deal");
}

/**
 * Everything a stage-config change can invalidate: the config itself plus
 * every list that renders stage columns, options or labels.
 */
export function useInvalidatePipelineStages() {
  const queryClient = useQueryClient();
  const workspaceId = getStoredWorkspaceId();
  return () => {
    void queryClient.invalidateQueries({
      queryKey: pipelineStagesKey(workspaceId),
    });
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["leads-kanban-column"] });
    void queryClient.invalidateQueries({ queryKey: ["leads-kanban-counts"] });
    void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
    void queryClient.invalidateQueries({ queryKey: ["workflow-field-catalog"] });
  };
}

export function useCreatePipelineStage() {
  const invalidate = useInvalidatePipelineStages();
  return useMutation({
    mutationFn: (payload: CreatePipelineStagePayload) =>
      createPipelineStage(payload),
    onSuccess: invalidate,
  });
}

export function usePatchPipelineStage() {
  const invalidate = useInvalidatePipelineStages();
  return useMutation({
    mutationFn: (args: { stageId: string; payload: PatchPipelineStagePayload }) =>
      patchPipelineStage(args.stageId, args.payload),
    onSuccess: invalidate,
  });
}

export function useReorderPipelineStages() {
  const queryClient = useQueryClient();
  const workspaceId = getStoredWorkspaceId();
  const invalidate = useInvalidatePipelineStages();
  return useMutation({
    mutationFn: (args: { entity: StageEntity; orderedIds: string[] }) =>
      reorderPipelineStages(args.entity, args.orderedIds),
    // Optimistic column order — the settings list should not snap back while
    // the request is in flight.
    onMutate: async (args) => {
      const key = pipelineStagesKey(workspaceId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PipelineStage[]>(key);
      if (previous) {
        const order = new Map(args.orderedIds.map((id, i) => [id, i]));
        queryClient.setQueryData<PipelineStage[]>(
          key,
          [...previous]
            .map((s) =>
              s.entity === args.entity && order.has(s.id)
                ? { ...s, position: order.get(s.id)! }
                : s,
            )
            .sort((a, b) =>
              a.entity === b.entity ? a.position - b.position : 0,
            ),
        );
      }
      return { previous };
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(pipelineStagesKey(workspaceId), ctx.previous);
      }
    },
    onSettled: invalidate,
  });
}

export function useDeletePipelineStage() {
  const invalidate = useInvalidatePipelineStages();
  return useMutation({
    mutationFn: (stageId: string) => deletePipelineStage(stageId),
    onSuccess: invalidate,
  });
}
