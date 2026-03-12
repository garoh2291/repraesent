import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuthContext } from "~/providers/auth-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { getAppointmentConfig, type AppointmentConfig } from "~/lib/api/appointments";
import { useAppointmentConfig } from "~/lib/hooks/useAppointmentConfig";
import { CalendarTab } from "~/components/appointments/CalendarTab";
import { GeneralSettingsTab } from "~/components/appointments/GeneralSettingsTab";
import { BookingSettingsTab } from "~/components/appointments/BookingSettingsTab";
import { BusinessLogicTab } from "~/components/appointments/BusinessLogicTab";
import { Calendar, Settings, BookOpen, Briefcase } from "lucide-react";

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
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Calendar className="h-6 w-6" />
        Appointments
      </h1>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            General Settings
          </TabsTrigger>
          <TabsTrigger value="booking" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Booking Settings
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Business Logic
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <p className="text-muted-foreground">
            Your appointments from Baikal CalDAV. Switch between day, week, and
            month views. Times shown in your configured timezone (
            {config.timezone ?? "UTC"}).
          </p>
          <CalendarTab config={config} />
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <GeneralSettingsTab config={config} />
        </TabsContent>

        <TabsContent value="booking" className="space-y-4">
          <BookingSettingsTab config={config} />
        </TabsContent>

        <TabsContent value="business" className="space-y-4">
          <BusinessLogicTab config={config} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
