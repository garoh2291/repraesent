"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { getToday, updateSetup } from "~/lib/api/today";

/** Today feed, per workspace and scope. */
export function todayKey(workspaceId: string | null, assignee?: "me" | "all") {
  return assignee
    ? (["today", workspaceId, assignee] as const)
    : (["today", workspaceId] as const);
}

export function useToday(assignee: "me" | "all", enabled = true) {
  const workspaceId = getStoredWorkspaceId();
  return useQuery({
    queryKey: todayKey(workspaceId, assignee),
    queryFn: () => getToday({ assignee }),
    enabled: enabled && !!workspaceId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    // Switching Mine / Everyone keeps the screen instead of blanking it.
    placeholderData: keepPreviousData,
  });
}

/**
 * Everything the owner's loop can change: Today, the inquiry lists and
 * boards, tasks, deals and histories. One place, so every action on the
 * Today screen, the lead sheet and the kanban refreshes the same caches.
 */
export function useInvalidateWork() {
  const qc = useQueryClient();
  return () => {
    for (const key of [
      "today",
      "leads",
      "lead",
      "leads-kanban-counts",
      "leads-kanban-column",
      "lead-history",
      "tasks",
      "task",
      "lead-tasks",
      "deal-tasks",
      "contact-tasks",
      // An outcome can carry a note; every notes list (lead sheet / page,
      // deal and contact activity panels) must show it without a reload.
      "lead-notes",
      "deal-notes",
      "customer-notes",
      "pipelines",
      "deals",
      "deal",
      "deals-pipeline",
      "deal-history",
      "contact",
      "contacts",
      "contact-history",
      "contact-deals",
      "home-tasks-upcoming",
      "home-tasks-overdue",
      "results",
    ]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useUpdateSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateSetup,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["today"] }),
  });
}

/**
 * A Call / WhatsApp / Email tap only changes the lead's contact state: refresh
 * the screens that show it, not every board in the app.
 */
export function useInvalidateLeadAttempt() {
  const qc = useQueryClient();
  return () => {
    for (const key of [
      "today",
      "lead",
      "leads",
      "leads-kanban-column",
      "lead-history",
    ]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}
