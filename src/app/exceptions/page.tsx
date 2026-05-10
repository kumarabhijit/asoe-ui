/**
 * Exception Queue — case-projected master-detail view (V5.1).
 *
 * Phase 28.5 §28.5 — `/exceptions` is now an "all cases" view of
 * `/cases`: rows project from `casesApi.list()` (no source filter),
 * not from `exceptionsApi.list`. Click-through goes to
 * `/cases/{case_id}` — the canonical case detail surface.
 *
 * Architectural notes:
 *   * Pure list projector (CLAUDE.md Guardrail #6). No client-side
 *     composition; every field comes from OrderCase as the backend
 *     hands it.
 *   * No per-intent / per-lifecycle dispatch (Guardrail #1).
 *     A case is a case regardless of which intent its child
 *     exceptions carry. The legacy ExceptionListPane (intent +
 *     lifecycle filter chips, search, saved views) is unchanged
 *     behind it but no longer mounted on this page; the
 *     V5.1 follow-up is a CaseListPane that replays those
 *     features against case-level fields.
 *   * Direct exception detail (e.g. from a deeplink in a runbook,
 *     or from `/inbox` legacy back-link) remains reachable at
 *     `/exceptions/[id]` — that route still mounts
 *     `ExceptionDetailPanel`.
 *   * WS invalidation: `case_*` events trigger silent refetch via
 *     `useCases().refetch()`; `pipeline_progress` /
 *     `exception_update` / `task_complete` retain their existing
 *     shape but no longer drive list re-fetches on this surface
 *     (they are exception-keyed, not case-keyed).
 */
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
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
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  useCases,
  isCaseInvalidationEvent,
} from "@/hooks/useManualOrderCases";
import { ALLOWED_CASE_SOURCES } from "@/lib/api";
import type { CaseSource, OrderCase, SlaBand } from "@/types/cases";
import type { WSEvent } from "@/types/websocket";
import { cn } from "@/lib/utils";

import { slaSnapshot } from "@/app/cases/page";

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

const STATUS_LABEL: Record<string, string> = {
  OPEN_AGENT_PROCESSING: "Agent processing",
  OPEN_AWAITING_HUMAN: "Awaiting review",
  OPEN_AWAITING_BUYER: "Awaiting buyer",
  OPEN_AWAITING_ERP: "Awaiting ERP",
  RESOLVED: "Resolved",
  FAILED: "Failed",
  BLOCKED: "Blocked",
};

const SLA_BAND_VARIANT: Record<SlaBand, "error" | "warning" | "success" | "neutral"> = {
  breached: "error",
  at_risk: "warning",
  today: "warning",
  comfortable: "success",
  none: "neutral",
};

