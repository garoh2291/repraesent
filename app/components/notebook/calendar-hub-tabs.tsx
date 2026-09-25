import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import { useAuthContext } from "~/providers/auth-provider";
import { useAppointmentConfigs } from "~/lib/hooks/useAppointmentConfigs";
import { useCalendarSummary } from "~/lib/hooks/useCalendarSummary";

/**
 * One calendar place (NOTEBOOK_UX_PLAN.md D17): the team calendar, the public
 * booking page and the connected sources used to live in three corners of the
 * app. The pages are unchanged; this strip ties them together.
 */
export function CalendarHubTabs({ className }: { className?: string }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { currentWorkspace } = useAuthContext();
  const isDemo = currentWorkspace?.is_demo === true;
  const hasAppointments =
    currentWorkspace?.services?.some((s) => s.service_type === "appointments") ?? false;
  const { data: configs } = useAppointmentConfigs(hasAppointments && !!currentWorkspace?.id);
  const { data: summary } = useCalendarSummary(!!currentWorkspace?.id);
  const showCalendar =
    (summary?.google_account_count ?? 0) + (summary?.baikal_config_count ?? 0) > 0 || isDemo;
  const showBooking = (hasAppointments && !!configs?.length) || isDemo;

  const tabs = [
    showCalendar ? { to: "/calendar", label: t("calendarHub.calendar", "Calendar") } : null,
    showBooking ? { to: "/appointments", label: t("calendarHub.booking", "Booking page") } : null,
    { to: "/settings/calendars", label: t("calendarHub.sources", "Connected calendars") },
  ].filter(Boolean) as { to: string; label: string }[];

  if (tabs.length < 2) return null;
  return (
    <div
      role="tablist"
      className={cn("inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-card p-0.5 scrollbar-hide", className)}
    >
      {tabs.map((tab) => {
        const active = location.pathname.startsWith(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            role="tab"
            aria-selected={active}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
