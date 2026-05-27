/**
 * Saved-views storage — v2 (Phase 28.5.x §D4).
 *
 * v2 adds a `surface` discriminator so the legacy
 * `ExceptionListPane` queue (`surface: "exceptions"`) and the new
 * `CaseListPane` queue (`surface: "cases"`) can share the same
 * storage without their filter shapes colliding. v1 entries are
 * migrated one-shot on first read (every existing entry inherits
 * `surface: "exceptions"` because the legacy hook only served that
 * queue).
 *
 * The "My queue" default the workshop pre-read discussed is NOT
 * shipped as a built-in view — the operator's binding decision
 * (PO ruling) is opt-in: the operator pins their preferred
 * filter as a normal saved view named "My queue" on the first
 * click of "Save as default." No auto-apply.
 *
 * Storage shape (v2): a JSON array of `SavedView` records
 * discriminated by `surface`. Reads tolerate corruption (garbage /
 * wrong shape → empty list, no throw) and missing optional fields.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

import type { Origin } from "@/types/cases";

const STORAGE_KEY = "asoe-ui:saved-views:v2";
const LEGACY_STORAGE_KEY = "asoe-ui:saved-views:v1";

/** The two surfaces with saved-view support. */
export type SavedViewSurface = "exceptions" | "cases";

export interface ExceptionSavedViewFilters {
  surface: "exceptions";
  filterStates: string[];
  filterIntents: string[];
  filterDate: "today" | null;
  searchQuery: string;
}

export interface CaseSavedViewFilters {
  surface: "cases";
  /** Multi-value case statuses (`CaseStatus` literals). */
  filterStatuses: string[];
  /** Multi-value child intents. */
  filterIntents: string[];
  /** Single-value origin filter (CUSTOMER | API). Replaces the
   *  pre-pivot `filterSource` field. */
  filterOrigin: Origin | null;
  /** Recency preset matching the backend's `since=` param. */
  filterSince: "today" | "24h" | "7d" | "30d" | null;
  searchQuery: string;
  sortMode: "sla" | "recent";
}

export type SavedViewFilters =
  | ExceptionSavedViewFilters
  | CaseSavedViewFilters;

export type SavedView = SavedViewFilters & {
  id: string;
  name: string;
  /** ISO 8601 — when the view was first saved. */
  createdAt: string;
  /** ISO 8601 — last time the view was renamed (rename UI ships
   *  in V5.1.2). */
  updatedAt: string;
};

/* ── Storage adapter (pure, no React) ─────────────────────────────── */

function readStorage(): SavedView[] {
  if (typeof window === "undefined") return [];
  // One-shot migration: drain v1 into the v2 store with
  // surface="exceptions" then delete v1.
  migrateLegacyOnce();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSavedView);
  } catch {
    return [];
  }
}

function writeStorage(views: SavedView[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    // QuotaExceededError or storage disabled — swallow.
  }
}

function migrateLegacyOnce(): void {
  // Idempotent: the migration removes the legacy key on success, so
  // re-running is a no-op.
  let legacy: unknown;
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;
    legacy = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(legacy) || legacy.length === 0) {
    try { window.localStorage.removeItem(LEGACY_STORAGE_KEY); } catch {}
    return;
  }
  // Whatever v2 already has stays first — newer entries take
  // precedence over the migration.
  let existing: SavedView[] = [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) existing = parsed.filter(isValidSavedView);
    }
  } catch {}
  const migrated: SavedView[] = legacy
    .map((entry) => migrateLegacyEntry(entry))
    .filter((v): v is SavedView => v !== null);
  writeStorage([...existing, ...migrated]);
  try { window.localStorage.removeItem(LEGACY_STORAGE_KEY); } catch {}
}

