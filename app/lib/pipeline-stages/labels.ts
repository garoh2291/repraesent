import type { TFunction } from "i18next";
import type { StageCategory, StageEntity } from "~/lib/api/pipeline-stages";
import { SEEDED_DEAL_STAGES, stageWordGroup } from "./industry-words";

/** "new_lead" -> "New lead" — last-resort label for keys with no translation. */
export function humanizeStageKey(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface StageLabelInput {
  entity: StageEntity;
  key: string;
  label: string | null;
  /** Needed for business-type words; without it the default words are used. */
  category?: StageCategory;
}

/**
 * The label for a stage row: the owner's own name wins, then (deal stages
 * only) the words for the business type, then the built-in translation.
 */
export function resolveStageLabel(
  stage: StageLabelInput,
  t: TFunction,
  industry?: string | null,
): string {
  if (stage.label) return stage.label;
  const word = industryStageWord(stage, t, industry);
  if (word) return word;
  return resolveStageLabelByKey(stage.entity, stage.key, t);
}

/**
 * Business-type word for a never-renamed seeded deal stage, or null. Every
 * condition must hold; anything else keeps today's label.
 */
export function industryStageWord(
  stage: StageLabelInput,
  t: TFunction,
  industry?: string | null,
): string | null {
  if (stage.label || stage.entity !== "deal" || !stage.category) return null;
  const seeded = SEEDED_DEAL_STAGES[stage.key];
  if (!seeded || seeded !== stage.category) return null;
  const group = stageWordGroup(industry);
  if (!group) return null;
  const i18nKey = `pipeline.stagesByType.${group}.${stage.key}`;
  const word = t(i18nKey, { defaultValue: "" });
  return word && word !== i18nKey ? word : null;
}

export function resolveStageLabelByKey(
  entity: StageEntity,
  key: string,
  t: TFunction,
): string {
  const i18nKey =
    entity === "lead" ? `leads.statuses.${key}` : `pipeline.stages.${key}`;
  return t(i18nKey, { defaultValue: humanizeStageKey(key) });
}
