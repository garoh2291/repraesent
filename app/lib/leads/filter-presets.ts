import { LEAD_STATUSES, LEAD_SOURCES } from "~/lib/leads/constants";
import type { FilterOption } from "~/components/molecule/filter-component/types";

export const LEAD_FILTER_STATUS_OPTIONS: FilterOption[] = LEAD_STATUSES.map(
  (s) => ({ key: s, label: `leads.statuses.${s}` })
);

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
