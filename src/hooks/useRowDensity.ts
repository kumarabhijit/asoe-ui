// useRowDensity — per-user density preference for the /cases queue.
//
// ADR-041 P3e §2.4. The new four-line row roughly doubles per-row
// height; an operator working a long queue may prefer the legacy
// compact form. Persist the choice to `localStorage` under the
// stable key below.
//
// SSR-safe — initial render returns the default; the persisted
// value is read in `useEffect` and the component re-renders once.
// Mirrors the pattern in `useSavedViews.ts` so a future operator
// preference syncing surface can fold both keys into one migration.

"use client";

import { useCallback, useEffect, useState } from "react";

export type RowDensity = "compact" | "comfortable";

const STORAGE_KEY = "asoe.cases.rowDensity";
const DEFAULT: RowDensity = "comfortable";

function isRowDensity(value: unknown): value is RowDensity {
  return value === "compact" || value === "comfortable";
}

function readStorage(): RowDensity {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isRowDensity(raw) ? raw : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function writeStorage(value: RowDensity): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // QuotaExceededError or storage disabled — swallow.
  }
}

export function useRowDensity(): [RowDensity, (value: RowDensity) => void] {
  const [density, setDensity] = useState<RowDensity>(DEFAULT);

  useEffect(() => {
    setDensity(readStorage());
  }, []);

  const update = useCallback((value: RowDensity) => {
    setDensity(value);
    writeStorage(value);
  }, []);

  return [density, update];
}
