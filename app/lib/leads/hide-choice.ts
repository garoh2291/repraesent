import type { QueryClient } from "@tanstack/react-query";

/** What to do when a lead is moved to Hidden. */
export type HideChoice = "hide" | "block";

/** Every cached view a lead's stage or spam state shows up in. */
export function refreshLeadViews(queryClient: QueryClient, leadId: string) {
  for (const key of [
    ["leads"],
    ["leads-kanban-column"],
    ["leads-kanban-counts"],
    ["lead", leadId],
    ["lead-history", leadId],
    ["lead-blocklist"],
    ["contacts"],
  ]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}
