import type { Condition, ConditionGroup } from "~/lib/api/workflows";

/**
 * Which pipeline a deals trigger is pinned to.
 *
 * A deal always belongs to exactly one pipeline, and most people want one
 * automation per board — "when a deal is won in Sales" and not in Partners.
 * The mechanism for that has existed all along as an ordinary trigger
 * condition on `pipeline_id`; what was missing was any sign of it. You had to
 * know to open "Only if", find Pipeline among thirty fields, and pick `is`.
 *
 * So this reads and writes that same condition, and the builder puts a real
 * Pipeline control on the trigger instead. Nothing new is stored, and a filter
 * written by hand before this existed opens as the selector shows it.
 *
 * The path is `pipeline_id` because that is the deals column the event carries;
 * see the deals field catalog, where the enum's options are the workspace's
 * pipelines.
 */
export const PIPELINE_PATH = "pipeline_id";

/** `all` is not a pipeline id — it is the absence of the condition. */
export const ALL_PIPELINES = "all";

/**
 * What the selector should show.
 *
 *  - a pipeline id  — exactly one top-level `pipeline_id is <id>`
 *  - `all`          — no pipeline condition at all
 *  - `custom`       — something the selector must not touch: several pipeline
 *                     conditions, or one using `is any of` / `is not`. Those
 *                     say things a single-choice control cannot, and quietly
 *                     rewriting them would throw away what somebody meant.
 */
export function pipelineScopeOf(
  group: ConditionGroup | undefined,
): string | "custom" {
  const matches = (group?.conditions ?? []).filter(
    (c) => c.path === PIPELINE_PATH,
  );
  if (matches.length === 0) return ALL_PIPELINES;
  if (matches.length > 1) return "custom";

  const [only] = matches;
  return only.operator === "eq" && typeof only.value === "string"
    ? only.value
    : "custom";
}

/**
 * Pin the group to one pipeline, or unpin it.
 *
 * Replaces the existing `pipeline_id` condition in place rather than appending,
 * so switching pipelines twice does not leave two contradictory rules behind —
 * and keeps its position, so the row does not jump around underneath the
 * person who set it.
 */
export function withPipelineScope(
  group: ConditionGroup | undefined,
  pipelineId: string,
): ConditionGroup {
  const base: ConditionGroup = group ?? { match: "all", conditions: [] };
  const without = base.conditions.filter((c) => c.path !== PIPELINE_PATH);

  if (pipelineId === ALL_PIPELINES) {
    return { ...base, conditions: without };
  }

  const next: Condition = {
    path: PIPELINE_PATH,
    operator: "eq",
    value: pipelineId,
  };
  const at = base.conditions.findIndex((c) => c.path === PIPELINE_PATH);
  const conditions = [...without];
  conditions.splice(at === -1 ? conditions.length : at, 0, next);

  return { ...base, conditions };
}

/**
 * Stage conditions that cannot be true in the pinned pipeline.
 *
 * Two pipelines can both have a stage keyed `won`, so a stage condition is only
 * meaningful once you know the board. Pinning a trigger to a pipeline where the
 * chosen stage does not exist leaves a rule that can never fire — and because
 * the stage picker hides out-of-scope options, the value goes invisible rather
 * than wrong, which is worse. Naming them is the whole fix.
 */
export function unreachableStages(
  group: ConditionGroup | undefined,
  pipelineId: string,
  stageField: { options?: { value: string; scopes?: string[] }[] } | undefined,
): string[] {
  if (pipelineId === ALL_PIPELINES || pipelineId === "custom") return [];
  const options = stageField?.options ?? [];
  if (options.length === 0) return [];

  const reachable = new Set(
    options
      .filter((o) => !o.scopes?.length || o.scopes.includes(pipelineId))
      .map((o) => o.value),
  );

  const out: string[] = [];
  for (const condition of group?.conditions ?? []) {
    if (condition.path !== "stage") continue;
    const values = Array.isArray(condition.value)
      ? condition.value
      : [condition.value];
    for (const value of values) {
      if (typeof value !== "string" || reachable.has(value)) continue;
      out.push(value);
    }
  }

  return [...new Set(out)];
}
