import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import {
  updateAppointmentConfig,
  type AppointmentConfig,
  type BookingFieldConfig,
} from "~/lib/api/appointments";
import { extractErrorMessage } from "~/lib/api/axios-instance";

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
    mutationFn: updateAppointmentConfig,
    onSuccess: () => {
      toast.success("Booking settings saved");
      queryClient.invalidateQueries({ queryKey: ["appointment-config"] });
    },
    onError: (error) => {
      toast.error("Failed to save", {
        description: extractErrorMessage(error),
      });
    },
  });

  function handleFieldChange(
    key: string,
    prop: "display" | "require",
    value: boolean
  ) {
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
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Configure which fields appear on the booking form and which are
        required.
      </p>
      <div className="space-y-4">
        <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
          <span className="w-48">Field</span>
          <span className="w-24">Display</span>
          <span className="w-24">Require</span>
        </div>
        {BOOKING_FIELDS.map(({ key, label }) => {
          const field = fields[key] ?? { display: false, require: false };
          return (
            <div
              key={key}
              className="flex items-center gap-4 rounded-lg border p-4"
            >
              <Label className="w-48 font-normal">
                {label}
                {field.require && " *"}
              </Label>
              <Switch
                checked={field.display}
                onCheckedChange={(v) =>
                  handleFieldChange(key, "display", v)
                }
              />
              <Switch
                checked={field.require}
                onCheckedChange={(v) =>
                  handleFieldChange(key, "require", v)
                }
                disabled={!field.display}
              />
            </div>
          );
        })}
      </div>
      <Button onClick={handleSave} disabled={updateMutation.isPending}>
        {updateMutation.isPending ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
