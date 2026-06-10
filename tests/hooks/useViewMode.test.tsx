/**
 * useViewMode tests — in-UI Legacy/Modern view preference.
 *
 * Verifies: env-seeded default (Legacy when NEXT_PUBLIC_COCKPIT is
 * unset), localStorage round-trip + persistence, corrupted-value
 * rejection, storage-failure resilience, and the provider-less fallback
 * that keeps isolated component tests rendering the classic layout.
 *
 * The env default is exercised through `cockpitEnabled()`, which reads
 * `process.env.NEXT_PUBLIC_COCKPIT` — inlined at build by Next, so here
 * (no flag set) the seed is Legacy.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import { ViewModeProvider, useViewMode } from "@/hooks/useViewMode";

const STORAGE_KEY = "asoe.view-mode";

const wrapper = ({ children }: { children: ReactNode }) => (
  <ViewModeProvider>{children}</ViewModeProvider>
);

describe("useViewMode (within provider)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("defaults to Legacy when no preference is stored (env flag off)", () => {
    const { result } = renderHook(() => useViewMode(), { wrapper });
    expect(result.current.mode).toBe("legacy");
    expect(result.current.defaultMode).toBe("legacy");
  });

  it("hydrates a stored Modern preference after mount", () => {
    window.localStorage.setItem(STORAGE_KEY, "modern");
    const { result } = renderHook(() => useViewMode(), { wrapper });
    // The mount effect applies the stored override.
    expect(result.current.mode).toBe("modern");
  });

  it("ignores a corrupted stored value and keeps the default", () => {
    window.localStorage.setItem(STORAGE_KEY, "spaceship");
    const { result } = renderHook(() => useViewMode(), { wrapper });
    expect(result.current.mode).toBe("legacy");
  });

  it("persists a new choice to localStorage and re-renders", () => {
    const { result } = renderHook(() => useViewMode(), { wrapper });
    act(() => result.current.setMode("modern"));
    expect(result.current.mode).toBe("modern");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("modern");
    act(() => result.current.setMode("legacy"));
    expect(result.current.mode).toBe("legacy");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("legacy");
  });

  it("survives a storage write failure without throwing", () => {
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    try {
      const { result } = renderHook(() => useViewMode(), { wrapper });
      expect(() => act(() => result.current.setMode("modern"))).not.toThrow();
      // The in-session choice still applies even when persistence fails.
      expect(result.current.mode).toBe("modern");
    } finally {
      window.localStorage.setItem = original;
    }
  });
});

describe("useViewMode (no provider)", () => {
  it("falls back to the env default with no persistence", () => {
    // Isolated component tests mount pages/panels without the provider;
    // the hook must resolve to the classic layout, not crash.
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe("legacy");
    expect(result.current.mounted).toBe(false);
    expect(() => result.current.setMode("modern")).not.toThrow();
  });
});
