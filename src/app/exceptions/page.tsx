/**
 * Exception Queue — Three-pane "Outlook" layout (Master-Detail pattern).
 *
 * Architecture:
 *   Top Rail      — NavBar (56px sticky, existing global nav)
 *   Middle Pane   — Scrollable exception list with search/filters
 *   Right Pane    — Exception detail panel (sections A-D)
 *
 * State management:
 *   selectedExceptionId is lifted to this parent layout.
 *   Selecting a card in the Middle Pane updates the Right Pane
 *   without a full page reload.
 *
 * Data fetching:
 *   First item is auto-selected and pre-fetched on initial load.
 *   Subsequent selections trigger on-demand fetching in the detail pane.
 *
 * Filter values sourced from health endpoint per Guardrail #2.
 */
"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Inbox } from "lucide-react";
import { NavBar } from "@/components/ui/NavBar";
import { useHealth } from "@/hooks/useHealth";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { exceptionsApi } from "@/lib/api";
import type { ExceptionSummary } from "@/types/exceptions";
import type { StatsResponse } from "@/types/api";
import type { WSEvent } from "@/types/websocket";
import ExceptionListPane from "./ExceptionListPane";
import ExceptionDetailPanel from "./ExceptionDetailPanel";
import { matchExceptions, parseQuery } from "./searchParser";

/** Decode a comma-separated URL param into a deduped array of
 *  non-empty values. `null` / empty string → []. Used for the
 *  state[] and intent[] filter URL params. */
function parseCsvParam(raw: string | null): string[] {
  if (!raw) return [];
  return Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean)));
}

const NAV_TABS = [
  { id: "inbox", label: "Customer Inbox", href: "/inbox" },
  { id: "exceptions", label: "Exception Queue", href: "/exceptions" },
  { id: "cases", label: "Cases", href: "/cases" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "settings", label: "Settings", href: "/settings" },
];

export default function ExceptionQueuePage() {
  return (
    <Suspense>
      <ExceptionQueueContent />
    </Suspense>
  );
}

function ExceptionQueueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { health } = useHealth();
  const { user, accessToken, visibleTabs } = useAuth();

  useEffect(() => { document.title = "Exception Queue — ASOE"; }, []);

  const userName = user?.name || "User";
  const userInitials = (user as { avatar_initials?: string })?.avatar_initials || userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const userTitle = (user as { title?: string })?.title || "";
  const filteredTabs = visibleTabs.length > 0
    ? NAV_TABS.filter((t) => visibleTabs.includes(t.id))
    : NAV_TABS;

  /* ── List state ──────────────────────────────────────────────────── */
  const [exceptions, setExceptions] = useState<ExceptionSummary[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Lifted selection state ──────────────────────────────────────── */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* ── Filters (initialized from URL params) ───────────────────────── */
  // Multi-value filters arrive as comma-separated lists in the URL
  // (`?state=PENDING_REVIEW,ESCALATED&intent=DUPLICATE_PO,EDI_MISMATCH`).
  // The `filterDate` quick-filter is a single-value preset today
  // ("today" or null); the multi-select chip bar handles state/intent
  // arrays.
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [filterStates, setFilterStates] = useState<string[]>(
    parseCsvParam(searchParams.get("state")),
  );
  const [filterIntents, setFilterIntents] = useState<string[]>(
    parseCsvParam(searchParams.get("intent")),
  );
  const [filterDate, setFilterDate] = useState<"today" | null>(
    searchParams.get("date") === "today" ? "today" : null,
  );

  /* ── Sync filters to URL ─────────────────────────────────────────── */
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterStates.length > 0) params.set("state", filterStates.join(","));
    if (filterIntents.length > 0) params.set("intent", filterIntents.join(","));
    if (filterDate) params.set("date", filterDate);
    if (searchQuery) params.set("q", searchQuery);
    const qs = params.toString();
    const url = qs ? `/exceptions?${qs}` : "/exceptions";
    router.replace(url, { scroll: false });
  }, [filterStates, filterIntents, filterDate, searchQuery, router]);

  const hasActiveFilters =
    filterStates.length > 0 ||
    filterIntents.length > 0 ||
    filterDate !== null ||
    !!searchQuery;

  function clearAllFilters() {
    setFilterStates([]);
    setFilterIntents([]);
    setFilterDate(null);
    setSearchQuery("");
  }

  // Apply a saved view (Slice 3) — replaces all four filter dimensions
  // in one render so the URL sync effect runs once. The cast below is
  // safe: SavedView mirrors the four state slots exactly. We accept the
  // shape inline rather than importing the type to keep page.tsx free
  // of an extra hook-only dependency.
  function applySavedView(view: {
    filterStates: string[];
    filterIntents: string[];
    filterDate: "today" | null;
    searchQuery: string;
  }) {
    setFilterStates(view.filterStates);
    setFilterIntents(view.filterIntents);
    setFilterDate(view.filterDate);
    setSearchQuery(view.searchQuery);
  }

  /* ── Data fetching ───────────────────────────────────────────────── */
  //
  // `silent: true` is used by the WebSocket event handler so an
  // exception_update / task_complete event refreshes the list without
  // flashing the loading spinner — the user's scroll position and any
  // hover state are preserved. The initial mount + filter changes
  // pass silent=false so the first paint shows a proper loading
  // indicator.
  //
  // We follow the cursor pagination contract on every refresh until
  // `has_more === false`. Mock mode short-circuits with has_more=false
  // on page 1, so the loop is a no-op there. Live mode currently
  // returns ~10 rows in a single page (limit=50 default), so the loop
  // is also short — but if the row count grows past one page, this is
  // what makes the queue render the full result set instead of just
  // the first page.
  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const allRows: ExceptionSummary[] = [];
      let cursor: string | undefined = undefined;
      let safety = 0;
      do {
        // Multi-value filters are applied client-side (see the
        // `filtered` block below). The API accepts only a single
        // status/intent today; passing a single value when several are
        // selected would silently drop the others. Fetching unfiltered
        // and filtering in the page keeps the UX consistent and is
        // cheap given the current row volume; if the production list
        // grows large enough that this matters, the API client should
        // be extended to accept arrays.
        const page = await exceptionsApi.list({ cursor });
        allRows.push(...page.data);
        cursor = page.has_more ? (page.cursor ?? undefined) : undefined;
        safety += 1;
        if (safety > 50) {
          // Defensive: never spin forever if the backend reports
          // has_more=true without advancing the cursor.
          console.warn("Pagination loop safety triggered after 50 pages");
          break;
        }
      } while (cursor);

      const statsRes = await exceptionsApi.stats();
      setExceptions(allRows);
      setStats(statsRes);
    } catch (err) {
      console.error("Failed to fetch exceptions:", err);
      if (!silent) {
        setError("Failed to load exceptions. Check your connection and try again.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Auto-select first item for pre-fetching ─────────────────────── */
  useEffect(() => {
    if (exceptions.length > 0 && !selectedId) {
      setSelectedId(exceptions[0].id);
    }
  }, [exceptions, selectedId]);

  /* ── WebSocket — real-time pipeline updates ──────────────────────── */
  const detailRefreshRef = useRef<(() => void) | null>(null);
  // Tracks whether a reanalysis is mid-flight for the currently-viewed
  // exception. Cleared on task_complete. Passed to the detail panel so it
  // can show a live "Re-running…" banner while pipeline events stream in.
  const [reanalyzing, setReanalyzing] = useState<{
    exceptionId: string;
    attempt: number;
    reason: string;
    triggeredBy: string;
  } | null>(null);

  const handleWsEvent = useCallback((event: WSEvent) => {
    if (event.type === "pipeline_progress") {
      // Pipeline progress for currently viewed exception — notify detail panel
      if (event.exception_id === selectedId) {
        detailRefreshRef.current?.();
      }
    } else if (event.type === "exception_update") {
      // Exception state changed — silently refresh list + detail if
      // viewing this exception. silent=true avoids flashing the
      // loading spinner / clearing the queue while the operator is
      // mid-scroll on every state transition.
      fetchData({ silent: true });
      if (event.exception_id === selectedId) {
        detailRefreshRef.current?.();
      }
    } else if (event.type === "task_complete") {
      // Task finished — silently refresh and clear any reanalysis banner.
      fetchData({ silent: true });
      if (event.exception_id === selectedId) {
        detailRefreshRef.current?.();
      }
      setReanalyzing((cur) => (cur?.exceptionId === event.exception_id ? null : cur));
    } else if (event.type === "reanalysis_started") {
      // Surface the re-running state for the currently viewed exception.
      const payload = event.payload as {
        attempt: number; triggered_by: string; reason: string;
      };
      if (event.exception_id === selectedId) {
        setReanalyzing({
          exceptionId: event.exception_id,
          attempt: payload.attempt,
          reason: payload.reason,
          triggeredBy: payload.triggered_by,
        });
      }
    }
  }, [selectedId, fetchData]);

  // After a WS reconnect, reconcile both the list and the currently-
  // viewed detail. Container Apps drops idle sockets at ~4 minutes; if
  // the operator was scrolling or reading a detail when the drop
  // happened, the page would otherwise keep showing pre-disconnect
  // data with no way to know it was stale. Silent refresh keeps the
  // scroll position; detail refresh re-runs the panel's GET.
  const handleWsReconnect = useCallback(() => {
    fetchData({ silent: true });
    detailRefreshRef.current?.();
  }, [fetchData]);

  useWebSocket({
    // Pass the real backend-issued JWT so the WebSocket auth message
    // (Section 8.1) carries a token the asoe2 ws_router can validate.
    // The previous "mock-ws-token" placeholder authenticated only
    // against the mock api; against the real backend the connection
    // would close immediately on receipt of the auth frame and the
    // exponential-backoff loop would reconnect-and-fail forever
    // without ever delivering an event. We still gate on user (not
    // accessToken) for the `enabled` flag so the hook waits for
    // session hydration on first paint instead of flashing a
    // disconnect+reconnect when accessToken arrives.
    token: accessToken,
    enabled: !!user && !!accessToken,
    onEvent: handleWsEvent,
    onReconnect: handleWsReconnect,
    // Section 8.4 polling fallback. When the WS has been unhealthy
    // long enough that the hook gives up on real-time, fall back to
    // refreshing the queue every ~5s so the operator's view doesn't
    // go stale. Same silent-refresh path as the WS event handlers
    // so the loading spinner doesn't flash. Auto-clears when WS
    // recovers.
    onPollFallback: handleWsReconnect,
  });

  /* ── Client-side filter pipeline (account scoping is server-side) ──
   * Order: chips/pill constraints first (state / intent / today), then
   * the search box. The search box runs through `searchParser` so the
   * operator can write `account:walmart since:7d 1042` and have it
   * decomposed into operator predicates + a Fuse.js fuzzy free-term
   * match. Operators AND with the multi-select chips — the operator
   * may use either, and the result is the intersection. */
  const todayStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const chipFiltered = exceptions.filter((exc) => {
    if (filterStates.length > 0 && !filterStates.includes(exc.lifecycle_state)) {
      return false;
    }
    if (filterIntents.length > 0 && !filterIntents.includes(exc.intent ?? "")) {
      return false;
    }
    if (filterDate === "today") {
      const t = Date.parse(exc.updated_at ?? exc.created_at);
      if (Number.isNaN(t) || t < todayStart) return false;
    }
    return true;
  });
  const parsedQuery = parseQuery(searchQuery);
  const { matched: filtered, warnings: searchWarnings } = matchExceptions(
    chipFiltered,
    parsedQuery,
  );

  /* ── Recency sort (Outlook-style: most-recent first) ───────────────
   * Sort by `updated_at` desc, with `created_at` desc as tiebreaker so
   * the order is deterministic when two rows share an updated timestamp.
   * Pinning the sort here (not in the API client) keeps the list
   * stable across silent WebSocket refreshes. */
  const sorted = [...filtered].sort((a, b) => {
    const ua = Date.parse(a.updated_at ?? a.created_at);
    const ub = Date.parse(b.updated_at ?? b.created_at);
    if (ub !== ua) return ub - ua;
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });

  /* ── Arrow-key navigation (Outlook parity) ──────────────────────────
   * ArrowUp / ArrowDown move the selection through the (sorted +
   * filtered) list and open that exception in the detail pane via the
   * existing setSelectedId pipeline. Home / End jump to first / last
   * row. The handler binds at the document level so the keys work
   * whenever the page is focused — not only when a list card has focus
   * — matching Outlook inbox behaviour. We bail when the user is typing
   * in an input, select, or contenteditable so the search field,
   * filter selects, and the override-dialog textarea keep their native
   * key handling. Selecting an item also scrolls it into view. */
  useEffect(() => {
    function isTypingTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (t.isContentEditable) return true;
      // Don't hijack keys while a Radix popover / dialog is open.
      if (t.closest("[role='combobox'], [role='dialog']")) return true;
      return false;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (sorted.length === 0) return;
      if (isTypingTarget(e.target)) return;
      // Don't fire when modifier keys are held — those combinations
      // belong to the browser / OS (e.g. Cmd+ArrowUp = scroll to top).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = sorted.findIndex((x) => x.id === selectedId);
      let next = idx;
      switch (e.key) {
        case "ArrowDown":
        case "j":
          next = idx < 0 ? 0 : Math.min(idx + 1, sorted.length - 1);
          break;
        case "ArrowUp":
        case "k":
          next = idx < 0 ? 0 : Math.max(idx - 1, 0);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = sorted.length - 1;
          break;
        default:
          return;
      }
      if (next !== idx) {
        e.preventDefault();
        const nextId = sorted[next].id;
        setSelectedId(nextId);
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLElement>(
            `[data-exception-id="${nextId}"]`,
          );
          el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          // Move DOM focus to the newly-selected card so the
          // :focus-visible outline (globals.css:56-58) follows the
          // selection. Without this the previously-clicked card
          // retained focus and showed a 2px brand-coloured ring,
          // making it look like the first card was "still
          // highlighted" even though selection had moved on.
          // preventScroll avoids fighting the smooth scrollIntoView
          // we just queued above.
          el?.focus({ preventScroll: true });
        });
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sorted, selectedId]);

  /*
   * Zoom strategy:
   *   At normal zoom the page fills exactly the viewport (no scroll).
   *   When zoomed in, 100vh shrinks in CSS pixels but the min-height
   *   of 576px keeps the panel area usable.  Because the combined
   *   height (nav + panels) then exceeds 100vh, the browser shows a
   *   native page-level scrollbar — the same behaviour as /inbox.
   *   The nav-height token keeps the calc() in sync with NavBar.
   *
   *   react-resizable-panels sets touch-action: pan-y on Group/Panel
   *   elements via inline styles, which blocks trackpad pinch-to-zoom.
   *   The .panel-group-zoomable class in globals.css overrides this
   *   with "pan-x pan-y pinch-zoom !important" to restore zoom while
   *   preserving Separator drag.
   */

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="bg-surface-page font-sans min-h-screen">
      {/* ━━ Top Rail: Global Navigation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <NavBar
        tabs={filteredTabs}
        activeTab="exceptions"
        onTabChange={(id) => {
          const tab = NAV_TABS.find((t) => t.id === id);
          if (tab?.href) router.push(tab.href);
        }}
        userName={userName}
        userInitials={userInitials}
        userTitle={userTitle}
        agentCount={health?.allowed_intents?.length || 0}
        onSignOut={() => signOut({ callbackUrl: "/login" })}

      />

      {/* ━━ Two-pane Master-Detail Area ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <main id="main-content" className="h-[calc(100vh-var(--nav-height))] min-h-[576px]">
        <Group orientation="horizontal" id="exception-queue-panels" className="panel-group-zoomable h-full">

          {/* ── Middle Pane: Exception List ──────────────────────────── */}
          <Panel defaultSize="35%" minSize="22%" maxSize="50%" id="list-pane">
            <ExceptionListPane
              exceptions={sorted}
              stats={stats}
              loading={loading}
              error={error}
              selectedId={selectedId}
              onSelect={setSelectedId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filterStates={filterStates}
              onFilterStatesChange={setFilterStates}
              filterIntents={filterIntents}
              onFilterIntentsChange={setFilterIntents}
              filterDate={filterDate}
              onFilterDateChange={setFilterDate}
              parsedSearchOperators={parsedQuery.operators}
              searchWarnings={searchWarnings}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearAllFilters}
              onApplySavedView={applySavedView}
              health={health}
              onRefresh={fetchData}
            />
          </Panel>

          {/* ── Resize Handle ────────────────────────────────────────── */}
          <Separator className="w-[var(--pane-handle-width)] bg-border cursor-col-resize transition-colors duration-fast shrink-0 touch-none" />

          {/* ── Right Pane: Exception Detail ─────────────────────────── */}
          <Panel minSize="45%" id="detail-pane">
            {selectedId ? (
              <ExceptionDetailPanel
                key={selectedId}
                exceptionId={selectedId}
                onActionComplete={fetchData}
                onRefreshRef={detailRefreshRef}
                reanalyzing={
                  reanalyzing?.exceptionId === selectedId ? reanalyzing : null
                }
              />
            ) : (
              <EmptyDetailState />
            )}
          </Panel>

        </Group>
      </main>
    </div>
  );
}

/* ── Empty state for detail pane when nothing is selected ─────────── */

function EmptyDetailState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-text-quaternary gap-8 bg-surface-page">
      <Inbox size={32} />
      <div className="text-body font-medium">
        Select an exception to view details
      </div>
      <div className="text-caption">
        Click any item in the list to see the full analysis
      </div>
    </div>
  );
}
