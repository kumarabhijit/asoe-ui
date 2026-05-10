/**
 * useCases — fetch /api/v1/cases with an optional source filter.
 *
 * ADR-038 §H.6 commits `/inbox` and `/exceptions` to operating as
 * filtered case-list views of `/cases`. Phase 28.5 (Frontend Platform
 * V5.1) wires this hook as the canonical case-list source for all
 * three surfaces.
 *
 * Returns `{ cases, total, loading, error, refetch }`.
 *
 * The hook itself does not subscribe to WebSocket events — every
 * page that consumes it already mounts `useWebSocket` for its own
 * pipeline / exception handlers. Those handlers are expected to call
 * `refetch()` on `case_open` / `case_update` / `case_close` events so
 * the case list stays live without a page refresh. See
 * `useCaseInvalidationHandler` for a small helper that pages can
 * compose into their existing WS event handler.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

import { casesApi } from "@/lib/api";
import type { CaseSource, OrderCase } from "@/types/cases";
import type { WSEvent } from "@/types/websocket";

interface UseCasesReturn {
  cases: OrderCase[];
  total: number;
  loading: boolean;
  error: string | null;
  /** Force re-fetch. Pages call this from their `useWebSocket` event
   *  handler on `case_*` events, and after operator-driven actions
   *  that mutate the case server-side. */
  refetch: () => void;
}

export function useCases(source?: CaseSource): UseCasesReturn {
  const [cases, setCases] = useState<OrderCase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped by `refetch()` to trigger an effect re-run.
  const [refetchCounter, setRefetchCounter] = useState(0);

  const refetch = useCallback(() => {
    setRefetchCounter((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Only flip the loading flag on the first fetch (or filter
    // change). Refetch-driven calls are silent — flashing the
    // spinner on every case_update would defeat the live-count UX.
    const isInitial = refetchCounter === 0;
    if (isInitial) setLoading(true);
    casesApi
      .list(source ? { source } : undefined)
      .then((res) => {
        if (cancelled) return;
        setCases(res.items);
        setTotal(res.total);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "Failed to fetch cases",
        );
      })
      .finally(() => {
        if (!cancelled && isInitial) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, refetchCounter]);

  return { cases, total, loading, error, refetch };
}

/**
 * useManualOrderCases — convenience wrapper. Kept as the previous
 * named export so callers in /inbox don't need to update.
 */
export function useManualOrderCases(): UseCasesReturn {
  return useCases("manual_order");
}

/**
 * Returns true when the WS event is a case-level invalidation
 * trigger (`case_open` / `case_update` / `case_close`). Page-level
 * `useWebSocket` handlers compose this with their own
 * pipeline-progress / exception-update logic and call
 * `useCases().refetch()` whenever it returns true.
 *
 * Kept as a pure helper rather than a hook so the page handler can
 * remain a single useCallback without an extra subscription.
 */
export function isCaseInvalidationEvent(event: WSEvent): boolean {
  return (
    event.type === "case_open"
    || event.type === "case_update"
    || event.type === "case_close"
  );
}
