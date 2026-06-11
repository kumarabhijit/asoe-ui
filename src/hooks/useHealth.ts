/**
 * useHealth — fetches dynamic enum values from GET /api/v1/health.
 *
 * Per Guardrail #2: the UI must not hardcode intent or lifecycle state values.
 * These are fetched from the health endpoint at runtime.
 *
 * The fetch is deduped through a module-level cache: the health payload
 * is enum vocabulary that only changes on a backend deploy, but the hook
 * is mounted by several components per page (detail panel, action hook,
 * queue toolbar). Without the cache each mount fired its own
 * GET /api/v1/health — 3+ identical requests per render tree.
 * Failures are NOT cached, so the next mount retries.
 */
"use client";

import { useState, useEffect } from "react";
import type { HealthResponse } from "@/types/exceptions";
import { healthApi } from "@/lib/api";

interface UseHealthReturn {
  health: HealthResponse | null;
  loading: boolean;
  error: string | null;
}

let cachedHealth: HealthResponse | null = null;
let inFlight: Promise<HealthResponse> | null = null;

function fetchHealthDeduped(): Promise<HealthResponse> {
  if (cachedHealth) return Promise.resolve(cachedHealth);
  if (!inFlight) {
    inFlight = healthApi
      .get()
      .then((data) => {
        cachedHealth = data;
        return data;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Test seam — clears the module cache between test cases. */
export function __resetHealthCacheForTests(): void {
  cachedHealth = null;
  inFlight = null;
}

export function useHealth(): UseHealthReturn {
  const [health, setHealth] = useState<HealthResponse | null>(cachedHealth);
  const [loading, setLoading] = useState(cachedHealth === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHealthDeduped()
      .then((data) => {
        if (!cancelled) {
          setHealth(data);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to fetch health");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { health, loading, error };
}
