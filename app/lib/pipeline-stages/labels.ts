import type { TFunction } from "i18next";
import type { StageEntity } from "~/lib/api/pipeline-stages";

/** "new_lead" -> "New lead" — last-resort label for keys with no translation. */
export function humanizeStageKey(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Minimal stage shape the label helpers need. */
export interface StageLabelInput {
  entity: StageEntity;
  key: string;
  label: string | null;
}

/**
 * Display name of a stage: the admin-chosen label verbatim in every locale,
 * else the built-in translation for legacy keys (so untouched workspaces keep
 * their four localized label sets), else the humanized key.
 */
export function resolveStageLabel(stage: StageLabelInput, t: TFunction): string {
  if (stage.label) return stage.label;
  return resolveStageLabelByKey(stage.entity, stage.key, t);
}

/**
 * Same fallback chain for a raw key when no stage row is at hand (history
 * entries, cross-workspace brand views, rows whose stage was deleted).
 */
export function resolveStageLabelByKey(
  entity: StageEntity,
  key: string,
  t: TFunction,
): string {
  const i18nKey =
    entity === "lead" ? `leads.statuses.${key}` : `pipeline.stages.${key}`;
  return t(i18nKey, { defaultValue: humanizeStageKey(key) });
}
