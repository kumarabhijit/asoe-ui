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

const NAV_TABS = [
  { id: "inbox", label: "Customer Inbox", href: "/inbox" },
  { id: "exceptions", label: "Exception Queue", href: "/exceptions" },
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
  const { user, visibleTabs } = useAuth();

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
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [filterState, setFilterState] = useState(searchParams.get("state") || "");
  const [filterIntent, setFilterIntent] = useState(searchParams.get("intent") || "");

  /* ── Sync filters to URL ─────────────────────────────────────────── */
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterState) params.set("state", filterState);
    if (filterIntent) params.set("intent", filterIntent);
    if (searchQuery) params.set("q", searchQuery);
    const qs = params.toString();
    const url = qs ? `/exceptions?${qs}` : "/exceptions";
    router.replace(url, { scroll: false });
  }, [filterState, filterIntent, searchQuery, router]);

  const hasActiveFilters = !!(filterState || filterIntent || searchQuery);

  function clearAllFilters() {
    setFilterState("");
    setFilterIntent("");
    setSearchQuery("");
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
        const page = await exceptionsApi.list({
          status: filterState || undefined,
          intent: filterIntent || undefined,
          cursor,
        });
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
  }, [filterState, filterIntent]);

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
    token: user?.id ? "mock-ws-token" : undefined,
    enabled: !!user,
    onEvent: handleWsEvent,
    onReconnect: handleWsReconnect,
  });

  /* ── Client-side search filter (account scoping is server-side) ──── */
  const filtered = exceptions.filter((exc) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      exc.order_id.toLowerCase().includes(q) ||
      exc.id.toLowerCase().includes(q) ||
      (exc.intent?.toLowerCase().includes(q) ?? false) ||
      exc.event_type.toLowerCase().includes(q)
    );
  });

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
              exceptions={filtered}
              stats={stats}
              loading={loading}
              error={error}
              selectedId={selectedId}
              onSelect={setSelectedId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filterState={filterState}
              onFilterStateChange={setFilterState}
              filterIntent={filterIntent}
              onFilterIntentChange={setFilterIntent}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearAllFilters}
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
