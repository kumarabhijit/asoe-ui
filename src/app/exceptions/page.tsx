/**
 * Exception Queue — flagship view (Section 11.5, Layout A).
 *
 * Enriched with expandable order rows showing line-item grids,
 * adapted from samples/asoe-sample-screen.jsx visual design.
 * Filter values sourced from health endpoint per Guardrail #2.
 */
"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
  RefreshCw,
  Search,
  Shield,
  Zap,
  Filter,
  Inbox,
} from "lucide-react";
import { NavBar } from "@/components/ui/NavBar";
import { MetricTile } from "@/components/ui/MetricTile";
import { Badge, lifecycleVariant, verdictVariant, rootCauseVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sidebar } from "@/components/ui/Sidebar";
import { Input } from "@/components/ui/Input";
import { useHealth } from "@/hooks/useHealth";
import { exceptionsApi } from "@/lib/api";
import type { ExceptionSummary, LineItem } from "@/types/exceptions";
import type { StatsResponse } from "@/types/api";
import ExceptionDetailPanel from "./ExceptionDetailPanel";

const NAV_TABS = [
  { id: "inbox", label: "Customer Inbox", href: "/inbox" },
  { id: "exceptions", label: "Exception Queue", href: "/exceptions" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "settings", label: "Settings", href: "/settings" },
];

function enrichLine(l: LineItem) {
  const delta = +(l.po_price - l.erp_price).toFixed(2);
  const totalErp = +(l.erp_price * l.quantity).toFixed(2);
  const totalPo = +(l.po_price * l.quantity).toFixed(2);
  return { ...l, delta, totalErp, totalPo };
}

