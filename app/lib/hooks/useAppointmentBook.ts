import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuthContext } from "~/providers/auth-provider";
import {
  appointmentKeys,
  getAppointmentsToday,
  listAppointmentCalendars,
  listAppointments,
  type ListAppointmentsParams,
} from "~/lib/api/appointment-book";

/** Every Repraesent calendar of the workspace (the first read creates the default one). */
export function useAppointmentCalendars(enabled = true) {
  const { currentWorkspace } = useAuthContext();
  return useQuery({
    queryKey: appointmentKeys.calendars(currentWorkspace?.id),
    queryFn: listAppointmentCalendars,
    enabled: enabled && !!currentWorkspace?.id,
    staleTime: 60_000,
  });
}

export function useAppointments(params: ListAppointmentsParams, enabled = true) {
  const { currentWorkspace } = useAuthContext();
  return useQuery({
    queryKey: appointmentKeys.list(currentWorkspace?.id, params),
    queryFn: () => listAppointments(params),
    enabled: enabled && !!currentWorkspace?.id,
  });
}

export function useAppointmentsToday(enabled = true) {
  const { currentWorkspace } = useAuthContext();
  return useQuery({
    queryKey: appointmentKeys.today(currentWorkspace?.id),
    queryFn: getAppointmentsToday,
    enabled: enabled && !!currentWorkspace?.id,
    refetchInterval: 5 * 60_000,
  });
}

/** Everything an appointment change can show up in, in one place. */
export function useInvalidateAppointments() {
  const qc = useQueryClient();
  const { currentWorkspace } = useAuthContext();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: appointmentKeys.all(currentWorkspace?.id) });
    void qc.invalidateQueries({ queryKey: ["today"] });
    void qc.invalidateQueries({ queryKey: ["leads"] });
  }, [qc, currentWorkspace?.id]);
}
