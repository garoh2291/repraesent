import { CalendarClock } from "lucide-react";
import { CalDavIcon } from "~/components/icons/CalDavIcon";
import { GoogleIcon } from "~/components/icons/GoogleIcon";
import { MicrosoftIcon } from "~/components/icons/MicrosoftIcon";
import type { AppointmentProvider } from "~/lib/leads/appointment";
import { cn } from "~/lib/utils";

/**
 * Provider mark for a lead's booked appointment. Baikal shares the CalDAV
 * mark (Baikal IS a CalDAV server — same convention as CalendarSourcesPanel).
 */
export function AppointmentProviderIcon({
  provider,
  className,
}: {
  provider: AppointmentProvider;
  className?: string;
}) {
  if (provider === "google") return <GoogleIcon className={className} />;
  if (provider === "microsoft") return <MicrosoftIcon className={className} />;
  if (provider === "caldav" || provider === "baikal") {
    return <CalDavIcon className={className} />;
  }
  return <CalendarClock className={cn("text-muted-foreground", className)} />;
}
