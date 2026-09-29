import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import { resolveStageLabel, type StageLabelInput } from "./labels";

/**
 * `resolveStageLabel` with the workspace's business type filled in, so deal
 * stages the owner never renamed read in their trade's words. Brand
 * workspaces keep the default words.
 */
export function useStageLabel(): (stage: StageLabelInput) => string {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const industry =
    currentWorkspace?.type === "doorboost_brand" ? null : (currentWorkspace?.industry ?? null);
  return useCallback((stage: StageLabelInput) => resolveStageLabel(stage, t, industry), [t, industry]);
}
