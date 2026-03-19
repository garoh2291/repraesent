import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "~/components/ui/switch";
import {
  updateAppointmentConfigById,
  type AppointmentConfig,
  type BookingFieldConfig,
} from "~/lib/api/appointments";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { cn } from "~/lib/utils";

const BOOKING_FIELDS: { key: string; label: string }[] = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone Number" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "zip_code", label: "Zip Code" },
  { key: "notes", label: "Notes" },
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
      toast.success("Booking settings saved");
      queryClient.invalidateQueries({ queryKey: ["appointment-configs"] });
    },
    onError: (error) => {
      toast.error("Failed to save", { description: extractErrorMessage(error) });
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
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_100px_100px] gap-4 px-5 py-3 bg-muted/40 border-b border-border">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Field</span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-center">Display</span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-center">Required</span>
        </div>
        <div className="divide-y divide-border">
          {BOOKING_FIELDS.map(({ key, label }) => {
            const field = fields[key] ?? { display: false, require: false };
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
        {updateMutation.isPending ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
