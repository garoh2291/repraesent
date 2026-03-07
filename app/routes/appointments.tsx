import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthContext } from "~/providers/auth-provider";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  getAppointmentConfig,
  getAppointments,
  getAppointmentProviderSettings,
  type AppointmentConfig,
} from "~/lib/api/appointments";
import { useAppointmentConfig } from "~/lib/hooks/useAppointmentConfig";
import { buildPublicBookingUrl } from "~/lib/config";
import { Calendar, Copy } from "lucide-react";

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
    currentWorkspace?.products?.some(
      (p) => p.product_slug === "appointments"
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
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ["appointments-list"],
    queryFn: getAppointments,
  });

  const { data: providerSettings } = useQuery({
    queryKey: ["appointment-provider-settings"],
    queryFn: getAppointmentProviderSettings,
  });

  const publicBookingUrl = buildPublicBookingUrl(config.id);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicBookingUrl);
    toast.success("Booking link copied to clipboard");
  };

  const iframeCode = `<iframe src="${publicBookingUrl}" width="100%" height="600" frameborder="0"></iframe>`;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Calendar className="h-6 w-6" />
        Appointments
      </h1>

      <Tabs defaultValue="appointments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="link">Public Link</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="space-y-4">
          <p className="text-muted-foreground">
            Your upcoming and past appointments from Baikal CalDAV.
          </p>
          {appointmentsLoading ? (
            <div className="animate-pulse h-48 bg-muted rounded" />
          ) : Array.isArray(appointments) && appointments.length > 0 ? (
            <div className="border rounded-md divide-y">
              {appointments.map((apt: unknown, i: number) => {
                const a = apt as Record<string, unknown>;
                return (
                <div key={i} className="p-4 flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      {String(a.start ?? "—")} – {String(a.end ?? "—")}
                    </div>
                    {(a.summary ?? a.notes) != null && (
                      <div className="text-sm text-muted-foreground">
                        {String(a.summary ?? a.notes ?? "")}
                      </div>
                    )}
                  </div>
                </div>
              );})}
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              No appointments yet. Share your booking link to get started.
            </p>
          )}
        </TabsContent>

        <TabsContent value="link" className="space-y-4">
          <p className="text-muted-foreground">
            Share this link so clients can book appointments. You can also embed
            it on your website.
          </p>
          <div className="space-y-2">
            <Label>Booking URL</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={publicBookingUrl}
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={handleCopyLink}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={publicBookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open
                </a>
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Embed code (iframe)</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={iframeCode}
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(iframeCode);
                  toast.success("Embed code copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <p className="text-muted-foreground">
            Slot duration and working hours. Default: 30 min slots, Mon–Fri
            09:00–17:00.
          </p>
          {providerSettings ? (
            <pre className="p-4 bg-muted rounded-md text-xs overflow-auto max-h-64">
              {JSON.stringify(providerSettings, null, 2)}
            </pre>
          ) : (
            <p className="text-muted-foreground">
              Using default settings. Contact support to customize.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
