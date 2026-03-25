import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Play, Loader2, CheckCircle2, XCircle, CalendarCog } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { type AppointmentConfig } from "~/lib/api/appointments";
import { useAppointmentConfigs } from "~/lib/hooks/useAppointmentConfigs";
import { CalendarTab } from "~/components/appointments/CalendarTab";
import { GeneralSettingsTab } from "~/components/appointments/GeneralSettingsTab";
import { BookingSettingsTab } from "~/components/appointments/BookingSettingsTab";
import { BusinessLogicTab } from "~/components/appointments/BusinessLogicTab";
import { ServicesTab } from "~/components/appointments/ServicesTab";
import { ProviderTab } from "~/components/appointments/ProviderTab";
import { CustomerEmailTab } from "~/components/appointments/CustomerEmailTab";
import { useCalDavConfig } from "~/components/appointments/CalDavInstructionsModal";
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

function DevEmailProcessor() {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [result, setResult] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleTrigger = async () => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
    const cronKey = import.meta.env.VITE_CRON_API_KEY || "";
    setState("loading");
    setResult(null);
    try {
      const res = await axios.post(
        `${apiUrl}/internal/process-email-queue`,
        {},
        { headers: { "x-cron-api-key": cronKey } },
      );
      setResult(JSON.stringify(res.data));
      setState("ok");
    } catch (err: unknown) {
      setResult(err instanceof Error ? err.message : "Request failed");
      setState("error");
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 z-50 h-10 w-10 flex items-center justify-center rounded-full bg-amber-100 border border-amber-300 text-amber-700 shadow-lg hover:bg-amber-200 transition-colors"
        title="Dev: Email Queue Processor"
      >
        <Play className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-xl border border-dashed border-amber-300 bg-amber-50/95 backdrop-blur-sm p-3.5 space-y-2.5 shadow-xl">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
          <Play className="h-3 w-3" /> Dev: Email Processor
        </p>
        <button
          onClick={() => setExpanded(false)}
          className="text-amber-400 hover:text-amber-600 text-xs leading-none"
        >
          &times;
        </button>
      </div>
      <p className="text-[10px] text-amber-600 leading-relaxed">
        Simulates the cron. Set{" "}
        <code className="font-mono bg-amber-100 px-1 rounded">VITE_CRON_API_KEY</code>{" "}
        in <code className="font-mono bg-amber-100 px-1 rounded">.env</code>.
      </p>
      <button
        onClick={handleTrigger}
        disabled={state === "loading"}
        className="h-7 w-full flex items-center justify-center gap-1.5 text-[11px] font-medium rounded-md border border-amber-400 text-amber-800 bg-white hover:bg-amber-100 disabled:opacity-50 transition-colors"
      >
        {state === "loading" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : state === "ok" ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        ) : state === "error" ? (
          <XCircle className="h-3 w-3 text-red-500" />
        ) : (
          <Play className="h-3 w-3" />
        )}
        Run now
      </button>
      {result && (
        <p
          className={`text-[10px] font-mono break-all leading-relaxed ${
            state === "ok" ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {result}
        </p>
      )}
    </div>
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
  const { currentWorkspace } = useAuthContext();
  const hasEmailConfig =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "email-config" || s.service_slug === "email-config",
    ) ?? false;
  const { data: caldavConfig } = useCalDavConfig();
  const navigate = useNavigate();
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 app-fade-in relative">
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

        {caldavConfig && (
          <button
            type="button"
            onClick={() => navigate("/instructions")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            <CalendarCog className="h-3.5 w-3.5" />
            {t("appointments.caldav.setupButton")}
          </button>
        )}
      </div>

      <div className="border-t border-border" />

      <Tabs defaultValue="calendar" className="w-full app-fade-up app-fade-up-d1">
        <div className="overflow-x-auto scrollbar-hide -mx-4 sm:mx-0 px-4 sm:px-0">
          <TabsList variant="line" className="w-full mb-4 sm:mb-6 min-w-max sm:min-w-0">
            <TabsTrigger value="calendar">{t("appointments.tabCalendar")}</TabsTrigger>
            <TabsTrigger value="services">{t("appointments.tabServices")}</TabsTrigger>
            <TabsTrigger value="provider">{t("appointments.tabProvider")}</TabsTrigger>
            <TabsTrigger value="general">{t("appointments.tabGeneral")}</TabsTrigger>
            <TabsTrigger value="booking">{t("appointments.tabBooking")}</TabsTrigger>
            <TabsTrigger value="business">{t("appointments.tabBusinessHours")}</TabsTrigger>
            {hasEmailConfig && (
              <TabsTrigger value="customer-email">{t("appointments.tabCustomerEmail", "Confirm Email")}</TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="calendar" className="space-y-4">
          <CalendarTab config={config} />
        </TabsContent>

        <TabsContent value="services">
          <ServicesTab config={config} />
        </TabsContent>

        <TabsContent value="provider">
          <ProviderTab config={config} />
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

        {hasEmailConfig && (
          <TabsContent value="customer-email">
            <CustomerEmailTab config={config} />
          </TabsContent>
        )}
      </Tabs>

      {import.meta.env.DEV && <DevEmailProcessor />}

    </div>
  );
}
