/**
 * Home — operational landing surface (issue #133, PO points #5, #6).
 *
 * The 2026-05 PO review separated the customer/case operational view
 * from the agent-performance analytics view. /home is the former:
 * SLA-at-risk cases, awaiting-review counts, awaiting-buyer counts,
 * a "top of queue" panel for the most urgent open cases, and direct
 * jumps into /exceptions and /cases. /dashboard now hosts the agent
 * performance / throughput analytics (relabelled "Performance" in
 * the nav).
 *
 * Architecturally:
 *   * Pure projector — reads `useCases()` (no source filter) plus
 *     the per-case `slaSnapshot()` helper for ms-until-deadline.
 *     No client-side composition beyond sorting (Guardrail #6).
 *   * No hardcoded enum literals — status counts come through the
 *     shared `isAwaitingHuman` / `isTerminalStatus` predicates
 *     (Guardrail #1).
 *   * Status / source labels reuse the consolidated maps in
 *     `src/lib/cases.ts`.
 */
"use client";

import { Suspense, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSignOut } from "@/hooks/useSignOut";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Home as HomeIcon,
  Inbox as InboxIcon,
  Mail,
  PackageCheck,
  RefreshCw,
} from "lucide-react";

import { NavBar } from "@/components/ui/NavBar";
import { MetricTile } from "@/components/ui/MetricTile";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useHealth } from "@/hooks/useHealth";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  useCases,
  isCaseInvalidationEvent,
} from "@/hooks/useManualOrderCases";
import { useSlaTicker } from "@/hooks/useSlaTicker";
import type { CaseSource } from "@/types/cases";
import type { WSEvent } from "@/types/websocket";
import {
  STATUS_LABEL,
  isAwaitingHuman,
  isTerminalStatus,
  sourceChannelLabel,
} from "@/lib/cases";
import { NAV_TABS } from "@/config/nav-tabs";
import { slaSnapshot } from "@/app/cases/page";

const SOURCE_ICON: Record<CaseSource | "default", React.ReactNode> = {
  manual_order: <Mail size={12} aria-hidden />,
  automated_order: <PackageCheck size={12} aria-hidden />,
  default: <Clock size={12} aria-hidden />,
};

const SLA_BAND_VARIANT = {
  breached: "error",
  at_risk: "warning",
  today: "warning",
  comfortable: "success",
  none: "neutral",
} as const;

export const requiresAuth = true;

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageInner />
    </Suspense>
  );
}

