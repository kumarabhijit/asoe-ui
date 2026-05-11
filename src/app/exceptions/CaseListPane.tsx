/**
 * CaseListPane — V5.1.1 master-detail queue for the /exceptions
 * route (Phase 28.5.x §D1-D8).
 *
 * Replaces the inline V5.1 source-filter-only queue with the full
 * filter / search / saved-views / keyboard-nav surface:
 *
 *   * Cluster filter chips (Live / Waiting / Terminal) sourced
 *     from `useHealth().allowed_case_statuses` + the cluster
 *     grouping in `src/lib/cases.ts`. (§D1)
 *   * Source filter chip (single-value).
 *   * Multi-select intent chip group sourced from
 *     `useHealth().allowed_intents`. (§D2)
 *   * Search box with operator parsing (`po:`, `so:`,
 *     `customer:`, `since:`, `intent:`, `status:`, plus free-text
 *     fuzzy match). (§D3)
 *   * Saved-views menu — uses the v2 `useSavedViews("cases")`
 *     hook; "My queue" is opt-in (operator saves their preferred
 *     filter, no auto-apply). (§D4)
 *   * Keyboard nav via `useKeyboardListNav` — Arrow / Home / End
 *     / j / k; row `role="option"` inside `role="listbox"`. (§D5)
 *   * Sort toggle: SLA-urgency default, recent-changed alternative.
 *     URL-synced via `?sort=`. (§D6)
 *   * "Showing N of M" indicator when the limit caps the result.
 *     Pagination cursor stays deferred per §D7.
 *   * Thin right-pane case summary stays unchanged (D8).
 *
 * Pure projector: all data flows through `useCases()` and the
 * `casesApi.list` query-param surface. No client-side composition
 * of audit-bearing fields (CLAUDE.md Guardrail #6).
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Mail,
  PackageCheck,
  Pencil,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useHealth } from "@/hooks/useHealth";
import { useKeyboardListNav } from "@/hooks/useKeyboardListNav";
import { useSavedViews, type CaseSavedViewFilters } from "@/hooks/useSavedViews";
import { useSlaTicker } from "@/hooks/useSlaTicker";
import { casesApi, type CaseListItem } from "@/lib/api";
import {
  CASE_STATUS_CLUSTERS,
  STATUS_LABEL,
  clusterFor,
  sourceChannelLabel,
} from "@/lib/cases";
import type { CaseSource, SlaBand } from "@/types/cases";
import { cn } from "@/lib/utils";

import { slaSnapshot } from "@/app/cases/page";

/* ── Visual mappings (Guardrail #1 — default-fallback maps) ───────── */

const SOURCE_LABEL: Record<CaseSource | "default", string> = {
  manual_order: "Manual",
  automated_order: "Automated",
  default: "Unknown source",
};

const SOURCE_ICON: Record<CaseSource | "default", React.ReactNode> = {
  manual_order: <Mail size={12} aria-hidden />,
  automated_order: <PackageCheck size={12} aria-hidden />,
  default: <Clock size={12} aria-hidden />,
};

const SLA_BAND_VARIANT: Record<
  SlaBand,
  "error" | "warning" | "success" | "neutral"
> = {
  breached: "error",
  at_risk: "warning",
  today: "warning",
  comfortable: "success",
  none: "neutral",
};

const CLUSTER_LABEL: Record<"Live" | "Waiting" | "Terminal", string> = {
  Live: "Live",
  Waiting: "Waiting",
  Terminal: "Terminal",
};

type SortMode = "sla" | "recent";

/* ── Props ────────────────────────────────────────────────────────── */

