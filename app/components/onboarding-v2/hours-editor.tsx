"use client";

import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";
import { controlCls, inkSwitchCls } from "./primitives";

export type Hours = Record<string, Array<{ open: string; close: string }>>;

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DEFAULT_RANGE = { open: "10:00", close: "18:00" };

const timeCls =
  cn(controlCls, "w-[6.5rem] px-2.5 tabular-nums");

/**
 * Opening hours, one row per weekday: open/closed switch, up to two ranges
 * (lunch breaks are common in showrooms), "copy Monday to weekdays".
 */
export function HoursEditor({ value, onChange }: { value: Hours | undefined; onChange: (v: Hours) => void }) {
  const { t } = useTranslation();
  const hours: Hours = value ?? {};
  const set = (day: string, ranges: Array<{ open: string; close: string }>) => onChange({ ...hours, [day]: ranges });

  const copyWeekdays = () => {
    const mon = hours.mon ?? [];
    onChange({ ...hours, tue: mon, wed: mon, thu: mon, fri: mon });
  };

  return (
    <div className="space-y-1">
      {DAYS.map((day) => {
        const ranges = hours[day] ?? [];
        const isOpen = ranges.length > 0;
        const invalid = ranges.some((r) => r.open >= r.close);
        return (
          <div key={day} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-1 py-1.5">
            <label className="flex w-28 items-center gap-2.5 text-sm font-medium">
              <Switch
                className={inkSwitchCls}
                checked={isOpen}
                onCheckedChange={(v) => set(day, v ? [DEFAULT_RANGE] : [])}
                aria-label={t(`onb.days.${day}`)}
              />
              {t(`onb.daysShort.${day}`)}
            </label>
            {isOpen ? (
              <div className="flex flex-wrap items-center gap-2">
                {ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={r.open}
                      aria-label={t("onb.hours.from")}
                      onChange={(e) => set(day, ranges.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))}
                      className={cn(timeCls, invalid && "border-destructive")}
                    />
                    <span className="text-muted-foreground">–</span>
                    <input
                      type="time"
                      value={r.close}
                      aria-label={t("onb.hours.to")}
                      onChange={(e) => set(day, ranges.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))}
                      className={cn(timeCls, invalid && "border-destructive")}
                    />
                    {i > 0 ? (
                      <button
                        type="button"
                        onClick={() => set(day, ranges.filter((_, j) => j !== i))}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={t("onb.hours.removeRange")}
                      >
                        <X className="size-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
                {ranges.length < 2 ? (
                  <button
                    type="button"
                    onClick={() => set(day, [...ranges, { open: "14:00", close: "18:00" }])}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="size-3.5" /> {t("onb.hours.addRange")}
                  </button>
                ) : null}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">{t("onb.hours.closed")}</span>
            )}
          </div>
        );
      })}
      {(hours.mon?.length ?? 0) > 0 ? (
        <button
          type="button"
          onClick={copyWeekdays}
          className="mt-1 text-sm font-medium text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground"
        >
          {t("onb.hours.copyWeekdays")}
        </button>
      ) : null}
    </div>
  );
}
