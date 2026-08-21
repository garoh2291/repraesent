import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import { useDealStages } from "~/lib/hooks/usePipelineStages";
import {
  resolveStageColors,
  resolveStageColorsByKey,
} from "~/lib/pipeline-stages/colors";
import {
  resolveStageLabel,
  resolveStageLabelByKey,
} from "~/lib/pipeline-stages/labels";

interface DealStageBadgeProps {
  stage: string;
  className?: string;
}

/** Colored dot + stage label, matching the deal page. Unknown keys (a stage
 * that was deleted) render humanized with neutral colors instead of being
 * silently coerced to another stage. */
export function DealStageBadge({ stage, className }: DealStageBadgeProps) {
  const { t } = useTranslation();
  const { byKey } = useDealStages();
  const row = byKey.get(stage);
  const facets = row
    ? resolveStageColors(row)
    : resolveStageColorsByKey("deal", stage);
  const label = row
    ? resolveStageLabel(row, t)
    : resolveStageLabelByKey("deal", stage, t);

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", facets.text, className)}
    >
      <span className={cn("inline-block h-2 w-2 rounded-full", facets.dot)} />
      {label}
    </span>
  );
}
