/**
 * Exception Queue — case-projected master-detail view (V5.1.1).
 *
 * Phase 28.5.x §28.5 → §D8 — `/exceptions` mounts the new
 * `CaseListPane` (cluster filter chips, intent multi-select,
 * search with operators, saved views, keyboard nav with
 * `role="listbox"`/`role="option"`, sort toggle). Right pane stays
 * the thin case-header summary with "Open case" → `/cases/{id}`
 * (D8: full-detail-in-pane stays deferred to V5.2). Click-through
 * still routes to `/cases/{case_id}` — the canonical case detail
 * surface.
 *
 * Architectural notes:
 *   * Pure list projector (CLAUDE.md Guardrail #6). No client-side
 *     composition; every field comes from OrderCase as the backend
 *     hands it.
 *   * No per-intent / per-lifecycle dispatch (Guardrail #1). Status
 *     and intent vocabularies come from `useHealth`; the chip bar
 *     sources its grouping from `src/lib/cases.ts` (the single
 *     consolidated STATUS_LABEL map this PR creates).
 *   * Direct exception detail (e.g. from a runbook deeplink)
 *     remains reachable at `/exceptions/[id]` — that route still
 *     mounts `ExceptionDetailPanel`.
 *   * WS invalidation: `case_*` events trigger silent refetch via
 *     `useCases().refetch()`.
 */
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Mail,
  PackageCheck,
  RefreshCw,
} from "lucide-react";

import { NavBar } from "@/components/ui/NavBar";
import { CaseViewBanner } from "@/components/ui/CaseViewBanner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MetricTile } from "@/components/ui/MetricTile";
import { useHealth } from "@/hooks/useHealth";
import { useAuth } from "@/hooks/useAuth";
import { useSlaTicker } from "@/hooks/useSlaTicker";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  useCases,
  isCaseInvalidationEvent,
} from "@/hooks/useManualOrderCases";
import { casesApi } from "@/lib/api";
import { STATUS_LABEL, isAwaitingHuman } from "@/lib/cases";
import { ChevronLeft } from "lucide-react";
import type { ExceptionDetailResponse } from "@/types/api";
import ExceptionDetailPanel from "./ExceptionDetailPanel";
import { cn } from "@/lib/utils";
import type { CaseSource, SlaBand } from "@/types/cases";
import type { WSEvent } from "@/types/websocket";

import { slaSnapshot } from "@/app/cases/page";
import { CaseListPane } from "./CaseListPane";

/* ── Visual mappings (Guardrail #1: default-fallback maps) ────────── */

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

import { NAV_TABS } from "@/config/nav-tabs";
// NAV_TABS consolidated to src/config/nav-tabs.ts (issue #133, PO #9).

/* ── Page ─────────────────────────────────────────────────────────── */

export default function ExceptionQueuePage() {
  return (
    <Suspense>
      <ExceptionQueueContent />
    </Suspense>
  );
}

