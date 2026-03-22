import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { type AppointmentConfig } from "~/lib/api/appointments";
import { useAppointmentConfigs } from "~/lib/hooks/useAppointmentConfigs";
import { CalendarTab } from "~/components/appointments/CalendarTab";
import { GeneralSettingsTab } from "~/components/appointments/GeneralSettingsTab";
import { BookingSettingsTab } from "~/components/appointments/BookingSettingsTab";
import { BusinessLogicTab } from "~/components/appointments/BusinessLogicTab";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

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

  const { data: configs, isLoading: configsLoading } = useAppointmentConfigs(
    hasAccess && !!currentWorkspace?.id
  );

  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);

  useEffect(() => {
    if (configs && configs.length > 0 && !selectedConfigId) {
      setSelectedConfigId(configs[0].id);
    }
  }, [configs, selectedConfigId]);

  const shouldRedirect =
    !hasAccess || (!configsLoading && (!configs || configs.length === 0));

  useEffect(() => {
    if (shouldRedirect) {
      navigate("/", { replace: true });
    }
  }, [shouldRedirect, navigate]);

  if (shouldRedirect) {
    return null;
  }

  if (configsLoading || !configs) {
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

  const selectedConfig =
    configs.find((c) => c.id === selectedConfigId) ?? configs[0];

  if (!selectedConfig) {
    return null;
  }

  return (
    <AppointmentsDashboard
      key={selectedConfig.id}
      config={selectedConfig}
      configs={configs}
      selectedConfigId={selectedConfig.id}
      onConfigChange={setSelectedConfigId}
    />
  );
}

function AppointmentsDashboard({
  config,
  configs,
  selectedConfigId,
  onConfigChange,
}: {
  config: AppointmentConfig;
  configs: AppointmentConfig[];
  selectedConfigId: string;
  onConfigChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 app-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between app-fade-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
            {t("appointments.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("appointments.manageHint")}
          </p>
        </div>

        {configs.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium shrink-0">
              {t("appointments.configLabel")}
            </span>
            <Select value={selectedConfigId} onValueChange={onConfigChange}>
              <SelectTrigger className="h-9 text-sm w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {configs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name || c.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      <Tabs defaultValue="calendar" className="w-full app-fade-up app-fade-up-d1">
        <div className="overflow-x-auto scrollbar-hide -mx-4 sm:mx-0 px-4 sm:px-0">
          <TabsList variant="line" className="w-full mb-4 sm:mb-6 min-w-max sm:min-w-0">
            <TabsTrigger value="calendar">{t("appointments.tabCalendar")}</TabsTrigger>
            <TabsTrigger value="general">{t("appointments.tabGeneral")}</TabsTrigger>
            <TabsTrigger value="booking">{t("appointments.tabBooking")}</TabsTrigger>
            <TabsTrigger value="business">{t("appointments.tabBusinessHours")}</TabsTrigger>
          </TabsList>
        </div>

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
