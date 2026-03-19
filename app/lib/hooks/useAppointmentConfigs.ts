import { useQuery } from "@tanstack/react-query";
import { getAppointmentConfigs } from "~/lib/api/appointments";

export function useAppointmentConfigs(enabled: boolean) {
  return useQuery({
    queryKey: ["appointment-configs"],
    queryFn: getAppointmentConfigs,
    enabled,
  });
}
