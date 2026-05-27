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

import { casesApi, type CaseListItem } from "@/lib/api";
import type { Origin } from "@/types/cases";
import type { WSEvent } from "@/types/websocket";

interface UseCasesReturn {
  cases: CaseListItem[];
  total: number;
  loading: boolean;
  error: string | null;
  /** Defensive disclosure — `total > cases.length` after the
   *  cursor loop has completed. Should always be false in normal
   *  operation (the loop accumulates every page); flipping true
   *  indicates the loop terminated early via the 200-iteration
   *  ceiling or a stalled-cursor guard, which is a backend bug. */
  truncated: boolean;
  /** Force re-fetch. Pages call this from their `useWebSocket` event
   *  handler on `case_*` events, and after operator-driven actions
   *  that mutate the case server-side. */
  refetch: () => void;
}

export interface UseCasesOptions {
  /** Per-page size for the cursor loop. Defaults to the backend
   *  default (200). Backend caps at 500. The hook walks every page
   *  until `has_more` is false, accumulating into `cases`. */
  limit?: number;
  /** Filter by Intent Super-Group (requirements §6). E.g.
   *  `supergroupCode: "SG_BLOCK_PRICING"`. Orthogonal to `origin`. */
  supergroupCode?: string;
}

export function useCases(
  origin?: Origin,
  options?: UseCasesOptions,
): UseCasesReturn {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped by `refetch()` to trigger an effect re-run.
  const [refetchCounter, setRefetchCounter] = useState(0);

  const limit = options?.limit;
  const supergroupCode = options?.supergroupCode;

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

    // Cursor-anchored loop. The backend (asoe2/api/routes/cases.py
    // ::list_cases) and the mock both honour `cursor` + `has_more`
    // per the ADR-038 §D7 amendment; we walk every page so a
    // tenant with >limit cases doesn't silently see only the first
    // slice.
    const pageParams: {
      origin?: Origin;
      supergroup_code?: string;
      limit?: number;
    } = {};
    if (origin) pageParams.origin = origin;
    if (supergroupCode) pageParams.supergroup_code = supergroupCode;
    if (limit !== undefined) pageParams.limit = limit;

    const run = async () => {
      try {
        const accumulated: CaseListItem[] = [];
        let cursor: string | undefined = undefined;
        let lastTotal = 0;
        // Bounded loop — defensive guard against a backend that
        // never advances the cursor. 200 pages × default-limit-200
        // covers 40k cases per tenant, well past current ceilings.
        for (let iter = 0; iter < 200; iter += 1) {
          const params: typeof pageParams & { cursor?: string } = { ...pageParams };
          if (cursor) params.cursor = cursor;
          const res = await casesApi.list(
            Object.keys(params).length > 0 ? params : undefined,
          );
          if (cancelled) return;
          accumulated.push(...res.items);
          lastTotal = res.total;
          if (!res.has_more) break;
          if (!res.cursor || res.cursor === cursor) break; // backend bug guard
          cursor = res.cursor;
        }
        if (cancelled) return;
        setCases(accumulated);
        setTotal(lastTotal);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "Failed to fetch cases",
        );
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [origin, supergroupCode, limit, refetchCounter]);

  return {
    cases,
    total,
    loading,
    error,
    truncated: total > cases.length,
    refetch,
  };
}

/**
 * useManualOrderCases — convenience wrapper. Kept as the previous
 * named export so callers in /inbox don't need to update. Post Case
 * & Intent Super-Group pivot the "manual order" lens IS the
 * `origin === "CUSTOMER"` slice.
 */
export function useManualOrderCases(
  options?: UseCasesOptions,
): UseCasesReturn {
  return useCases("CUSTOMER", options);
}

/**
 * Returns true when the WS event is a case-list invalidation trigger.
 * Covers the case-level events (`case_open` / `case_update` / `case_close`)
 * and the ADR-042 Phase 4 AI Draft Reply events (`reply_drafted` /
 * `reply_sent`) — a drafted or sent buyer reply mutates the record a case
 * projects, so the list view must refetch. Page-level `useWebSocket`
 * handlers compose this with their own pipeline-progress / exception-update
 * logic and call `useCases().refetch()` whenever it returns true.
 *
 * Kept as a pure helper rather than a hook so the page handler can
 * remain a single useCallback without an extra subscription.
 */
export function isCaseInvalidationEvent(event: WSEvent): boolean {
  return (
    event.type === "case_open"
    || event.type === "case_update"
    || event.type === "case_close"
    || event.type === "reply_drafted"
    || event.type === "reply_sent"
  );
}
