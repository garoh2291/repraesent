import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectWorkspaceAi,
  disconnectWorkspaceAi,
  getWorkspaceAiSettings,
  testWorkspaceAi,
  updateWorkspaceAiSettings,
} from "~/lib/api/workspace-ai";
import { useAuthContext } from "~/providers/auth-provider";

export const WORKSPACE_AI_KEY = ["workspace-ai-settings"] as const;

/**
 * retry: false — the endpoint answers for every member, and a slow first
 * paint on the banner is worse than a missed retry.
 */
export function useWorkspaceAi(enabled = true) {
  return useQuery({
    queryKey: WORKSPACE_AI_KEY,
    queryFn: getWorkspaceAiSettings,
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

/** Mirrors the server-side WorkspaceAdminGuard 1:1, like useCanManageOpenaiAds. */
export function useCanManageWorkspaceAi(): boolean {
  const { currentWorkspace } = useAuthContext();
  return currentWorkspace?.member_role === "admin";
}

export function useWorkspaceAiMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: WORKSPACE_AI_KEY });

  const connect = useMutation({
    mutationFn: connectWorkspaceAi,
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: updateWorkspaceAiSettings,
    onSuccess: refresh,
  });
  const test = useMutation({
    mutationFn: testWorkspaceAi,
    onSettled: refresh,
  });
  const disconnect = useMutation({
    mutationFn: disconnectWorkspaceAi,
    onSuccess: refresh,
  });

  return { connect, update, test, disconnect };
}
