import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  getAppointmentProviderSettings,
  updateAppointmentProviderSettings,
  type AppointmentConfig,
  type WorkingHoursDay,
  type BreakConfig,
} from "~/lib/api/appointments";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Plus, Trash2 } from "lucide-react";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

const SLOT_OPTIONS = [15, 30, 45, 60];

function ensureBreaksArray(v: unknown): BreakConfig[] {
  return Array.isArray(v) ? v : [];
}

const DEFAULT_WORKING_HOURS: Record<string, WorkingHoursDay> = {
  mon: { enabled: true, start: "09:00", end: "17:00" },
  tue: { enabled: true, start: "09:00", end: "17:00" },
  wed: { enabled: true, start: "09:00", end: "17:00" },
  thu: { enabled: true, start: "09:00", end: "17:00" },
  fri: { enabled: true, start: "09:00", end: "17:00" },
  sat: { enabled: false, start: "09:00", end: "17:00" },
  sun: { enabled: false, start: "09:00", end: "17:00" },
};

interface BusinessLogicTabProps {
  config: AppointmentConfig;
}

export function BusinessLogicTab({ config }: BusinessLogicTabProps) {
  const queryClient = useQueryClient();
  const { data: providerSettings } = useQuery({
    queryKey: ["appointment-provider-settings"],
    queryFn: getAppointmentProviderSettings,
  });

  const [workingHours, setWorkingHours] = useState<Record<string, WorkingHoursDay>>(
    () => providerSettings?.working_hours ?? config.working_hours ?? DEFAULT_WORKING_HOURS
  );
  const [slotDuration, setSlotDuration] = useState(
    providerSettings?.slot_duration_minutes ?? config.slot_duration_minutes ?? 30
  );
  const [breaks, setBreaks] = useState<BreakConfig[]>(
    () => ensureBreaksArray(providerSettings?.breaks ?? config.breaks)
  );

  useEffect(() => {
    const wh = providerSettings?.working_hours ?? config.working_hours ?? DEFAULT_WORKING_HOURS;
    setWorkingHours(wh);
    setSlotDuration(providerSettings?.slot_duration_minutes ?? config.slot_duration_minutes ?? 30);
    setBreaks(ensureBreaksArray(providerSettings?.breaks ?? config.breaks));
  }, [providerSettings, config]);

  const updateMutation = useMutation({
    mutationFn: updateAppointmentProviderSettings,
    onSuccess: () => {
      toast.success("Business logic saved");
      queryClient.invalidateQueries({ queryKey: ["appointment-config"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-provider-settings"] });
    },
    onError: (error) => {
      toast.error("Failed to save", {
        description: extractErrorMessage(error),
      });
    },
  });

  function handleWorkingHoursChange(
    day: string,
    field: "enabled" | "start" | "end",
    value: boolean | string
  ) {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] ?? { enabled: true, start: "09:00", end: "17:00" }),
        [field]: value,
      },
    }));
  }

  function handleAddBreak() {
    setBreaks((prev) => [
      ...ensureBreaksArray(prev),
      { day: "mon", start: "13:00", end: "14:00" },
    ]);
  }

  function handleBreakChange(index: number, field: keyof BreakConfig, value: string) {
    setBreaks((prev) => {
      const next = [...ensureBreaksArray(prev)];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function handleRemoveBreak(index: number) {
    setBreaks((prev) => ensureBreaksArray(prev).filter((_, i) => i !== index));
  }

  function handleSave() {
    updateMutation.mutate({
      slot_duration_minutes: slotDuration,
      working_hours: workingHours,
      breaks,
    });
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="space-y-4">
        <h3 className="font-medium">Working Plan</h3>
        <p className="text-sm text-muted-foreground">
          Mark the days and hours that you accept appointments. Customers cannot
          book outside these times.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
            <span className="w-28">Day</span>
            <span className="w-16">Enabled</span>
            <span className="w-24">Start</span>
            <span className="w-24">End</span>
          </div>
          {DAYS.map(({ key, label }) => {
            const wh = workingHours[key] ?? {
              enabled: true,
              start: "09:00",
              end: "17:00",
            };
            return (
              <div
                key={key}
                className="flex items-center gap-4 rounded-lg border p-3"
              >
                <span className="w-28 font-medium">{label}</span>
                <Checkbox
                  checked={wh.enabled !== false}
                  onCheckedChange={(v) =>
                    handleWorkingHoursChange(key, "enabled", !!v)
                  }
                />
                <Input
                  type="time"
                  value={wh.start}
                  onChange={(e) =>
                    handleWorkingHoursChange(key, "start", e.target.value)
                  }
                  className="w-24"
                />
                <Input
                  type="time"
                  value={wh.end}
                  onChange={(e) =>
                    handleWorkingHoursChange(key, "end", e.target.value)
                  }
                  className="w-24"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <Label>Slot duration (minutes)</Label>
        <Select
          value={String(slotDuration)}
          onValueChange={(v) => setSlotDuration(Number(v))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SLOT_OPTIONS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m} min
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium">Breaks</h3>
        <p className="text-sm text-muted-foreground">
          Add breaks during each day. These times will be unavailable for
          booking.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={handleAddBreak}>
          <Plus className="h-4 w-4 mr-2" />
          Add Break
        </Button>
        {breaks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
              <span className="w-24">Day</span>
              <span className="w-24">Start</span>
              <span className="w-24">End</span>
              <span className="w-12">Actions</span>
            </div>
            {breaks.map((b, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-lg border p-3"
              >
                <Select
                  value={b.day}
                  onValueChange={(v) => handleBreakChange(i, "day", v)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map(({ key, label }) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="time"
                  value={b.start}
                  onChange={(e) =>
                    handleBreakChange(i, "start", e.target.value)
                  }
                  className="w-24"
                />
                <Input
                  type="time"
                  value={b.end}
                  onChange={(e) => handleBreakChange(i, "end", e.target.value)}
                  className="w-24"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveBreak(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={updateMutation.isPending}>
        {updateMutation.isPending ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
