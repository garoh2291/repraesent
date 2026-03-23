import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  getProviderSettingsByConfigId,
  updateProviderSettingsByConfigId,
  type AppointmentConfig,
  type WorkingHoursDay,
  type BreakConfig,
} from "~/lib/api/appointments";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "~/lib/utils";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

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

function SectionPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="space-y-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function BusinessLogicTab({ config }: BusinessLogicTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: providerSettings } = useQuery({
    queryKey: ["appointment-provider-settings", config.id],
    queryFn: () => getProviderSettingsByConfigId(config.id),
  });

  const [workingHours, setWorkingHours] = useState<Record<string, WorkingHoursDay>>(
    () => providerSettings?.working_hours ?? config.working_hours ?? DEFAULT_WORKING_HOURS
  );
  const [breaks, setBreaks] = useState<BreakConfig[]>(
    () => ensureBreaksArray(providerSettings?.breaks ?? config.breaks)
  );

  useEffect(() => {
    const wh = providerSettings?.working_hours ?? config.working_hours ?? DEFAULT_WORKING_HOURS;
    setWorkingHours(wh);
    setBreaks(ensureBreaksArray(providerSettings?.breaks ?? config.breaks));
  }, [providerSettings, config]);

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateProviderSettingsByConfigId>[1]) =>
      updateProviderSettingsByConfigId(config.id, data),
    onSuccess: () => {
      toast.success(t("appointments.businessLogic.saved"));
      queryClient.invalidateQueries({ queryKey: ["appointment-configs"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-provider-settings", config.id] });
    },
    onError: (error) => {
      toast.error(t("common.failedToSave"), { description: extractErrorMessage(error) });
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
      working_hours: workingHours,
      breaks,
    });
  }

  const columnHeaders = [
    t("appointments.businessLogic.day"),
    t("appointments.businessLogic.on"),
    t("appointments.businessLogic.start"),
    t("appointments.businessLogic.end"),
  ];

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Working hours */}
      <SectionPanel
        title={t("appointments.businessLogic.workingPlan")}
        description={t("appointments.businessLogic.workingPlanDesc")}
      >
        {/* Column headers */}
        <div className="overflow-x-auto -mx-1">
        <div className="grid grid-cols-[120px_48px_1fr_1fr] gap-4 px-1 min-w-[360px]">
          {columnHeaders.map((h) => (
            <span key={h} className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {h}
            </span>
          ))}
        </div>
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border min-w-[360px]">
          {DAY_KEYS.map((key) => {
            const label = t(`appointments.businessLogic.days.${key}`);
            const wh = workingHours[key] ?? { enabled: true, start: "09:00", end: "17:00" };
            const isEnabled = wh.enabled !== false;
            return (
              <div
                key={key}
                className={cn(
                  "grid grid-cols-[120px_48px_1fr_1fr] gap-4 px-4 py-3 items-center transition-colors",
                  !isEnabled && "opacity-45"
                )}
              >
                <span className="text-sm font-medium text-foreground">{label}</span>
                <Checkbox
                  checked={isEnabled}
                  onCheckedChange={(v) => handleWorkingHoursChange(key, "enabled", !!v)}
                />
                <Input
                  type="time"
                  value={wh.start}
                  onChange={(e) => handleWorkingHoursChange(key, "start", e.target.value)}
                  disabled={!isEnabled}
                  className="h-9 text-sm"
                />
                <Input
                  type="time"
                  value={wh.end}
                  onChange={(e) => handleWorkingHoursChange(key, "end", e.target.value)}
                  disabled={!isEnabled}
                  className="h-9 text-sm"
                />
              </div>
            );
          })}
        </div>
        </div>
      </SectionPanel>

      {/* Breaks */}
      <SectionPanel
        title={t("appointments.businessLogic.breaks")}
        description={t("appointments.businessLogic.breaksDesc")}
      >
        <button
          type="button"
          onClick={handleAddBreak}
          className="inline-flex items-center gap-2 h-9 rounded-lg border border-border bg-muted/40 px-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("appointments.businessLogic.addBreak")}
        </button>

        {breaks.length > 0 && (
          <div className="overflow-x-auto">
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border min-w-[360px]">
            {/* Header */}
            <div className="grid grid-cols-[120px_1fr_1fr_40px] gap-4 px-4 py-2 bg-muted/40">
              {[
                t("appointments.businessLogic.day"),
                t("appointments.businessLogic.start"),
                t("appointments.businessLogic.end"),
                "",
              ].map((h, i) => (
                <span key={i} className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {h}
                </span>
              ))}
            </div>
            {breaks.map((b, i) => (
              <div key={i} className="grid grid-cols-[120px_1fr_1fr_40px] gap-4 px-4 py-2.5 items-center">
                <Select
                  value={b.day}
                  onValueChange={(v) => handleBreakChange(i, "day", v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {t(`appointments.businessLogic.days.${key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="time"
                  value={b.start}
                  onChange={(e) => handleBreakChange(i, "start", e.target.value)}
                  className="h-9 text-sm"
                />
                <Input
                  type="time"
                  value={b.end}
                  onChange={(e) => handleBreakChange(i, "end", e.target.value)}
                  className="h-9 text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveBreak(i)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
                  aria-label={t("appointments.businessLogic.removeBreak")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          </div>
        )}
      </SectionPanel>

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
