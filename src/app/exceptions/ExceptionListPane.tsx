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
  X,
} from "lucide-react";
import { Badge, lifecycleVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { cn } from "@/lib/utils";
import { intentLabelFor } from "@/config/erp-label-map";
import { useErpProfile } from "@/hooks/useErpProfile";
import type { ExceptionSummary, HealthResponse } from "@/types/exceptions";
import type { StatsResponse } from "@/types/api";
import { HITL_LIFECYCLE_STATES } from "./shared";
import { parseQuery, stringifyTokens, type OperatorToken } from "./searchParser";

interface ExceptionListPaneProps {
  exceptions: ExceptionSummary[];
  stats: StatsResponse | null;
  loading: boolean;
  error?: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  /** Multi-select lifecycle-state filter. Empty array = no constraint. */
  filterStates: string[];
  onFilterStatesChange: (s: string[]) => void;
  /** Multi-select intent filter. Empty array = no constraint. */
  filterIntents: string[];
  onFilterIntentsChange: (i: string[]) => void;
  /** Quick-filter date range. Today-only single value for now;
   *  future presets (this week, last 24h) can extend the union. */
  filterDate: "today" | null;
  onFilterDateChange: (d: "today" | null) => void;
  /** Operator tokens parsed out of the search box (e.g. account:,
   *  state:, since:). Rendered as removable chips in the active-filter
   *  row so the operator can see what their query was decomposed into.
   *  Removing a chip rewrites the search string with that operator
   *  stripped — see `onRemoveSearchOperator` below. */
  parsedSearchOperators: OperatorToken[];
  /** Non-fatal parse warnings from the search parser. Surfaced as a
   *  caption hint under the search box. */
  searchWarnings: string[];
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
  filterStates,
  onFilterStatesChange,
  filterIntents,
  onFilterIntentsChange,
  filterDate,
  onFilterDateChange,
  parsedSearchOperators,
  searchWarnings,
  hasActiveFilters,
  onClearFilters,
  health,
  onRefresh,
}: ExceptionListPaneProps) {
  const erp = useErpProfile();
  // Quick-filter pills compose with the multi-select chips: clicking a
  // state-set pill replaces the state filter with that preset's set,
  // re-clicking clears it. The "Today" pill toggles `filterDate`.
  const lifecycleOptions = health?.lifecycle_states ?? [];
  const intentOptions = health?.allowed_intents ?? [];
  const hitlOptions = lifecycleOptions.filter((s) => HITL_LIFECYCLE_STATES.has(s));
  const failedOptions = lifecycleOptions.filter((s) => s === "FAILED");
  const cosignOptions = lifecycleOptions.filter((s) => s === "PENDING_COSIGN");
  const isPresetActive = (preset: readonly string[]) =>
    preset.length > 0 &&
    filterStates.length === preset.length &&
    preset.every((s) => filterStates.includes(s));
  function togglePreset(preset: readonly string[]) {
    if (isPresetActive(preset)) {
      onFilterStatesChange([]);
    } else {
      onFilterStatesChange([...preset]);
    }
  }
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
            {/* Structural omission (CLAUDE.md Guardrail #6): suppress
                the Avg tile entirely when the backend has no
                resolution-time data, rather than rendering a "—"
                placeholder that conceals where the missing value
                came from. */}
            {stats.avg_resolution_time_seconds ? (
              <CompactMetric
                label="Avg"
                value={`${Math.round(stats.avg_resolution_time_seconds / 60)}m`}
                color="var(--color-cat-teal)"
              />
            ) : null}
          </div>
        )}

        {/* Search — fuzzy multi-token + operator syntax (account:, state:,
            intent:, verdict:, since:, before:). The placeholder hints
            at one operator so newcomers discover the syntax; the full
            list is documented in `searchParser.ts`. */}
        <Input
          placeholder='Search… try "account:walmart since:7d 1042"'
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          rightIcon={<Search size={14} />}
        />
        {/* Parser warnings — surfaces unknown operators / unparseable
            since: values without failing the query. Caption-styled and
            non-blocking; the operator can edit and retry. */}
        {searchWarnings.length > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 text-label text-warning"
          >
            {searchWarnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
        )}

        {/* Quick-filter pill bar — one-click presets that compose with
            the multi-select chips. Operators reach for these first;
            the multi-selects exist for ad-hoc combinations the pills
            don't cover. */}
        <div role="group" aria-label="Quick filters" className="flex gap-4 flex-wrap mt-8">
          <QuickPill
            label="Today"
            active={filterDate === "today"}
            onClick={() => onFilterDateChange(filterDate === "today" ? null : "today")}
          />
          <QuickPill
            label="HITL"
            active={isPresetActive(hitlOptions)}
            disabled={hitlOptions.length === 0}
            onClick={() => togglePreset(hitlOptions)}
          />
          <QuickPill
            label="Failed"
            active={isPresetActive(failedOptions)}
            disabled={failedOptions.length === 0}
            onClick={() => togglePreset(failedOptions)}
          />
          <QuickPill
            label="Awaiting cosign"
            active={isPresetActive(cosignOptions)}
            disabled={cosignOptions.length === 0}
            onClick={() => togglePreset(cosignOptions)}
          />
        </div>

        {/* Filter row — multi-select chips for state and intent.
            Selected items show in the trigger label; the active-chip
            row below summarises everything for one-click removal. */}
        <div className="flex gap-6 mt-8">
          <div className="flex items-center gap-4 flex-1">
            <Filter size={12} className="text-text-tertiary shrink-0" />
            <MultiSelect
              ariaLabel="Filter by lifecycle state"
              placeholder="All States"
              options={lifecycleOptions}
              value={filterStates}
              onChange={onFilterStatesChange}
              triggerClassName="flex-1"
            />
          </div>
          <MultiSelect
            ariaLabel="Filter by intent"
            placeholder="All Exceptions"
            options={intentOptions}
            value={filterIntents}
            onChange={onFilterIntentsChange}
            formatLabel={(v) => intentLabelFor(v, erp)}
            triggerClassName="flex-1"
          />
        </div>

        {/* Active-filter chip row — every applied filter as a removable
            chip. A "Clear all" link still appears on the right so the
            operator has a single one-click escape hatch. */}
        {hasActiveFilters && (
          <div className="flex items-start justify-between gap-8 py-6">
            <div className="flex items-center gap-4 flex-wrap">
              {filterDate === "today" && (
                <FilterChip
                  label="Today"
                  onRemove={() => onFilterDateChange(null)}
                />
              )}
              {filterStates.map((s) => (
                <FilterChip
                  key={`state-${s}`}
                  label={s.replace(/_/g, " ")}
                  onRemove={() =>
                    onFilterStatesChange(filterStates.filter((x) => x !== s))
                  }
                />
              ))}
              {filterIntents.map((i) => (
                <FilterChip
                  key={`intent-${i}`}
                  label={intentLabelFor(i, erp)}
                  onRemove={() =>
                    onFilterIntentsChange(filterIntents.filter((x) => x !== i))
                  }
                />
              ))}
              {/* Each parsed operator → its own chip. Removing the
                  chip rewrites the search string via `stringifyTokens`
                  so the operator can pare a complex query down one
                  constraint at a time. */}
              {parsedSearchOperators.map((op, idx) => (
                <FilterChip
                  key={`op-${op.key}-${idx}`}
                  label={`${op.key}: ${op.rawValue}`}
                  onRemove={() => {
                    const tokens = parseQuery(searchQuery);
                    tokens.operators.splice(idx, 1);
                    onSearchChange(stringifyTokens(tokens));
                  }}
                />
              ))}
              {/* Any free-text portion that remains after operators
                  are pulled out renders as a single quoted chip. */}
              {parseQuery(searchQuery).freeText && (
                <FilterChip
                  label={`"${parseQuery(searchQuery).freeText}"`}
                  onRemove={() => {
                    const tokens = parseQuery(searchQuery);
                    tokens.freeText = "";
                    onSearchChange(stringifyTokens(tokens));
                  }}
                />
              )}
            </div>
            <button
              onClick={onClearFilters}
              className="bg-transparent border-none cursor-pointer text-label font-semibold text-brand font-sans p-0 shrink-0 mt-1"
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
            {hasActiveFilters && (
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

/* ── Quick-filter pill ─────────────────────────────────────────────── */

function QuickPill({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "px-10 py-4 rounded-full text-label font-semibold cursor-pointer font-sans border transition-colors duration-fast",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        active
          ? "bg-brand text-white border-brand"
          : "bg-surface-primary text-text-secondary border-border hover:border-text-quaternary hover:text-text-primary",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none",
      )}
    >
      {label}
    </button>
  );
}

/* ── Active-filter chip (label + × remover) ────────────────────────── */

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-4 px-8 py-2 rounded-full bg-brand-subtle text-label font-semibold text-brand">
      {label}
      <button
        type="button"
        aria-label={`Remove filter ${label}`}
        onClick={onRemove}
        className="bg-transparent border-none cursor-pointer text-brand p-0 leading-none flex items-center"
      >
        <X size={10} />
      </button>
    </span>
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
  const erp = useErpProfile();
  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      data-exception-id={exc.id}
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

      {/* Row 2: Intent tag + lifecycle badge.
          The shadow-verdict pill is intentionally omitted here per the
          PO + TRB ruling: the list card carries lifecycle state only.
          Operators see the explicit "Audit Result" label in the detail
          pane (HeaderRibbon), which avoids partial-truth presentation
          while reducing list density. */}
      <div className="flex items-center gap-4 flex-wrap">
        {exc.intent && (
          <Badge variant="brand" size="sm" icon={null}>
            {intentLabelFor(exc.intent, erp)}
          </Badge>
        )}
        <Badge variant={lifecycleVariant(exc.lifecycle_state)} size="sm">
          {exc.lifecycle_state.replace(/_/g, " ")}
        </Badge>
      </div>
    </div>
  );
}
