import { useQuery } from "@tanstack/react-query";
import { getCalendarSummary } from "~/lib/api/calendar";

export function useCalendarSummary(enabled: boolean) {
  return useQuery({
    queryKey: ["calendar-summary"],
    queryFn: getCalendarSummary,
    enabled,
    staleTime: 60_000,
  });
}
