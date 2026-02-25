"use client";

import { useCallback, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

export type LeadStatusFilter = string;
export type LeadSourceFilter = "website" | "";

export interface LeadFormQueryParams {
  search: string;
  page: number;
  limit: number;
  statusFilter: LeadStatusFilter;
  sourceFilter: LeadSourceFilter;
}

const DEFAULTS: LeadFormQueryParams = {
  search: "",
  page: 1,
  limit: 10,
  statusFilter: "",
  sourceFilter: "",
};

export function useLeadFormQueryParams() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const params = useMemo<LeadFormQueryParams>(() => {
    return {
      search: searchParams.get("search") ?? DEFAULTS.search,
      page: Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1),
      limit: Math.max(
        1,
        Math.min(100, parseInt(searchParams.get("limit") ?? "10", 10) || 10)
      ),
      statusFilter: searchParams.get("status") ?? DEFAULTS.statusFilter,
      sourceFilter:
        (searchParams.get("source") as LeadSourceFilter) ?? DEFAULTS.sourceFilter,
    };
  }, [searchParams]);

  const setParam = useCallback(
    (key: string, value: string | number) => {
      const next = new URLSearchParams(searchParams);
      const defaultValue =
        key === "search"
          ? ""
          : key === "page"
            ? 1
            : key === "limit"
              ? 10
              : key === "status" || key === "source"
                ? ""
                : undefined;
      const isDefault = value === defaultValue;
      if (isDefault) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
      navigate(
        { pathname: location.pathname, search: next.toString() },
        { replace: true }
      );
    },
    [searchParams, navigate, location.pathname]
  );

  const deleteParam = useCallback(
    (key: string) => {
      const next = new URLSearchParams(searchParams);
      next.delete(key);
      navigate(
        { pathname: location.pathname, search: next.toString() },
        { replace: true }
      );
    },
    [searchParams, navigate, location.pathname]
  );

  const setSearch = useCallback(
    (v: string) => setParam("search", v),
    [setParam]
  );
  const setPage = useCallback(
    (v: number) => setParam("page", v),
    [setParam]
  );
  const setLimit = useCallback(
    (v: number) => setParam("limit", v),
    [setParam]
  );
  const setStatusFilter = useCallback(
    (v: LeadStatusFilter) => setParam("status", v),
    [setParam]
  );
  const setSourceFilter = useCallback(
    (v: LeadSourceFilter) => setParam("source", v),
    [setParam]
  );

  return {
    ...params,
    setSearch,
    setPage,
    setLimit,
    setStatusFilter,
    setSourceFilter,
    setParam,
    deleteParam,
  };
}
