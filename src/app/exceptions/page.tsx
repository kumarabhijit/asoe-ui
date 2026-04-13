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

import { useState, useEffect, useCallback } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Inbox } from "lucide-react";
import { NavBar } from "@/components/ui/NavBar";
import { useHealth } from "@/hooks/useHealth";
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
  const { health } = useHealth();

  /* ── List state ──────────────────────────────────────────────────── */
  const [exceptions, setExceptions] = useState<ExceptionSummary[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  /* ── Lifted selection state ──────────────────────────────────────── */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* ── Filters ─────────────────────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterIntent, setFilterIntent] = useState("");

  /* ── Data fetching ───────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true);
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
   * Layout strategy:
   *   At normal zoom the page fills exactly the viewport (no scroll).
   *   When zoomed in, 100vh shrinks in CSS pixels but the min-height
   *   of 576px keeps the panel area usable.  Because the combined
   *   height (nav + panels) then exceeds 100vh, the outer container
   *   scrolls via overflow: auto — the same behaviour as /inbox.
   *   The nav-height token keeps the calc() in sync with NavBar.
   */

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div
      style={{
        background: "var(--color-surface-page)",
        fontFamily: "var(--font-sans)",
        minHeight: "100vh",
        overflow: "auto",
      }}
    >
      {/* ━━ Top Rail: Global Navigation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <NavBar
        tabs={NAV_TABS}
        activeTab="exceptions"
        onTabChange={(id) => {
          const tab = NAV_TABS.find((t) => t.id === id);
          if (tab?.href) window.location.href = tab.href;
        }}
        userName="Jane Doe"
        userInitials="JD"
        agentCount={3}
      />

      {/* ━━ Two-pane Master-Detail Area ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{ height: "calc(100vh - var(--nav-height))", minHeight: 576 }}>
        <Group orientation="horizontal" id="exception-queue-panels" style={{ height: "100%" }}>

          {/* ── Middle Pane: Exception List ──────────────────────────── */}
          <Panel defaultSize="35%" minSize="22%" maxSize="50%" id="list-pane">
            <ExceptionListPane
              exceptions={filtered}
              stats={stats}
              loading={loading}
              selectedId={selectedId}
              onSelect={setSelectedId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filterState={filterState}
              onFilterStateChange={setFilterState}
              filterIntent={filterIntent}
              onFilterIntentChange={setFilterIntent}
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
              />
            ) : (
              <EmptyDetailState />
            )}
          </Panel>

        </Group>
      </div>
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
