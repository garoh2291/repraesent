"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWorkspaceReAppointmentButton,
  deleteWorkspaceReAppointmentButton,
  getWorkspaceReAppointmentButtons,
  getWorkspaceReAppointmentPickerUrl,
  updateWorkspaceReAppointmentButton,
  type ReAppointmentButtonsResponse,
} from "~/lib/api/wordpress-hub";
import type {
  ReAppointmentButtonConfig,
  ReAppointmentStatus,
} from "~/lib/wordpress/plugin-settings-types";

const RE_APPOINTMENT_KEY = ["workspace-wp-re-appointment-buttons"] as const;

/**
 * The re:appointment buttons on the workspace's WordPress site, plus the page
 * and slot options the editor needs. Gate this on the site query: the endpoint
 * 404s when the workspace has no site at all.
 */
export function useWorkspaceReAppointmentButtons(
  pluginUuid: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: RE_APPOINTMENT_KEY,
    queryFn: () => getWorkspaceReAppointmentButtons(pluginUuid as string),
    enabled: enabled && !!pluginUuid,
    // Reading the site's posts/postmeta goes over an SSH tunnel; don't refetch
    // on focus and never swap the list out from under someone mid-edit.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/**
 * Every write goes through one mutation set that invalidates the list on
 * success. Saving a button can silently change *another* button (claiming a
 * theme slot releases it from whoever held it), so refetching the whole list is
 * the only way to keep the UI honest — patching the cache in place would leave
 * the evicted button still showing a slot it no longer owns.
 */
function useInvalidateOnSuccess() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: RE_APPOINTMENT_KEY });
}

/** re:appointment must be resolved before any write can address it. */
function requirePluginUuid(pluginUuid: string | undefined): string {
  if (!pluginUuid) {
    throw new Error("Missing plugin id");
  }
  return pluginUuid;
}

export function useCreateReAppointmentButton(pluginUuid: string | undefined) {
  const invalidate = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: (config: Partial<ReAppointmentButtonConfig>) =>
      createWorkspaceReAppointmentButton(
        requirePluginUuid(pluginUuid),
        config,
      ),
    onSuccess: invalidate,
  });
}

export function useUpdateReAppointmentButton(pluginUuid: string | undefined) {
  const invalidate = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: (vars: {
      id: number;
      config: Partial<ReAppointmentButtonConfig>;
    }) =>
      updateWorkspaceReAppointmentButton(
        requirePluginUuid(pluginUuid),
        vars.id,
        vars.config,
      ),
    onSuccess: invalidate,
  });
}

/**
 * Toggling a button's active status gets its own mutation so it can update the
 * cache optimistically — the switch flips the moment it's clicked instead of
 * waiting on the round-trip over the SSH tunnel. This is safe to patch in place
 * (unlike a full save) because status never changes slot ownership; on error we
 * roll the button back, and we still invalidate on settle to reconcile.
 */
export function useToggleReAppointmentButtonStatus(
  pluginUuid: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; status: ReAppointmentStatus }) =>
      updateWorkspaceReAppointmentButton(requirePluginUuid(pluginUuid), vars.id, {
        status: vars.status,
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: RE_APPOINTMENT_KEY });
      const previous =
        queryClient.getQueryData<ReAppointmentButtonsResponse>(
          RE_APPOINTMENT_KEY,
        );
      if (previous) {
        queryClient.setQueryData<ReAppointmentButtonsResponse>(
          RE_APPOINTMENT_KEY,
          {
            ...previous,
            buttons: previous.buttons.map((b) =>
              b.id === vars.id ? { ...b, status: vars.status } : b,
            ),
          },
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(RE_APPOINTMENT_KEY, context.previous);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: RE_APPOINTMENT_KEY }),
  });
}

export function useDeleteReAppointmentButton(pluginUuid: string | undefined) {
  const invalidate = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: (id: number) =>
      deleteWorkspaceReAppointmentButton(requirePluginUuid(pluginUuid), id),
    onSuccess: invalidate,
  });
}

/**
 * A short-lived signed URL for the live placement picker iframe. Runs only in
 * the browser (needs `window.location.origin`) and only while the caller wants
 * it (the Placement tab is open). Never retries: a site that hasn't connected
 * SSO answers `sso_required`, and the UI falls back to the manual picker rather
 * than spinning. The URL is button-scoped so the picker can preview the button.
 */
export function useReAppointmentPickerUrl(
  pluginUuid: string | undefined,
  buttonId: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["workspace-wp-re-appointment-picker-url", buttonId],
    queryFn: () =>
      getWorkspaceReAppointmentPickerUrl(
        pluginUuid as string,
        window.location.origin,
        buttonId,
      ),
    enabled: enabled && !!pluginUuid && typeof window !== "undefined",
    // The signed URL lives 15 minutes; refresh well before it expires.
    staleTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