function migrateLegacyEntry(v: unknown): SavedView | null {
  if (typeof v !== "object" || v === null) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  const migrated: ExceptionSavedViewFilters & {
    id: string; name: string; createdAt: string; updatedAt: string;
  } = {
    id: r.id,
    name: r.name,
    surface: "exceptions",
    filterStates: Array.isArray(r.filterStates)
      ? r.filterStates.filter((s) => typeof s === "string") as string[]
      : [],
    filterIntents: Array.isArray(r.filterIntents)
      ? r.filterIntents.filter((s) => typeof s === "string") as string[]
      : [],
    filterDate: r.filterDate === "today" ? "today" : null,
    searchQuery: typeof r.searchQuery === "string" ? r.searchQuery : "",
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
  };
  return migrated;
}

function isValidSavedView(v: unknown): v is SavedView {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return false;
  if (typeof r.createdAt !== "string" || typeof r.updatedAt !== "string") return false;
  if (r.surface === "exceptions") {
    return (
      Array.isArray(r.filterStates) &&
      (r.filterStates as unknown[]).every((s) => typeof s === "string") &&
      Array.isArray(r.filterIntents) &&
      (r.filterIntents as unknown[]).every((s) => typeof s === "string") &&
      (r.filterDate === null || r.filterDate === "today") &&
      typeof r.searchQuery === "string"
    );
  }
  if (r.surface === "cases") {
    return (
      Array.isArray(r.filterStatuses) &&
      (r.filterStatuses as unknown[]).every((s) => typeof s === "string") &&
      Array.isArray(r.filterIntents) &&
      (r.filterIntents as unknown[]).every((s) => typeof s === "string") &&
      (r.filterOrigin === null
        || r.filterOrigin === "CUSTOMER"
        || r.filterOrigin === "API") &&
      (r.filterSince === null
        || r.filterSince === "today"
        || r.filterSince === "24h"
        || r.filterSince === "7d"
        || r.filterSince === "30d") &&
      typeof r.searchQuery === "string" &&
      (r.sortMode === "sla" || r.sortMode === "recent")
    );
  }
  return false;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ── Hook ─────────────────────────────────────────────────────────── */

export interface UseSavedViewsApi {
  /** Hydrated list of saved views for the requested surface,
   *  sorted most-recently-created first. */
  views: SavedView[];
  /** Persist a new view from the current filter state.
   *  Filters carry the `surface` discriminator so the hook stores
   *  them on the correct surface. */
  save: (name: string, filters: SavedViewFilters) => SavedView;
  remove: (id: string) => void;
  /** V5.1.2 — rename a saved view by id. Empty / whitespace
   *  `newName` is a no-op (the consumer's prompt UI already
   *  filters those out). `updatedAt` is bumped to the current
   *  ISO timestamp. */
  rename: (id: string, newName: string) => void;
  hydrated: boolean;
}

/**
 * Pass `surface` to scope the returned `views` array to one queue.
 * Defaults to `"exceptions"` so legacy callers (the old
 * ExceptionListPane) work without changes.
 */
export function useSavedViews(
  surface: SavedViewSurface = "exceptions",
): UseSavedViewsApi {
  const [allViews, setAllViews] = useState<SavedView[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAllViews(readStorage());
    setHydrated(true);
  }, []);

  const save = useCallback(
    (name: string, filters: SavedViewFilters): SavedView => {
      const trimmed = name.trim() || `View ${new Date().toLocaleString()}`;
      const now = new Date().toISOString();
      const next: SavedView = {
        ...filters,
        id: newId(),
        name: trimmed,
        createdAt: now,
        updatedAt: now,
      };
      setAllViews((prev) => {
        const updated = [next, ...prev];
        writeStorage(updated);
        return updated;
      });
      return next;
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setAllViews((prev) => {
      const updated = prev.filter((v) => v.id !== id);
      if (updated.length === prev.length) return prev;
      writeStorage(updated);
      return updated;
    });
  }, []);

  const rename = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return; // No-op on empty input.
    setAllViews((prev) => {
      const idx = prev.findIndex((v) => v.id === id);
      if (idx === -1) return prev;
      const now = new Date().toISOString();
      const updated = [...prev];
      updated[idx] = { ...prev[idx], name: trimmed, updatedAt: now };
      writeStorage(updated);
      return updated;
    });
  }, []);

  const views = allViews.filter((v) => v.surface === surface);
  return { views, save, remove, rename, hydrated };
}