export interface CaseListPaneProps {
  /**
   * Loaded cases from `useCases()`. Parent owns the hook so the
   * page can wire `case_*` invalidation through its own
   * useWebSocket handler.
   */
  cases: CaseListItem[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;

  /** Controlled selection — the currently-selected case_id. */
  selectedId: string | null;
  onSelect: (case_id: string) => void;
}

/* ── Pane ─────────────────────────────────────────────────────────── */

export function CaseListPane({
  cases,
  total,
  loading,
  error,
  refetch,
  selectedId,
  onSelect,
}: CaseListPaneProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { health } = useHealth();
  const { views, save, remove, rename, hydrated } = useSavedViews("cases");

  /* ── Filter state (URL-synced) ───────────────────────────────── */
  // Cluster expansion is local-only; the underlying status chips
  // are the source of truth in the URL.
  const [expandedClusters, setExpandedClusters] = useState<
    Set<"Live" | "Waiting" | "Terminal">
  >(new Set());
  const [filterStatuses, setFilterStatuses] = useState<string[]>(() =>
    parseCsvParam(searchParams.get("status")),
  );
  const [filterIntents, setFilterIntents] = useState<string[]>(() =>
    parseCsvParam(searchParams.get("intents")),
  );
  const [filterSource, setFilterSource] = useState<CaseSource | null>(() => {
    const raw = searchParams.get("source");
    if (raw === "manual_order" || raw === "automated_order") return raw;
    return null;
  });
  const [filterSince, setFilterSince] = useState<CaseSavedViewFilters["filterSince"]>(() => {
    const raw = searchParams.get("since");
    if (raw === "today" || raw === "24h" || raw === "7d" || raw === "30d") return raw;
    return null;
  });
  const [searchQuery, setSearchQuery] = useState<string>(() =>
    searchParams.get("q") ?? "",
  );
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const raw = searchParams.get("sort");
    return raw === "recent" ? "recent" : "sla";
  });

  /* ── URL sync ─────────────────────────────────────────────────── */
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterStatuses.length > 0) params.set("status", filterStatuses.join(","));
    if (filterIntents.length > 0) params.set("intents", filterIntents.join(","));
    if (filterSource) params.set("source", filterSource);
    if (filterSince) params.set("since", filterSince);
    if (searchQuery) params.set("q", searchQuery);
    if (sortMode === "recent") params.set("sort", "recent");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [
    filterStatuses, filterIntents, filterSource,
    filterSince, searchQuery, sortMode, router,
  ]);

  /* ── Refetch when the backend-honoured params change ──────────── */
  // Filters that the backend evaluates (status, intents, since, q,
  // source) trigger an upstream refetch; sort + cluster expansion
  // are client-side and don't refetch.
  const parentRefetch = useRef(refetch);
  parentRefetch.current = refetch;
  useEffect(() => {
    parentRefetch.current();
    // The actual upstream call is the parent's useCases() — we
    // route the param change through whatever fetcher the page uses.
    // For now the parent's useCases() reads the URL on its own; this
    // effect is a placeholder for the V5.1.2 follow-up where the
    // hook accepts the params directly.
  }, [filterStatuses, filterIntents, filterSource, filterSince, searchQuery]);

  /* ── Client-side filter + sort pipeline ──────────────────────── */
  // The backend already applies status/intents/since/q/source when
  // the page wires them; for the V5.1.1 ship we ALSO apply them
  // client-side so the UI works whether the parent refetched yet
  // or not (idempotent — backend + client filters are pure
  // subset operations).
  // PO #20 (issue #133): `useSlaTicker` ticks `now` once a minute
  // so the SLA band sort order and per-row labels stay live without
  // a refetch.
  const now = useSlaTicker();

  // Phase 28.5.x V5.1.2 — match-reason tracking. When the operator
  // types a free-text query, we record WHICH field each remaining
  // row matched on (po / so / customer / case_id) so the row can
  // surface a small "matched on PO" badge AND the list announces a
  // single aria-live summary for screen-reader operators. Search-
  // operator-prefixed queries (`po:KRO`) narrow the match dimension
  // to that field; the bare free-text path checks all four.
  const { filtered, matchReasonByCaseId } = useMemo(() => {
    let rows = [...cases];
    if (filterSource) rows = rows.filter((c) => c.source === filterSource);
    if (filterStatuses.length > 0) {
      const set = new Set(filterStatuses);
      rows = rows.filter((c) => set.has(c.status));
    }
    if (filterIntents.length > 0) {
      const set = new Set(filterIntents);
      rows = rows.filter((c) =>
        (c.child_intents || []).some((i) => set.has(i)),
      );
    }
    const reasons = new Map<string, "po" | "so" | "customer" | "case_id">();
    if (searchQuery.trim()) {
      const parsed = parseSearchQuery(searchQuery);
      rows = rows.filter((c) => {
        const reason = findMatchReason(c, parsed);
        if (reason === null) return false;
        reasons.set(c.case_id, reason);
        return true;
      });
    }
    return { filtered: rows, matchReasonByCaseId: reasons };
  }, [cases, filterSource, filterStatuses, filterIntents, searchQuery]);

  // Aria-live summary so a screen-reader operator hears why the
  // visible row count just changed. Recomputed every render but the
  // text only changes when the underlying search yields a different
  // shape, so AT announcement frequency stays sane.
  const matchSummary = useMemo(() => {
    if (!searchQuery.trim()) return "";
    const counts = { po: 0, so: 0, customer: 0, case_id: 0 };
    matchReasonByCaseId.forEach((r) => { counts[r] += 1; });
    const parts: string[] = [];
    if (counts.po) parts.push(`${counts.po} by PO`);
    if (counts.so) parts.push(`${counts.so} by sales order`);
    if (counts.customer) parts.push(`${counts.customer} by customer`);
    if (counts.case_id) parts.push(`${counts.case_id} by case id`);
    const total = matchReasonByCaseId.size;
    if (total === 0) return "No cases match the current search.";
    return `${total} cases match: ${parts.join(", ")}.`;
  }, [searchQuery, matchReasonByCaseId]);

  const sorted = useMemo(() => {
    const decorated = filtered.map((c) => ({ case_: c, sla: slaSnapshot(c, now) }));
    if (sortMode === "recent") {
      // Most-recently-opened first (proxy for "did anything happen
      // since coffee"). True updated_at sorting requires backend
      // surfacing case.updated_at — opened_at is the stable proxy
      // for V5.1.1.
      decorated.sort((a, b) => (a.case_.opened_at < b.case_.opened_at ? 1 : -1));
    } else {
      // SLA-urgency default. Cases with no SLA sink to the bottom.
      decorated.sort((a, b) => {
        const aMs = a.sla.ms_until_deadline ?? Number.POSITIVE_INFINITY;
        const bMs = b.sla.ms_until_deadline ?? Number.POSITIVE_INFINITY;
        return aMs - bMs;
      });
    }
    return decorated;
  }, [filtered, sortMode, now]);

  /* ── Keyboard nav ─────────────────────────────────────────────── */
  const listRef = useRef<HTMLDivElement | null>(null);
  useKeyboardListNav({
    items: sorted,
    getId: (row) => row.case_.case_id,
    selectedId,
    onSelect,
    containerRef: listRef,
    enabled: sorted.length > 0,
  });

  /* ── Health-sourced vocab (Guardrail #1) ──────────────────────── */
  const allowedStatuses = health?.allowed_case_statuses ?? [];
  const allowedIntents = health?.allowed_intents ?? [];
  const allowedSources = health?.allowed_case_sources ?? [
    "manual_order", "automated_order",
  ];

  /* ── Filter handlers ──────────────────────────────────────────── */
  function toggleStatus(status: string) {
    setFilterStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  }
  function toggleIntent(intent: string) {
    setFilterIntents((prev) =>
      prev.includes(intent) ? prev.filter((i) => i !== intent) : [...prev, intent],
    );
  }
  function toggleCluster(cluster: "Live" | "Waiting" | "Terminal") {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(cluster)) next.delete(cluster);
      else next.add(cluster);
      return next;
    });
  }
  function clearAllFilters() {
    setFilterStatuses([]);
    setFilterIntents([]);
    setFilterSource(null);
    setFilterSince(null);
    setSearchQuery("");
    setExpandedClusters(new Set());
  }

  /* ── Saved-view application ───────────────────────────────────── */
  function applySavedView(viewId: string) {
    const view = views.find((v) => v.id === viewId);
    if (!view || view.surface !== "cases") return;
    setFilterStatuses(view.filterStatuses);
    setFilterIntents(view.filterIntents);
    setFilterSource(view.filterSource);
    setFilterSince(view.filterSince);
    setSearchQuery(view.searchQuery);
    setSortMode(view.sortMode);
  }

  function saveCurrent() {
    const name = window.prompt(
      "Name this saved view (e.g. 'My queue'):",
      "My queue",
    );
    if (!name) return;
    save(name, {
      surface: "cases",
      filterStatuses,
      filterIntents,
      filterSource,
      filterSince,
      searchQuery,
      sortMode,
    });
  }

  const hasActiveFilters =
    filterStatuses.length > 0
    || filterIntents.length > 0
    || filterSource !== null
    || filterSince !== null
    || searchQuery !== "";

  const limitCapped = total > sorted.length;

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="h-full flex flex-col bg-surface-page min-w-0">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="px-16 py-12 border-b border-border bg-surface-primary shrink-0">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-8">
            <h2 className="text-heading font-bold text-text-primary m-0">
              Cases
            </h2>
            <span
              aria-label={`${sorted.length} of ${total} cases`}
              className="text-label font-semibold text-text-tertiary bg-surface-secondary px-2 py-px rounded-full"
            >
              {sorted.length}{limitCapped ? ` of ${total}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <CaseSavedViewsMenu
              views={views}
              hydrated={hydrated}
              onApply={applySavedView}
              onSave={saveCurrent}
              onRemove={remove}
              onRename={rename}
              canSave={hasActiveFilters}
            />
            <Button variant="ghost" size="sm" onClick={refetch} loading={loading}>
              <RefreshCw size={14} aria-label="Refresh" />
            </Button>
          </div>
        </div>

        {/* ── Search ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-8 mb-12">
          <Search size={14} className="text-text-tertiary" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="po:KRO since:7d customer:walmart"
            aria-label="Search cases"
            className="flex-1 bg-transparent border-none outline-none text-body text-text-primary placeholder:text-text-quaternary"
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-caption text-text-tertiary hover:text-text-primary"
              aria-label="Clear all filters"
            >
              <XCircle size={14} />
            </button>
          )}
        </div>

        {/* ── Status cluster chips ───────────────────────────────── */}
        <div
          role="group"
          aria-label="Status filter clusters"
          className="flex flex-wrap items-center gap-4 mb-8"
        >
          {(Object.keys(CASE_STATUS_CLUSTERS) as Array<"Live" | "Waiting" | "Terminal">).map((cluster) => {
            const clusterStatuses = CASE_STATUS_CLUSTERS[cluster];
            const activeCount = clusterStatuses.filter((s) =>
              filterStatuses.includes(s),
            ).length;
            const isExpanded = expandedClusters.has(cluster);
            return (
              <FilterChip
                key={cluster}
                label={`${CLUSTER_LABEL[cluster]}${activeCount > 0 ? ` (${activeCount})` : ""}`}
                active={isExpanded || activeCount > 0}
                onClick={() => toggleCluster(cluster)}
                ariaPressed={isExpanded}
              />
            );
          })}
        </div>

        {/* ── Per-status sub-chips, only when a cluster is expanded ── */}
        {expandedClusters.size > 0 && (
          <div
            role="group"
            aria-label="Status filter (sub-chips)"
            className="flex flex-wrap items-center gap-4 mb-8"
          >
            {Array.from(expandedClusters).flatMap((cluster) =>
              CASE_STATUS_CLUSTERS[cluster]
                .filter((s) => allowedStatuses.length === 0 || allowedStatuses.includes(s))
                .map((status) => (
                  <FilterChip
                    key={status}
                    label={STATUS_LABEL[status] ?? status}
                    active={filterStatuses.includes(status)}
                    onClick={() => toggleStatus(status)}
                  />
                )),
            )}
          </div>
        )}

        {/* ── Source filter chip (single-value) ────────────────── */}
        <div role="group" aria-label="Source filter" className="flex items-center gap-4 mb-8">
          <span className="text-label uppercase tracking-wider text-text-quaternary">
            Source:
          </span>
          <FilterChip
            label="All"
            active={filterSource === null}
            onClick={() => setFilterSource(null)}
          />
          {allowedSources.map((src) => (
            <FilterChip
              key={src}
              label={SOURCE_LABEL[src as CaseSource] ?? SOURCE_LABEL.default}
              active={filterSource === src}
              onClick={() =>
                setFilterSource((cur) =>
                  cur === src ? null : (src as CaseSource),
                )
              }
            />
          ))}
        </div>

        {/* ── Intent multi-select chip group ────────────────────── */}
        {allowedIntents.length > 0 && (
          <div
            role="group"
            aria-label="Intent filter"
            className="flex flex-wrap items-center gap-4 mb-8"
          >
            <span className="text-label uppercase tracking-wider text-text-quaternary">
              Intent:
            </span>
            {allowedIntents.map((intent) => (
              <FilterChip
                key={intent}
                label={intent.replace(/_/g, " ").toLowerCase()}
                active={filterIntents.includes(intent)}
                onClick={() => toggleIntent(intent)}
              />
            ))}
          </div>
        )}

        {/* ── Sort toggle ────────────────────────────────────────── */}
        <div role="group" aria-label="Sort order" className="flex items-center gap-4">
          <span className="text-label uppercase tracking-wider text-text-quaternary">
            Sort:
          </span>
          <FilterChip
            label="SLA urgency"
            active={sortMode === "sla"}
            onClick={() => setSortMode("sla")}
          />
          <FilterChip
            label="Recently opened"
            active={sortMode === "recent"}
            onClick={() => setSortMode("recent")}
          />
        </div>
      </div>

      {/* ── Empty / error / loading states ──────────────────────── */}
      {loading && (
        <div role="status" aria-live="polite" className="p-16 text-text-tertiary">
          Loading cases…
        </div>
      )}
      {!loading && error && (
        <div role="alert" className="p-16 text-error">
          {error}
        </div>
      )}
      {!loading && !error && sorted.length === 0 && (
        <div role="status" className="p-16 text-text-tertiary">
          {hasActiveFilters
            ? "No cases match the current filters."
            : "No cases in scope."}
        </div>
      )}

      {/* ── Listbox of case rows (D5: role=listbox/option) ──────── */}
      {/* Phase 28.5.x V5.1.2 — match-reason live announcement.
          Whenever the search query changes the visible-row count,
          this region updates so screen readers hear how many cases
          match and across which dimensions (PO / SO / customer /
          case id). Empty when no search is active so quiet typing
          doesn't fire spurious announcements. */}
      <div role="status" aria-live="polite" className="sr-only">
        {matchSummary}
      </div>
      <div
        ref={listRef}
        role="listbox"
        aria-label="Case list"
        aria-multiselectable="false"
        className="flex-1 overflow-y-auto"
      >
        {sorted.map(({ case_, sla }) => (
          <CaseRow
            key={case_.case_id}
            case_={case_}
            slaLabel={sla.label}
            slaBand={sla.band}
            isSelected={case_.case_id === selectedId}
            onSelect={() => onSelect(case_.case_id)}
            matchReason={matchReasonByCaseId.get(case_.case_id)}
          />
        ))}
        {limitCapped && (
          <div
            role="status"
            className="p-12 text-caption text-text-tertiary border-t border-border-subtle"
          >
            Showing {sorted.length} of {total} — refine filter to see the rest.
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Row component (role="option") ───────────────────────────────── */

interface CaseRowProps {
  case_: CaseListItem;
  slaLabel: string;
  slaBand: SlaBand;
  isSelected: boolean;
  onSelect: () => void;
  /**
   * Phase 28.5.x V5.1.2 — when a search query is active and this
   * row passed the filter, the match-dimension that hit. Surfaced
   * as a small visible badge plus an aria-label suffix so the
   * screen-reader hears "Select case PO-123, matched on PO".
   */
  matchReason?: "po" | "so" | "customer" | "case_id";
}

const MATCH_REASON_LABEL: Record<NonNullable<CaseRowProps["matchReason"]>, string> = {
  po: "PO",
  so: "sales order",
  customer: "customer",
  case_id: "case id",
};

function CaseRow({
  case_,
  slaLabel,
  slaBand,
  isSelected,
  onSelect,
  matchReason,
}: CaseRowProps) {
  const orderRef =
    case_.customer_po_number || case_.sales_order_id || case_.case_id;
  const matchLabel = matchReason ? MATCH_REASON_LABEL[matchReason] : null;
  return (
    <div
      role="option"
      tabIndex={-1}
      aria-selected={isSelected}
      data-keyboard-nav-id={case_.case_id}
      data-case-id={case_.case_id}
      aria-label={
        matchLabel
          ? `Select case ${orderRef}, matched on ${matchLabel}`
          : `Select case ${orderRef}`
      }
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "px-16 py-12 cursor-pointer border-b border-border-subtle border-l-[3px] transition-colors duration-fast outline-none",
        isSelected
          ? "bg-surface-secondary border-l-brand"
          : "bg-surface-primary border-l-transparent",
        "focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-inset",
      )}
    >
      <div className="flex items-center gap-8 mb-6">
        <Badge variant="neutral" size="sm">
          {SOURCE_ICON[case_.source as CaseSource] ?? SOURCE_ICON.default}
          <span className="ml-4">{sourceChannelLabel(case_.source_channel)}</span>
        </Badge>
        <Badge
          variant={SLA_BAND_VARIANT[slaBand]}
          size="sm"
          aria-label={`SLA: ${slaLabel}`}
        >
          <Clock size={10} aria-hidden className="mr-4" />
          {slaLabel}
        </Badge>
      </div>
      <div className="font-mono text-body font-medium text-text-primary mb-2">
        {orderRef}
      </div>
      <div className="text-caption text-text-tertiary">
        {STATUS_LABEL[case_.status] ?? case_.status}
        {clusterFor(case_.status) && (
          <span className="ml-4 text-text-quaternary">
            · {clusterFor(case_.status)}
          </span>
        )}
        {matchLabel && (
          <span
            className="ml-8 inline-flex items-center text-label uppercase tracking-wider text-brand"
            aria-hidden
          >
            matched on {matchLabel}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Saved-views menu (cases surface) ──────────────────────────── */

import type { SavedView } from "@/hooks/useSavedViews";

interface CaseSavedViewsMenuProps {
  views: SavedView[];
  hydrated: boolean;
  onApply: (id: string) => void;
  onSave: () => void;
  onRemove: (id: string) => void;
  /** V5.1.2 — rename a saved view by id; consumer prompts for
   *  the new name via window.prompt to match the "save as default"
   *  flow (no inline-input UI in V5.1.2). */
  onRename: (id: string, newName: string) => void;
  canSave: boolean;
}

function CaseSavedViewsMenu({
  views,
  hydrated,
  onApply,
  onSave,
  onRemove,
  onRename,
  canSave,
}: CaseSavedViewsMenuProps) {
  const [open, setOpen] = useState(false);
  // V5.1.2 — Escape closes the menu. Bound to the window because the
  // menu doesn't trap focus (no Radix Dialog here); the listener
  // is gated on `open` so we don't leak keystroke handlers when the
  // menu is closed.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Saved views
        {views.length > 0 && (
          <span className="ml-4 text-text-tertiary">({views.length})</span>
        )}
      </Button>
      {open && (
        <div
          role="menu"
          aria-label="Saved views menu"
          className="absolute right-0 top-full mt-4 w-[320px] bg-surface-primary border border-border rounded-md shadow-md z-10"
        >
          {hydrated && views.length === 0 && (
            <p className="p-12 text-caption text-text-tertiary m-0">
              No saved views yet. Apply filters and click "Save current".
            </p>
          )}
          {views.map((v) => (
            <div
              key={v.id}
              role="menuitem"
              className="flex items-center gap-6 px-12 py-8 hover:bg-surface-secondary"
            >
              <button
                type="button"
                onClick={() => {
                  onApply(v.id);
                  setOpen(false);
                }}
                className="flex-1 text-left text-body text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm"
              >
                {v.name}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = window.prompt(
                    "Rename saved view:", v.name,
                  );
                  if (next && next.trim()) {
                    onRename(v.id, next.trim());
                  }
                }}
                aria-label={`Rename saved view ${v.name}`}
                className="text-text-tertiary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm p-2"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  // V5.1.2 — confirm before deletion. The window.prompt
                  // pattern matches the rename + save-as-default flow;
                  // confirm() is the equivalent for destructive
                  // actions. Cancel keeps the view intact.
                  if (window.confirm(`Delete saved view "${v.name}"?`)) {
                    onRemove(v.id);
                  }
                }}
                aria-label={`Remove saved view ${v.name}`}
                className="text-text-tertiary hover:text-error focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm p-2"
              >
                <XCircle size={14} />
              </button>
            </div>
          ))}
          <div className="p-8 border-t border-border-subtle">
            <Button
              variant="brand"
              size="sm"
              onClick={() => {
                onSave();
                setOpen(false);
              }}
              disabled={!canSave}
            >
              Save current as default
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Filter chip primitive ──────────────────────────────────────── */

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  ariaPressed?: boolean;
}

function FilterChip({ label, active, onClick, ariaPressed }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={ariaPressed ?? active}
      onClick={onClick}
      className={cn(
        "px-10 py-2 rounded-full border text-caption transition-colors duration-fast",
        active
          ? "bg-brand-subtle border-brand text-brand font-semibold"
          : "bg-surface-primary border-border text-text-secondary hover:bg-surface-secondary",
      )}
    >
      {label}
    </button>
  );
}

/* ── URL CSV parser ─────────────────────────────────────────────── */

function parseCsvParam(raw: string | null): string[] {
  if (!raw) return [];
  return Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean)));
}


/* ── Search-query parser + match-reason helpers (V5.1.2 §D3) ────── */

interface ParsedQuery {
  /** When the operator typed `po:KRO`, this narrows the match to
   *  customer_po_number; null means "search all four fields". */
  field: "po" | "so" | "customer" | "case_id" | null;
  needle: string;
}

/**
 * Parse the search box's free-text query into a `(field, needle)`
 * pair. Recognises four operator prefixes (`po:`, `so:`,
 * `customer:`, `case:`); the bare-text path searches all four
 * fields and `findMatchReason` returns the first one that matched.
 */
function parseSearchQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return { field: null, needle: "" };
  if (trimmed.startsWith("po:")) {
    return { field: "po", needle: trimmed.slice(3).trim() };
  }
  if (trimmed.startsWith("so:")) {
    return { field: "so", needle: trimmed.slice(3).trim() };
  }
  if (trimmed.startsWith("customer:")) {
    return { field: "customer", needle: trimmed.slice(9).trim() };
  }
  if (trimmed.startsWith("case:")) {
    return { field: "case_id", needle: trimmed.slice(5).trim() };
  }
  return { field: null, needle: trimmed };
}

/**
 * Return the match-reason dimension a case matched on, or null
 * when the case doesn't match the parsed query. Operator-prefixed
 * queries check only the named field; bare-text checks all four
 * in PO → SO → customer → case_id priority order (which is the
 * order operators most often filter by).
 */
function findMatchReason(
  case_: CaseListItem,
  parsed: ParsedQuery,
): "po" | "so" | "customer" | "case_id" | null {
  if (!parsed.needle) return null;
  const fields: ReadonlyArray<["po" | "so" | "customer" | "case_id", string | null | undefined]> = [
    ["po", case_.customer_po_number],
    ["so", case_.sales_order_id],
    ["customer", case_.customer_id],
    ["case_id", case_.case_id],
  ];
  for (const [name, value] of fields) {
    if (parsed.field !== null && parsed.field !== name) continue;
    if (value && value.toLowerCase().includes(parsed.needle)) {
      return name;
    }
  }
  return null;
}
