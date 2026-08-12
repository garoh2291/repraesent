import { useQuery } from "@tanstack/react-query";
import { listIntegrations } from "~/lib/api/integrations";

/**
 * Available integrations plus this workspace's connections.
 *
 * The key omits the workspace id like every other query here — switching
 * workspaces invalidates everything except ["auth"] in use-auth.ts.
 */
export function useWorkspaceIntegrations(enabled = true) {
  return useQuery({
    queryKey: ["workspace-integrations"],
    queryFn: listIntegrations,
    enabled,
  });
}

/** Convenience for the sidebar and the Products page empty state. */
export function useStripeConnection(enabled = true) {
  const query = useWorkspaceIntegrations(enabled);
  const stripe = query.data?.find((i) => i.key === "stripe") ?? null;
  return {
    ...query,
    stripe,
    isConnected: !!stripe?.connected,
  };
}
