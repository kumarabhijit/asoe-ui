/**
 * Saved-views storage for the Exception Queue list pane.
 *
 * A "view" is a snapshot of the four list-pane filter dimensions —
 * lifecycle states, intents, the today-pill, and the search-box query
 * — that the operator wants to recall in one click. Stored in
 * `localStorage` under a versioned key so a future schema change
 * (e.g. adding a date-range filter) has a clean migration point: just
 * bump the key suffix.
 *
 * Slice-3 scope (PO ruling 2026-05-03): client-side only. No server
 * round-trip, no per-tenant scoping, no shareable URLs (the URL search-
 * params already give that for ad-hoc views — saved views are for
 * personal recurring queries). When a user-preferences API ships,
 * `useSavedViews` is the natural seam to swap the localStorage adapter
 * for a server-backed one without touching the UI.
 *
 * Storage shape: a JSON array of `SavedView` records. Reads tolerate
 * corruption (garbage / wrong shape → empty list, no throw) so a
 * stale browser entry never bricks the queue.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

/** Bumped when the persisted shape changes incompatibly. */
const STORAGE_KEY = "asoe-ui:saved-views:v1";

export interface SavedViewFilters {
  filterStates: string[];
  filterIntents: string[];
  filterDate: "today" | null;
  searchQuery: string;
}

export interface SavedView extends SavedViewFilters {
  id: string;
  name: string;
  /** ISO 8601 — when the view was first saved. */
  createdAt: string;
  /** ISO 8601 — last time the view was renamed (rename arrives in a
   *  follow-up; for now this matches `createdAt`). */
  updatedAt: string;
}

/* ── Storage adapter (pure, no React) ─────────────────────────────── */

function readStorage(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSavedView);
  } catch {
    // Corrupt JSON, quota error on read, or localStorage disabled.
    // Treat as empty — never bubble up to the consumer.
    return [];
  }
}

function writeStorage(views: SavedView[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    // QuotaExceededError or storage disabled. Swallow — the in-memory
    // state still updates so the user sees their change in this tab;
    // it just won't survive a reload. A toast would be friendlier and
    // is on the backlog.
  }
}

function isValidSavedView(v: unknown): v is SavedView {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.name === "string" &&
    Array.isArray(r.filterStates) &&
    r.filterStates.every((s) => typeof s === "string") &&
    Array.isArray(r.filterIntents) &&
    r.filterIntents.every((s) => typeof s === "string") &&
    (r.filterDate === null || r.filterDate === "today") &&
    typeof r.searchQuery === "string" &&
    typeof r.createdAt === "string" &&
    typeof r.updatedAt === "string"
  );
}

/** Stable, no-collision id generator. Falls back to a timestamp +
 *  random suffix when `crypto.randomUUID` is missing (older Edge,
 *  some test environments). */
function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ── Hook ─────────────────────────────────────────────────────────── */

export interface UseSavedViewsApi {
  /** Hydrated list of saved views, sorted by most-recently-created
   *  first so the menu shows the latest at the top. */
  views: SavedView[];
  /** Persist a new view from the current filter state. Returns the
   *  created record so callers can show toast / focus the new entry. */
  save: (name: string, filters: SavedViewFilters) => SavedView;
  /** Remove a view by id. No-op if the id isn't found. */
  remove: (id: string) => void;
  /** True after the first hydrate from localStorage — useful for
   *  callers that want to suppress an empty-state flash on mount. */
  hydrated: boolean;
}

export function useSavedViews(): UseSavedViewsApi {
  // SSR: start with [] so the server-rendered HTML matches; hydrate
  // from localStorage in an effect on the client.
  const [views, setViews] = useState<SavedView[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setViews(readStorage());
    setHydrated(true);
  }, []);

  const save = useCallback(
    (name: string, filters: SavedViewFilters): SavedView => {
      const trimmed = name.trim() || `View ${new Date().toLocaleString()}`;
      const now = new Date().toISOString();
      const next: SavedView = {
        id: newId(),
        name: trimmed,
        filterStates: [...filters.filterStates],
        filterIntents: [...filters.filterIntents],
        filterDate: filters.filterDate,
        searchQuery: filters.searchQuery,
        createdAt: now,
        updatedAt: now,
      };
      setViews((prev) => {
        // Prepend so the freshly-saved view is first in the menu.
        const updated = [next, ...prev];
        writeStorage(updated);
        return updated;
      });
      return next;
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setViews((prev) => {
      const updated = prev.filter((v) => v.id !== id);
      // Return the prior reference if nothing changed — React then
      // bails on the re-render and we avoid a useless localStorage
      // write on an unknown id.
      if (updated.length === prev.length) return prev;
      writeStorage(updated);
      return updated;
    });
  }, []);

  return { views, save, remove, hydrated };
}
