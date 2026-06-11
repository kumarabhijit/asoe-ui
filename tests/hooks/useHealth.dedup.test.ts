/**
 * useHealth dedup tests.
 *
 * Regression context (Phase 2 UX audit, 2026-06-11): every component
 * mounting useHealth fired its own GET /api/v1/health — 3+ identical
 * requests per page (detail panel + action hook + queue toolbar each
 * call it). The hook now dedupes through a module-level cache:
 *   - concurrent mounts share one in-flight request
 *   - later mounts reuse the cached payload (no refetch)
 *   - failures are NOT cached, so the next mount retries
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  healthApi: {
    get: vi.fn(),
  },
}));

import { healthApi } from "@/lib/api";
import { useHealth, __resetHealthCacheForTests } from "@/hooks/useHealth";

const FAKE_HEALTH = { allowed_intents: ["A"], lifecycle_states: ["S"] };
const getMock = healthApi.get as ReturnType<typeof vi.fn>;

describe("useHealth — module-level dedup", () => {
  beforeEach(() => {
    __resetHealthCacheForTests();
    getMock.mockReset();
  });

  it("two concurrent mounts share a single request", async () => {
    getMock.mockResolvedValue(FAKE_HEALTH);

    const a = renderHook(() => useHealth());
    const b = renderHook(() => useHealth());

    await waitFor(() => expect(a.result.current.loading).toBe(false));
    await waitFor(() => expect(b.result.current.loading).toBe(false));

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(a.result.current.health).toEqual(FAKE_HEALTH);
    expect(b.result.current.health).toEqual(FAKE_HEALTH);
  });

  it("a mount after resolution reuses the cache without refetching", async () => {
    getMock.mockResolvedValue(FAKE_HEALTH);

    const a = renderHook(() => useHealth());
    await waitFor(() => expect(a.result.current.loading).toBe(false));

    const b = renderHook(() => useHealth());
    // Cached value is available synchronously — no loading flash.
    expect(b.result.current.health).toEqual(FAKE_HEALTH);
    expect(b.result.current.loading).toBe(false);

    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
  });

  it("does not cache failures — the next mount retries", async () => {
    getMock.mockRejectedValueOnce(new Error("HTTP_503: unavailable"));

    const a = renderHook(() => useHealth());
    await waitFor(() => expect(a.result.current.error).toBe("HTTP_503: unavailable"));
    expect(a.result.current.health).toBeNull();

    getMock.mockResolvedValue(FAKE_HEALTH);
    const b = renderHook(() => useHealth());
    await waitFor(() => expect(b.result.current.health).toEqual(FAKE_HEALTH));
    expect(getMock).toHaveBeenCalledTimes(2);
  });
});
