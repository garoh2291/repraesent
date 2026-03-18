import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuthContext } from "~/providers/auth-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { type AppointmentConfig } from "~/lib/api/appointments";
import { useAppointmentConfig } from "~/lib/hooks/useAppointmentConfig";
import { CalendarTab } from "~/components/appointments/CalendarTab";
import { GeneralSettingsTab } from "~/components/appointments/GeneralSettingsTab";
import { BookingSettingsTab } from "~/components/appointments/BookingSettingsTab";
import { BusinessLogicTab } from "~/components/appointments/BusinessLogicTab";

export function meta() {
  return [
    { title: "Appointments - Repraesent" },
    { name: "description", content: "Manage appointments and booking" },
  ];
}

export default function Appointments() {
  const { currentWorkspace } = useAuthContext();
  const navigate = useNavigate();
  const hasAccess =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "appointments"
    ) ?? false;

  const { data: config, isLoading: configLoading } = useAppointmentConfig(
    hasAccess && !!currentWorkspace?.id
  );

  const shouldRedirect =
    !hasAccess || (hasAccess && !configLoading && !config);

  useEffect(() => {
    if (shouldRedirect) {
      navigate("/", { replace: true });
    }
  }, [shouldRedirect, navigate]);

  if (shouldRedirect) {
    return null;
  }

  if (configLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-1.5">
          <div className="h-7 w-44 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-muted/60 rounded animate-pulse" />
        </div>
        <div className="h-px bg-border" />
        <div className="h-[520px] bg-muted rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!config) {
    return null;
  }

  return <AppointmentsDashboard config={config} />;
}

function AppointmentsDashboard({ config }: { config: AppointmentConfig }) {
  return (
    <div className="p-6 space-y-6 app-fade-in">
      {/* Header */}
      <div className="app-fade-up">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          Appointments
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your calendar, booking page, and scheduling rules
        </p>
      </div>

      <div className="border-t border-border" />

      <Tabs defaultValue="calendar" className="w-full app-fade-up app-fade-up-d1">
        <TabsList variant="line" className="w-full mb-6">
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="booking">Booking form</TabsTrigger>
          <TabsTrigger value="business">Working hours</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <CalendarTab config={config} />
        </TabsContent>

        <TabsContent value="general">
          <GeneralSettingsTab config={config} />
        </TabsContent>

        <TabsContent value="booking">
          <BookingSettingsTab config={config} />
        </TabsContent>

        <TabsContent value="business">
          <BusinessLogicTab config={config} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
