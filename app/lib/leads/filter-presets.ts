import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_SOURCES,
} from "~/lib/leads/constants";
import type { FilterOption } from "~/components/molecule/filter-component/types";

export const LEAD_FILTER_STATUS_OPTIONS: FilterOption[] = LEAD_STATUSES.map(
  (s) => ({ key: s, label: LEAD_STATUS_LABELS[s] })
);

export const LEAD_FILTER_SOURCE_OPTIONS: FilterOption[] = Object.values(
  LEAD_SOURCES
).map((src) => ({ key: src.value, label: src.label }));

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
];
