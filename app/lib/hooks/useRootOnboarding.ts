"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getRootOnboardingSettings,
  getRootPipelines,
  previewRootDays,
  previewRootSlots,
  runRootTestIntake,
  saveRootOnboardingSettings,
  type RootBookingConfig,
  type RootOnboardingSettingsInput,
} from "~/lib/api/root-onboarding";

export function rootOnboardingKey(workspaceId: string | null | undefined) {
  return ["root-onboarding", workspaceId ?? null] as const;
}

/** Only fires in the root workspace for admins — everywhere else it's a 404. */
function useEnabled() {
  const { currentWorkspace } = useAuthContext();
  return {
    workspaceId: currentWorkspace?.id ?? null,
    enabled:
      currentWorkspace?.is_root === true &&
      currentWorkspace.member_role === "admin",
  };
}

export function useRootOnboardingSettings() {
  const { workspaceId, enabled } = useEnabled();
  return useQuery({
    queryKey: [...rootOnboardingKey(workspaceId), "settings"],
    queryFn: getRootOnboardingSettings,
    enabled,
  });
}

export function useRootPipelines() {
  const { workspaceId, enabled } = useEnabled();
  return useQuery({
    queryKey: [...rootOnboardingKey(workspaceId), "pipelines"],
    queryFn: getRootPipelines,
    enabled,
    staleTime: 60_000,
  });
}

export function useSaveRootOnboardingSettings() {
  const qc = useQueryClient();
  const { workspaceId } = useEnabled();
  return useMutation({
    mutationFn: (input: RootOnboardingSettingsInput) =>
      saveRootOnboardingSettings(input),
    onSuccess: (saved) => {
      qc.setQueryData([...rootOnboardingKey(workspaceId), "settings"], saved);
    },
  });
}

/**
 * Preview of the DRAFT config — keyed on the serialised draft so the grid
 * follows unsaved edits, and only when there is at least one complete host.
 */
export function useRootPreviewDays(
  booking: RootBookingConfig | null,
  from: string,
  to: string,
) {
  const { workspaceId, enabled } = useEnabled();
  const draft = booking ? JSON.stringify(booking) : null;
  return useQuery({
    queryKey: [...rootOnboardingKey(workspaceId), "preview-days", draft, from, to],
    queryFn: () => previewRootDays(booking!, from, to),
    enabled: enabled && !!booking && booking.hosts.length > 0,
    staleTime: 30_000,
    retry: false,
  });
}

export function useRootPreviewSlots(
  booking: RootBookingConfig | null,
  date: string | null,
) {
  const { workspaceId, enabled } = useEnabled();
  const draft = booking ? JSON.stringify(booking) : null;
  return useQuery({
    queryKey: [...rootOnboardingKey(workspaceId), "preview-slots", draft, date],
    queryFn: () => previewRootSlots(booking!, date!),
    enabled: enabled && !!booking && booking.hosts.length > 0 && !!date,
    staleTime: 30_000,
    retry: false,
  });
}

export function useRunRootTestIntake() {
  return useMutation({
    mutationFn: (slot?: string) => runRootTestIntake(slot),
  });
}