function ExceptionQueueContent() {
  const router = useRouter();
  const { health } = useHealth();
  const { user, accessToken, visibleTabs } = useAuth();
  const { cases, total, loading, error, refetch } = useCases();

  const userName = user?.name || "User";
  const userInitials =
    (user as { avatar_initials?: string })?.avatar_initials
    || userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const userTitle = (user as { title?: string })?.title || "";
  const filteredTabs = visibleTabs.length > 0
    ? NAV_TABS.filter((t) => visibleTabs.includes(t.id))
    : NAV_TABS;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Phase 28.5.x V5.1.2 — per-record drill-in. Right pane state machine:
  //   selectedId=null              → "Select a case" placeholder
  //   selectedId + records.empty   → case header only (no children yet)
  //   selectedId + records + null  → records stack (operator picks one)
  //   selectedId + records + id    → ExceptionDetailPanel inline
  // Single-record cases auto-set selectedRecordId so the stack is skipped.
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [records, setRecords] = useState<ExceptionDetailResponse[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  useEffect(() => {
    document.title = "Exception Queue — ASOE";
  }, []);

  // Auto-select first case on initial load; keep selection if still
  // present after a refetch.
  useEffect(() => {
    if (cases.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((cur) => {
      if (cur && cases.some((c) => c.case_id === cur)) return cur;
      return cases[0].case_id;
    });
  }, [cases]);

  // Phase 28.5.x V5.1.2 — fetch attached records on case selection so
  // the right pane can route to the records-stack or directly to
  // ExceptionDetailPanel (single-record cases). Re-fetches on case
  // switch; resets the per-record selection.
  useEffect(() => {
    if (!selectedId) {
      setRecords([]);
      setSelectedRecordId(null);
      return;
    }
    let cancelled = false;
    setRecordsLoading(true);
    setSelectedRecordId(null);
    casesApi
      .getRecords(selectedId)
      .then((res) => {
        if (cancelled) return;
        setRecords(res.items);
        // Single-record case: skip the stack and drill straight in.
        // The operator's primary HITL flow is per-record action, so
        // we don't make them click through a one-item list.
        if (res.items.length === 1) {
          setSelectedRecordId(res.items[0].id);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setRecordsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleWsEvent = useCallback((event: WSEvent) => {
    if (isCaseInvalidationEvent(event)) {
      refetch();
    }
  }, [refetch]);

  useWebSocket({
    token: accessToken,
    enabled: !!user && !!accessToken,
    onEvent: handleWsEvent,
    onReconnect: refetch,
    onPollFallback: refetch,
  });

  // Metric tiles read from the unfiltered tenant cache (NOT the
  // pane's filtered view) — operators want the global "what's
  // outstanding?" count regardless of the chip state.
  // PO #20 (issue #133): `useSlaTicker` re-runs this block once a
  // minute so the breached counter and the selected-case SLA label
  // stay live as deadlines pass.
  const now = useSlaTicker();
  const breached = cases.filter((c) => {
    const ms = c.sla_deadline
      ? new Date(c.sla_deadline).getTime() - now.getTime()
      : Number.POSITIVE_INFINITY;
    return ms < 0;
  }).length;
  const awaitingHumanCount = cases.filter((c) => isAwaitingHuman(c.status)).length;
  const resolved = cases.filter((c) => c.status === "RESOLVED").length;

  const selected = cases.find((c) => c.case_id === selectedId) ?? null;
  const selectedSla = selected ? slaSnapshot(selected, now) : null;

  return (
    <div className="min-h-screen bg-surface-page font-sans text-body text-text-primary leading-normal">
      <NavBar
        tabs={filteredTabs}
        activeTab="exceptions"
        onTabChange={(id) => {
          const tab = NAV_TABS.find((t) => t.id === id);
          if (tab?.href) router.push(tab.href);
        }}
        userName={userName}
        userInitials={userInitials}
        userTitle={userTitle}
        agentCount={health?.allowed_intents?.length || 0}
        onSignOut={() => signOut({ callbackUrl: "/login" })}
      />

      <CaseViewBanner scopeLabel="Exception Queue" />

      {/* ── PAGE HEADER ── */}
      <div className="bg-surface-primary border-b border-border shadow-xs">
        <div className="max-w-[1440px] mx-auto px-32">
          <nav aria-label="Breadcrumb" className="py-8">
            {/* PO #6 (issue #133): Home is a real link, not a static
                label. */}
            <Link
              href="/home"
              className="text-caption text-text-tertiary hover:text-text-secondary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm"
            >
              Home
            </Link>
            <ChevronRight
              size={10}
              aria-hidden
              className="mx-4 text-text-tertiary align-middle inline"
            />
            <span className="text-caption text-text-secondary">
              Exception Queue
            </span>
          </nav>
          <div className="flex items-center justify-between py-8 pb-16">
            <div className="flex items-center gap-12">
              <div className="w-[40px] h-[40px] rounded-md bg-text-primary flex items-center justify-center">
                <AlertTriangle size={20} className="text-text-inverse" />
              </div>
              <div>
                <h1 className="text-display font-bold leading-tight m-0">
                  Exception Queue
                </h1>
                <span className="text-caption text-text-tertiary">
                  All cases — filter, search, sort with keyboard support
                </span>
              </div>
            </div>
            <div className="flex gap-8">
              <Button variant="neutral" size="md" onClick={refetch}>
                <RefreshCw size={14} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div id="main-content" />

      {/* ── METRICS STRIP ── */}
      <div className="max-w-[1440px] mx-auto px-32 py-16">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-16">
          <MetricTile
            icon={<AlertTriangle size={20} />}
            label="Total cases"
            value={String(total)}
            subtitle="All sources"
            tint="var(--color-cat-blue)"
          />
          <MetricTile
            icon={<Clock size={20} />}
            label="SLA breached"
            value={String(breached)}
            subtitle="Past deadline"
            tint="var(--color-error)"
          />
          <MetricTile
            icon={<AlertTriangle size={20} />}
            label="Awaiting review"
            value={String(awaitingHumanCount)}
            subtitle="Operator action needed"
            tint="var(--color-warning)"
          />
          <MetricTile
            icon={<CheckCircle2 size={20} />}
            label="Resolved"
            value={String(resolved)}
            subtitle="Closed in this window"
            tint="var(--color-success)"
          />
        </div>
      </div>

      {/* ── CONTENT: QUEUE + DETAIL ── */}
      <div className="max-w-[1440px] mx-auto px-32 py-16 flex gap-16">
        {/* ── LEFT: CaseListPane (V5.1.1 — full filter / search / sort) ── */}
        <div className="w-[460px] shrink-0 bg-surface-primary rounded-md shadow-sm overflow-hidden">
          <div className="h-[calc(100vh-360px)] min-h-[480px]">
            <CaseListPane
              cases={cases}
              total={total}
              loading={loading}
              error={error}
              refetch={refetch}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </div>

        {/* ── RIGHT: case detail surface (V5.1.2 state machine) ── */}
        {/*   selectedId=null               → "Select a case" placeholder.
             selectedId, records loading    → loading state.
             selectedId, no records         → case header + empty-records
                                              note.
             selectedId, records, no record → case header + records stack.
             selectedId + selectedRecordId  → "← Back to records" +
                                              ExceptionDetailPanel inline.
            Single-record cases auto-set selectedRecordId so the stack
            is skipped (per the V5.1.2 design call). */}
        <div className="flex-1 flex flex-col gap-16 min-w-0">
          {!selected && !loading && (
            <div className="bg-surface-primary rounded-md shadow-sm p-32 text-text-tertiary text-center">
              Select a case to view its summary.
            </div>
          )}

          {selected && selectedRecordId && (
            <>
              {/* Back affordance — only meaningful when the case has
                  more than one record. Single-record cases hide it
                  because there's nothing to go back to. */}
              {records.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedRecordId(null)}
                  className="self-start inline-flex items-center gap-4 text-caption text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm px-2 py-1"
                  aria-label="Back to attached records"
                >
                  <ChevronLeft size={14} aria-hidden />
                  Back to records ({records.length})
                </button>
              )}
              <ExceptionDetailPanel
                key={selectedRecordId}
                exceptionId={selectedRecordId}
                onActionComplete={refetch}
              />
            </>
          )}

          {selected && !selectedRecordId && selectedSla && (
            <>
              <div className="bg-surface-primary rounded-md shadow-sm p-20">
                <div className="flex items-center gap-8 mb-12">
                  <Badge variant="neutral" size="sm">
                    {SOURCE_ICON[selected.source as CaseSource] ?? SOURCE_ICON.default}
                    <span className="ml-4">
                      {SOURCE_LABEL[selected.source as CaseSource]
                        ?? SOURCE_LABEL.default}
                    </span>
                  </Badge>
                  <Badge variant="neutral" size="sm">
                    {selected.source_channel}
                  </Badge>
                  <Badge
                    variant={SLA_BAND_VARIANT[selectedSla.band]}
                    size="sm"
                    aria-label={`SLA: ${selectedSla.label}`}
                  >
                    <Clock size={10} aria-hidden className="mr-4" />
                    {selectedSla.label}
                  </Badge>
                  <span className="ml-auto text-caption text-text-tertiary uppercase tracking-wider">
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </span>
                </div>
                <h2 className="text-heading font-bold m-0 leading-snug mb-12">
                  Case <code className="font-mono">{selected.case_id}</code>
                </h2>

                <dl className="grid grid-cols-2 gap-x-24 gap-y-12 text-body">
                  {selected.customer_po_number && (
                    <Field
                      label="Customer PO"
                      value={selected.customer_po_number}
                      mono
                    />
                  )}
                  {selected.sales_order_id && (
                    <Field
                      label="Sales order"
                      value={selected.sales_order_id}
                      mono
                    />
                  )}
                  {selected.customer_id && (
                    <Field label="Customer" value={selected.customer_id} />
                  )}
                  <Field label="Opened" value={selected.opened_at} mono />
                  {selectedSla.deadline && (
                    <Field
                      label={`SLA · ${selectedSla.label}`}
                      value={selectedSla.deadline}
                      mono
                    />
                  )}
                  {selected.bundle_version_at_open && (
                    <Field
                      label="Skill bundle at open"
                      value={selected.bundle_version_at_open}
                      mono
                    />
                  )}
                </dl>
              </div>

              {/* Records stack — operator clicks one to drill into
                  the per-record ExceptionDetailPanel (HITL surface).
                  Hidden when only one record exists because the effect
                  above auto-selected it. */}
              {recordsLoading && (
                <div role="status" aria-live="polite" className="bg-surface-primary rounded-md shadow-sm p-16 text-text-tertiary">
                  Loading attached records…
                </div>
              )}
              {!recordsLoading && records.length === 0 && (
                <div className="bg-surface-primary rounded-md shadow-sm p-20 flex items-center justify-between">
                  <div>
                    <div className="text-label uppercase tracking-wider text-text-quaternary mb-2">
                      No attached records yet
                    </div>
                    <p className="text-body text-text-secondary leading-normal m-0">
                      This case has no per-event records attached.
                      The agent may still be processing the first event.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => router.push(`/cases/${selected.case_id}`)}
                  >
                    Open case
                    <ChevronRight size={14} />
                  </Button>
                </div>
              )}
              {!recordsLoading && records.length > 0 && (
                <div className="bg-surface-primary rounded-md shadow-sm p-20">
                  <div className="flex items-center gap-8 mb-12">
                    <h3 className="text-subhead font-semibold text-text-primary m-0">
                      Attached records
                    </h3>
                    <span className="text-caption text-text-tertiary">
                      {records.length}
                    </span>
                    <span className="ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/cases/${selected.case_id}`)}
                        aria-label="Open the case detail surface"
                      >
                        Open case <ChevronRight size={12} />
                      </Button>
                    </span>
                  </div>
                  <p className="text-caption text-text-tertiary leading-normal mb-12">
                    Pick a record to act on it (Approve / Reject / Override / Escalate).
                  </p>
                  <ul role="list" className="m-0 p-0 list-none divide-y divide-border-subtle">
                    {records.map((record) => (
                      <li key={record.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedRecordId(record.id)}
                          className="flex items-center gap-12 py-12 w-full text-left hover:bg-surface-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm"
                          aria-label={`Open exception ${record.order_id ?? record.id} in this pane`}
                        >
                          <Badge variant="neutral" size="sm">
                            {record.intent ?? "UNCLASSIFIED"}
                          </Badge>
                          <span className="font-mono text-body text-text-primary">
                            {record.order_id ?? record.id}
                          </span>
                          <span className="ml-auto text-caption text-text-tertiary">
                            {record.lifecycle_state}
                          </span>
                          <ChevronRight size={14} aria-hidden className="text-text-tertiary" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Field ────────────────────────────────────────────────────────── */

interface FieldProps {
  label: string;
  value: string;
  mono?: boolean;
}

function Field({ label, value, mono = false }: FieldProps) {
  return (
    <div>
      <dt className="text-label font-bold uppercase tracking-widest text-text-tertiary mb-px">
        {label}
      </dt>
      <dd
        className={cn(
          "m-0",
          mono ? "font-mono text-text-primary" : "text-text-primary",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
