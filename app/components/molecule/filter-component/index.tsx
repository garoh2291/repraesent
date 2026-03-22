"use client";

import * as React from "react";
import { Check, ChevronLeft, Filter, Search } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Badge } from "~/components/ui/badge";
import { Calendar } from "~/components/ui/calendar";
import {
  type AdditionalFilter,
  type Filter as FilterType,
  type FilterOption,
} from "./types";
import { LEADS_FILTERS } from "~/lib/leads/filter-presets";

const STATIC_FILTERS: Record<string, FilterType[]> = {
  leads: LEADS_FILTERS,
};

const FILTER_LABEL_KEYS: Record<string, string> = {
  status: "leads.filters.status",
  source: "leads.filters.source",
};

export interface FilterComponentProps {
  optionKey?: string;
  additionalFilters?: AdditionalFilter[];
  currentSearchValues?: { [filterName: string]: string };
  filters?: FilterType[];
}

export function FilterComponent({
  optionKey,
  additionalFilters = [],
  currentSearchValues = {},
  filters: customFilters,
}: FilterComponentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  const getFilterLabel = (name: string): string => {
    const key = FILTER_LABEL_KEYS[name];
    if (key) return t(key);
    return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const [open, setOpen] = React.useState(false);
  const [activeFilter, setActiveFilter] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [groupSearch, setGroupSearch] = React.useState("");
  const [hoveredOption, setHoveredOption] = React.useState<string | null>(null);
  const [dateFilters, setDateFilters] = React.useState<{
    [key: string]: Date | undefined;
  }>({});

  const isUpdatingFromURL = React.useRef(false);

  const processedAdditionalFilters = React.useMemo(() => {
    return additionalFilters?.map((filter) => ({
      ...filter,
      options: filter.options
        .map((item: unknown) => {
          if (typeof item === "string") {
            return { key: item, label: item };
          }
          if (typeof item === "object" && item !== null) {
            const obj = item as Record<string, unknown>;
            const key = (obj.key ?? obj.id ?? obj.value ?? "").toString();
            const label = (obj.label ?? obj.name ?? obj.title ?? "").toString();
            return { key, label };
          }
          return { key: "", label: "" };
        })
        .filter(
          (option: { key: string; label: string }) =>
            option.key !== "" && option.label !== ""
        ),
      useExternalSearch: filter.useExternalSearch,
      onSearchChange: filter.onSearchChange,
    }));
  }, [additionalFilters]);

  const filters = React.useMemo(() => {
    if (customFilters && customFilters.length > 0) {
      return customFilters;
    }
    const base =
      optionKey && STATIC_FILTERS[optionKey]
        ? [...STATIC_FILTERS[optionKey]]
        : [];
    return [...base, ...processedAdditionalFilters] as FilterType[];
  }, [optionKey, customFilters, processedAdditionalFilters]);

  const getSelectedFiltersFromParams = React.useCallback(() => {
    const selectedFilters: Record<string, string[]> = {};
    filters.forEach((filter) => {
      const paramValue = searchParams.get(filter.paramKey);
      if (paramValue) {
        if (filter.type === "date") {
          selectedFilters[filter.name] = [paramValue];
        } else {
          selectedFilters[filter.name] = paramValue.split(",").filter(Boolean);
        }
      }
    });
    return selectedFilters;
  }, [filters, searchParams]);

  const [selectedFilters, setSelectedFilters] = React.useState<
    Record<string, string[]>
  >({});

  const filteredGroups = React.useMemo(() => {
    if (!groupSearch.trim()) return filters;
    const q = groupSearch.toLowerCase();
    return filters.filter((filter) =>
      getFilterLabel(filter.name).toLowerCase().includes(q)
    );
  }, [filters, groupSearch]);

  React.useEffect(() => {
    const newSelectedFilters: Record<string, string[]> = {};
    const newDateFilters: { [key: string]: Date | undefined } = {};

    filters.forEach((filter) => {
      const paramValue = searchParams.get(filter.paramKey);
      if (paramValue) {
        if (filter.type === "date") {
          newSelectedFilters[filter.name] = [paramValue];
          newDateFilters[filter.name] = new Date(paramValue);
        } else {
          newSelectedFilters[filter.name] = paramValue
            .split(",")
            .filter(Boolean);
        }
      }
    });

    isUpdatingFromURL.current = true;

    const currentState = JSON.stringify(selectedFilters);
    const newState = JSON.stringify(newSelectedFilters);

    if (currentState !== newState) {
      setSelectedFilters(newSelectedFilters);
      setDateFilters(newDateFilters);
    }

    isUpdatingFromURL.current = false;
  }, [searchParams]);

  const getSelectedFilterDisplay = () => {
    const isLoading = additionalFilters.some((filter) => filter.isLoading);
    if (isLoading) return "Loading...";

    const allSelectedFilters = Object.entries(selectedFilters)
      .flatMap(([filterName, selectedKeys]) => {
        const filter = filters.find((f) => f.name === filterName);
        if (!filter) return [];

        return selectedKeys.map((key) => {
          if (filter.type === "date") {
            try {
              return format(new Date(key), "MMM dd, yyyy");
            } catch {
              return key;
            }
          }
          const option = filter.options.find(
            (opt: FilterOption) => opt.key === key
          );
          return option ? t(option.label, { defaultValue: option.label }) : "";
        });
      })
      .filter(Boolean);

    if (allSelectedFilters.length === 0) return t("common.filter");
    if (allSelectedFilters.length === 1) {
      const filterValue = allSelectedFilters[0];
      return filterValue.length > 20
        ? `${filterValue.substring(0, 20)}...`
        : filterValue;
    }

    const firstFilter = allSelectedFilters[0];
    const truncatedFirst =
      firstFilter.length > 15
        ? `${firstFilter.substring(0, 15)}...`
        : firstFilter;
    return `${truncatedFirst} +${allSelectedFilters.length - 1}`;
  };

  const updateSearchParams = React.useCallback(
    (newFilters: Record<string, string[]>) => {
      const current = new URLSearchParams(searchParams.toString());

      const currentFilters = getSelectedFiltersFromParams();
      const filtersChanged =
        JSON.stringify(currentFilters) !== JSON.stringify(newFilters);

      if (filtersChanged) {
        current.set("page", "1");
      }

      filters.forEach((filter) => {
        const values = newFilters[filter.name];
        if (values && values.length > 0) {
          if (filter.type === "date") {
            current.set(filter.paramKey, values[0]);
          } else {
            current.set(filter.paramKey, values.join(","));
          }
        } else {
          current.delete(filter.paramKey);
        }
      });

      const search = current.toString();
      navigate(`${pathname}${search ? `?${search}` : ""}`, { replace: true });
    },
    [filters, searchParams, pathname, navigate, getSelectedFiltersFromParams]
  );

  const handleSelect = (filterName: string, optionKeyVal: string) => {
    setSelectedFilters((prev) => {
      const updatedFilters = { ...prev };
      const currentFilter = filters.find((f) => f.name === filterName);

      if (currentFilter?.single) {
        if (updatedFilters[filterName]?.[0] === optionKeyVal) {
          delete updatedFilters[filterName];
        } else {
          updatedFilters[filterName] = [optionKeyVal];
        }
      } else {
        if (!updatedFilters[filterName]) {
          updatedFilters[filterName] = [];
        }
        if (updatedFilters[filterName].includes(optionKeyVal)) {
          updatedFilters[filterName] = updatedFilters[filterName].filter(
            (k) => k !== optionKeyVal
          );
        } else {
          updatedFilters[filterName].push(optionKeyVal);
        }
        if (updatedFilters[filterName].length === 0) {
          delete updatedFilters[filterName];
        }
      }

      return updatedFilters;
    });
  };

  const handleSelectOnly = (filterName: string, optionKeyVal: string) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [filterName]: [optionKeyVal],
    }));
  };

  const handleDateSelect = (filterName: string, date: Date | undefined) => {
    setSelectedFilters((prev) => {
      const updatedFilters = { ...prev };
      if (date) {
        const dateString = date.toISOString().split("T")[0];
        updatedFilters[filterName] = [dateString];
      } else {
        delete updatedFilters[filterName];
      }
      return updatedFilters;
    });

    setDateFilters((prev) => ({
      ...prev,
      [filterName]: date,
    }));
  };

  const filteredOptions = React.useMemo(() => {
    if (!activeFilter) return [];
    const currentFilter = filters.find((f) => f.name === activeFilter);
    if (!currentFilter) return [];

    if (currentFilter.type === "date") return [];

    if (currentFilter.useExternalSearch) {
      return currentFilter.options;
    }

    return currentFilter.options.filter((option: FilterOption) =>
      option.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [activeFilter, filters, search]);

  React.useEffect(() => {
    if (open) {
      setSearch("");
      setGroupSearch("");
      setActiveFilter(null);
      setHoveredOption(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (activeFilter) {
      setGroupSearch("");
      const currentFilter = filters.find((f) => f.name === activeFilter);
      if (currentFilter?.useExternalSearch) {
        const currentSearchValue = currentSearchValues[activeFilter] || "";
        setSearch(currentSearchValue);
      }
    }
  }, [activeFilter, currentSearchValues, filters]);

  React.useEffect(() => {
    if (!isUpdatingFromURL.current) {
      const timeoutId = setTimeout(() => {
        updateSearchParams(selectedFilters);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [selectedFilters]);

  const currentFilterForActive = activeFilter
    ? filters.find((f) => f.name === activeFilter)
    : null;
  const isDateFilter = currentFilterForActive?.type === "date";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="min-w-[150px] w-max h-8 py-0 justify-between capitalize"
        >
          <Filter className="mr-2 h-4 w-4" />
          {getSelectedFilterDisplay()}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(
          "w-[min(100vw-1rem,400px)] p-0",
          activeFilter && isDateFilter ? "sm:max-w-[350px]" : "sm:max-w-[400px]"
        )}
      >
        <Command
          shouldFilter={
            !activeFilter || !currentFilterForActive?.useExternalSearch
          }
        >
          {!activeFilter && (
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                placeholder={t("leads.filters.searchFilters")}
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          )}

          {activeFilter && !isDateFilter && (
            <CommandInput
              placeholder={t("leads.filters.searchOptions")}
              value={search}
              onValueChange={(value) => {
                setSearch(value);
                const cf = filters.find((f) => f.name === activeFilter);
                if (cf?.useExternalSearch && cf?.onSearchChange) {
                  cf.onSearchChange(value);
                }
              }}
            />
          )}
          <CommandList className={cn(isDateFilter ? "max-h-none" : "")}>
            <CommandEmpty>{t("common.noResults")}</CommandEmpty>
            {activeFilter ? (
              <div
                key="options"
                className="animate-in fade-in-0 slide-in-from-right-4 duration-200"
              >
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setSearch("");
                      const cf = filters.find((f) => f.name === activeFilter);
                      if (cf?.useExternalSearch && cf?.onSearchChange) {
                        cf.onSearchChange("");
                      }
                      setTimeout(() => setActiveFilter(null), 0);
                    }}
                    className="cursor-pointer capitalize"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    {t("common.back")}
                  </CommandItem>
                </CommandGroup>
                <CommandGroup
                  heading={getFilterLabel(activeFilter)}
                  className="capitalize"
                >
                  {currentFilterForActive?.isLoading ? (
                    <CommandItem disabled>{t("common.loading")}</CommandItem>
                  ) : isDateFilter ? (
                    <div className="p-3 min-h-[320px]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium capitalize">
                          {dateFilters[activeFilter]
                            ? format(dateFilters[activeFilter]!, "MMM dd, yyyy")
                            : t("leads.filters.pickADate")}
                        </span>
                        {dateFilters[activeFilter] && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleDateSelect(activeFilter, undefined)
                            }
                            className="h-6 px-2 text-xs capitalize"
                          >
                            {t("common.remove")}
                          </Button>
                        )}
                      </div>
                      <Calendar
                        mode="single"
                        selected={dateFilters[activeFilter]}
                        onSelect={(date) =>
                          handleDateSelect(activeFilter, date)
                        }
                        className="rounded-md border"
                      />
                    </div>
                  ) : (
                    filteredOptions.map((option: FilterOption) => {
                      const isSelected =
                        selectedFilters[activeFilter]?.includes(option.key) ??
                        false;
                      const isMultiSelect = !currentFilterForActive?.single;

                      return (
                        <div
                          key={option.key}
                          className="relative"
                          onMouseEnter={() => setHoveredOption(option.key)}
                          onMouseLeave={() => setHoveredOption(null)}
                        >
                          <CommandItem
                            onSelect={() =>
                              handleSelect(activeFilter, option.key)
                            }
                            className={cn(
                              "flex items-center capitalize cursor-pointer",
                              isSelected && "bg-accent"
                            )}
                          >
                            <span className="flex-1 truncate">
                              {t(option.label, { defaultValue: option.label })}
                            </span>
                            <div className="flex items-center gap-1 ml-auto">
                              {isMultiSelect && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectOnly(activeFilter, option.key);
                                  }}
                                  className={cn(
                                    "px-2 py-0.5 text-[10px] bg-white dark:bg-zinc-800 text-black dark:text-white border border-gray-300 dark:border-zinc-600 rounded hover:bg-black hover:text-white dark:hover:bg-zinc-100 dark:hover:text-black transition-all duration-150 font-medium shadow-sm whitespace-nowrap z-10",
                                    hoveredOption === option.key
                                      ? "opacity-100"
                                      : "opacity-0 pointer-events-none"
                                  )}
                                >
                                  {t("leads.filters.selectOnly")}
                                </button>
                              )}
                              <Check
                                size={16}
                                className={cn(
                                  "h-2 w-2 shrink-0",
                                  isSelected ? "opacity-100" : "opacity-0"
                                )}
                              />
                            </div>
                          </CommandItem>
                        </div>
                      );
                    })
                  )}
                </CommandGroup>
              </div>
            ) : (
              <div key="groups" className="animate-in fade-in-0 duration-200">
                {filteredGroups.length === 0 ? (
                  <CommandItem disabled>{t("leads.filters.noFilterGroups")}</CommandItem>
                ) : (
                  filteredGroups.map((filter) => (
                    <CommandItem
                      key={filter.name}
                      onSelect={() => setActiveFilter(filter.name)}
                      className="py-3 capitalize cursor-pointer"
                    >
                      {getFilterLabel(filter.name)}
                      {selectedFilters[filter.name]?.length > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                          {selectedFilters[filter.name].length}
                        </Badge>
                      )}
                    </CommandItem>
                  ))
                )}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default FilterComponent;
