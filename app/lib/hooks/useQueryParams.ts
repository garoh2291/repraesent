"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

export type SearchParamInput =
  | { key: string; value: string }
  | { [key: string]: string };

/** null = delete param, string = set param */
type PendingMap = Record<string, string | null>;

function applyPending(current: URLSearchParams, pending: PendingMap): void {
  Object.entries(pending).forEach(([key, value]) => {
    if (value === null || value === "") {
      current.delete(key);
    } else {
      current.set(key, value);
    }
  });
}

/**
 * Hook to update URL search params. Accepts single { key, value } or multiple { [key]: value }.
 * Empty value removes the param. Batches rapid calls into one navigate. Uses replace by default.
 */
export function useSearchParamsSelect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pathname = useLocation().pathname;

  const pendingRef = useRef<PendingMap>({});
  const flushRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSelect = useCallback(
    (input: SearchParamInput, replace = true) => {
      const p = pendingRef.current;

      if ("key" in input) {
        p[input.key] = input.value === "" ? null : input.value;
      } else {
        Object.entries(input).forEach(([key, value]) => {
          p[key] = value === "" ? null : value;
        });
      }

      const flush = () => {
        flushRef.current = null;
        const current = new URLSearchParams(searchParams.toString());
        applyPending(current, { ...pendingRef.current });
        pendingRef.current = {};
        const search = current.toString();
        navigate(`${pathname}${search ? `?${search}` : ""}`, { replace });
      };

      if (flushRef.current) clearTimeout(flushRef.current);
      flushRef.current = setTimeout(flush, 0);
    },
    [searchParams, navigate, pathname]
  );

  useEffect(
    () => () => {
      if (flushRef.current) clearTimeout(flushRef.current);
    },
    []
  );

  const clearParams = useCallback(() => {
    navigate(pathname, { replace: true });
  }, [navigate, pathname]);

  return [onSelect, clearParams] as const;
}

/**
 * Simpler hook for single key-value search param updates.
 */
export function useSearch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pathname = useLocation().pathname;

  const onSelect = useCallback(
    (key: string, value: string, replace = true) => {
      const current = new URLSearchParams(searchParams.toString());

      if (!value) {
        current.delete(key);
      } else {
        current.set(key, value);
      }

      const search = current.toString();
      const query = search ? `?${search}` : "";

      navigate(`${pathname}${query}`, { replace });
    },
    [searchParams, navigate, pathname]
  );

  return [onSelect] as const;
}
