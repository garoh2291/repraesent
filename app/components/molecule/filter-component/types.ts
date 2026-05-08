export interface FilterOption {
  key: string;
  label: string;
  /**
   * Optional second line shown beneath the label — useful when several
   * options share the same display name (e.g. campaigns named identically
   * across ad accounts) so the user can still tell them apart.
   */
  description?: string;
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
