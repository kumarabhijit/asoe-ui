/**
 * useManualOrderCases — fetch the manual-order subset of /api/v1/cases.
 *
 * ADR-038 §H.6 commits `/inbox` and `/exceptions` to operating as
 * filtered case-list views of `/cases`. The deeper data-hook swap
 * — replacing the inbox's `INBOX` mock + the exception queue's
 * `exceptionsApi.list` with case-projected rows — is a Frontend
 * Platform follow-up tracked separately (V5.1).
 *
 * This hook lands the scaffolding for that swap: callers can
 * surface the manual-order case count, pre-fetch the case rows
 * to seed the future projection, and deep-link from existing
 * legacy rows to their parent case.
 *
 * Returns `{ cases, total, loading, error }`. Re-fetches when the
 * effect dependencies change (currently mount-only — refresh
 * lands when WebSocket-driven invalidation is wired in V5.1).
 */
"use client";

import { useEffect, useState } from "react";

import { casesApi } from "@/lib/api";
import type { OrderCase } from "@/types/cases";

interface UseManualOrderCasesReturn {
  cases: OrderCase[];
  total: number;
  loading: boolean;
  error: string | null;
}

export function useManualOrderCases(): UseManualOrderCasesReturn {
  const [cases, setCases] = useState<OrderCase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    casesApi
      .list({ source: "manual_order" })
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
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { cases, total, loading, error };
}
