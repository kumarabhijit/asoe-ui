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

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Inbox } from "lucide-react";
import { NavBar } from "@/components/ui/NavBar";
import { useHealth } from "@/hooks/useHealth";
import { useAuth } from "@/hooks/useAuth";
import { exceptionsApi } from "@/lib/api";
import type { ExceptionSummary } from "@/types/exceptions";
import type { StatsResponse } from "@/types/api";
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
  const { user } = useAuth();

  useEffect(() => { document.title = "Exception Queue — ASOE"; }, []);

  const userName = user?.name || "User";
  const userInitials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

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
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [excRes, statsRes] = await Promise.all([
        exceptionsApi.list({
          status: filterState || undefined,
          intent: filterIntent || undefined,
        }),
        exceptionsApi.stats(),
      ]);
      setExceptions(excRes.data);
      setStats(statsRes);
    } catch (err) {
      console.error("Failed to fetch exceptions:", err);
      setError("Failed to load exceptions. Check your connection and try again.");
    } finally {
      setLoading(false);
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

  /* ── Client-side search filter ───────────────────────────────────── */
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
    <div
      style={{
        background: "var(--color-surface-page)",
        fontFamily: "var(--font-sans)",
        minHeight: "100vh",
      }}
    >
      {/* ━━ Top Rail: Global Navigation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <NavBar
        tabs={NAV_TABS}
        activeTab="exceptions"
        onTabChange={(id) => {
          const tab = NAV_TABS.find((t) => t.id === id);
          if (tab?.href) router.push(tab.href);
        }}
        userName={userName}
        userInitials={userInitials}
        agentCount={health?.allowed_intents?.length || 0}
        onSignOut={() => signOut({ callbackUrl: "/login" })}
        onSettingsClick={() => router.push("/settings")}
      />

      {/* ━━ Two-pane Master-Detail Area ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <main id="main-content" style={{ height: "calc(100vh - var(--nav-height))", minHeight: 576 }}>
        <Group orientation="horizontal" id="exception-queue-panels" className="panel-group-zoomable" style={{ height: "100%" }}>

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
          <Separator
            style={{
              width: "var(--pane-handle-width)",
              background: "var(--color-border-default)",
              cursor: "col-resize",
              transition: "background var(--dur-fast)",
              flexShrink: 0,
              touchAction: "none",
            }}
          />

          {/* ── Right Pane: Exception Detail ─────────────────────────── */}
          <Panel minSize="45%" id="detail-pane">
            {selectedId ? (
              <ExceptionDetailPanel
                key={selectedId}
                exceptionId={selectedId}
                onActionComplete={fetchData}
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
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-text-quaternary)",
        gap: "var(--space-8)",
        background: "var(--color-surface-page)",
      }}
    >
      <Inbox size={32} />
      <div style={{ fontSize: "var(--font-size-body)", fontWeight: 500 }}>
        Select an exception to view details
      </div>
      <div style={{ fontSize: "var(--font-size-caption)" }}>
        Click any item in the list to see the full analysis
      </div>
    </div>
  );
}
