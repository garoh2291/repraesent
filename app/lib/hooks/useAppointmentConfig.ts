import { useQuery } from "@tanstack/react-query";
import { getAppointmentConfig } from "~/lib/api/appointments";

export function useAppointmentConfig(enabled: boolean) {
  return useQuery({
    queryKey: ["appointment-config"],
    queryFn: getAppointmentConfig,
    enabled,
  });
}
