"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_EVENT = "basket-changed";

const subscribe = (listener: EventListener) => {
  window?.addEventListener(STORAGE_EVENT, listener);
  return () => window?.removeEventListener(STORAGE_EVENT, listener);
};

const getSnapshot = (name: string) => () => localStorage.getItem(name);
const getServerSnapshot = () => "";

export const useLocalStorageValue = <T>(name: string) => {
  const value = useSyncExternalStore(
    subscribe,
    getSnapshot(name),
    getServerSnapshot
  );

  const setItem = useCallback(
    (item: T) => {
      localStorage.setItem(name, JSON.stringify(item));
      window.dispatchEvent(new StorageEvent(STORAGE_EVENT));
    },
    [name]
  );

  const removeItem = useCallback(() => {
    localStorage.removeItem(name);
    window.dispatchEvent(new StorageEvent(STORAGE_EVENT));
  }, [name]);

  return { item: value ? (JSON.parse(value) as T) : null, setItem, removeItem };
};

const LEADS_VIEW_MODE_KEY = "leads-view-mode";

export function useLeadsViewMode(): ["table" | "kanban", (mode: "table" | "kanban") => void] {
  const { item, setItem } = useLocalStorageValue<"table" | "kanban">(LEADS_VIEW_MODE_KEY);
  const value = item ?? "table";
  const setValue = (mode: "table" | "kanban") => setItem(mode);
  return [value, setValue];
}
