import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useLeadStages } from "~/lib/hooks/usePipelineStages";
import {
  resolveStageColors,
  resolveStageColorsByKey,
} from "~/lib/pipeline-stages/colors";
import { resolveStageLabel } from "~/lib/pipeline-stages/labels";
import { cn } from "~/lib/utils";

interface LeadStatusSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function LeadStatusSelect({
  value,
  onValueChange,
  disabled,
  className,
}: LeadStatusSelectProps) {
  const { t } = useTranslation();
  const { visible, byKey } = useLeadStages();
  const current = byKey.get(value);
  const borderClass = current
    ? resolveStageColors(current).borderL
    : (resolveStageColorsByKey("lead", value).borderL ?? "border-l-transparent");

  // A record can sit in a stage that was since hidden — keep that stage in
  // the list so the control never shows a blank value.
  const options =
    current && current.is_hidden ? [...visible, current] : visible;

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        className={cn("border-l-4 border-l-transparent ", borderClass, className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((stage) => (
          <SelectItem key={stage.id} value={stage.key}>
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  resolveStageColors(stage).dot,
                )}
              />
              {resolveStageLabel(stage, t)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
