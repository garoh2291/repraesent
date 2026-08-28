"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  getWorkspaceWpPluginInstalls,
  setWorkspaceCatalogPluginActive,
} from "~/lib/api/wordpress-hub";
import { extractErrorMessage } from "~/lib/api/axios-instance";

export const INSTALLS_KEY = ["workspace-wp-plugin-installs"] as const;

/**
 * Catalog plugins installed on the current workspace's WordPress site.
 * Postgres relation only — if the row is there, it is listed. Gate `enabled`
 * on knowing the workspace has a site.
 */
export function useWorkspaceWpPluginInstalls(enabled: boolean) {
  return useQuery({
    queryKey: INSTALLS_KEY,
    queryFn: getWorkspaceWpPluginInstalls,
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Activate / deactivate a catalog service on the workspace's WordPress site.
 * Waits for the WordPress call to finish before flipping `active`, so a failed
 * activate/deactivate does not flash the settings UI.
 */
export function useWorkspacePluginActivation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pluginUuid,
      active,
    }: {
      pluginUuid: string;
      active: boolean;
      name: string;
    }) => setWorkspaceCatalogPluginActive(pluginUuid, active),
    onError: (err) => {
      toast.error(
        extractErrorMessage(err) ||
          t(
            "wordpress.plugins.toggleError",
            "Couldn't update this service. Please contact support.",
          ),
      );
    },
    onSuccess: (data, vars) => {
      queryClient.setQueryData(INSTALLS_KEY, data);
      toast.success(
        vars.active
          ? t("wordpress.plugins.activated", "{{name}} activated", {
              name: vars.name,
            })
          : t("wordpress.plugins.deactivated", "{{name}} deactivated", {
              name: vars.name,
            }),
      );
    },
  });
}
