/**
 * useCases — cursor-loop pagination behaviour.
 *
 * After the ADR-038 §D7 amendment landed cursor pagination on
 * /api/v1/cases, `useCases` walks every page via a bounded loop
 * until `has_more` is false. This file pins:
 *
 *   * limit pass-through to casesApi.list
 *   * cursor loop accumulates rows across pages
 *   * stalled-cursor guard (backend bug protection) does not
 *     infinite-loop
 *   * truncated stays false in normal multi-page operation
 *   * refetch is silent (no spinner flash)
 *   * limit-less call omits both `limit` and `cursor` from params
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { CaseListItem } from "@/lib/api";

function makeItem(i: number): CaseListItem {
  return {
    case_id: `case-${i.toString().padStart(3, "0")}`,
    tenant_id: "acme-corp",
    source: "manual_order",
    source_channel: "email",
    opened_at: "2026-05-10T09:00:00Z",
    updated_at: "2026-05-10T09:00:00Z",
    status: "OPEN_AGENT_PROCESSING",
    tier: 2,
    child_intents: [],
  };
}

const MOCK_ITEMS = Array.from({ length: 12 }, (_, i) => makeItem(i));

const listMock = vi.fn();

vi.mock("@/lib/api", () => ({
  casesApi: {
    list: (...args: unknown[]) => listMock(...args),
  },
}));

const { useCases } = await import("@/hooks/useManualOrderCases");

describe("useCases — cursor-loop pagination", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("passes limit through to casesApi.list (first page)", async () => {
    listMock.mockResolvedValue({
      items: MOCK_ITEMS.slice(0, 5),
      total: 5,
      cursor: null,
      has_more: false,
    });
    const { result } = renderHook(() =>
      useCases("manual_order", { limit: 5 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listMock).toHaveBeenNthCalledWith(1, { source: "manual_order", limit: 5 });
  });

  it("walks every page until has_more=false (rows accumulated, total respected)", async () => {
    // Three-page response: 5, 5, 2.
    listMock
      .mockResolvedValueOnce({
        items: MOCK_ITEMS.slice(0, 5), total: 12, cursor: "case-004", has_more: true,
      })
      .mockResolvedValueOnce({
        items: MOCK_ITEMS.slice(5, 10), total: 12, cursor: "case-009", has_more: true,
      })
      .mockResolvedValueOnce({
        items: MOCK_ITEMS.slice(10, 12), total: 12, cursor: null, has_more: false,
      });

    const { result } = renderHook(() =>
      useCases("manual_order", { limit: 5 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cases).toHaveLength(12);
    expect(result.current.total).toBe(12);
    expect(result.current.truncated).toBe(false);
    expect(listMock).toHaveBeenCalledTimes(3);
    // Subsequent calls carry the previous page's cursor.
    expect(listMock).toHaveBeenNthCalledWith(2, {
      source: "manual_order", limit: 5, cursor: "case-004",
    });
    expect(listMock).toHaveBeenNthCalledWith(3, {
      source: "manual_order", limit: 5, cursor: "case-009",
    });
  });

  it("stalled-cursor guard: backend that returns the same cursor breaks the loop", async () => {
    // Pathological backend — never advances the cursor and never
    // sets has_more=false. The hook MUST not infinite-loop.
    listMock.mockResolvedValue({
      items: MOCK_ITEMS.slice(0, 5),
      total: 99,
      cursor: "case-004",  // never changes
      has_more: true,      // never flips
    });
    const { result } = renderHook(() =>
      useCases("manual_order", { limit: 5 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    // First fetch returns 5 rows; second sees cursor === previous
    // cursor and breaks. So the call count is 2.
    expect(listMock).toHaveBeenCalledTimes(2);
    expect(result.current.cases).toHaveLength(10);
  });

  it("refetch is silent (loading does not flip back to true)", async () => {
    listMock.mockResolvedValue({
      items: MOCK_ITEMS, total: 12, cursor: null, has_more: false,
    });
    const { result } = renderHook(() =>
      useCases("manual_order", { limit: 200 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.refetch());
    expect(result.current.loading).toBe(false);
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it("limit-less call omits limit + cursor from the first-page params", async () => {
    listMock.mockResolvedValue({
      items: MOCK_ITEMS, total: 12, cursor: null, has_more: false,
    });
    const { result } = renderHook(() => useCases("manual_order"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listMock).toHaveBeenNthCalledWith(1, { source: "manual_order" });
  });

  it("source-less call omits both source and limit", async () => {
    listMock.mockResolvedValue({
      items: MOCK_ITEMS, total: 12, cursor: null, has_more: false,
    });
    const { result } = renderHook(() => useCases());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listMock).toHaveBeenNthCalledWith(1, undefined);
  });
});
