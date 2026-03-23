import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  updateAppointmentConfigById,
  type AppointmentConfig,
  type AppointmentService,
} from "~/lib/api/appointments";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Plus, Trash2 } from "lucide-react";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface ServicesTabProps {
  config: AppointmentConfig;
}

export function ServicesTab({ config }: ServicesTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [services, setServices] = useState<AppointmentService[]>(() => {
    if (config.services && config.services.length > 0) return config.services;
    return [{ id: generateId(), name: "Book an appointment", duration_minutes: 30, description: "" }];
  });

  useEffect(() => {
    if (config.services && config.services.length > 0) {
      setServices(config.services);
    }
  }, [config.services]);

  const updateMutation = useMutation({
    mutationFn: (svcs: AppointmentService[]) =>
      updateAppointmentConfigById(config.id, { services: svcs }),
    onSuccess: () => {
      toast.success(t("appointments.services.saved"));
      queryClient.invalidateQueries({ queryKey: ["appointment-configs"] });
    },
    onError: (error) => {
      toast.error(t("common.failedToSave"), { description: extractErrorMessage(error) });
    },
  });

  function handleAdd() {
    setServices((prev) => [
      ...prev,
      { id: generateId(), name: "", duration_minutes: 30, description: "" },
    ]);
  }

  function handleChange(
    index: number,
    field: keyof AppointmentService,
    value: string | number
  ) {
    setServices((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function handleRemove(index: number) {
    if (services.length <= 1) return;
    setServices((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    updateMutation.mutate(services);
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("appointments.services.title")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("appointments.services.description")}
          </p>
        </div>

        <div className="space-y-3">
          {services.map((service, i) => (
            <div
              key={service.id}
              className="rounded-xl border border-border bg-background p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    {t("appointments.services.name")}
                  </label>
                  <Input
                    value={service.name}
                    onChange={(e) => handleChange(i, "name", e.target.value)}
                    placeholder={t("appointments.services.namePlaceholder")}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="w-36 shrink-0">
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    {t("appointments.services.duration")}
                  </label>
                  <Select
                    value={String(service.duration_minutes)}
                    onValueChange={(v) => handleChange(i, "duration_minutes", Number(v))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {t("appointments.businessLogic.minutesSuffix", { count: m })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  disabled={services.length <= 1}
                  className="mt-5 h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors disabled:opacity-25 disabled:pointer-events-none"
                  title={t("appointments.services.remove")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  {t("appointments.services.descriptionLabel")}{" "}
                  <span className="normal-case font-normal">
                    ({t("common.optional")})
                  </span>
                </label>
                <Textarea
                  value={service.description ?? ""}
                  onChange={(e) => handleChange(i, "description", e.target.value)}
                  placeholder={t("appointments.services.descriptionPlaceholder")}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-2 h-9 rounded-lg border border-border bg-muted/40 px-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("appointments.services.addService")}
        </button>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={updateMutation.isPending}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground text-background text-sm font-medium px-6 hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {updateMutation.isPending ? t("common.saving") : t("common.saveChanges")}
      </button>
    </div>
  );
}
