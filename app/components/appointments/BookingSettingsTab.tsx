import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Switch } from "~/components/ui/switch";
import {
  updateAppointmentConfigById,
  type AppointmentConfig,
  type BookingFieldConfig,
} from "~/lib/api/appointments";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { cn } from "~/lib/utils";

const BOOKING_FIELD_KEYS: string[] = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "address",
  "city",
  "zip_code",
  "notes",
];

const DEFAULT_BOOKING_FIELDS: Record<string, BookingFieldConfig> = {
  first_name: { display: true, require: true },
  last_name: { display: true, require: true },
  email: { display: true, require: true },
  phone: { display: true, require: false },
  address: { display: false, require: false },
  city: { display: false, require: false },
  zip_code: { display: false, require: false },
  notes: { display: true, require: false },
};

interface BookingSettingsTabProps {
  config: AppointmentConfig;
}

export function BookingSettingsTab({ config }: BookingSettingsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<Record<string, BookingFieldConfig>>(
    () => config.booking_fields ?? DEFAULT_BOOKING_FIELDS
  );

  useEffect(() => {
    setFields(config.booking_fields ?? DEFAULT_BOOKING_FIELDS);
  }, [config.booking_fields]);

  const updateMutation = useMutation({
    mutationFn: (dto: Parameters<typeof updateAppointmentConfigById>[1]) =>
      updateAppointmentConfigById(config.id, dto),
    onSuccess: () => {
      toast.success(t("appointments.bookingForm.saved"));
      queryClient.invalidateQueries({ queryKey: ["appointment-configs"] });
    },
    onError: (error) => {
      toast.error(t("common.failedToSave"), { description: extractErrorMessage(error) });
    },
  });

  function handleFieldChange(key: string, prop: "display" | "require", value: boolean) {
    setFields((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? { display: false, require: false }),
        [prop]: value,
      },
    }));
  }

  function handleSave() {
    updateMutation.mutate({ booking_fields: fields });
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="rounded-2xl border border-border bg-card overflow-x-auto">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_100px_100px] gap-4 px-5 py-3 bg-muted/40 border-b border-border min-w-[320px]">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t("appointments.bookingForm.fieldCol")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-center">{t("appointments.bookingForm.displayCol")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-center">{t("appointments.bookingForm.requiredCol")}</span>
        </div>
        <div className="divide-y divide-border min-w-[320px]">
          {BOOKING_FIELD_KEYS.map((key) => {
            const field = fields[key] ?? { display: false, require: false };
            const label = t(`appointments.bookingForm.fields.${key}`, { defaultValue: key });
            return (
              <div
                key={key}
                className={cn(
                  "grid grid-cols-[1fr_100px_100px] gap-4 px-5 py-3.5 items-center transition-colors",
                  !field.display && "opacity-50"
                )}
              >
                <span className="text-sm font-medium text-foreground">
                  {label}
                  {field.require && (
                    <span className="ml-1 text-xs text-muted-foreground font-normal">*</span>
                  )}
                </span>
                <div className="flex justify-center">
                  <Switch
                    checked={field.display}
                    onCheckedChange={(v) => handleFieldChange(key, "display", v)}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={field.require}
                    onCheckedChange={(v) => handleFieldChange(key, "require", v)}
                    disabled={!field.display}
                  />
                </div>
              </div>
            );
          })}
        </div>
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
