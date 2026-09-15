import type { QueryClient } from "@tanstack/react-query";
import type { WorkflowDetail, WorkflowSummary } from "~/lib/api/workflows";

/**
 * Optimistic-cache helpers for workflows, shared by the list's card menu and
 * the builder's command bar.
 *
 * Same shape as `~/lib/deals/optimistic` — patch the cache in the handler,
 * hand the snapshot to the mutation, roll it back in `onError` — because that
 * is how every other optimistic surface in this app is written, and a second
 * convention would be one more thing to hold in your head.
 *
 * Both cache families are patched together on purpose: the list
 * (`["workflows"]`) and the builder (`["workflow", id]`) show the same status
 * badge, and pausing from one while the other holds a stale copy is how you
 * get a workflow that reads Active on one screen and Paused on the next.
 */

export type ListSnapshots = Array<[readonly unknown[], unknown]>;

/** Keys the list row and the detail row genuinely share. */
type SharedPatch = Partial<
  Pick<
    WorkflowSummary,
    | "status"
    | "name"
    | "description"
    | "published_version_id"
    | "has_unpublished_changes"
  >
>;

/**
 * Apply a patch to one workflow everywhere it is cached. Returns what was
 * there, for `restoreSnapshots`.
 */
export function patchWorkflowInLists(
  queryClient: QueryClient,
  id: string,
  patch: SharedPatch,
): ListSnapshots {
  const snapshots: ListSnapshots = [];
  const now = new Date().toISOString();

  const lists = queryClient.getQueriesData<WorkflowSummary[]>({
    queryKey: ["workflows"],
  });
  for (const [key, value] of lists) {
    snapshots.push([key, value]);
    if (!value) continue;
    queryClient.setQueryData<WorkflowSummary[]>(
      key,
      value.map((w) => (w.id === id ? { ...w, ...patch, updated_at: now } : w)),
    );
  }

  const details = queryClient.getQueriesData<WorkflowDetail>({
    queryKey: ["workflow", id],
  });
  for (const [key, value] of details) {
    snapshots.push([key, value]);
    if (!value) continue;
    queryClient.setQueryData<WorkflowDetail>(key, {
      ...value,
      ...patch,
      updated_at: now,
    });
  }

  return snapshots;
}

/** The optimistic shape of a delete: the card goes, now. */
export function removeWorkflowFromLists(
  queryClient: QueryClient,
  id: string,
): ListSnapshots {
  const snapshots: ListSnapshots = [];

  const lists = queryClient.getQueriesData<WorkflowSummary[]>({
    queryKey: ["workflows"],
  });
  for (const [key, value] of lists) {
    snapshots.push([key, value]);
    if (!value) continue;
    queryClient.setQueryData<WorkflowSummary[]>(
      key,
      value.filter((w) => w.id !== id),
    );
  }

  return snapshots;
}

/**
 * Put a deleted workflow back — the optimistic shape of Undo.
 *
 * Re-inserted by `updated_at`, which is the order the list is served in, so it
 * lands where it was rather than jumping to the top and looking like a new
 * workflow. A row already present is replaced, not duplicated: the undo may
 * race a refetch that already brought it back.
 */
export function insertWorkflowIntoLists(
  queryClient: QueryClient,
  workflow: WorkflowSummary,
): ListSnapshots {
  const snapshots: ListSnapshots = [];

  const lists = queryClient.getQueriesData<WorkflowSummary[]>({
    queryKey: ["workflows"],
  });
  for (const [key, value] of lists) {
    snapshots.push([key, value]);
    if (!value) continue;
    const without = value.filter((w) => w.id !== workflow.id);
    const at = without.findIndex((w) => w.updated_at < workflow.updated_at);
    const next = [...without];
    next.splice(at === -1 ? next.length : at, 0, workflow);
    queryClient.setQueryData<WorkflowSummary[]>(key, next);
  }

  return snapshots;
}

export function restoreSnapshots(
  queryClient: QueryClient,
  snapshots: ListSnapshots,
): void {
  for (const [key, value] of snapshots) {
    queryClient.setQueryData(key, value);
  }
}

/**
 * Let the caches catch up with the server without yanking the list out from
 * under the person who is still looking at it. The optimistic patch is already
 * correct; this only makes the next mount re-read.
 */
export function markWorkflowsStale(
  queryClient: QueryClient,
  id?: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: ["workflows"],
    refetchType: "none",
  });
  void queryClient.invalidateQueries({
    queryKey: id ? ["workflow", id] : ["workflow"],
    refetchType: "none",
  });
}
