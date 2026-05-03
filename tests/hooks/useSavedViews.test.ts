/**
 * Unit tests for `src/hooks/useSavedViews.ts`.
 *
 * Covers the storage adapter directly (round-trip, corruption tolerance,
 * delete, ordering) and the React hook surface (hydration, save,
 * remove). Uses vitest's `act` from @testing-library/react to step
 * through the useEffect-driven hydrate.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSavedViews } from "@/hooks/useSavedViews";

const STORAGE_KEY = "asoe-ui:saved-views:v1";

const baseFilters = {
  filterStates: ["PENDING_REVIEW"],
  filterIntents: ["DUPLICATE_PO"],
  filterDate: "today" as const,
  searchQuery: "account:walmart",
};

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

describe("useSavedViews — hydration", () => {
  it("starts empty and reports hydrated=true after mount", async () => {
    const { result } = renderHook(() => useSavedViews());
    // After the first effect runs, hydrated flips and views reflects storage.
    await act(async () => {});
    expect(result.current.hydrated).toBe(true);
    expect(result.current.views).toEqual([]);
  });

  it("loads pre-existing views from localStorage on mount", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "v-1",
          name: "Walmart HITL",
          filterStates: ["PENDING_REVIEW"],
          filterIntents: [],
          filterDate: null,
          searchQuery: "account:walmart",
          createdAt: "2026-04-01T12:00:00Z",
          updatedAt: "2026-04-01T12:00:00Z",
        },
      ]),
    );
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    expect(result.current.views).toHaveLength(1);
    expect(result.current.views[0].name).toBe("Walmart HITL");
  });

  it("tolerates corrupt localStorage (returns empty, never throws)", async () => {
    window.localStorage.setItem(STORAGE_KEY, "not-json{{{");
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    expect(result.current.views).toEqual([]);
  });

  it("filters out entries with the wrong shape", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "good", name: "OK", filterStates: [], filterIntents: [], filterDate: null, searchQuery: "", createdAt: "x", updatedAt: "x" },
        { id: "bad", name: 42 /* wrong type */ },
        "string-not-object",
      ]),
    );
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    expect(result.current.views.map((v) => v.id)).toEqual(["good"]);
  });
});

describe("useSavedViews — save / remove", () => {
  it("save() prepends a new view and persists it", async () => {
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});

    let created: { id: string; name: string } | undefined;
    act(() => {
      created = result.current.save("Walmart HITL", baseFilters);
    });
    expect(created?.name).toBe("Walmart HITL");
    expect(result.current.views).toHaveLength(1);
    expect(result.current.views[0].name).toBe("Walmart HITL");
    expect(result.current.views[0].filterStates).toEqual(["PENDING_REVIEW"]);

    // Persisted to storage with the same shape.
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].name).toBe("Walmart HITL");
  });

  it("save() with an empty / whitespace name auto-generates a fallback name", async () => {
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    let created: { name: string } | undefined;
    act(() => {
      created = result.current.save("   ", baseFilters);
    });
    expect(created?.name).toMatch(/^View /);
  });

  it("save() prepends so the most recent view is first in the list", async () => {
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    act(() => {
      result.current.save("First", baseFilters);
    });
    act(() => {
      result.current.save("Second", baseFilters);
    });
    expect(result.current.views.map((v) => v.name)).toEqual(["Second", "First"]);
  });

  it("save() takes a defensive copy of the filter arrays", async () => {
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    const filters = { ...baseFilters, filterStates: ["PENDING_REVIEW"] };
    act(() => {
      result.current.save("X", filters);
    });
    // Mutating the caller's array must not leak into the saved view.
    filters.filterStates.push("BLOCKED");
    expect(result.current.views[0].filterStates).toEqual(["PENDING_REVIEW"]);
  });

  it("remove() deletes the matching view and persists", async () => {
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    let id = "";
    act(() => {
      id = result.current.save("Doomed", baseFilters).id;
    });
    expect(result.current.views).toHaveLength(1);

    act(() => {
      result.current.remove(id);
    });
    expect(result.current.views).toEqual([]);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("[]");
  });

  it("remove() is a no-op for an unknown id", async () => {
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    act(() => {
      result.current.save("Keep", baseFilters);
    });
    const before = result.current.views;
    act(() => {
      result.current.remove("nonexistent");
    });
    expect(result.current.views).toBe(before);
  });
});
