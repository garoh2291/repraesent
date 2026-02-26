export interface FilterOption {
  key: string;
  label: string;
}

export interface AdditionalFilter {
  name: string;
  paramKey: string;
  options: FilterOption[] | unknown[];
  single?: boolean;
  isLoading?: boolean;
  useExternalSearch?: boolean;
  onSearchChange?: (search: string) => void;
}

export interface Filter {
  name: string;
  paramKey: string;
  options: FilterOption[];
  single?: boolean;
  isLoading?: boolean;
  type?: "date";
  useExternalSearch?: boolean;
  onSearchChange?: (search: string) => void;
}

export type SelectedFilters = {
  [key: string]: string[];
};
