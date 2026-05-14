// /cases — primary CSR work surface (ADR-041 P3).
//
// Two-pane workspace: queue (left) + case detail (right), URL-driven
// via `?case=<caseId>&record=<recordId>`. Replaces the prior full-
// width queue that forced a route change on every drill-in.
//
// The UX architect's panel recommendation was three-pane (case list
// | record list | detail); P3a ships the queue+detail split because
// the record list already lives INSIDE `CaseDetailPanel` as the
// "Attached records" picker. P3c will lift the picker out when the
// responsive-collapse + pin-selection work lands.
//
// Architecturally:
//   * No per-intent dispatch (Guardrail #1). Source vocabulary from
//     ALLOWED_CASE_SOURCES (api.ts boundary).
//   * No threshold logic in page code — `slaSnapshot` is exported as
//     a pure derivation (visual policy ratified by Frontend Platform).
//   * `/cases/[id]` survives as a focused single-case view for deep
//     links and notifications; this page is the workspace where the
//     queue stays visible while the operator works the detail.

"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  PackageCheck,
} from "lucide-react";

import { useSignOut } from "@/hooks/useSignOut";
import { Badge } from "@/components/ui/Badge";
import { NavBar } from "@/components/ui/NavBar";
import { ALLOWED_CASE_SOURCES, casesApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useHealth } from "@/hooks/useHealth";
import { useKeyboardListNav } from "@/hooks/useKeyboardListNav";
import { useSlaTicker } from "@/hooks/useSlaTicker";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  isCaseInvalidationEvent,
  useCases,
} from "@/hooks/useManualOrderCases";
import { STATUS_LABEL } from "@/lib/cases";
import { cn } from "@/lib/utils";
import type {
  CaseSource,
  CaseStatus,
  OrderCase,
  SlaBand,
  SlaSnapshot,
} from "@/types/cases";
import type { ExceptionDetailResponse } from "@/types/api";

import { CaseDetailPanel } from "./CaseDetailPanel";
import { NAV_TABS } from "@/config/nav-tabs";


/* ── Visual mappings (vendor-neutral; per-source / per-status badge style) ── */

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

const SLA_BAND_VARIANT: Record<SlaBand, "error" | "warning" | "success" | "neutral"> = {
  breached: "error",
  at_risk: "warning",
  today: "warning",
  comfortable: "success",
  none: "neutral",
};


/**
 * Derive the SLA visualisation snapshot for a case. Pure function —
 * tests assert against it directly. Exported because the home page
 * and other case-rendering surfaces (CaseDetailPanel, ChromeBoundary
 * banner) consume it.
 */
export function slaSnapshot(
  case_: OrderCase,
  now: Date = new Date(),
): SlaSnapshot {
  const deadline = case_.sla_deadline;
  if (!deadline) {
    return { band: "none", deadline: null, label: "No SLA set" };
  }
  const target = new Date(deadline).getTime();
  if (Number.isNaN(target)) {
    return { band: "none", deadline, label: "Invalid SLA" };
  }
  const ms = target - now.getTime();

  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  let band: SlaBand;
  let label: string;
  if (ms < 0) {
    band = "breached";
    label = `Breached ${formatDeltaShort(-ms)} ago`;
  } else if (ms < TWO_HOURS_MS) {
    band = "at_risk";
    label = `Due in ${formatDeltaShort(ms)}`;
  } else if (ms < ONE_DAY_MS) {
    band = "today";
    label = `Due in ${formatDeltaShort(ms)}`;
  } else {
    band = "comfortable";
    label = `Due in ${formatDeltaShort(ms)}`;
  }
  return { band, deadline, ms_until_deadline: ms, label };
}

function formatDeltaShort(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}


/* ── Filters ────────────────────────────────────────────────────── */

interface CasesFilters {
  source: CaseSource | null;
  status: CaseStatus | null;
}


/* ── Page ───────────────────────────────────────────────────────── */

export const requiresAuth = true;

// `useSearchParams` must be inside a <Suspense> boundary for the
// build to succeed in Next.js App Router. The page is split into a
// shell (NavBar + Suspense wrapper) and a workspace (the searchParams-
// reading body) so static rendering still works for the chrome.
export default function CasesPage() {
  const router = useRouter();
  const { user, visibleTabs } = useAuth();
  const { health } = useHealth();
  const handleSignOut = useSignOut();

  const userName = user?.name || "User";
  const userInitials = (
    (user as { avatar_initials?: string } | null)?.avatar_initials
    || userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  );
  const userTitle = (user as { title?: string } | null)?.title || "";
  const filteredTabs = visibleTabs.length > 0
    ? NAV_TABS.filter((t) => visibleTabs.includes(t.id))
    : NAV_TABS;

  return (
    <div className="min-h-screen bg-surface-page font-sans text-body text-text-primary leading-normal">
      <NavBar
        tabs={filteredTabs}
        activeTab="cases"
        onTabChange={(id) => {
          const tab = NAV_TABS.find((t) => t.id === id);
          if (tab?.href) router.push(tab.href);
        }}
        userName={userName}
        userInitials={userInitials}
        userTitle={userTitle}
        agentCount={health?.allowed_intents?.length || 0}
        onSignOut={handleSignOut}
      />
      <Suspense fallback={<WorkspaceFallback />}>
        <CasesWorkspace />
      </Suspense>
    </div>
  );
}


