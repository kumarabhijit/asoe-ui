/**
 * Unit tests for `src/hooks/useSavedViews.ts` (v2 — Phase 28.5.x §D4).
 *
 * Covers:
 *   * Storage adapter (round-trip, corruption tolerance, delete,
 *     ordering)
 *   * React hook surface (hydration, save, remove)
 *   * Surface discriminator (`useSavedViews("cases")` vs default
 *     `"exceptions"`)
 *   * v1 → v2 migration on first read
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  useSavedViews,
  type CaseSavedViewFilters,
  type ExceptionSavedViewFilters,
} from "@/hooks/useSavedViews";

const STORAGE_KEY = "asoe-ui:saved-views:v2";
const LEGACY_KEY = "asoe-ui:saved-views:v1";

const exceptionFilters: ExceptionSavedViewFilters = {
  surface: "exceptions",
  filterStates: ["PENDING_REVIEW"],
  filterIntents: ["DUPLICATE_PO"],
  filterDate: "today",
  searchQuery: "account:walmart",
};

const caseFilters: CaseSavedViewFilters = {
  surface: "cases",
  filterStatuses: ["OPEN_AWAITING_HUMAN"],
  filterIntents: ["CONTRACTUAL_CORRECTION"],
  filterSource: "manual_order",
  filterSince: "7d",
  searchQuery: "po:KRO",
  sortMode: "sla",
};

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});


describe("useSavedViews — hydration + surface scope", () => {
  it("starts empty and reports hydrated=true after mount", async () => {
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    expect(result.current.hydrated).toBe(true);
    expect(result.current.views).toEqual([]);
  });

  it("scopes returned views to the requested surface", async () => {
    const ex = renderHook(() => useSavedViews("exceptions"));
    const cs = renderHook(() => useSavedViews("cases"));
    await act(async () => {});

    act(() => {
      ex.result.current.save("Exception view", exceptionFilters);
      cs.result.current.save("Case view", caseFilters);
    });
    expect(ex.result.current.views.map((v) => v.name)).toEqual(["Exception view"]);
    expect(cs.result.current.views.map((v) => v.name)).toEqual(["Case view"]);
  });

  it("tolerates corrupt JSON without throwing", async () => {
    window.localStorage.setItem(STORAGE_KEY, "not-json{{{");
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    expect(result.current.views).toEqual([]);
  });

  it("drops invalid entries during hydration", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "good", name: "OK",
          surface: "exceptions",
          filterStates: [], filterIntents: [],
          filterDate: null, searchQuery: "",
          createdAt: "x", updatedAt: "x",
        },
        { totally: "bogus" },
      ]),
    );
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    expect(result.current.views).toHaveLength(1);
    expect(result.current.views[0].name).toBe("OK");
  });
});


describe("useSavedViews — save / remove", () => {
  it("save() prepends a new view and persists it", async () => {
    const { result } = renderHook(() => useSavedViews("exceptions"));
    await act(async () => {});
    let created;
    act(() => {
      created = result.current.save("Walmart HITL", exceptionFilters);
    });
    expect(created).toBeDefined();
    expect(result.current.views).toHaveLength(1);
    expect(result.current.views[0].name).toBe("Walmart HITL");
    expect(result.current.views[0].surface).toBe("exceptions");
    if (result.current.views[0].surface === "exceptions") {
      expect(result.current.views[0].filterStates).toEqual(["PENDING_REVIEW"]);
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toContain("Walmart HITL");
  });

  it("save() with an empty / whitespace name auto-generates a fallback name", async () => {
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    let created: { name: string } | undefined;
    act(() => {
      created = result.current.save("   ", exceptionFilters);
    });
    expect(created!.name).toMatch(/View /);
  });

  it("save() prepends so the most recent view is first in the list", async () => {
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    act(() => {
      result.current.save("First", exceptionFilters);
    });
    act(() => {
      result.current.save("Second", exceptionFilters);
    });
    expect(result.current.views.map((v) => v.name)).toEqual(["Second", "First"]);
  });

  it("save() accepts a case-surface filter and stores it verbatim", async () => {
    const { result } = renderHook(() => useSavedViews("cases"));
    await act(async () => {});
    act(() => {
      result.current.save("My queue", caseFilters);
    });
    const view = result.current.views[0];
    expect(view.surface).toBe("cases");
    if (view.surface === "cases") {
      expect(view.filterStatuses).toEqual(["OPEN_AWAITING_HUMAN"]);
      expect(view.filterSource).toBe("manual_order");
      expect(view.filterSince).toBe("7d");
      expect(view.sortMode).toBe("sla");
    }
  });

  it("remove() drops the entry and persists the update", async () => {
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    let id = "";
    act(() => {
      id = result.current.save("Doomed", exceptionFilters).id;
    });
    expect(result.current.views).toHaveLength(1);

    act(() => {
      result.current.remove(id);
    });
    expect(result.current.views).toEqual([]);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("[]");
  });

  it("remove() on an unknown id is a no-op (no rewrite)", async () => {
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    act(() => {
      result.current.save("Keep", exceptionFilters);
    });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    act(() => {
      result.current.remove("nonexistent-id");
    });
    // Storage is untouched.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
});


describe("useSavedViews — v1 → v2 migration", () => {
  it("hydration moves legacy entries to v2 under surface=exceptions and deletes the legacy key", async () => {
    window.localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([
        {
          id: "legacy-1", name: "Legacy view",
          filterStates: ["PENDING_REVIEW"], filterIntents: ["DUPLICATE_PO"],
          filterDate: "today", searchQuery: "",
          createdAt: "2026-04-01T00:00:00Z",
          updatedAt: "2026-04-01T00:00:00Z",
        },
      ]),
    );
    const { result } = renderHook(() => useSavedViews("exceptions"));
    await act(async () => {});

    expect(result.current.views).toHaveLength(1);
    expect(result.current.views[0].id).toBe("legacy-1");
    expect(result.current.views[0].surface).toBe("exceptions");
    // Legacy key has been drained.
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
    // v2 key carries the migrated entry.
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toContain("legacy-1");
  });

  it("migration is idempotent — second hydrate doesn't duplicate", async () => {
    window.localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([
        {
          id: "legacy-2", name: "L2",
          filterStates: [], filterIntents: [],
          filterDate: null, searchQuery: "",
          createdAt: "x", updatedAt: "x",
        },
      ]),
    );
    const { result, rerender } = renderHook(() => useSavedViews());
    await act(async () => {});
    expect(result.current.views).toHaveLength(1);

    rerender();
    await act(async () => {});
    expect(result.current.views).toHaveLength(1);
  });
});


describe("useSavedViews — rename (V5.1.2)", () => {
  it("rename() updates the name and bumps updatedAt", async () => {
    const { result } = renderHook(() => useSavedViews("exceptions"));
    await act(async () => {});
    let id = "";
    let originalUpdatedAt = "";
    act(() => {
      const created = result.current.save("Old name", exceptionFilters);
      id = created.id;
      originalUpdatedAt = created.updatedAt;
    });
    // Sleep 5ms so the new updatedAt is strictly greater.
    await new Promise((r) => setTimeout(r, 5));
    act(() => {
      result.current.rename(id, "New name");
    });
    expect(result.current.views[0].name).toBe("New name");
    expect(result.current.views[0].updatedAt).not.toBe(originalUpdatedAt);
    // Persisted to storage.
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toContain("New name");
    expect(raw).not.toContain("Old name");
  });

  it("rename() with empty / whitespace name is a no-op", async () => {
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    let id = "";
    act(() => {
      id = result.current.save("Keep", exceptionFilters).id;
    });
    act(() => { result.current.rename(id, "   "); });
    expect(result.current.views[0].name).toBe("Keep");
  });

  it("rename() on an unknown id is a no-op", async () => {
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    act(() => { result.current.save("Untouched", exceptionFilters); });
    const before = window.localStorage.getItem(STORAGE_KEY);
    act(() => { result.current.rename("bogus-id", "Whatever"); });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  it("rename() trims surrounding whitespace from the new name", async () => {
    const { result } = renderHook(() => useSavedViews());
    await act(async () => {});
    let id = "";
    act(() => {
      id = result.current.save("Orig", exceptionFilters).id;
    });
    act(() => { result.current.rename(id, "  Padded  "); });
    expect(result.current.views[0].name).toBe("Padded");
  });
});