const NAV_TABS = [
  { id: "inbox", label: "Customer Inbox", href: "/inbox" },
  { id: "exceptions", label: "Exception Queue", href: "/exceptions" },
  { id: "cases", label: "Cases", href: "/cases" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "settings", label: "Settings", href: "/settings" },
];

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
  const [sourceFilter, setSourceFilter] = useState<CaseSource | null>(null);

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

  // Source-chip filtering happens client-side. Sort by SLA urgency.
  const now = new Date();
  const filtered = sourceFilter
    ? cases.filter((c) => c.source === sourceFilter)
    : cases;
  const sorted = filtered
    .map((c) => ({ case_: c, sla: slaSnapshot(c, now) }))
    .sort((a, b) => {
      const aMs = a.sla.ms_until_deadline ?? Number.POSITIVE_INFINITY;
      const bMs = b.sla.ms_until_deadline ?? Number.POSITIVE_INFINITY;
      return aMs - bMs;
    });

  const selected = sorted.find((s) => s.case_.case_id === selectedId);
  const breached = cases.filter((c) => {
    const ms = c.sla_deadline
      ? new Date(c.sla_deadline).getTime() - now.getTime()
      : Number.POSITIVE_INFINITY;
    return ms < 0;
  }).length;
  const awaitingHuman = cases.filter(
    (c) => c.status === "OPEN_AWAITING_HUMAN",
  ).length;
  const resolved = cases.filter((c) => c.status === "RESOLVED").length;

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
            <span className="text-caption text-text-tertiary">Home</span>
            <ChevronRight
              size={10}
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
                  All cases — sorted by SLA urgency
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
            value={String(awaitingHuman)}
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

      {/* ── SOURCE FILTER CHIPS ── */}
      <div className="max-w-[1440px] mx-auto px-32 pb-8">
        <div
          role="toolbar"
          aria-label="Case source filter"
          className="flex items-center gap-8"
        >
          <span className="text-label uppercase tracking-wider text-text-quaternary">
            Source:
          </span>
          <FilterChip
            label="All"
            active={sourceFilter === null}
            onClick={() => setSourceFilter(null)}
          />
          {ALLOWED_CASE_SOURCES.map((src) => (
            <FilterChip
              key={src}
              label={SOURCE_LABEL[src as CaseSource] ?? SOURCE_LABEL.default}
              active={sourceFilter === src}
              onClick={() =>
                setSourceFilter((cur) =>
                  cur === src ? null : (src as CaseSource),
                )
              }
            />
          ))}
        </div>
      </div>

      {/* ── CONTENT: QUEUE + DETAIL ── */}
      <div className="max-w-[1440px] mx-auto px-32 py-16 flex gap-16">
        {/* ── LEFT: case queue ── */}
        <div className="w-[420px] shrink-0 bg-surface-primary rounded-md shadow-sm overflow-hidden">
          <div className="px-16 py-12 border-b border-border-subtle flex items-center gap-8">
            <span className="text-label font-bold tracking-widest text-text-tertiary uppercase">
              Cases
            </span>
            <div className="flex-1" />
            <span className="text-caption text-text-tertiary">
              {sorted.length} of {total}
            </span>
          </div>

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
              No cases match the current filter.
            </div>
          )}

          <div className="max-h-[calc(100vh-440px)] overflow-y-auto">
            {sorted.map(({ case_, sla }) => (
              <CaseRow
                key={case_.case_id}
                case_={case_}
                slaLabel={sla.label}
                slaBand={sla.band}
                isSelected={case_.case_id === selectedId}
                onSelect={() => setSelectedId(case_.case_id)}
              />
            ))}
          </div>
        </div>

        {/* ── RIGHT: case detail summary ── */}
        <div className="flex-1 flex flex-col gap-16">
          {!selected && !loading && (
            <div className="bg-surface-primary rounded-md shadow-sm p-32 text-text-tertiary text-center">
              Select a case to view its summary.
            </div>
          )}

          {selected && (
            <>
              <div className="bg-surface-primary rounded-md shadow-sm p-20">
                <div className="flex items-center gap-8 mb-12">
                  <Badge variant="neutral" size="sm">
                    {SOURCE_ICON[selected.case_.source as CaseSource]
                      ?? SOURCE_ICON.default}
                    <span className="ml-4">
                      {SOURCE_LABEL[selected.case_.source as CaseSource]
                        ?? SOURCE_LABEL.default}
                    </span>
                  </Badge>
                  <Badge variant="neutral" size="sm">
                    {selected.case_.source_channel}
                  </Badge>
                  <Badge
                    variant={SLA_BAND_VARIANT[selected.sla.band]}
                    size="sm"
                    aria-label={`SLA: ${selected.sla.label}`}
                  >
                    <Clock size={10} aria-hidden className="mr-4" />
                    {selected.sla.label}
                  </Badge>
                  <span className="ml-auto text-caption text-text-tertiary uppercase tracking-wider">
                    {STATUS_LABEL[selected.case_.status]
                      ?? selected.case_.status}
                  </span>
                </div>
                <h2 className="text-heading font-bold m-0 leading-snug mb-12">
                  Case <code className="font-mono">{selected.case_.case_id}</code>
                </h2>

                <dl className="grid grid-cols-2 gap-x-24 gap-y-12 text-body">
                  {selected.case_.customer_po_number && (
                    <Field
                      label="Customer PO"
                      value={selected.case_.customer_po_number}
                      mono
                    />
                  )}
                  {selected.case_.sales_order_id && (
                    <Field
                      label="Sales order"
                      value={selected.case_.sales_order_id}
                      mono
                    />
                  )}
                  {selected.case_.customer_id && (
                    <Field
                      label="Customer"
                      value={selected.case_.customer_id}
                    />
                  )}
                  <Field
                    label="Opened"
                    value={selected.case_.opened_at}
                    mono
                  />
                  {selected.sla.deadline && (
                    <Field
                      label={`SLA · ${selected.sla.label}`}
                      value={selected.sla.deadline}
                      mono
                    />
                  )}
                  {selected.case_.bundle_version_at_open && (
                    <Field
                      label="Skill bundle at open"
                      value={selected.case_.bundle_version_at_open}
                      mono
                    />
                  )}
                </dl>
              </div>

              <div className="bg-surface-primary rounded-md shadow-sm p-20 flex items-center justify-between">
                <div>
                  <div className="text-label uppercase tracking-wider text-text-quaternary mb-2">
                    Full case detail
                  </div>
                  <p className="text-body text-text-secondary leading-normal m-0">
                    Open the case for attached records, agent reasoning,
                    and resolution actions.
                  </p>
                </div>
                <Button
                  variant="brand"
                  size="md"
                  onClick={() =>
                    router.push(`/cases/${selected.case_.case_id}`)
                  }
                >
                  Open case
                  <ChevronRight size={14} />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Case row ─────────────────────────────────────────────────────── */

interface CaseRowProps {
  case_: OrderCase;
  slaLabel: string;
  slaBand: SlaBand;
  isSelected: boolean;
  onSelect: () => void;
}

function CaseRow({
  case_,
  slaLabel,
  slaBand,
  isSelected,
  onSelect,
}: CaseRowProps) {
  const orderRef =
    case_.customer_po_number || case_.sales_order_id || case_.case_id;
  return (
    <div
      role="button"
      tabIndex={0}
      data-case-id={case_.case_id}
      aria-label={`Select case ${orderRef}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect();
      }}
      className={cn(
        "px-16 py-12 cursor-pointer border-b border-border-subtle border-l-[3px] transition-colors duration-fast",
        isSelected
          ? "bg-surface-secondary border-l-brand"
          : "bg-surface-primary border-l-transparent",
      )}
    >
      <div className="flex items-center gap-8 mb-6">
        <Badge variant="neutral" size="sm">
          {SOURCE_ICON[case_.source as CaseSource] ?? SOURCE_ICON.default}
          <span className="ml-4">{case_.source_channel}</span>
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
      </div>
    </div>
  );
}

/* ── Filter chip ──────────────────────────────────────────────────── */

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