function fmtPrice(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ExceptionQueuePage() {
  const { health } = useHealth();
  const [exceptions, setExceptions] = useState<ExceptionSummary[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("orders");

  // Expandable rows — line items loaded on demand
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lineItems, setLineItems] = useState<Record<string, LineItem[]>>({});
  const [lineLoading, setLineLoading] = useState<Record<string, boolean>>({});

  // Filters — values from health endpoint per Guardrail #2
  const [filterState, setFilterState] = useState<string>("");
  const [filterIntent, setFilterIntent] = useState<string>("");

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

  async function toggleExpand(excId: string) {
    const isExpanding = !expanded[excId];
    setExpanded((prev) => ({ ...prev, [excId]: isExpanding }));

    if (isExpanding && !lineItems[excId]) {
      setLineLoading((prev) => ({ ...prev, [excId]: true }));
      try {
        const items = await exceptionsApi.lineItems(excId);
        setLineItems((prev) => ({ ...prev, [excId]: items }));
      } catch (err) {
        console.error("Failed to fetch line items:", err);
      } finally {
        setLineLoading((prev) => ({ ...prev, [excId]: false }));
      }
    }
  }

  function handleViewDetail(exc: ExceptionSummary) {
    setSelectedId(exc.id);
    setSidebarOpen(true);
  }

  function closeSidebar() {
    setSidebarOpen(false);
    setSelectedId(null);
  }

  // Search filter (client-side)
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

  // Compute totals for line count across all loaded exceptions
  const totalLineItems = Object.values(lineItems).reduce((sum, items) => sum + items.length, 0);

  const PAGE_TABS = [
    { id: "orders", label: `Orders (${filtered.length})` },
    { id: "insights", label: "Root Cause Insights" },
    { id: "activity", label: "Agent Activity" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-surface-page)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Navigation */}
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

      {/* Page Content */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "var(--space-24) var(--space-32)" }}>
        {/* Breadcrumb */}
        <div
          style={{
            fontSize: "var(--font-size-caption)",
            color: "var(--color-text-tertiary)",
            marginBottom: "var(--space-12)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-6)",
          }}
        >
          <span>Home</span>
          <ChevronRight size={10} />
          <span>Order Management</span>
          <ChevronRight size={10} />
          <span style={{ color: "var(--color-text-secondary)" }}>Exception Queue</span>
        </div>

        {/* Page Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "var(--space-24)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-16)" }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "var(--radius-md)",
                background: "var(--color-text-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Shield size={22} color="var(--color-text-inverse)" />
            </div>
            <div>
              <h1
                style={{
                  fontSize: "var(--font-size-title)",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                  margin: 0,
                }}
              >
                Exception Queue
              </h1>
              <p
                style={{
                  fontSize: "var(--font-size-body)",
                  color: "var(--color-text-tertiary)",
                  margin: "var(--space-4) 0 0",
                }}
              >
                {filtered.length} exception{filtered.length !== 1 ? "s" : ""}
                {totalLineItems > 0 && ` · ${totalLineItems} line items`}
                {" · Updated "}
                {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <Button variant="neutral" size="sm" onClick={fetchData} loading={loading}>
            <RefreshCw size={14} />
            Refresh
          </Button>
        </div>

        {/* Metrics Strip */}
        {stats && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--space-16)",
              marginBottom: "var(--space-24)",
            }}
          >
            <MetricTile
              icon={<Inbox size={20} />}
              label="Total Exceptions"
              value={stats.total_exceptions}
              tint="var(--color-cat-blue)"
            />
            <MetricTile
              icon={<AlertTriangle size={20} />}
              label="Open"
              value={stats.open_exceptions}
              subtitle="Need attention"
              tint="var(--color-warning)"
            />
            <MetricTile
              icon={<Zap size={20} />}
              label="Auto-Resolved"
              value={stats.auto_resolved}
              tint="var(--color-success)"
            />
            <MetricTile
              icon={<Clock size={20} />}
              label="Avg Resolution"
              value={
                stats.avg_resolution_time_seconds
                  ? `${Math.round(stats.avg_resolution_time_seconds / 60)}m`
                  : "—"
              }
              tint="var(--color-cat-teal)"
            />
          </div>
        )}

        {/* Tab Bar */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-4)",
            borderBottom: "1px solid var(--color-border-default)",
            marginBottom: "var(--space-16)",
          }}
        >
          {PAGE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "var(--space-8) var(--space-16)",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid var(--color-brand)" : "2px solid transparent",
                cursor: "pointer",
                fontSize: "var(--font-size-body)",
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                fontFamily: "var(--font-sans)",
                transition: "all var(--dur-fast)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "orders" && (
          <>
            {/* Filters + Search */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-12)",
                marginBottom: "var(--space-16)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
                <Input
                  placeholder="Search by order ID, intent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  rightIcon={<Search size={14} />}
                />
              </div>

              {/* State filter — values from health endpoint */}
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
                <Filter size={14} color="var(--color-text-tertiary)" />
                <select
                  value={filterState}
                  onChange={(e) => setFilterState(e.target.value)}
                  style={{
                    padding: "var(--space-6) var(--space-10)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border-default)",
                    background: "var(--color-surface-primary)",
                    fontSize: "var(--font-size-caption)",
                    fontFamily: "var(--font-sans)",
                    color: "var(--color-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <option value="">All States</option>
                  {(health?.lifecycle_states ?? []).map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Intent filter — values from health endpoint */}
              <select
                value={filterIntent}
                onChange={(e) => setFilterIntent(e.target.value)}
                style={{
                  padding: "var(--space-6) var(--space-10)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border-default)",
                  background: "var(--color-surface-primary)",
                  fontSize: "var(--font-size-caption)",
                  fontFamily: "var(--font-sans)",
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                }}
              >
                <option value="">All Intents</option>
                {(health?.allowed_intents ?? []).map((i) => (
                  <option key={i} value={i}>
                    {i.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            {/* Exception Cards (Expandable Rows) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-8)",
              }}
            >
              {loading ? (
                <div style={{ padding: "var(--space-32)", textAlign: "center" }}>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="skeleton"
                      style={{
                        height: 56,
                        borderRadius: "var(--radius-md)",
                        marginBottom: "var(--space-8)",
                      }}
                    />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div
                  style={{
                    padding: "var(--space-32)",
                    textAlign: "center",
                    color: "var(--color-text-quaternary)",
                    background: "var(--color-surface-primary)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <CheckCircle size={24} style={{ marginBottom: 8 }} />
                  <div>No exceptions match your filters</div>
                </div>
              ) : (
                filtered.map((exc) => {
                  const isExpanded = expanded[exc.id] ?? false;
                  const items = lineItems[exc.id];
                  const isLineLoading = lineLoading[exc.id] ?? false;

                  return (
                    <div
                      key={exc.id}
                      style={{
                        background: "var(--color-surface-primary)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-sm)",
                        overflow: "hidden",
                        borderLeft: selectedId === exc.id ? "3px solid var(--color-brand)" : "3px solid transparent",
                        transition: "box-shadow var(--dur-fast)",
                      }}
                    >
                      {/* Collapsed row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-12)",
                          padding: "var(--space-12) var(--space-16)",
                          cursor: "pointer",
                        }}
                        onClick={() => handleViewDetail(exc)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleViewDetail(exc); }}
                        tabIndex={0}
                        role="button"
                        aria-expanded={isExpanded}
                      >
                        {/* Expand chevron */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(exc.id);
                          }}
                          aria-label={isExpanded ? "Collapse line items" : "Expand line items"}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "var(--space-4)",
                            display: "flex",
                            alignItems: "center",
                            color: "var(--color-text-tertiary)",
                            transition: "transform var(--dur-fast)",
                            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                          }}
                        >
                          <ChevronRight size={16} />
                        </button>

                        {/* Order ID */}
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            fontSize: "var(--font-size-body)",
                            color: "var(--color-text-primary)",
                            minWidth: 80,
                          }}
                        >
                          {exc.order_id}
                        </span>

                        {/* Event type */}
                        <span
                          style={{
                            fontSize: "var(--font-size-caption)",
                            color: "var(--color-text-secondary)",
                            minWidth: 120,
                          }}
                        >
                          {exc.event_type.replace(/_/g, " ")}
                        </span>

                        {/* Intent badge */}
                        <div style={{ minWidth: 120 }}>
                          {exc.intent && (
                            <Badge variant="brand" size="sm" icon={null}>
                              {exc.intent.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </div>

                        {/* Line count pill */}
                        {items && (
                          <span
                            style={{
                              fontSize: "var(--font-size-label)",
                              fontWeight: 600,
                              color: "var(--color-text-tertiary)",
                              background: "var(--color-surface-secondary)",
                              padding: "2px 8px",
                              borderRadius: "var(--radius-full)",
                            }}
                          >
                            {items.length} line{items.length !== 1 ? "s" : ""}
                          </span>
                        )}

                        <div style={{ flex: 1 }} />

                        {/* Lifecycle state badge */}
                        <Badge variant={lifecycleVariant(exc.lifecycle_state)} size="sm">
                          {exc.lifecycle_state.replace(/_/g, " ")}
                        </Badge>

                        {/* Verdict badge */}
                        {exc.shadow_verdict && (
                          <Badge variant={verdictVariant(exc.shadow_verdict)} size="sm">
                            {exc.shadow_verdict}
                          </Badge>
                        )}

                        {/* Created time */}
                        <span
                          style={{
                            fontSize: "var(--font-size-caption)",
                            color: "var(--color-text-quaternary)",
                            fontFamily: "var(--font-mono)",
                            minWidth: 90,
                            textAlign: "right",
                          }}
                        >
                          {formatTime(exc.created_at)}
                        </span>

                        {/* View button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetail(exc);
                          }}
                        >
                          View
                        </Button>
                      </div>

                      {/* Expanded line-item grid */}
                      {isExpanded && (
                        <div
                          style={{
                            borderTop: "1px solid var(--color-border-default)",
                            background: "var(--color-surface-page)",
                            padding: "var(--space-16) var(--space-16) var(--space-16) var(--space-48)",
                          }}
                        >
                          {isLineLoading ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
                              {[1, 2].map((i) => (
                                <div key={i} className="skeleton" style={{ height: 32, borderRadius: "var(--radius-sm)" }} />
                              ))}
                            </div>
                          ) : items && items.length > 0 ? (
                            <LineItemGrid items={items} />
                          ) : (
                            <div
                              style={{
                                fontSize: "var(--font-size-caption)",
                                color: "var(--color-text-quaternary)",
                                fontStyle: "italic",
                                padding: "var(--space-8) 0",
                              }}
                            >
                              No line items available.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Placeholder tabs */}
        {activeTab === "insights" && (
          <PlaceholderTab icon={<Shield size={24} />} title="Root Cause Insights" />
        )}
        {activeTab === "activity" && (
          <PlaceholderTab icon={<Zap size={24} />} title="Agent Activity" />
        )}
      </div>

      {/* Sidebar Detail Panel */}
      <Sidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        title={selectedId ? `Exception ${selectedId}` : undefined}
      >
        {selectedId && (
          <ExceptionDetailPanel exceptionId={selectedId} onClose={closeSidebar} />
        )}
      </Sidebar>
    </div>
  );
}

/* ── Line Item Grid (adapted from samples/asoe-sample-screen.jsx) ─── */

function LineItemGrid({ items }: { items: LineItem[] }) {
  const enriched = items.map(enrichLine);
  const totalErp = enriched.reduce((s, l) => s + l.totalErp, 0);
  const totalPo = enriched.reduce((s, l) => s + l.totalPo, 0);

  const COLUMNS = ["Line", "SKU", "Product", "UOM", "Qty", "ERP", "PO", "Σ ERP", "Σ PO", "Root Cause"];
  const colWidths = "60px 90px 1fr 50px 60px 80px 80px 90px 90px 130px";

  return (
    <div
      style={{
        background: "var(--color-surface-primary)",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-border-default)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: colWidths,
          gap: "var(--space-4)",
          padding: "var(--space-8) var(--space-12)",
          background: "var(--color-surface-secondary)",
          borderBottom: "1px solid var(--color-border-default)",
        }}
      >
        {COLUMNS.map((col) => (
          <span
            key={col}
            style={{
              fontSize: "var(--font-size-label)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--color-text-tertiary)",
              textAlign: ["Qty", "ERP", "PO", "Σ ERP", "Σ PO"].includes(col) ? "right" : "left",
            }}
          >
            {col}
          </span>
        ))}
      </div>

      {/* Rows */}
      {enriched.map((line) => (
        <div
          key={line.line_id}
          style={{
            display: "grid",
            gridTemplateColumns: colWidths,
            gap: "var(--space-4)",
            padding: "var(--space-8) var(--space-12)",
            borderBottom: "1px solid var(--color-border-subtle)",
            fontSize: "var(--font-size-caption)",
            alignItems: "center",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-text-secondary)" }}>
            {line.line_id}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-label)", color: "var(--color-text-tertiary)" }}>
            {line.sku}
          </span>
          <span style={{ color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {line.description}
          </span>
          <span style={{ color: "var(--color-text-tertiary)" }}>{line.uom}</span>
          <span style={{ fontFamily: "var(--font-mono)", textAlign: "right", color: "var(--color-text-primary)" }}>
            {line.quantity.toLocaleString()}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", textAlign: "right", color: "var(--color-text-primary)" }}>
            {fmtPrice(line.erp_price)}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              textAlign: "right",
              color: line.delta !== 0 ? "var(--color-error)" : "var(--color-text-primary)",
              fontWeight: line.delta !== 0 ? 600 : 400,
            }}
          >
            {fmtPrice(line.po_price)}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", textAlign: "right", color: "var(--color-text-secondary)" }}>
            {fmtPrice(line.totalErp)}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", textAlign: "right", color: "var(--color-text-secondary)" }}>
            {fmtPrice(line.totalPo)}
          </span>
          <div>
            {line.root_cause && (
              <Badge variant={rootCauseVariant(line.root_cause)} size="sm" icon={null}>
                {line.root_cause.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </div>
      ))}

      {/* Footer totals */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: colWidths,
          gap: "var(--space-4)",
          padding: "var(--space-8) var(--space-12)",
          background: "var(--color-surface-secondary)",
          fontWeight: 700,
          fontSize: "var(--font-size-caption)",
        }}
      >
        <span style={{ gridColumn: "span 7", color: "var(--color-text-secondary)" }}>
          Total ({items.length} line{items.length !== 1 ? "s" : ""})
        </span>
        <span style={{ fontFamily: "var(--font-mono)", textAlign: "right", color: "var(--color-text-primary)" }}>
          {fmtPrice(totalErp)}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            textAlign: "right",
            color: totalPo !== totalErp ? "var(--color-error)" : "var(--color-text-primary)",
          }}
        >
          {fmtPrice(totalPo)}
        </span>
        <span />
      </div>
    </div>
  );
}

function PlaceholderTab({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div
      style={{
        padding: "var(--space-48)",
        textAlign: "center",
        color: "var(--color-text-quaternary)",
        background: "var(--color-surface-primary)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {icon}
      <div style={{ marginTop: "var(--space-8)", fontSize: "var(--font-size-body)" }}>
        {title} — coming soon
      </div>
    </div>
  );
}

