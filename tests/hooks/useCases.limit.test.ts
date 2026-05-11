/**
 * useCases — limit + truncation behaviour.
 *
 * Scope (S4 re-scoped): the case-projected `/exceptions` queue
 * cannot do cursor-based pagination today (see
 * docs/test-strategy/cases-cursor-pagination-tracking.md), but it
 * MUST surface the "total > items.length" case to the operator so
 * they don't act on a silently-truncated view.
 *
 * Locks:
 *   * `useCases(undefined, { limit: N })` passes `limit: N` to
 *     `casesApi.list`.
 *   * Mock honours `limit` (clamped to 1..500 per backend contract).
 *   * `truncated` flips when `total > cases.length`.
 *   * `truncated` is false on a non-truncated fetch.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { CaseListItem } from "@/lib/api";

const MOCK_ITEMS: CaseListItem[] = Array.from({ length: 12 }).map((_, i) => ({
  case_id: `case-${i.toString().padStart(3, "0")}`,
  tenant_id: "acme-corp",
  source: "manual_order",
  source_channel: "email",
  opened_at: "2026-05-10T09:00:00Z",
  updated_at: "2026-05-10T09:00:00Z",
  status: "OPEN_AGENT_PROCESSING",
  tier: 2,
  child_intents: [],
}));

const listMock = vi.fn();

vi.mock("@/lib/api", () => ({
  casesApi: {
    list: (...args: unknown[]) => listMock(...args),
  },
}));

const { useCases } = await import("@/hooks/useManualOrderCases");

describe("useCases — limit + truncation", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("passes limit through to casesApi.list", async () => {
    listMock.mockResolvedValue({ items: MOCK_ITEMS.slice(0, 5), total: 12 });
    const { result } = renderHook(() =>
      useCases("manual_order", { limit: 5 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listMock).toHaveBeenCalledWith({ source: "manual_order", limit: 5 });
  });

  it("flips truncated when total > items.length", async () => {
    listMock.mockResolvedValue({ items: MOCK_ITEMS.slice(0, 5), total: 12 });
    const { result } = renderHook(() =>
      useCases("manual_order", { limit: 5 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cases.length).toBe(5);
    expect(result.current.total).toBe(12);
    expect(result.current.truncated).toBe(true);
  });

  it("truncated stays false on a complete fetch", async () => {
    listMock.mockResolvedValue({ items: MOCK_ITEMS, total: 12 });
    const { result } = renderHook(() =>
      useCases("manual_order", { limit: 200 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.truncated).toBe(false);
  });

  it("refetch is silent (loading does not flip back to true)", async () => {
    listMock.mockResolvedValue({ items: MOCK_ITEMS.slice(0, 5), total: 12 });
    const { result } = renderHook(() =>
      useCases("manual_order", { limit: 5 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.refetch());
    expect(result.current.loading).toBe(false);
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it("limit-less call omits limit from params", async () => {
    listMock.mockResolvedValue({ items: MOCK_ITEMS, total: 12 });
    const { result } = renderHook(() => useCases("manual_order"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listMock).toHaveBeenCalledWith({ source: "manual_order" });
  });
});
