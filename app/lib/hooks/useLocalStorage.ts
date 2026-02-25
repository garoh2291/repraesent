"use client";

import { useCallback, useSyncExternalStore } from "react";

const subscribe = (listener: EventListener) => {
  window?.addEventListener("basket-changed", listener);

  return () => window?.removeEventListener("basket-changed", listener);
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
      window.dispatchEvent(new StorageEvent("basket-changed"));
    },
    [name]
  );

  const removeItem = useCallback(() => {
    localStorage.removeItem(name);
    window.dispatchEvent(new StorageEvent("basket-changed"));
  }, [name]);

  return { item: value ? (JSON.parse(value) as T) : null, setItem, removeItem };
};
