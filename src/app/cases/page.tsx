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
//   * No per-intent dispatch (Guardrail #1). Origin vocabulary from
//     ALLOWED_CASE_ORIGINS (api.ts boundary).
//   * No threshold logic in page code — `slaSnapshot` is exported as
//     a pure derivation (visual policy ratified by Frontend Platform).
//   * `/cases/[id]` survives as a focused single-case view for deep
//     links and notifications; this page is the workspace where the
//     queue stays visible while the operator works the detail.

"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ALLOWED_CASE_ORIGINS, casesApi, type CaseListItem } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useHealth } from "@/hooks/useHealth";
import { useKeyboardListNav } from "@/hooks/useKeyboardListNav";
import { usePaneFocusCycle } from "@/hooks/usePaneFocusCycle";
import { useSlaTicker } from "@/hooks/useSlaTicker";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  isCaseInvalidationEvent,
  useCases,
} from "@/hooks/useManualOrderCases";
import { STATUS_LABEL, attentionGroup } from "@/lib/cases";
import { cn } from "@/lib/utils";
import type {
  CaseStatus,
  Origin,
  OrderCase,
  SlaBand,
  SlaSnapshot,
} from "@/types/cases";
import type { ExceptionDetailResponse } from "@/types/api";

import { CaseDetailPanel } from "./CaseDetailPanel";
import { CasesQueueRow } from "./CasesQueueRow";
import { CasesQueueRowV2 } from "./CasesQueueRowV2";
import { ComplianceHitsRail } from "./ComplianceHitsRail";
import { RecordPreviewRail } from "./RecordPreviewRail";
import { NAV_TABS } from "@/config/nav-tabs";
import { useRowDensity, type RowDensity } from "@/hooks/useRowDensity";
import { casesRowV2Enabled } from "@/lib/flags";
import { HotkeyCheatsheet } from "@/components/ui/HotkeyCheatsheet";

// ADR-041 P3e §2.1 — gates the four-line queue row + density
// toggle. Rollout policy in `src/lib/flags.ts`: production stays
// OFF until Phase 3 sign-off completes; Vercel preview deploys
// flip ON so gate reviewers see the V2 surface. Resolved at
// module load so the value is stable across renders.
const CASES_ROW_V2 = casesRowV2Enabled();


/* ── Visual mappings (vendor-neutral; per-source / per-status badge style) ── */

// Origin chrome — KEEP the "Customer Inbox" label per requirements
// §4 Q7. The internal field flipped from CaseSource to Origin but
// the partner-facing chrome stays.
const ORIGIN_LABEL: Record<Origin | "default", string> = {
  CUSTOMER: "Customer Inbox",
  API: "API",
  default: "Unknown origin",
};

const ORIGIN_ICON: Record<Origin | "default", React.ReactNode> = {
  CUSTOMER: <Mail size={12} aria-hidden />,
  API: <PackageCheck size={12} aria-hidden />,
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
  origin: Origin | null;
  status: CaseStatus | null;
}

// The Customer Inbox lens (requirements §3/§4 Q7) is the CUSTOMER
// origin slice of /cases. Typed once here so the chip carries no
// bare enum literal in JSX (Guardrail #1).
const INBOX_LENS_ORIGIN: Origin = "CUSTOMER";


/* ── Page ───────────────────────────────────────────────────────── */

export const requiresAuth = true;

