/**
 * useViewMode tests — in-UI Legacy/Modern view preference.
 *
 * Verifies: env-seeded default (Modern since the 2026-06-11 default
 * flip; Legacy via the NEXT_PUBLIC_COCKPIT=0 escape hatch),
 * localStorage round-trip + persistence, corrupted-value rejection,
 * storage-failure resilience, and the provider-less fallback for
 * isolated component tests.
 *
 * The env default is exercised through `cockpitEnabled()`, which reads
 * `process.env.NEXT_PUBLIC_COCKPIT` — inlined at build by Next; in
 * vitest it reads live, so the escape hatch is testable via stubEnv.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { ViewModeProvider, useViewMode } from "@/hooks/useViewMode";

const STORAGE_KEY = "asoe.view-mode";

const wrapper = ({ children }: { children: ReactNode }) => (
  <ViewModeProvider>{children}</ViewModeProvider>
);

describe("useViewMode (within provider)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllEnvs();
  });

  it("defaults to Modern when no preference is stored (org-wide default)", () => {
    const { result } = renderHook(() => useViewMode(), { wrapper });
    expect(result.current.mode).toBe("modern");
    expect(result.current.defaultMode).toBe("modern");
  });

  it("NEXT_PUBLIC_COCKPIT=0 is the env escape hatch back to Legacy", () => {
    vi.stubEnv("NEXT_PUBLIC_COCKPIT", "0");
    const { result } = renderHook(() => useViewMode(), { wrapper });
    expect(result.current.mode).toBe("legacy");
    expect(result.current.defaultMode).toBe("legacy");
  });

  it("hydrates a stored Legacy preference after mount (user choice beats the default)", () => {
    window.localStorage.setItem(STORAGE_KEY, "legacy");
    const { result } = renderHook(() => useViewMode(), { wrapper });
    // The mount effect applies the stored override.
    expect(result.current.mode).toBe("legacy");
  });

  it("ignores a corrupted stored value and keeps the default", () => {
    window.localStorage.setItem(STORAGE_KEY, "spaceship");
    const { result } = renderHook(() => useViewMode(), { wrapper });
    expect(result.current.mode).toBe("modern");
  });

  it("persists a new choice to localStorage and re-renders", () => {
    const { result } = renderHook(() => useViewMode(), { wrapper });
    act(() => result.current.setMode("legacy"));
    expect(result.current.mode).toBe("legacy");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("legacy");
    act(() => result.current.setMode("modern"));
    expect(result.current.mode).toBe("modern");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("modern");
  });

  it("survives a storage write failure without throwing", () => {
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    try {
      const { result } = renderHook(() => useViewMode(), { wrapper });
      expect(() => act(() => result.current.setMode("legacy"))).not.toThrow();
      // The in-session choice still applies even when persistence fails.
      expect(result.current.mode).toBe("legacy");
    } finally {
      window.localStorage.setItem = original;
    }
  });
});

describe("useViewMode (no provider)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("falls back to the env default with no persistence", () => {
    // Isolated component tests mount pages/panels without the provider;
    // the hook must resolve to the env default, not crash.
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe("modern");
    expect(result.current.mounted).toBe(false);
    expect(() => result.current.setMode("legacy")).not.toThrow();
  });

  it("honors the escape hatch without a provider too", () => {
    vi.stubEnv("NEXT_PUBLIC_COCKPIT", "0");
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe("legacy");
  });
});
