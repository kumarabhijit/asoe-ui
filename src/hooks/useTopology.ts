/**
 * useTopology — fetches the pipeline topology from
 * GET /api/v1/pipeline/topology (ADR-027 Phase A).
 *
 * Cached by `topology_hash`; the topology is the same for every
 * authenticated user (it's the graph SHAPE, not per-tenant data),
 * so a global window cache avoids refetch storms across detail-page
 * mounts. The cache key is the URL — flipping NEXT_PUBLIC_USE_REAL_API
 * resets it naturally.
 */
"use client";

import { useEffect, useState } from "react";
import { pipelineApi } from "@/lib/api";
import type { PipelineTopology } from "@/types/api";

interface UseTopologyReturn {
  topology: PipelineTopology | null;
  loading: boolean;
  error: string | null;
}

let _cachedTopology: PipelineTopology | null = null;
let _inflight: Promise<PipelineTopology> | null = null;

export function useTopology(): UseTopologyReturn {
  const [topology, setTopology] = useState<PipelineTopology | null>(_cachedTopology);
  const [loading, setLoading] = useState(_cachedTopology === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (_cachedTopology) {
      setTopology(_cachedTopology);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const promise = _inflight ?? pipelineApi.topology();
    _inflight = promise;
    promise
      .then((data) => {
        _cachedTopology = data;
        _inflight = null;
        if (!cancelled) {
          setTopology(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        _inflight = null;
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { topology, loading, error };
}

/**
 * Test-only: clear the module-level cache so each test starts fresh.
 * Not exported from the package's public surface.
 */
export function _resetTopologyCache(): void {
  _cachedTopology = null;
  _inflight = null;
}
