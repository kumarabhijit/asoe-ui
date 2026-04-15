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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
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
    <div className="h-full flex flex-col bg-surface-page min-w-0">
      {/* ── Pane Header ──────────────────────────────────────────────── */}
      <div className="px-16 py-12 border-b border-border bg-surface-primary shrink-0">
        {/* Title row */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-8">
            <Shield size={16} className="text-text-primary" />
            <h2 className="text-heading font-bold text-text-primary m-0">
              Exceptions
            </h2>
            <span className="text-label font-semibold text-text-tertiary bg-surface-secondary px-2 py-px rounded-full">
              {exceptions.length}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onRefresh} loading={loading}>
            <RefreshCw size={14} />
          </Button>
        </div>

        {/* Compact inline metrics */}
        {stats && (
          <div className="flex gap-12 mb-10 text-caption">
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
        <div className="flex gap-6 mt-8">
          <div className="flex items-center gap-4 flex-1">
            <Filter size={12} className="text-text-tertiary" />
            <Select value={filterState} onValueChange={(v) => onFilterStateChange(v === "__all__" ? "" : v)}>
              <SelectTrigger aria-label="Filter by lifecycle state" className="flex-1">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All States</SelectItem>
                {(health?.lifecycle_states ?? []).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={filterIntent} onValueChange={(v) => onFilterIntentChange(v === "__all__" ? "" : v)}>
            <SelectTrigger aria-label="Filter by intent" className="flex-1">
              <SelectValue placeholder="All Exceptions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Exceptions</SelectItem>
              {(health?.allowed_intents ?? []).map((i) => (
                <SelectItem key={i} value={i}>
                  {i.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active filter indicator */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between py-4">
            <span className="text-label text-text-tertiary font-semibold uppercase tracking-wider">
              <Filter size={10} className="mr-4 inline align-middle" />
              Filters active
            </span>
            <button
              onClick={onClearFilters}
              className="bg-transparent border-none cursor-pointer text-label font-semibold text-brand font-sans p-0"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Scrollable Exception Card List ────────────────────────────── */}
      <div role="listbox" aria-label="Exception list" className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex flex-col gap-6 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-[68px] rounded-md" />
            ))}
          </div>
        ) : error ? (
          <div className="p-32 text-center text-error">
            <AlertTriangle size={24} className="mb-8" />
            <div className="text-body font-medium mb-8">{error}</div>
            <Button variant="neutral" size="sm" onClick={onRefresh}>Retry</Button>
          </div>
        ) : exceptions.length === 0 ? (
          <div className="p-32 text-center text-text-quaternary">
            <CheckCircle size={24} className="mb-8" />
            <div className="text-body">No exceptions match your filters</div>
            {(filterState || filterIntent || searchQuery) && (
              <div className="text-caption mt-4">
                Try clearing your filters to see all exceptions.
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
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
    <div className="flex items-center gap-4">
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-text-tertiary font-medium">{label}</span>
      <span className="font-mono font-bold text-text-primary">{value}</span>
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
      className={cn(
        "w-full text-left px-12 py-10 rounded-md border-l-[3px] cursor-pointer font-sans transition-all duration-fast flex flex-col gap-4",
        isSelected ? "bg-surface-row-active" : "bg-surface-primary",
      )}
      style={{ borderLeftColor: getLeftBorderColor(exc, isSelected) }}
    >
      {/* Row 1: Order ID + Timestamp */}
      <div className="flex items-center justify-between gap-6 min-w-0">
        <span className="font-mono text-body font-bold text-text-primary overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
          {exc.order_id}
        </span>
        <span className="text-label text-text-quaternary font-mono shrink-0">
          {formatTime(exc.created_at)}
        </span>
      </div>

      {/* Row 2: Intent tag + lifecycle badge + verdict */}
      <div className="flex items-center gap-4 flex-wrap">
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
