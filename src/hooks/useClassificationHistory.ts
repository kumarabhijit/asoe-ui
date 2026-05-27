/**
 * useClassificationHistory — GET /api/v1/cases/{case_id}/classification-history.
 *
 * Returns the case's append-order classification audit trail
 * (requirements §8.6). Single fetch + refetch — no cursor loop,
 * because audit depth is single-digit inside the operator's window.
 *
 * Partner-role responses are redacted server-side; the hook just
 * surfaces what it gets. The presentation layer
 * (`ClassificationHistoryPanel`) handles the coarse tokens.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

import { casesApi } from "@/lib/api";
import type {
  ClassificationHistoryEntry,
  ClassificationHistoryResponse,
} from "@/types/exceptions";

export interface UseClassificationHistoryReturn {
  entries: ClassificationHistoryEntry[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useClassificationHistory(
  case_id: string | undefined,
): UseClassificationHistoryReturn {
  const [entries, setEntries] = useState<ClassificationHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const refetch = useCallback(() => {
    setRefetchCounter((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!case_id) {
      setEntries([]);
      setTotal(0);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    casesApi
      .getClassificationHistory(case_id)
      .then((res: ClassificationHistoryResponse) => {
        if (cancelled) return;
        setEntries(res.items);
        setTotal(res.total);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          e instanceof Error
            ? e.message
            : "Failed to fetch classification history",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [case_id, refetchCounter]);

  return { entries, total, loading, error, refetch };
}