// `useSearchParams` must be inside a <Suspense> boundary for the
// build to succeed in Next.js App Router. The page is split into a
// shell (NavBar + Suspense wrapper) and a workspace (the searchParams-
// reading body) so static rendering still works for the chrome.
export default function CasesPage() {
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
    <main id="main-content" className="p-32 max-w-[1280px] mx-auto">
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
    origin: null,
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
  // PO finding 2026-05-28 round-2 #1 — dynamically collapse the
  // xl audit rail when none of its tenants have content. Each
  // tenant reports its contentful state (ComplianceHitsRail's
  // hits comes from page-level `policyHits`; RecordPreviewRail's
  // draft availability fires via the `onContentfulChange`
  // callback below). Combined `railHasContent` gates both the
  // 3-column grid override and the aside visibility — when
  // neither tenant has content the layout reverts to 2 columns.
  const [previewHasContent, setPreviewHasContent] = useState(false);
  const hitsHaveContent = (policyHits ?? []).length > 0;
  const railHasContent = hitsHaveContent || previewHasContent;

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
  } = useCases(filters.origin ?? undefined);

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
  const cases = useMemo<{ case_: CaseListItem; isPinned: boolean }[]>(() => {
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

  /* ── Post-action refresh ────────────────────────────────────── */
  // A HITL action on the inline-mounted record mutates that record's
  // `lifecycle_state`, which rolls up into `OrderCase.status`
  // (STATUS_MODEL.md §3). Re-fetch the selected case + its records so
  // the header status badge and the RecordListPane rows reflect the
  // new state, and `refetch()` the queue so the left pane agrees.
  // Unlike the selection-change effect this does NOT null out state
  // first — it overwrites in place, so the panel never unmounts and
  // the operator keeps their scroll position.
  const refreshCaseDetail = useCallback(async () => {
    const caseId = selectedCaseId;
    if (!caseId) return;
    const [c, r] = await Promise.all([
      casesApi.get(caseId),
      casesApi.getRecords(caseId).catch(() => ({
        items: [] as ExceptionDetailResponse[],
        total: 0,
        aggregated_policy_hits: [] as string[],
      })),
    ]);
    if (c) {
      setOrderCase(c);
      setRecords(r.items);
      setPolicyHits(r.aggregated_policy_hits);
    }
  }, [selectedCaseId]);

  const handleRecordActionComplete = useCallback(() => {
    // S2 sprint 2026-05-28 finding #11 — next-case auto-advance.
    //
    // Snapshot the next case in the VISIBLE queue BEFORE the
    // post-action refresh so the operator advances to the case
    // they would have picked next, even when the resolved record
    // filters out post-mutation and shifts every index. Pinning
    // (the row stays in place when an agent mutation excludes it
    // from the filter) is irrelevant here — we're using the
    // operator's pre-action mental order, not the post-state.
    //
    // If the operator was on the last visible case there is no
    // next pick; we leave the URL alone and the case projects
    // Resolved chrome. The operator can hit ArrowUp / k to walk
    // back into the queue.
    //
    // Reanalyze deliberately follows the same path: the new
    // analysis takes seconds to come back via WebSocket, and the
    // operator can review another case while it computes. They
    // can navigate back via the queue if they want to wait on the
    // same case.
    const idx = cases.findIndex((c) => c.case_.case_id === selectedCaseId);
    const next =
      idx >= 0 && idx + 1 < cases.length ? cases[idx + 1].case_ : null;

    refetch();
    void refreshCaseDetail();

    if (next) {
      router.replace(
        `/cases?case=${encodeURIComponent(next.case_id)}`,
        { scroll: false },
      );
    }
  }, [refetch, refreshCaseDetail, cases, selectedCaseId, router]);

  /* ── URL writes ─────────────────────────────────────────────── */
  // `scroll: false` on every router.replace below — selection is an
  // in-place workspace update, not a page navigation. Next.js App
  // Router scrolls to the top of the document by default on every
  // router.replace/push; without this flag, clicking a queue row (or
  // a record in the picker) yanks the viewport to the top and the
  // operator loses their place in a long, SLA-sorted list.
  const handleSelectCase = useCallback(
    (caseId: string) => {
      // Drop the `record` param when switching cases — the new case
      // has its own records; the auto-mount effect in CaseDetailPanel
      // will pick the right one.
      router.replace(`/cases?case=${encodeURIComponent(caseId)}`, {
        scroll: false,
      });
    },
    [router],
  );

  const handleSelectRecord = useCallback(
    (recordId: string) => {
      if (!selectedCaseId) return;
      router.replace(
        `/cases?case=${encodeURIComponent(selectedCaseId)}` +
          `&record=${encodeURIComponent(recordId)}`,
        { scroll: false },
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
        // Council 2026-06-07 — needs-human work scans first. Primary
        // key is the backend `attention_state` rank (NEEDS_HUMAN ->
        // IN_FLIGHT -> DONE); SLA urgency breaks ties WITHIN a group.
        // The grouping is the backend's disposition; the queue only
        // orders by it (it does not re-derive needs-human from status).
        const aRank = attentionGroup(a.case_.attention_state).rank;
        const bRank = attentionGroup(b.case_.attention_state).rank;
        if (aRank !== bRank) return aRank - bRank;
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

  // ── Density preference (ADR-041 P3e §2.4) ────────────────────
  // Only consulted when CASES_ROW_V2 is on; the legacy row has a
  // single density. Hook always mounts so the SSR hydration order
  // matches whether or not the flag is set.
  const [density, setDensity] = useRowDensity();

  // ── Cross-pane focus (F6 / Shift+F6) ────────────────────────
  // Tab walks the controls inside the focused pane; F6 jumps to the
  // next pane. The workspace is two panes — queue ↔ detail — with the
  // record list stacked at the top of the detail pane (reached by Tab
  // once focus is in the detail region). The detail section is made
  // focusable (tabIndex=-1) below so F6 can land on it.
  const detailRef = useRef<HTMLElement | null>(null);
  const paneRefs = useMemo(() => [queueRef, detailRef], []);
  usePaneFocusCycle(paneRefs);

  return (
    <main
      id="main-content"
      className={cn(
        "max-w-[1800px] mx-auto p-24",
        "grid gap-24",
        // Two-pane master-detail workspace:
        //   * <1024px  → single column; everything stacks vertically.
        //     Tablet / phone falls back to the queue-then-detail flow.
        //   * ≥1024px (lg)  → two columns: queue + detail. The attached-
        //     records picker is stacked at the top of the detail pane
        //     (full-width, no truncation) rather than a narrow dedicated
        //     column — a dedicated 3rd column squeezed the record rows
        //     and clipped their labels at common laptop widths.
        "grid-cols-1",
        "lg:grid-cols-[360px_minmax(0,1fr)]",
        // ADR-041 P3e §2.3 — at xl (≥1280px) the audit rail mounts
        // as a third column when CASES_ROW_V2 is on AND at least
        // one rail tenant has content to show (PO round-2 #1).
        // Without that AND we leave the 2-column layout in place
        // so the workspace gets the full width — better than a
        // 320px empty rail.
        CASES_ROW_V2 && railHasContent && "xl:grid-cols-[360px_minmax(0,1fr)_320px]",
        // Viewport-locked master-detail (the "Outlook" pane pattern the
        // layout tokens describe). Below `lg` the panes stack and use
        // normal document flow so nothing is clipped on tablet/phone.
        // At `lg`+ the workspace is pinned to the height left under the
        // sticky nav and clips its own overflow, so each pane's
        // `overflow-y-auto` actually engages and scrolls INDEPENDENTLY.
        // Without this the grid row grew to its tallest pane, the
        // per-pane `overflow-y-auto`/`min-h-0` never fired, and the
        // whole document scrolled — dragging the selected case's action
        // ribbon out of view on a long queue.
        "lg:h-[calc(100vh-var(--nav-height))] lg:overflow-hidden",
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
          {/* Discoverable keyboard affordances (Material UX — surface
              shortcuts where the interaction lives). */}
          <p className="mt-4 text-label text-text-quaternary leading-normal">
            <kbd className="font-sans">↑</kbd>/<kbd className="font-sans">↓</kbd>{" "}
            move · <kbd className="font-sans">F6</kbd> switch panes
          </p>
          {/* Density toggle — ADR-041 P3e §2.4. Only meaningful when
              the four-line V2 row is mounted; the legacy row has one
              density. The hook always runs (SSR-safe) so the toggle
              just hides without re-ordering hooks. */}
          {CASES_ROW_V2 && (
            <DensityToggle density={density} onChange={setDensity} />
          )}
        </div>

        {/* Filter chips. ALLOWED_CASE_ORIGINS comes from the api.ts
            boundary; page code never names the origin literals
            inline (Guardrail #1). The "Customer Inbox" label on the
            CUSTOMER chip is the visible partner-facing chrome
            (requirements §4 Q7). */}
        <div
          role="toolbar"
          aria-label="Case filters"
          className="flex items-center flex-wrap gap-4 px-16 py-12 border-b border-border-subtle"
        >
          <FilterChip
            label="All"
            active={filters.origin === null}
            onClick={() => setFilters((f) => ({ ...f, origin: null }))}
          />
          {ALLOWED_CASE_ORIGINS.map((o) => (
            <FilterChip
              key={o}
              label={ORIGIN_LABEL[o as Origin] ?? ORIGIN_LABEL.default}
              active={
                o === INBOX_LENS_ORIGIN
                  ? filters.origin === INBOX_LENS_ORIGIN
                  : filters.origin === o
              }
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  origin: f.origin === o ? null : (o as Origin),
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
              // The listbox is the single Tab stop and the durable focus
              // anchor; the active row is announced via
              // aria-activedescendant, not by moving DOM focus onto each
              // option (see useKeyboardListNav). So the visible focus
              // ring lives here, on the container.
              className="m-0 p-0 list-none rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring"
            >
              {sorted.map(({ case_, sla, isPinned }, rowIndex) => {
                const isSelected = case_.case_id === selectedCaseId;
                // Council 2026-06-07 — section header at each
                // attention-group boundary. `sorted` is ordered by
                // group rank, so a change from the previous row's
                // group is a clean boundary. The header is a
                // presentational <li> (role="presentation"): it is NOT
                // an option, so the listbox option set and the
                // keyboard nav (both driven off the flat `sorted`
                // array, which has no headers) are unaffected.
                const group = attentionGroup(case_.attention_state);
                const prevGroup =
                  rowIndex > 0
                    ? attentionGroup(sorted[rowIndex - 1].case_.attention_state)
                    : null;
                const showHeader = prevGroup === null || prevGroup.key !== group.key;
                const groupCount = sorted.filter(
                  (r) => attentionGroup(r.case_.attention_state).key === group.key,
                ).length;
                return (
                  <Fragment key={case_.case_id}>
                    {showHeader && (
                      <li
                        role="presentation"
                        className="flex items-center justify-between px-16 pt-16 pb-6 bg-surface-page"
                      >
                        <span className="text-label uppercase tracking-wider font-semibold text-text-tertiary">
                          {group.label}
                        </span>
                        <span
                          className="text-label font-mono text-text-quaternary"
                          aria-hidden
                        >
                          {groupCount}
                        </span>
                      </li>
                    )}
                  <li className="border-b border-border-subtle">
                    {CASES_ROW_V2 ? (
                      <CasesQueueRowV2
                        case_={case_}
                        sla={sla}
                        isSelected={isSelected}
                        isPinned={isPinned}
                        density={density}
                        onSelect={handleSelectCase}
                        rowIndex={rowIndex}
                      />
                    ) : (
                      <CasesQueueRow
                        case_={case_}
                        sla={sla}
                        isSelected={isSelected}
                        isPinned={isPinned}
                        onSelect={handleSelectCase}
                      />
                    )}
                  </li>
                  </Fragment>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Right pane: case workspace ──────────────────────── */}
      <section
        ref={detailRef}
        aria-label="Case workspace"
        // tabIndex=-1 so F6 can land focus on the pane as a region;
        // from there Tab reaches the record-list picker (stacked at the
        // top) and the action ribbon. Carries the same inset
        // focus-visible ring as the queue pane so an F6 jump INTO this
        // pane is visible — without it the operator can't tell focus
        // reached the detail pane and reads F6 as broken.
        tabIndex={-1}
        className={cn(
          "bg-surface-primary border border-border rounded-md shadow-xs p-24",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring",
          // Below lg: give the empty/detail state a comfortable minimum
          // height in normal document flow. At lg+: the pane is a grid
          // cell stretched to the viewport-locked row, so it scrolls its
          // own overflow instead of pushing the document taller.
          "min-h-[60vh] lg:min-h-0 lg:overflow-y-auto",
        )}
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
          <>
            {/* ADR-041 P3e §2.3 — when V2 is on, suppress the panel's
                own inline Compliance Hits and re-render it as a
                sibling that hides at xl. At xl the third column hosts
                the rail; below xl the inline render keeps Compliance
                Hits in the main column (Compliance veto on hiding
                them at smaller breakpoints). */}
            {CASES_ROW_V2 && (policyHits ?? []).length > 0 && (
              <div className="xl:hidden">
                <ComplianceHitsRail
                  hits={policyHits ?? []}
                  variant="inline"
                />
              </div>
            )}
            <CaseDetailPanel
              orderCase={orderCase}
              attachedRecords={records}
              policyHits={policyHits}
              selectedRecordId={selectedRecordId}
              onSelectRecord={handleSelectRecord}
              onRecordActionComplete={handleRecordActionComplete}
              suppressInlineComplianceHits={CASES_ROW_V2}
              // CaseDetailPanel renders the attached-records picker
              // (RecordListPane) stacked at the top of this pane by
              // default — the workspace no longer has a separate column
              // for it, so the operator always picks a record here.
            />
          </>
        )}
      </section>

      {/* ── Audit rail (xl-only third column) ───────────────────
          ADR-041 P3e §2.3 — at xl the Compliance Shadow hits live
          in their own column so they remain persistently visible
          without competing with the workspace. The aside is gated
          on the flag (`hidden` when V2 is off) and on xl breakpoint
          (`hidden xl:flex` when V2 is on). At lg and below the
          inline render under CaseDetailPanel takes over. */}
      {/* The aside is gated on `railHasContent` (PO round-2 #1)
          so the empty 320px column doesn't render when there are
          neither Compliance Hits nor a preview draft to show.
          RecordPreviewRail reports its contentful state via
          `onContentfulChange` so the page can flip the grid +
          aside together when the draft availability changes. */}
      <aside
        aria-label="Compliance audit rail"
        className={cn(
          "bg-surface-secondary border border-border-subtle rounded-md min-h-0 flex-col overflow-y-auto",
          CASES_ROW_V2 && railHasContent ? "hidden xl:flex" : "hidden",
        )}
      >
        {selectedCaseId && orderCase && (
          <>
            {/* Stacked rail tenants (PO 2026-05-28 #1 — UX panel
                synthesis). Compliance Hits stays at the top so
                SOX evidence-of-review is always above any preview
                content. The record preview (currently
                AI-drafted reply only) renders below when the
                selected record carries one; absent → no second
                section. No tabs — Compliance vetoed swap
                patterns that would hide hits off-screen. */}
            <ComplianceHitsRail hits={policyHits ?? []} variant="rail" />
            <RecordPreviewRail
              selectedRecordId={selectedRecordId}
              onContentfulChange={setPreviewHasContent}
            />
          </>
        )}
      </aside>
      {/* S2 sprint 2026-05-28 #5 — `?` keyboard-shortcut overlay.
          Self-mounted: zero props, toggles on its own `?` hotkey.
          Lives on /cases only for now (the surface with ribbon
          hotkeys); when the keymap reaches other routes the mount
          will move to the root layout. */}
      <HotkeyCheatsheet />
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


/* ── Density toggle ─────────────────────────────────────────────── */

interface DensityToggleProps {
  density: RowDensity;
  onChange: (value: RowDensity) => void;
}

function DensityToggle({ density, onChange }: DensityToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Row density"
      className="mt-8 inline-flex items-center gap-2 text-label"
    >
      <span className="text-text-quaternary">Density:</span>
      <DensityOption
        label="Comfortable"
        value="comfortable"
        active={density === "comfortable"}
        onSelect={onChange}
      />
      <DensityOption
        label="Compact"
        value="compact"
        active={density === "compact"}
        onSelect={onChange}
      />
    </div>
  );
}

interface DensityOptionProps {
  label: string;
  value: RowDensity;
  active: boolean;
  onSelect: (value: RowDensity) => void;
}

function DensityOption({ label, value, active, onSelect }: DensityOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(value)}
      className={cn(
        "px-6 py-2 rounded-sm border text-label transition-colors duration-fast",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        active
          ? "bg-brand-subtle border-brand text-brand font-semibold"
          : "bg-surface-primary border-border text-text-secondary hover:bg-surface-secondary",
      )}
    >
      {label}
    </button>
  );
}