function HomePageInner() {
  const { health } = useHealth();
  const { user, accessToken, visibleTabs } = useAuth();
  const handleSignOut = useSignOut();
  const { cases, total, loading, error, refetch } = useCases();

  useEffect(() => {
    document.title = "Home — ASOE";
  }, []);

  // WS-driven invalidation — same pattern as /inbox and /exceptions.
  const handleWsEvent = useCallback((event: WSEvent) => {
    if (isCaseInvalidationEvent(event)) refetch();
  }, [refetch]);

  useWebSocket({
    token: accessToken,
    enabled: !!user && !!accessToken,
    onEvent: handleWsEvent,
    onReconnect: refetch,
    onPollFallback: refetch,
  });

  const userName = user?.name || "User";
  const userInitials =
    (user as { avatar_initials?: string })?.avatar_initials
    || userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const userTitle = (user as { title?: string })?.title || "";
  const filteredTabs = visibleTabs.length > 0
    ? NAV_TABS.filter((t) => visibleTabs.includes(t.id))
    : NAV_TABS;

  // Re-tick once a minute so the SLA bands stay live without a fetch.
  // PO #20 (issue #133): the countdown turning red as SLA approaches
  // is the primary "act now" signal on this surface.
  const tickNow = useSlaTicker();

  const snapshots = useMemo(
    () => cases.map((c) => ({ case_: c, sla: slaSnapshot(c, tickNow) })),
    [cases, tickNow],
  );

  const openCases = useMemo(
    () => snapshots.filter(({ case_ }) => !isTerminalStatus(case_.status)),
    [snapshots],
  );

  const breached = openCases.filter(({ sla }) => sla.band === "breached").length;
  const atRisk = openCases.filter(({ sla }) => sla.band === "at_risk" || sla.band === "today").length;
  const needsReview = openCases.filter(({ case_ }) => isAwaitingHuman(case_.status)).length;
  const awaitingBuyer = openCases.filter(
    ({ case_ }) => case_.status === "OPEN_AWAITING_BUYER",
  ).length;

  // Sort by ms_until_deadline ascending (most urgent first).
  const urgent = [...openCases]
    .sort((a, b) => {
      const aMs = a.sla.ms_until_deadline ?? Number.POSITIVE_INFINITY;
      const bMs = b.sla.ms_until_deadline ?? Number.POSITIVE_INFINITY;
      return aMs - bMs;
    })
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-surface-page font-sans text-body text-text-primary leading-normal">
      <NavBar
        tabs={filteredTabs}
        activeTab="home"
        userName={userName}
        userInitials={userInitials}
        userTitle={userTitle}
        agentCount={health?.allowed_intents?.length || 0}
        onSignOut={handleSignOut}
      />

      {/* ── Page header ── */}
      <div className="bg-surface-primary border-b border-border shadow-xs">
        <div className="max-w-[1440px] mx-auto px-32">
          <nav aria-label="Breadcrumb" className="py-8">
            <span className="text-caption text-text-secondary">Home</span>
          </nav>
          <div className="flex items-center justify-between py-8 pb-16">
            <div className="flex items-center gap-12">
              <div className="w-[40px] h-[40px] rounded-md bg-text-primary flex items-center justify-center">
                <HomeIcon size={20} className="text-text-inverse" />
              </div>
              <div>
                <h1 className="text-display font-bold leading-tight m-0">
                  Home
                </h1>
                <span className="text-caption text-text-tertiary">
                  Cases, SLAs, and what needs your attention now
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

      {/* ── KPI tiles (operational, case-centric) ── */}
      <div className="max-w-[1440px] mx-auto px-32 py-16">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-16">
          <MetricTile
            icon={<AlertTriangle size={20} />}
            label="SLA breached"
            value={String(breached)}
            subtitle="Open cases past deadline"
            tint="var(--color-error)"
          />
          <MetricTile
            icon={<Clock size={20} />}
            label="SLA at risk"
            value={String(atRisk)}
            subtitle="Due today or within window"
            tint="var(--color-warning)"
          />
          <MetricTile
            icon={<InboxIcon size={20} />}
            label="Awaiting review"
            value={String(needsReview)}
            subtitle="Open · operator action needed"
            tint="var(--color-cat-blue)"
          />
          <MetricTile
            icon={<Mail size={20} />}
            label="Awaiting buyer"
            value={String(awaitingBuyer)}
            subtitle="Outbound clarification"
            tint="var(--color-cat-teal)"
          />
        </div>
      </div>

      {/* ── Top of queue ── */}
      <div className="max-w-[1440px] mx-auto px-32 pb-32">
        <section
          aria-label="Top of queue"
          className="bg-surface-primary rounded-md shadow-sm overflow-hidden"
        >
          <div className="px-16 py-12 border-b border-border-subtle flex items-center gap-8">
            <span className="text-label font-bold tracking-widest text-text-tertiary uppercase">
              Top of queue
            </span>
            <span className="text-caption text-text-tertiary ml-4">
              by SLA urgency
            </span>
            <div className="flex-1" />
            <Link
              href="/cases"
              className="text-caption font-semibold text-brand hover:underline inline-flex items-center gap-2"
            >
              All cases <ChevronRight size={12} aria-hidden />
            </Link>
          </div>

          {loading && (
            <div role="status" aria-live="polite" className="p-16 text-text-tertiary">
              Loading cases…
            </div>
          )}
          {!loading && error && (
            <div role="alert" className="p-16 text-error">{error}</div>
          )}
          {!loading && !error && urgent.length === 0 && (
            <div role="status" className="p-16 text-text-tertiary">
              <CheckCircle2 size={14} className="inline mr-4" aria-hidden />
              All open cases are within SLA. Total visible: {total}.
            </div>
          )}

          <ul role="list" className="m-0 p-0 list-none">
            {urgent.map(({ case_, sla }) => {
              const orderRef =
                case_.customer_po_number
                || case_.sales_order_id
                || case_.case_id;
              return (
                <li key={case_.case_id} className="border-b border-border-subtle last:border-b-0">
                  <Link
                    href={`/cases/${case_.case_id}`}
                    className="flex items-center gap-12 px-16 py-12 hover:bg-surface-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                    aria-label={`Open case ${orderRef}`}
                  >
                    <Badge variant="neutral" size="sm">
                      {SOURCE_ICON[case_.source as CaseSource]
                        ?? SOURCE_ICON.default}
                      <span className="ml-4">
                        {sourceChannelLabel(case_.source_channel)}
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
                    <span className="hidden min-w-0 flex-1 truncate font-mono text-body font-medium text-text-primary sm:block">
                      {orderRef}
                    </span>
                    <span className="hidden shrink-0 whitespace-nowrap text-caption text-text-tertiary sm:inline-block">
                      {STATUS_LABEL[case_.status] ?? case_.status}
                    </span>
                    <ChevronRight
                      size={14}
                      aria-hidden
                      className="ml-auto shrink-0 text-text-tertiary sm:ml-0"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
