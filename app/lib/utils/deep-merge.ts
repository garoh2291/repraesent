/**
 * Recursively merge `override` onto `base`. Plain objects merge key-by-key;
 * arrays and scalars in `override` replace whatever `base` had, so a saved
 * list (e.g. named scripts) never blends with the default one.
 */
export function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(override)) {
    const bv = base[k];
    const ov = override[k];
    if (
      ov != null &&
      typeof ov === "object" &&
      !Array.isArray(ov) &&
      bv != null &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      out[k] = deepMerge(
        bv as Record<string, unknown>,
        ov as Record<string, unknown>,
      );
    } else if (ov !== undefined) {
      out[k] = ov;
    }
  }
  return out;
}

export function cloneDeepJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Deep-merge an API `settings` payload into a fresh copy of `defaults`.
 * A missing or non-object payload yields a deep clone of the defaults, which
 * is what a site that has never saved the plugin returns.
 */
export function mergeRecordWithDefaults<T extends object>(
  defaults: T,
  raw: unknown,
): T {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return cloneDeepJson(defaults);
  }
  return deepMerge(
    defaults as Record<string, unknown>,
    raw as Record<string, unknown>,
  ) as T;
}
