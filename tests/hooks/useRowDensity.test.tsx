/**
 * useRowDensity tests — ADR-041 P3e §2.4.
 *
 * Verifies SSR-safe initial render and localStorage round-trip.
 * Mirrors the pattern in `useSavedViews.ts`.
 */
import { act, renderHook } from "@testing-library/react";

import { useRowDensity } from "@/hooks/useRowDensity";

const STORAGE_KEY = "asoe.cases.rowDensity";

describe("useRowDensity", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns the default on first render (no persisted value)", () => {
    const { result } = renderHook(() => useRowDensity());
    expect(result.current[0]).toBe("comfortable");
  });

  it("hydrates from localStorage on mount", () => {
    window.localStorage.setItem(STORAGE_KEY, "compact");
    const { result } = renderHook(() => useRowDensity());
    expect(result.current[0]).toBe("compact");
  });

  it("ignores corrupted values and keeps the default", () => {
    window.localStorage.setItem(STORAGE_KEY, "wide-screen");
    const { result } = renderHook(() => useRowDensity());
    expect(result.current[0]).toBe("comfortable");
  });

  it("persists to localStorage when updated", () => {
    const { result } = renderHook(() => useRowDensity());
    act(() => {
      result.current[1]("compact");
    });
    expect(result.current[0]).toBe("compact");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("compact");
  });

  it("survives a storage failure without throwing", () => {
    const setItem = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    try {
      const { result } = renderHook(() => useRowDensity());
      expect(() =>
        act(() => {
          result.current[1]("compact");
        }),
      ).not.toThrow();
      expect(result.current[0]).toBe("compact");
    } finally {
      window.localStorage.setItem = setItem;
    }
  });
});
