import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";

/** Impact as five short bars — readable at a glance, no number to interpret. */
export function Impact({ value, className }: { value: number; className?: string }) {
  const { t } = useTranslation();
  const labels = [
    t("aiVisibility.impact.1", "Very low impact"),
    t("aiVisibility.impact.2", "Low impact"),
    t("aiVisibility.impact.3", "Medium impact"),
    t("aiVisibility.impact.4", "High impact"),
    t("aiVisibility.impact.5", "Very high impact"),
  ];
  const v = Math.max(1, Math.min(5, Math.round(value)));
  return (
    <span className={cn("inline-flex items-end gap-[3px]", className)} title={labels[v - 1]} aria-label={labels[v - 1]} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("w-[4px] rounded-[1px]", i <= v ? (v >= 4 ? "bg-foreground" : "bg-foreground/60") : "bg-foreground/10")} style={{ height: 4 + i * 2.5 }} />
      ))}
    </span>
  );
}
