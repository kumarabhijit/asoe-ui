/**
 * useHealth — fetches dynamic enum values from GET /api/v1/health.
 *
 * Per Guardrail #2: the UI must not hardcode intent or lifecycle state values.
 * These are fetched from the health endpoint at runtime.
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

export function useHealth(): UseHealthReturn {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      try {
        const data = await healthApi.get();
        if (!cancelled) {
          setHealth(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to fetch health");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, []);

  return { health, loading, error };
}