function WorkspaceFallback() {
  return (
    <main className="p-32 max-w-[1280px] mx-auto">
      <div role="status" className="text-text-tertiary py-24" aria-live="polite">
        Loading cases…
      </div>
    </main>
  );
}


/**
 * The URL-bound workspace. Reads `?case=` and `?record=` via
 * `useSearchParams`; click handlers update the URL via
 * `router.replace` so back/forward + reload preserve the selection.
 */
function CasesWorkspace() {
  const router = useRouter();
  const search = useSearchParams();
  const selectedCaseId = search?.get("case") ?? undefined;
  const selectedRecordId = search?.get("record") ?? undefined;

  const [filters, setFilters] = useState<CasesFilters>({
    source: null,
    status: null,
  });

  // Right-pane state — case + records for `selectedCaseId`. Fetched
  // alongside the case so the header + picker both render on first
  // paint (no "loading records" flicker after the header lands).
  const [orderCase, setOrderCase] = useState<OrderCase | null>(null);
  const [records, setRecords] = useState<ExceptionDetailResponse[]>([]);
  const [policyHits, setPolicyHits] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMissing, setDetailMissing] = useState(false);

  /* ── Queue — silent live refresh via useCases + useWebSocket ── */
  // P3b restored the WS-driven silent refresh that landed on the
  // deleted /exceptions/page.tsx. `useCases` walks the cursor loop
  // (handles >limit cases) and exposes `refetch()`; the WS handler
  // calls it on any case_* event. `useCases` only flips `loading`
  // on the initial fetch — subsequent refetches are silent so the
  // queue doesn't flash a spinner under the operator's cursor.
  const {
    cases: rawCases,
    loading: listLoading,
    refetch,
  } = useCases(filters.source ?? undefined);

  // useCases doesn't take a status filter; apply it client-side so
  // the chip toolbar stays responsive without an extra round-trip.
  //
  // Pin-selection guard (UX architect 2026-05-13 panel ruling): if
  // `selectedCaseId` is set and the case doesn't match the active
  // filter (e.g., its status flipped from PENDING_REVIEW to RESOLVED
  // after a WS-driven refetch), keep it visible at the top of the
  // list rather than yanking the operator's row out from under them.
  // The visual treatment (`isPinned`) distinguishes the pin from a
  // regular filter match.
  const cases = useMemo<{ case_: OrderCase; isPinned: boolean }[]>(() => {
    const filtered = filters.status
      ? rawCases.filter((c) => c.status === filters.status)
      : rawCases;
    const wrapped = filtered.map((c) => ({ case_: c, isPinned: false }));
    if (
      selectedCaseId
      && !filtered.some((c) => c.case_id === selectedCaseId)
    ) {
      const pinned = rawCases.find((c) => c.case_id === selectedCaseId);
      if (pinned) return [{ case_: pinned, isPinned: true }, ...wrapped];
    }
    return wrapped;
  }, [rawCases, filters.status, selectedCaseId]);

  /* ── WS silent refresh wiring ───────────────────────────────── */
  useWebSocket({
    onEvent: (ev) => {
      if (isCaseInvalidationEvent(ev)) refetch();
    },
    onReconnect: refetch,
    onPollFallback: refetch,
  });

  /* ── Load the selected case's detail ────────────────────────── */
  useEffect(() => {
    if (!selectedCaseId) {
      setOrderCase(null);
      setRecords([]);
      setPolicyHits([]);
      setDetailMissing(false);
      return;
    }
    // Clear the prior case's data BEFORE the new fetch starts.
    // Without this, a fast case-switch (keyboard nav + click) re-
    // renders CaseDetailPanel with the OLD case's records still in
    // state — the panel's auto-mount effect then calls
    // onSelectRecord(records[0].id), writing the stale record's id
    // into the URL. By the time the new fetch finishes, the URL has
    // a record that doesn't exist on the new case, so the inline
    // ribbon never mounts ("many cases don't show detailed view"
    // bug, ADR-041 P3c follow-on).
    setOrderCase(null);
    setRecords([]);
    setPolicyHits([]);
    setDetailMissing(false);
    let cancelled = false;
    setDetailLoading(true);
    Promise.all([
      casesApi.get(selectedCaseId),
      casesApi.getRecords(selectedCaseId).catch(() => ({
        items: [] as ExceptionDetailResponse[],
        total: 0,
        aggregated_policy_hits: [] as string[],
      })),
    ])
      .then(([c, r]) => {
        if (cancelled) return;
        if (c) {
          setOrderCase(c);
          setRecords(r.items);
          setPolicyHits(r.aggregated_policy_hits);
        } else {
          setDetailMissing(true);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCaseId]);

  /* ── URL writes ─────────────────────────────────────────────── */
  const handleSelectCase = useCallback(
    (caseId: string) => {
      // Drop the `record` param when switching cases — the new case
      // has its own records; the auto-mount effect in CaseDetailPanel
      // will pick the right one.
      router.replace(`/cases?case=${encodeURIComponent(caseId)}`);
    },
    [router],
  );

  const handleSelectRecord = useCallback(
    (recordId: string) => {
      if (!selectedCaseId) return;
      router.replace(
        `/cases?case=${encodeURIComponent(selectedCaseId)}` +
          `&record=${encodeURIComponent(recordId)}`,
      );
    },
    [router, selectedCaseId],
  );

  /* ── SLA-driven sort ────────────────────────────────────────── */
  // PO #20 (issue #133): tick once a minute so the band labels and
  // sort order stay live without a re-fetch.
  const tickNow = useSlaTicker();
  const sorted = useMemo(() => {
    // Sort by SLA urgency (most-urgent first). The pinned row's
    // sort position is the same as it would be without pinning —
    // visual treatment alone distinguishes it. Filter-pinned rows
    // therefore stay near the top of the SLA-sorted list because
    // SLA-driven sort + pin both favour "most attention-worthy".
    return [...cases]
      .map(({ case_, isPinned }) => ({
        case_,
        isPinned,
        sla: slaSnapshot(case_, tickNow),
      }))
      .sort((a, b) => {
        const aMs = a.sla.ms_until_deadline ?? Number.POSITIVE_INFINITY;
        const bMs = b.sla.ms_until_deadline ?? Number.POSITIVE_INFINITY;
        return aMs - bMs;
      });
  }, [cases, tickNow]);

  /* ── Keyboard nav (j / k / ArrowDown / ArrowUp / Home / End) ── */
  // Plug the canonical hook into the queue. The hook gates on
  // typing-in-input + Cmd/Ctrl combos so search inputs and command
  // palettes keep their own bindings. Selection updates the URL via
  // handleSelectCase, which preserves the back/forward semantics.
  const queueRef = useRef<HTMLUListElement | null>(null);
  useKeyboardListNav({
    items: sorted,
    getId: ({ case_ }) => case_.case_id,
    selectedId: selectedCaseId ?? null,
    onSelect: handleSelectCase,
    containerRef: queueRef,
    enabled: sorted.length > 0,
  });

  return (
    <main
      className={cn(
        "max-w-[1600px] mx-auto p-24",
        "grid gap-24",
        // Two-pane layout: queue ~360px, detail flex. Below 1024px
        // (CSS variable breakpoint), the right pane stacks below the
        // queue — P3c's responsive-collapse work will turn it into a
        // proper overlay/popover.
        "grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]",
      )}
    >
      {/* ── Left pane: queue ────────────────────────────────── */}
      <aside
        aria-label="Case queue"
        className="bg-surface-primary border border-border rounded-md shadow-xs flex flex-col min-h-0"
      >
        <div className="p-16 border-b border-border-subtle">
          <h1 className="text-heading font-semibold text-text-primary mb-4">
            Cases
          </h1>
          <p className="text-caption text-text-tertiary leading-normal">
            Sorted by SLA. Select one to open its workspace on the right.
          </p>
        </div>

        {/* Filter chips. ALLOWED_CASE_SOURCES comes from the api.ts
            boundary; page code never names the source literals
            inline (Guardrail #1). */}
        <div
          role="toolbar"
          aria-label="Case filters"
          className="flex items-center flex-wrap gap-4 px-16 py-12 border-b border-border-subtle"
        >
          <FilterChip
            label="All"
            active={filters.source === null}
            onClick={() => setFilters((f) => ({ ...f, source: null }))}
          />
          {ALLOWED_CASE_SOURCES.map((src) => (
            <FilterChip
              key={src}
              label={SOURCE_LABEL[src as CaseSource] ?? SOURCE_LABEL.default}
              active={filters.source === src}
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  source: f.source === src ? null : (src as CaseSource),
                }))
              }
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {listLoading && (
            <div role="status" className="text-text-tertiary px-16 py-24" aria-live="polite">
              Loading cases…
            </div>
          )}
          {!listLoading && sorted.length === 0 && (
            <div role="status" className="text-text-tertiary px-16 py-24">
              <CheckCircle2 size={16} className="inline mr-6" aria-hidden />
              No cases match the current filters.
            </div>
          )}
          {!listLoading && sorted.length > 0 && (
            <ul
              ref={queueRef}
              role="listbox"
              aria-label="Cases"
              aria-activedescendant={
                selectedCaseId ? `case-row-${selectedCaseId}` : undefined
              }
              tabIndex={0}
              className="m-0 p-0 list-none"
            >
              {sorted.map(({ case_, sla, isPinned }) => {
                const isSelected = case_.case_id === selectedCaseId;
                return (
                  <li key={case_.case_id} className="border-b border-border-subtle">
                    <button
                      id={`case-row-${case_.case_id}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-keyboard-nav-id={case_.case_id}
                      data-pinned={isPinned || undefined}
                      onClick={() => handleSelectCase(case_.case_id)}
                      className={cn(
                        "w-full text-left py-12 px-16 flex flex-col gap-4",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                        "transition-colors duration-fast",
                        isSelected
                          ? "bg-surface-row-active"
                          : "hover:bg-surface-secondary",
                      )}
                    >
                      <div className="flex items-center gap-8">
                        <Badge variant="neutral" size="sm">
                          {SOURCE_ICON[case_.source as CaseSource] ??
                            SOURCE_ICON.default}
                          <span className="ml-4">
                            {SOURCE_LABEL[case_.source as CaseSource] ??
                              SOURCE_LABEL.default}
                          </span>
                        </Badge>
                        <Badge
                          variant={SLA_BAND_VARIANT[sla.band]}
                          size="sm"
                          aria-label={`SLA: ${sla.label}`}
                        >
                          {sla.band === "breached" && (
                            <AlertTriangle size={10} aria-hidden className="mr-4" />
                          )}
                          <Clock size={10} aria-hidden className="mr-4" />
                          {sla.label}
                        </Badge>
                        {isPinned && (
                          // Pin-selection guard — the selected case
                          // doesn't match the active filter but stays
                          // visible so the operator's cursor isn't
                          // yanked. The badge tells them "this is
                          // your row even though it's filtered out".
                          <Badge
                            variant="info"
                            size="sm"
                            aria-label="Pinned because selected"
                          >
                            Pinned
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-8">
                        <span className="font-mono text-body text-text-primary truncate">
                          {case_.customer_po_number ??
                            case_.sales_order_id ??
                            case_.case_id}
                        </span>
                      </div>
                      <span className="text-caption text-text-tertiary">
                        {STATUS_LABEL[case_.status] ?? case_.status}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Right pane: case workspace ──────────────────────── */}
      <section
        aria-label="Case workspace"
        className="bg-surface-primary border border-border rounded-md shadow-xs p-24 min-h-[60vh]"
      >
        {!selectedCaseId && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-12 text-text-tertiary">
            <Mail size={24} aria-hidden />
            <div className="text-body">Select a case from the queue to open its workspace.</div>
            <div className="text-caption max-w-[420px]">
              The Approve / Reject / Override / Escalate / Re-analyze ribbon
              mounts here for the selected record.
            </div>
          </div>
        )}
        {selectedCaseId && detailLoading && (
          <div role="status" className="text-text-tertiary py-24" aria-live="polite">
            Loading case…
          </div>
        )}
        {selectedCaseId && !detailLoading && detailMissing && (
          <div role="status" className="text-text-tertiary py-24">
            Case not found: <code>{selectedCaseId}</code>
          </div>
        )}
        {/* Render guard against fast case-switch race: don't show the
            panel until the fetched `orderCase.case_id` matches the
            current URL `?case=` value. Without this, a click → click
            sequence renders the panel with the prior case's records
            still in state, and CaseDetailPanel's auto-mount writes
            the wrong record id back into the URL. */}
        {selectedCaseId
          && !detailLoading
          && orderCase
          && orderCase.case_id === selectedCaseId && (
          <CaseDetailPanel
            orderCase={orderCase}
            attachedRecords={records}
            policyHits={policyHits}
            selectedRecordId={selectedRecordId}
            onSelectRecord={handleSelectRecord}
          />
        )}
      </section>
    </main>
  );
}


/* ── Tiny filter chip ───────────────────────────────────────────── */

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "px-12 py-4 rounded-full border text-caption transition-colors duration-fast",
        active
          ? "bg-brand-subtle border-brand text-brand font-semibold"
          : "bg-surface-primary border-border text-text-secondary hover:bg-surface-secondary",
      )}
    >
      {label}
    </button>
  );
}
