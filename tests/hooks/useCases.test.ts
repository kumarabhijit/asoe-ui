/**
 * Unit tests for `src/hooks/useManualOrderCases.ts` (exports `useCases`,
 * `useManualOrderCases`, and `isCaseInvalidationEvent`).
 *
 * Phase 28.5 — verifies the V5.1 hook contract:
 *   - initial fetch hydrates `cases`/`total` and flips `loading`
 *   - `refetch()` re-runs the fetch silently (no loading flicker)
 *   - the case-invalidation helper recognises every `case_*` event
 *     type and rejects all per-event types
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import {
  useCases,
  isCaseInvalidationEvent,
} from "@/hooks/useManualOrderCases";
import type { WSEvent } from "@/types/websocket";

vi.mock("@/lib/api", () => {
  const items = [
    {
      case_id: "case-A",
      tenant_id: "t",
      source: "manual_order",
      source_channel: "email",
      opened_at: "2026-05-10T08:00:00Z",
      status: "OPEN_AGENT_PROCESSING",
      tier: 2,
    },
  ];
  return {
    casesApi: {
      list: vi.fn(async () => ({ items, total: items.length })),
    },
  };
});

import { casesApi } from "@/lib/api";

describe("useCases — initial fetch", () => {
  beforeEach(() => {
    (casesApi.list as ReturnType<typeof vi.fn>).mockClear();
  });

  it("hydrates cases and flips loading after mount", async () => {
    const { result } = renderHook(() => useCases("manual_order"));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cases.map((c) => c.case_id)).toEqual(["case-A"]);
    expect(result.current.total).toBe(1);
    expect(result.current.error).toBeNull();
    expect(casesApi.list).toHaveBeenCalledWith({ source: "manual_order" });
  });

  it("omits the source filter when no source is passed", async () => {
    const { result } = renderHook(() => useCases());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(casesApi.list).toHaveBeenCalledWith(undefined);
  });
});

describe("useCases — refetch", () => {
  beforeEach(() => {
    (casesApi.list as ReturnType<typeof vi.fn>).mockClear();
  });

  it("refetch() triggers a silent re-fetch (loading stays false)", async () => {
    const { result } = renderHook(() => useCases("manual_order"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(casesApi.list).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() =>
      expect(casesApi.list).toHaveBeenCalledTimes(2),
    );
    // Loading must NOT flip back to true on refetch — silent
    // refresh is the V5.1 contract for case_* invalidation.
    expect(result.current.loading).toBe(false);
  });
});

describe("isCaseInvalidationEvent", () => {
  function event(type: WSEvent["type"]): WSEvent {
    return {
      type,
      trace_id: "t",
      exception_id: null,
      case_id: "case-A",
      tenant_id: "t",
      timestamp: "2026-05-10T00:00:00Z",
      payload: {} as WSEvent["payload"],
    };
  }

  it("recognises every case_* event type", () => {
    expect(isCaseInvalidationEvent(event("case_open"))).toBe(true);
    expect(isCaseInvalidationEvent(event("case_update"))).toBe(true);
    expect(isCaseInvalidationEvent(event("case_close"))).toBe(true);
  });

  it("rejects every per-event type", () => {
    expect(isCaseInvalidationEvent(event("pipeline_progress"))).toBe(false);
    expect(isCaseInvalidationEvent(event("exception_update"))).toBe(false);
    expect(isCaseInvalidationEvent(event("task_complete"))).toBe(false);
    expect(isCaseInvalidationEvent(event("error"))).toBe(false);
    expect(isCaseInvalidationEvent(event("reanalysis_started"))).toBe(false);
  });
});
