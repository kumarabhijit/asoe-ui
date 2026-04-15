/**
 * ExceptionListPane — Middle pane of the three-pane "Outlook" layout.
 *
 * Compact, scrollable exception card list with search + filters.
 * Cards show: SO ID, Intent Tag, Status (lifecycle + verdict), Timestamp.
 * Active card is highlighted with brand accent.
 *
 * Filter values sourced from health endpoint per Guardrail #2.
 */
"use client";

import {
  Search,
  Filter,
  RefreshCw,
  Shield,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { Badge, lifecycleVariant, verdictVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExceptionSummary, HealthResponse } from "@/types/exceptions";
import type { StatsResponse } from "@/types/api";

interface ExceptionListPaneProps {
  exceptions: ExceptionSummary[];
  stats: StatsResponse | null;
  loading: boolean;
  error?: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterState: string;
  onFilterStateChange: (s: string) => void;
  filterIntent: string;
  onFilterIntentChange: (i: string) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  health: HealthResponse | null;
  onRefresh: () => void;
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

const selectStyle: React.CSSProperties = {
  flex: 1,
  padding: "var(--space-4) var(--space-8)",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border-default)",
  background: "var(--color-surface-primary)",
  fontSize: "var(--font-size-label)",
  fontFamily: "var(--font-sans)",
  color: "var(--color-text-secondary)",
  cursor: "pointer",
};

export default function ExceptionListPane({
  exceptions,
  stats,
  loading,
  error,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  filterState,
  onFilterStateChange,
  filterIntent,
  onFilterIntentChange,
  hasActiveFilters,
  onClearFilters,
  health,
  onRefresh,
}: ExceptionListPaneProps) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface-page)",
        minWidth: 0,
      }}
    >
      {/* ── Pane Header ──────────────────────────────────────────────── */}
      <div
        style={{
          padding: "var(--space-12) var(--space-16)",
          borderBottom: "1px solid var(--color-border-default)",
          background: "var(--color-surface-primary)",
          flexShrink: 0,
        }}
      >
        {/* Title row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-10)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
            <Shield size={16} color="var(--color-text-primary)" />
            <h2
              style={{
                fontSize: "var(--font-size-heading)",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                margin: 0,
              }}
            >
              Exceptions
            </h2>
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
              {exceptions.length}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onRefresh} loading={loading}>
            <RefreshCw size={14} />
          </Button>
        </div>

        {/* Compact inline metrics */}
        {stats && (
          <div
            style={{
              display: "flex",
              gap: "var(--space-12)",
              marginBottom: "var(--space-10)",
              fontSize: "var(--font-size-caption)",
            }}
          >
            <CompactMetric label="Open" value={stats.open_exceptions} color="var(--color-warning)" />
            <CompactMetric label="Resolved" value={stats.auto_resolved} color="var(--color-success)" />
            <CompactMetric
              label="Avg"
              value={
                stats.avg_resolution_time_seconds
                  ? `${Math.round(stats.avg_resolution_time_seconds / 60)}m`
                  : "—"
              }
              color="var(--color-cat-teal)"
            />
          </div>
        )}

        {/* Search */}
        <Input
          placeholder="Search by order ID, exception..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          rightIcon={<Search size={14} />}
        />

        {/* Filter row */}
        <div style={{ display: "flex", gap: "var(--space-6)", marginTop: "var(--space-8)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flex: 1 }}>
            <Filter size={12} color="var(--color-text-tertiary)" />
            <select
              value={filterState}
              onChange={(e) => onFilterStateChange(e.target.value)}
              style={selectStyle}
              aria-label="Filter by lifecycle state"
            >
              <option value="">All States</option>
              {(health?.lifecycle_states ?? []).map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <select
            value={filterIntent}
            onChange={(e) => onFilterIntentChange(e.target.value)}
            style={selectStyle}
            aria-label="Filter by intent"
          >
            <option value="">All Exceptions</option>
            {(health?.allowed_intents ?? []).map((i) => (
              <option key={i} value={i}>
                {i.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        {/* Active filter indicator */}
        {hasActiveFilters && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-4) 0",
            }}
          >
            <span style={{ fontSize: "var(--font-size-label)", color: "var(--color-text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <Filter size={10} style={{ marginRight: "var(--space-4)", verticalAlign: "middle" }} />
              Filters active
            </span>
            <button
              onClick={onClearFilters}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "var(--font-size-label)",
                fontWeight: 600,
                color: "var(--color-brand)",
                fontFamily: "var(--font-sans)",
                padding: 0,
              }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Scrollable Exception Card List ────────────────────────────── */}
      <div
        role="listbox"
        aria-label="Exception list"
        style={{
          flex: 1,
          overflow: "auto",
          padding: "var(--space-6)",
        }}
      >
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: "var(--space-4)" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 68, borderRadius: "var(--radius-md)" }}
              />
            ))}
          </div>
        ) : error ? (
          <div
            style={{
              padding: "var(--space-32)",
              textAlign: "center",
              color: "var(--color-error)",
            }}
          >
            <AlertTriangle size={24} style={{ marginBottom: "var(--space-8)" }} />
            <div style={{ fontSize: "var(--font-size-body)", fontWeight: 500, marginBottom: "var(--space-8)" }}>{error}</div>
            <Button variant="neutral" size="sm" onClick={onRefresh}>Retry</Button>
          </div>
        ) : exceptions.length === 0 ? (
          <div
            style={{
              padding: "var(--space-32)",
              textAlign: "center",
              color: "var(--color-text-quaternary)",
            }}
          >
            <CheckCircle size={24} style={{ marginBottom: "var(--space-8)" }} />
            <div style={{ fontSize: "var(--font-size-body)" }}>No exceptions match your filters</div>
            {(filterState || filterIntent || searchQuery) && (
              <div style={{ fontSize: "var(--font-size-caption)", marginTop: "var(--space-4)" }}>
                Try clearing your filters to see all exceptions.
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {exceptions.map((exc) => (
              <ExceptionCard
                key={exc.id}
                exception={exc}
                isSelected={selectedId === exc.id}
                onSelect={() => onSelect(exc.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Compact Metric (inline dot + label + value) ───────────────────── */

function CompactMetric({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "var(--radius-full)",
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ color: "var(--color-text-tertiary)", fontWeight: 500 }}>{label}</span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          color: "var(--color-text-primary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Exception Card (compact for pane density) ─────────────────────── */

const TERMINAL_STATES = ["RESOLVED", "CLOSED", "REJECTED"];

function getLeftBorderColor(exc: ExceptionSummary, isSelected: boolean): string {
  if (isSelected) return "var(--color-brand)";
  if (exc.shadow_verdict === "GREEN" && TERMINAL_STATES.includes(exc.lifecycle_state)) {
    return "var(--color-success)";
  }
  return "transparent";
}

function ExceptionCard({
  exception: exc,
  isSelected,
  onSelect,
}: {
  exception: ExceptionSummary;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "var(--space-10) var(--space-12)",
        borderRadius: "var(--radius-md)",
        borderLeft: `3px solid ${getLeftBorderColor(exc, isSelected)}`,
        background: isSelected
          ? "var(--color-surface-row-active)"
          : "var(--color-surface-primary)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        transition: "all var(--dur-fast)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      {/* Row 1: Order ID + Timestamp */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-6)", minWidth: 0 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-body)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {exc.order_id}
        </span>
        <span
          style={{
            fontSize: "var(--font-size-label)",
            color: "var(--color-text-quaternary)",
            fontFamily: "var(--font-mono)",
            flexShrink: 0,
          }}
        >
          {formatTime(exc.created_at)}
        </span>
      </div>

      {/* Row 2: Intent tag + lifecycle badge + verdict */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
        {exc.intent && (
          <Badge variant="brand" size="sm" icon={null}>
            {exc.intent.replace(/_/g, " ")}
          </Badge>
        )}
        <Badge variant={lifecycleVariant(exc.lifecycle_state)} size="sm">
          {exc.lifecycle_state.replace(/_/g, " ")}
        </Badge>
        {exc.shadow_verdict && (
          <Badge variant={verdictVariant(exc.shadow_verdict)} size="sm">
            {exc.shadow_verdict}
          </Badge>
        )}
      </div>
    </div>
  );
}
