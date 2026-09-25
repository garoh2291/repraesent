"use client";

import { useQuery } from "@tanstack/react-query";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { getResultsSummary, type ResultPeriod } from "~/lib/api/results";

export function resultsKey(workspaceId: string | null, period: ResultPeriod) {
  return ["results", workspaceId, period] as const;
}

export function useResultsSummary(period: ResultPeriod, enabled = true) {
  const workspaceId = getStoredWorkspaceId();
  return useQuery({
    queryKey: resultsKey(workspaceId, period),
    queryFn: () => getResultsSummary(period),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60_000,
  });
}
