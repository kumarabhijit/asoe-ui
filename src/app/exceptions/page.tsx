/**
 * Exception Queue — flagship view (Section 11.5, Layout A).
 *
 * Metrics strip + tab bar + DataTable + Sidebar for detail.
 * Filter values sourced from health endpoint per Guardrail #2.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Inbox,
  RefreshCw,
  Search,
  Zap,
  Filter,
} from "lucide-react";
import { NavBar } from "@/components/ui/NavBar";
import { MetricTile } from "@/components/ui/MetricTile";
import { Badge, lifecycleVariant, verdictVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sidebar } from "@/components/ui/Sidebar";
import { Input } from "@/components/ui/Input";
import { useHealth } from "@/hooks/useHealth";
import { exceptionsApi } from "@/lib/api";
import type { ExceptionSummary } from "@/types/exceptions";
import type { StatsResponse } from "@/types/api";
import ExceptionDetailPanel from "./ExceptionDetailPanel";

const NAV_TABS = [
  { id: "exceptions", label: "Exception Queue", href: "/exceptions" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "settings", label: "Settings", href: "/settings" },
];

export default function ExceptionQueuePage() {
  const { health } = useHealth();
  const [exceptions, setExceptions] = useState<ExceptionSummary[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  function handleRowClick(exc: ExceptionSummary) {
    setSelectedId(exc.id);
    setSidebarOpen(true);
  }

  function closeSidebar() {
    setSidebarOpen(false);
    setSelectedId(null);
  }

  // Search filter (client-side on loaded data)
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
          if (id === "dashboard") window.location.href = "/dashboard";
          if (id === "settings") window.location.href = "/settings";
        }}
        userName="Jane Doe"
        userInitials="JD"
        agentCount={3}
      />

      {/* Page Content */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "var(--space-24)" }}>
        {/* Page Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-24)",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "var(--font-size-title)",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "var(--space-8)",
              }}
            >
              <Inbox size={22} />
              Exception Queue
            </h1>
            <p
              style={{
                fontSize: "var(--font-size-body)",
                color: "var(--color-text-tertiary)",
                margin: "var(--space-4) 0 0",
              }}
            >
              Monitor and resolve O2C exceptions across all tenants
            </p>
          </div>
          <Button
            variant="neutral"
            size="sm"
            onClick={fetchData}
            loading={loading}
          >
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
              tint="var(--color-category-blue)"
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
              value={stats.avg_resolution_time_seconds
                ? `${Math.round(stats.avg_resolution_time_seconds / 60)}m`
                : "—"}
              tint="var(--color-category-teal)"
            />
          </div>
        )}

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
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
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
              <option key={i} value={i}>{i.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        {/* Exception Table */}
        <div
          style={{
            background: "var(--color-surface-primary)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "var(--font-size-body)",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--color-border-default)",
                  background: "var(--color-surface-secondary)",
                }}
              >
                {["Order ID", "Event Type", "Intent", "State", "Verdict", "Recipe", "Created", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "var(--space-10) var(--space-16)",
                      textAlign: "left",
                      fontSize: "var(--font-size-label)",
                      fontWeight: 600,
                      color: "var(--color-text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: "var(--space-32)", textAlign: "center", color: "var(--color-text-quaternary)" }}>
                    <div className="skeleton" style={{ height: 20, width: 200, margin: "0 auto", borderRadius: "var(--radius-sm)" }} />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "var(--space-32)", textAlign: "center", color: "var(--color-text-quaternary)" }}>
                    <CheckCircle size={24} style={{ marginBottom: 8 }} />
                    <div>No exceptions match your filters</div>
                  </td>
                </tr>
              ) : (
                filtered.map((exc) => (
                  <tr
                    key={exc.id}
                    onClick={() => handleRowClick(exc)}
                    style={{
                      borderBottom: "1px solid var(--color-border-default)",
                      cursor: "pointer",
                      background: selectedId === exc.id ? "var(--color-surface-secondary)" : "transparent",
                      transition: "background var(--dur-fast)",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedId !== exc.id) e.currentTarget.style.background = "var(--color-surface-page)";
                    }}
                    onMouseLeave={(e) => {
                      if (selectedId !== exc.id) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={{ padding: "var(--space-10) var(--space-16)", fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "var(--font-size-caption)" }}>
                      {exc.order_id}
                    </td>
                    <td style={{ padding: "var(--space-10) var(--space-16)", color: "var(--color-text-secondary)", fontSize: "var(--font-size-caption)" }}>
                      {exc.event_type.replace(/_/g, " ")}
                    </td>
                    <td style={{ padding: "var(--space-10) var(--space-16)" }}>
                      {exc.intent && (
                        <Badge variant="brand" size="sm" icon={null}>
                          {exc.intent.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </td>
                    <td style={{ padding: "var(--space-10) var(--space-16)" }}>
                      <Badge variant={lifecycleVariant(exc.lifecycle_state)} size="sm">
                        {exc.lifecycle_state.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td style={{ padding: "var(--space-10) var(--space-16)" }}>
                      {exc.shadow_verdict && (
                        <Badge variant={verdictVariant(exc.shadow_verdict)} size="sm">
                          {exc.shadow_verdict}
                        </Badge>
                      )}
                    </td>
                    <td style={{ padding: "var(--space-10) var(--space-16)", fontSize: "var(--font-size-caption)", color: "var(--color-text-tertiary)" }}>
                      {exc.selected_recipe?.replace(".py", "") || "—"}
                    </td>
                    <td style={{ padding: "var(--space-10) var(--space-16)", fontSize: "var(--font-size-caption)", color: "var(--color-text-quaternary)", fontFamily: "var(--font-mono)" }}>
                      {formatTime(exc.created_at)}
                    </td>
                    <td style={{ padding: "var(--space-10) var(--space-16)" }}>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRowClick(exc); }}>View</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sidebar Detail Panel */}
      <Sidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        title={selectedId ? `Exception ${selectedId}` : undefined}
      >
        {selectedId && (
          <ExceptionDetailPanel
            exceptionId={selectedId}
            onClose={closeSidebar}
          />
        )}
      </Sidebar>
    </div>
  );
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
