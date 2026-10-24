import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { usePilotFeatures } from "~/lib/feature-flags";
import { useAuthContext } from "~/providers/auth-provider";

/**
 * Appointments are a pilot (`appointmentBook`). Outside it, `/appointments`
 * keeps meaning what it always did — the booking-page settings — and the new
 * pages send you there (or home). Returns whether the page may render.
 */
export function useAppointmentBookGate(fallback: "booking-page" | "home" = "home"): boolean {
  const { currentWorkspace } = useAuthContext();
  const pilot = usePilotFeatures();
  const navigate = useNavigate();
  const location = useLocation();
  const ready = !!currentWorkspace;
  const allowed = pilot.appointmentBook;
  useEffect(() => {
    if (!ready || allowed) return;
    navigate(fallback === "booking-page" ? `/appointments/booking-page${location.search}` : "/", { replace: true });
  }, [ready, allowed, fallback, navigate, location.search]);
  return ready && allowed;
}
