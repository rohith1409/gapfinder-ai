"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getStorageKey } from "@/lib/logic";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("gapfinder:storage", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("gapfinder:storage", callback);
  };
}

export function useLocalStorageValue<T>(key: string, fallback: T): T {
  const getSnapshot = useCallback(() => window.localStorage.getItem(getStorageKey(key)), [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
