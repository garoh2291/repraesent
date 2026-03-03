import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  LEAD_STATUSES,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from "~/lib/leads/constants";
import { cn } from "~/lib/utils";

interface LeadStatusSelectProps {
  value: LeadStatus | string;
  onValueChange: (value: LeadStatus) => void;
  disabled?: boolean;
  className?: string;
}

const STATUS_BORDER_CLASSES: Record<LeadStatus, string> = {
  new_lead: "border-l-blue-500",
  pending: "border-l-amber-500",
  in_progress: "border-l-violet-500",
  rejected: "border-l-red-500",
  on_hold: "border-l-orange-500",
  stale: "border-l-gray-500",
  success: "border-l-emerald-500",
  hidden: "border-l-muted",
};

export function LeadStatusSelect({
  value,
  onValueChange,
  disabled,
  className,
}: LeadStatusSelectProps) {
  const currentStatus = value as LeadStatus;
  const borderClass =
    STATUS_BORDER_CLASSES[currentStatus] ?? "border-l-transparent";

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as LeadStatus)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "border-l-4 border-l-transparent ",
          borderClass,
          className
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LEAD_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <span className="flex items-center gap-1.5">
              <span
                className={cn("w-2 h-2 rounded-full", LEAD_STATUS_COLORS[s])}
              />
              {LEAD_STATUS_LABELS[s]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
