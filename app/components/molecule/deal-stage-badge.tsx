import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import { DEAL_STAGE_KEYS, type DealStageKey } from "~/lib/api/deals";

/** Dot background color per deal stage. Shared by the deal page and contact deals UI. */
export const STAGE_COLOR: Record<DealStageKey, string> = {
  new: "bg-slate-400",
  in_progress: "bg-sky-500",
  won: "bg-emerald-600",
  lost: "bg-red-500",
};

/** Text color per deal stage. Shared by the deal page and contact deals UI. */
export const STAGE_TEXT: Record<DealStageKey, string> = {
  new: "text-slate-600 dark:text-slate-300",
  in_progress: "text-sky-700 dark:text-sky-300",
  won: "text-emerald-700 dark:text-emerald-300",
  lost: "text-red-700 dark:text-red-300",
};

function asStageKey(stage: string): DealStageKey {
  return DEAL_STAGE_KEYS.includes(stage as DealStageKey)
    ? (stage as DealStageKey)
    : "new";
}

interface DealStageBadgeProps {
  stage: string;
  className?: string;
}

/** Colored dot + localized stage label, matching the deal page. */
export function DealStageBadge({ stage, className }: DealStageBadgeProps) {
  const { t } = useTranslation();
  const key = asStageKey(stage);
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", STAGE_TEXT[key], className)}
    >
      <span
        className={cn("inline-block h-2 w-2 rounded-full", STAGE_COLOR[key])}
      />
      {t(`pipeline.stages.${stage}`, { defaultValue: stage })}
    </span>
  );
}
