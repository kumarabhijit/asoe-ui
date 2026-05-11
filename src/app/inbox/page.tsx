/**
 * Customer Inbox — manual_order case-projected list view.
 *
 * Phase 28.5 (Frontend Platform V5.1) — `/inbox` is now a filtered
 * case-list view of `/cases`. The legacy `INBOX` mock has been
 * retired; rows project from `useManualOrderCases()`
 * (`casesApi.list({ source: "manual_order" })`). Click-through goes
 * to `/cases/{id}` which is the canonical detail surface.
 *
 * Architecturally:
 *   * Pure list projector (CLAUDE.md Guardrail #6) — every field
 *     comes from OrderCase as the backend hands it. No client-side
 *     composition with event metadata.
 *   * No per-intent dispatch (Guardrail #1) — a manual-order case
 *     is a manual-order case regardless of which intent its child
 *     exceptions carry.
 *   * Status / source labels use default-fallback maps, mirroring
 *     `/cases` (Guardrail #1).
 *   * WS-driven invalidation: `case_*` events trigger a silent
 *     refetch via `useCases().refetch()`.
 */
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Mail, ChevronRight, Search, Zap, CheckCircle2,
  Clock, FileText, AlertTriangle, RefreshCw, LayoutList,
  ExternalLink,
} from "lucide-react";

import { NavBar } from "@/components/ui/NavBar";
import { CaseViewBanner } from "@/components/ui/CaseViewBanner";
import { MetricTile } from "@/components/ui/MetricTile";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useHealth } from "@/hooks/useHealth";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  useManualOrderCases,
  isCaseInvalidationEvent,
} from "@/hooks/useManualOrderCases";
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

/* ── Data ─────────────────────────────────────────────────────────── */
interface InboxItem {
  id: string;
  /** ADR-034 Phase G (PO supersession 2026-05-10) — when this inbox
   *  item produced an Exception Queue record (NEW_ORDER →
   *  MANUAL_ORDER_INTAKE exception), `exception_id` is set. The row
   *  click NO LONGER navigates straight to /exceptions/{id};
   *  every inbox row selects locally for a consistent master-detail
   *  UX. The right-pane detail surfaces an "Open in Exception Queue"
   *  jump button when this field is present, so the operator chooses
   *  when to leave the inbox surface. Absent on categories that
   *  don't become exceptions (SHIPMENT_INQUIRY, INVOICE_QUERY,
   *  COMPLAINT). */
  exception_id?: string;
  sender: string;
  initials: string;
  initialsColor: string;
  subject: string;
  preview: string;
  time: string;
  category: string;
  status: string;
  amount?: string;
  lineCount?: number;
  agentConfidence?: number;
  agentSummary?: string;
  agentRecommendation?: string;
  email?: { from: string; org: string; mailbox: string; received: string; body: string };
}

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

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxPageInner />
    </Suspense>
  );
}

