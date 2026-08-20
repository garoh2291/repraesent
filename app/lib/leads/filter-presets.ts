import { useMemo } from "react";
import { LEAD_STATUSES, LEAD_SOURCES } from "~/lib/leads/constants";
import type { FilterOption } from "~/components/molecule/filter-component/types";
import { useLeadStages } from "~/lib/hooks/usePipelineStages";

/**
 * Legacy static status options. Only for the cross-workspace brand views,
 * where per-workspace stage config doesn't apply — workspace-scoped screens
 * use useLeadFilterStatusOptions() instead.
 */
export const LEAD_FILTER_STATUS_OPTIONS: FilterOption[] = LEAD_STATUSES.map(
  (s) => ({ key: s, label: `leads.statuses.${s}` })
);

/**
 * The workspace's configured lead stages as filter options. `label` is either
 * a literal admin-chosen name or an i18n key — FilterComponent renders
 * options with t(label, { defaultValue: label }), which handles both.
 */
export function useLeadFilterStatusOptions(): FilterOption[] {
  const { visible } = useLeadStages();
  return useMemo(
    () =>
      visible.map((s) => ({
        key: s.key,
        label: s.label ?? `leads.statuses.${s.key}`,
      })),
    [visible],
  );
}

const SOURCE_LABEL_KEYS: Record<string, string> = {
  urls: "leads.filters.websiteSource",
  appointment_booking: "leads.filters.appointmentSource",
};

export const LEAD_FILTER_SOURCE_OPTIONS: FilterOption[] = Object.values(
  LEAD_SOURCES
).map((src) => ({ key: src.value, label: SOURCE_LABEL_KEYS[src.value] ?? src.label }));

export const LEADS_FILTERS = [
  {
    name: "status",
    paramKey: "status",
    options: LEAD_FILTER_STATUS_OPTIONS,
    single: true,
  },
  {
    name: "source",
    paramKey: "source",
    options: LEAD_FILTER_SOURCE_OPTIONS,
    single: true,
  },
  {
    name: "form_name",
    paramKey: "form_name",
    options: [] as { key: string; label: string }[],
    single: true,
  },
];