function InboxPageInner() {
  const router = useRouter();
  const { health } = useHealth();
  const { user, accessToken, visibleTabs } = useAuth();
  const {
    cases,
    total,
    loading,
    error,
    refetch,
  } = useManualOrderCases();

  const userName = user?.name || "User";
  const userInitials =
    (user as { avatar_initials?: string })?.avatar_initials
    || userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const userTitle = (user as { title?: string })?.title || "";
  const filteredTabs = visibleTabs.length > 0
    ? NAV_TABS.filter((t) => visibleTabs.includes(t.id))
    : NAV_TABS;

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Customer Inbox — ASOE";
  }, []);

  // Auto-select first case on initial load. Re-runs when the list
  // refreshes; we keep the selection if the previously-selected case
  // is still present, otherwise fall through to the first.
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

  // WS-driven invalidation: refetch on every case_* event so the
  // inbox stays live without a page refresh. Per
  // `useManualOrderCases` contract — the hook itself doesn't
  // subscribe; the page composes its own useWebSocket and routes
  // case_* events through `refetch`.
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

  // SLA-driven sort — most-urgent first, mirrors /cases.
  const now = new Date();
  const sorted = [...cases]
    .map((c) => ({ case_: c, sla: slaSnapshot(c, now) }))
    .sort((a, b) => {
      const aMs = a.sla.ms_until_deadline ?? Number.POSITIVE_INFINITY;
      const bMs = b.sla.ms_until_deadline ?? Number.POSITIVE_INFINITY;
      return aMs - bMs;
    });

  const selected = sorted.find((s) => s.case_.case_id === selectedId);
  const needsReview = cases.filter(
    (c) => c.status === "OPEN_AWAITING_HUMAN",
  ).length;
  const awaitingBuyer = cases.filter(
    (c) => c.status === "OPEN_AWAITING_BUYER",
  ).length;
  const resolved = cases.filter((c) => c.status === "RESOLVED").length;

  return (
    <div className="min-h-screen bg-surface-page font-sans text-body text-text-primary leading-normal">
      <NavBar
        tabs={filteredTabs}
        activeTab="inbox"
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

      <CaseViewBanner
        scopeLabel="Manual Order Inbox"
        casesHref="/cases?source=manual_order"
      />

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
              Customer Inbox
            </span>
          </nav>
          <div className="flex items-center justify-between py-8 pb-16">
            <div className="flex items-center gap-12">
              <div className="w-[40px] h-[40px] rounded-md bg-text-primary flex items-center justify-center">
                <Mail size={20} className="text-text-inverse" />
              </div>
              <div>
                <h1 className="text-display font-bold leading-tight m-0">
                  Customer Inbox
                </h1>
                <span className="text-caption text-text-tertiary">
                  Manual-order cases — email, phone, fax intake
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
            icon={<InboxIcon size={20} />}
            label="Total cases"
            value={String(total)}
            subtitle="Manual-order intake"
            tint="var(--color-cat-blue)"
          />
          <MetricTile
            icon={<AlertTriangle size={20} />}
            label="Awaiting review"
            value={String(needsReview)}
            subtitle="Open · operator action needed"
            tint="var(--color-warning)"
          />
          <MetricTile
            icon={<Clock size={20} />}
            label="Awaiting buyer"
            value={String(awaitingBuyer)}
            subtitle="Outbound clarification"
            tint="var(--color-cat-teal)"
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
        {/* ── LEFT: case queue ── */}
        <div className="w-[380px] shrink-0 bg-surface-primary rounded-md shadow-sm overflow-hidden">
          <div className="px-16 py-12 border-b border-border-subtle flex items-center gap-8">
            <span className="text-label font-bold tracking-widest text-text-tertiary uppercase">
              Manual Order Cases
            </span>
            <div className="flex-1" />
            <span className="text-caption text-text-tertiary">
              {total}
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
              No manual-order cases.
            </div>
          )}

          <div className="max-h-[calc(100vh-370px)] overflow-y-auto">
            {INBOX.map((item) => {
              const isSelected = item.id === selectedId;
              // ADR-034 Phase G (PO supersession 2026-05-10) — every
              // inbox row selects locally so the right-pane detail
              // updates in place. Operators see a consistent
              // master-detail UX regardless of category. For rows
              // that have an `exception_id`, the right pane renders
              // an explicit "Open in Exception Queue" jump button —
              // navigation off the inbox surface is now an explicit
              // operator action, not a side effect of clicking a row.
              const handleActivate = () => {
                setSelectedId(item.id);
              };
              return (
                <div
                  key={case_.case_id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select email from ${item.sender}: ${item.subject}`}
                  onKeyDown={(e) => { if (e.key === "Enter") handleActivate(); }}
                  className={cn(
                    "px-16 py-12 cursor-pointer border-b border-border-subtle border-l-[3px] transition-colors duration-fast",
                    isSelected
                      ? "bg-surface-secondary border-l-brand"
                      : "bg-surface-primary border-l-transparent",
                  )}
                >
                  <div className="flex items-center gap-8 mb-6">
                    <Badge variant="neutral" size="sm">
                      {SOURCE_ICON[case_.source as CaseSource]
                        ?? SOURCE_ICON.default}
                      <span className="ml-4">
                        {case_.source_channel}
                      </span>
                    </Badge>
                    <Badge
                      variant={SLA_BAND_VARIANT[sla.band]}
                      size="sm"
                      aria-label={`SLA: ${sla.label}`}
                    >
                      <Clock size={10} aria-hidden className="mr-4" />
                      {sla.label}
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
            })}
          </div>
        </div>

        {/* ── RIGHT: case detail summary ── */}
        <div className="flex-1 flex flex-col gap-16">
          {!selected && !loading && (
            <div className="bg-surface-primary rounded-md shadow-sm p-32 text-text-tertiary text-center">
              Select a case to view its summary.
            </div>
          )}

          {/* ── ADR-034 PO supersession (2026-05-10) — Open in
                Exception Queue jump button. Renders only when the
                selected inbox item carries an `exception_id`. The
                row click stays a local master-detail selection
                (consistent UX across categories); navigation off
                the inbox surface is now an explicit operator action.
                `?from=inbox` is whitelisted in
                src/app/exceptions/[id]/page.tsx::BACK_TARGETS so the
                detail page renders "Back to Inbox". */}
          {selected.exception_id && (
            <div className="bg-surface-primary rounded-md shadow-sm p-16 flex items-center justify-between gap-12">
              <div className="flex flex-col gap-2">
                <span className="text-caption font-semibold text-text-primary">
                  Linked to Exception Queue
                </span>
                <span className="text-caption text-text-tertiary font-mono">
                  {selected.exception_id}
                </span>
              </div>
              <Button
                variant="brand"
                size="sm"
                onClick={() =>
                  router.push(
                    `/exceptions/${selected.exception_id}?from=inbox`,
                  )
                }
                aria-label={`Open exception ${selected.exception_id} in Exception Queue`}
              >
                <ExternalLink size={12} />
                Open in Exception Queue
              </Button>
            </div>
          )}

          {/* ── AGENT REASONING CARD (Layer 1 — always visible) ── */}
          <div className="bg-surface-primary rounded-md shadow-md p-20">
            <div className="flex items-center gap-8 mb-12">
              <div className="w-[28px] h-[28px] rounded-sm bg-surface-secondary flex items-center justify-center">
                <Zap size={14} className="text-text-secondary" />
              </div>
              <span className="font-semibold text-subhead text-text-primary">Agent Recommendation</span>
              <div className="flex-1" />
              {selected.agentConfidence && (
                <div className="flex items-center gap-8">
                  <div className="w-[80px] h-[4px] rounded-full bg-surface-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-text-secondary"
                      style={{ width: `${selected.agentConfidence}%` }}
                    />
                  </div>
                  <span className="font-mono text-caption font-semibold text-text-primary">
                    {selected.agentConfidence}%
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
                    Open the case to see attached records, agent
                    reasoning, and resolution actions.
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

/* ── Helper components ────────────────────────────────────────────── */

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
