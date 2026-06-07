/**
 * Dashboard — analytics page (Section 11.5, Layout B).
 *
 * 2-column grid: resolution rates, agent performance, exception trends.
 * All KPIs from Section 11.6.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSignOut } from "@/hooks/useSignOut";
import { intentLabelFor } from "@/config/erp-label-map";
import { useErpProfile } from "@/hooks/useErpProfile";
import {
  BarChart3,
  TrendingUp,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  ShieldX,
  Users,
} from "lucide-react";
import { NavBar } from "@/components/ui/NavBar";
import { MetricTile } from "@/components/ui/MetricTile";
import { Card } from "@/components/ui/Card";
import { Badge, verdictVariant, lifecycleVariant, variantColorVar } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SampleDataTag, isMockDataMode } from "@/components/ui/ScaffoldDataBanner";
import { useHealth } from "@/hooks/useHealth";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { isCaseInvalidationEvent } from "@/hooks/useManualOrderCases";
import { exceptionsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { StatsResponse } from "@/types/api";

import Link from "next/link";
import { NAV_TABS } from "@/config/nav-tabs";

// preview-only: there is no recent-activity endpoint in the API client yet.
// Rendered behind `isMockDataMode()` + a SampleDataTag so it is never read as
// live/audited data. Remove once a real feed lands (tracked in the backlog).
const RECENT_ACTIVITY = [
  { time: "11:02", orderId: "SO-3100", action: "Resolved — PriceAdjustmentRecipe applied via YK07", status: "RESOLVED", badge: "success", color: "var(--color-success)" },
  { time: "10:31", orderId: "SO-2200", action: "Blocked by Compliance Shadow — PENALTY_MATRIX_VIOLATION", status: "BLOCKED", badge: "error", color: "var(--color-error)" },
  { time: "09:13", orderId: "SO-1042", action: "Pending human review — duplicate PO detected", status: "REVIEW", badge: "warning", color: "var(--color-warning)" },
  { time: "08:45", orderId: "SO-5010", action: "Escalated to manager — manual review required", status: "ESCALATED", badge: "warning", color: "var(--color-warning)" },
  { time: "08:20", orderId: "SO-1001", action: "Auto-resolved — price adjustment applied via YK07", status: "RESOLVED", badge: "success", color: "var(--color-success)" },
  { time: "07:22", orderId: "SO-6001", action: "Pending review — credit hold release needs approval", status: "REVIEW", badge: "warning", color: "var(--color-warning)" },
];

export const requiresAuth = true;

export default function DashboardPage() {
  const { health } = useHealth();
  const { user, visibleTabs } = useAuth();
  const handleSignOut = useSignOut();
  const erp = useErpProfile();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Tri-state load handling (mirrors the Settings→Autonomy reference pattern):
  // a fetch failure must surface an error+retry, not silently leave the tiles
  // blank / skeletons spinning forever.
  const [loadError, setLoadError] = useState(false);

  const userName = user?.name || "User";
  const userInitials = (user as { avatar_initials?: string })?.avatar_initials || userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const userTitle = (user as { title?: string })?.title || "";
  const filteredTabs = visibleTabs.length > 0 ? NAV_TABS.filter((t) => visibleTabs.includes(t.id)) : NAV_TABS;

  useEffect(() => { document.title = "Performance — ASOE"; }, []);

  // Initial-load flag so silent live refreshes don't flash a spinner
  // under the operator's cursor. Mirrors the `useCases` pattern that
  // /cases + /home use for their WS-driven refreshes.
  const refetchStats = useCallback(async (silent: boolean) => {
    try {
      const data = await exceptionsApi.stats();
      setStats(data);
      setLoadError(false);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      // Keep any previously-loaded stats visible on a silent refresh
      // failure; only the initial-load failure blanks the surface.
      setLoadError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetchStats(false);
  }, [refetchStats]);

  // Live refresh on backend case state-changes. The stats payload is
  // a roll-up of LifecycleState and CaseStatus distributions — any
  // case_* WS event (open / update / close) mutates those totals.
  // Mirrors the `/cases` + `/home` pattern: WS-driven silent refresh
  // with `onReconnect` + `onPollFallback` keeping the surface live
  // when the socket drops. Closes the Guardrail #4 "static screen
  // requiring manual refresh" gap the STATUS_MODEL audit flagged.
  const silentRefetch = useCallback(() => {
    void refetchStats(true);
  }, [refetchStats]);

  useWebSocket({
    onEvent: (ev) => {
      if (isCaseInvalidationEvent(ev)) silentRefetch();
    },
    onReconnect: silentRefetch,
    onPollFallback: silentRefetch,
  });

  const autoResolvedPct = stats && stats.total_exceptions > 0
    ? Math.round((stats.auto_resolved / stats.total_exceptions) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-surface-page font-sans">
      <NavBar
        tabs={filteredTabs}
        activeTab="dashboard"
        userName={userName}
        userInitials={userInitials}
        userTitle={userTitle}
        agentCount={health?.allowed_intents?.length || 0}
        onSignOut={handleSignOut}

      />

      <main id="main-content" className="mx-auto max-w-[1440px] px-32 py-24">
        {/* Breadcrumb — PO #6 (issue #133): "Home" is a real link, not
            a static label. */}
        <nav
          aria-label="Breadcrumb"
          className="mb-12 flex items-center gap-6 text-caption text-text-tertiary"
        >
          <Link
            href="/home"
            className="text-text-tertiary hover:text-text-secondary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm"
          >
            Home
          </Link>
          <ChevronRight size={10} aria-hidden />
          <span className="text-text-secondary">Performance</span>
        </nav>

        {/* Header */}
        <div className="mb-24 flex items-start gap-16">
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-md bg-text-primary">
            <BarChart3 size={22} color="var(--color-text-inverse)" />
          </div>
          <div>
            <h1 className="m-0 text-title font-bold text-text-primary">
              Performance
            </h1>
            <p className="mt-4 mb-0 text-body text-text-tertiary">
              Resolution analytics and agent performance metrics
            </p>
          </div>
        </div>

        {/* Initial-load failure — surface an error + retry instead of leaving
            the tiles blank and the skeletons below spinning forever. Stale
            stats (a failed silent refresh) keep rendering, so this only shows
            when there is nothing to show. */}
        {loadError && !stats && (
          <div
            role="alert"
            className="mb-24 flex flex-col items-start gap-12 rounded-md border border-error-border bg-error-subtle p-20"
          >
            <div className="flex items-center gap-8">
              <AlertTriangle size={16} className="text-error shrink-0" aria-hidden />
              <span className="text-body font-semibold text-text-primary">
                Couldn&apos;t load performance metrics
              </span>
            </div>
            <p className="m-0 text-caption text-text-tertiary">
              The metrics service didn&apos;t respond. Retry, or check back shortly.
            </p>
            <Button
              variant="neutral"
              size="sm"
              onClick={() => {
                setLoading(true);
                void refetchStats(false);
              }}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Top KPI Tiles */}
        {stats && (
          <div className="mb-24 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-16">
            <MetricTile
              icon={<TrendingUp size={20} />}
              label="Resolution Rate"
              value={`${autoResolvedPct}%`}
              subtitle="Auto-resolved"
              tint="var(--color-success)"
            />
            <MetricTile
              icon={<Clock size={20} />}
              label="Avg Resolution"
              value={stats.avg_resolution_time_seconds
                ? `${Math.round(stats.avg_resolution_time_seconds / 60)}m`
                : "—"}
              subtitle="p50 target: 8m"
              tint="var(--color-cat-teal)"
            />
            <MetricTile
              icon={<Users size={20} />}
              label="HITL Rate"
              value={stats.total_exceptions > 0
                ? `${Math.round(((stats.total_exceptions - stats.auto_resolved) / stats.total_exceptions) * 100)}%`
                : "—"}
              subtitle="Human intervention"
              tint="var(--color-warning)"
            />
            <MetricTile
              icon={<Zap size={20} />}
              label="Total Processed"
              value={stats.total_exceptions}
              tint="var(--color-cat-blue)"
            />
          </div>
        )}

        {/* 2-column grid */}
        <div className="grid grid-cols-2 gap-20">
          {/* By Intent breakdown */}
          <Card elevated className="p-20">
            <h3 className="m-0 mb-16 text-subhead font-semibold text-text-primary">
              Exceptions by Intent
            </h3>
            {stats?.by_intent ? (
              <div className="flex flex-col gap-10">
                {Object.entries(stats.by_intent).map(([intent, count]) => (
                  <div key={intent} className="flex items-center gap-12">
                    <span className="flex-1 text-body text-text-secondary">
                      {intentLabelFor(intent, erp)}
                    </span>
                    <BarSegment value={count} max={stats.total_exceptions} />
                    <span className="min-w-[24px] text-right font-mono text-caption font-semibold text-text-primary">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              loadError ? <UnavailableNote /> : <div className="skeleton h-[100px] rounded-sm" />
            )}
          </Card>

          {/* By Lifecycle State */}
          <Card elevated className="p-20">
            <h3 className="m-0 mb-16 text-subhead font-semibold text-text-primary">
              Exceptions by State
            </h3>
            {stats?.by_lifecycle_state ? (
              <div className="flex flex-col gap-10">
                {Object.entries(stats.by_lifecycle_state).map(([state, count]) => (
                  <div key={state} className="flex items-center gap-12">
                    <Badge variant={lifecycleVariant(state)} size="sm" className="min-w-[110px]">
                      {state.replace(/_/g, " ")}
                    </Badge>
                    <BarSegment value={count} max={stats.total_exceptions} />
                    <span className="min-w-[24px] text-right font-mono text-caption font-semibold text-text-primary">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              loadError ? <UnavailableNote /> : <div className="skeleton h-[100px] rounded-sm" />
            )}
          </Card>

          {/* By Shadow Verdict */}
          <Card elevated className="p-20">
            <h3 className="m-0 mb-16 text-subhead font-semibold text-text-primary">
              Shadow Verdict Distribution
            </h3>
            {stats?.by_shadow_verdict ? (
              <div className="flex flex-col gap-10">
                {Object.entries(stats.by_shadow_verdict).map(([verdict, count]) => (
                  <div key={verdict} className="flex items-center gap-12">
                    <Badge variant={verdictVariant(verdict)} size="sm" className="min-w-[80px]">
                      {verdict}
                    </Badge>
                    <BarSegment
                      value={count}
                      max={stats.total_exceptions}
                      color={variantColorVar(verdictVariant(verdict))}
                    />
                    <span className="min-w-[24px] text-right font-mono text-caption font-semibold text-text-primary">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              loadError ? <UnavailableNote /> : <div className="skeleton h-[80px] rounded-sm" />
            )}
          </Card>

          {/* Platform Health */}
          <Card elevated className="p-20">
            <h3 className="m-0 mb-16 text-subhead font-semibold text-text-primary">
              Platform Health
            </h3>
            {health ? (
              <div className="flex flex-col gap-12">
                <InfoRow label="Status" value={health.status} />
                <InfoRow label="Version" value={health.version} mono />
                <InfoRow
                  label="Kill Switch"
                  value={health.kill_switch ? "ACTIVE" : "Off"}
                  valueColor={health.kill_switch ? "var(--color-error)" : "var(--color-success)"}
                />
                <InfoRow
                  label="Explain Mode"
                  value={health.explain_mode ? "ACTIVE" : "Off"}
                  valueColor={health.explain_mode ? "var(--color-warning)" : "var(--color-text-secondary)"}
                />
                <InfoRow label="Active Intents" value={String(health.allowed_intents.length)} />
                <InfoRow label="Active Recipes" value={String(health.allowed_recipes.length)} />
              </div>
            ) : (
              loadError ? <UnavailableNote /> : <div className="skeleton h-[80px] rounded-sm" />
            )}
          </Card>

          {/* Recent Activity — there is no recent-activity endpoint yet, so the
              feed is preview-only sample data. Gate it behind the mock-data
              switch and label it non-live (expert decision, batch 5); in live
              mode show an honest "not connected" state instead of fabricated
              rows presented as audited activity. */}
          <Card elevated className="col-span-2 p-20">
            <div className="mb-16 flex items-center gap-8">
              <h3 className="m-0 text-subhead font-semibold text-text-primary">
                Recent Activity
              </h3>
              <SampleDataTag />
            </div>
            {!isMockDataMode() ? (
              <div role="status" className="py-12 text-caption text-text-tertiary">
                No recent-activity feed connected yet.
              </div>
            ) : (
            <div className="flex flex-col">
              {RECENT_ACTIVITY.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-12 py-10",
                    idx < RECENT_ACTIVITY.length - 1 && "border-b border-border-subtle"
                  )}
                >
                  <div
                    className="h-[8px] w-[8px] shrink-0 rounded-full"
                    style={{ background: item.color }}
                  />
                  <span className="min-w-[50px] shrink-0 font-mono text-label text-text-quaternary">
                    {item.time}
                  </span>
                  <span className="min-w-[70px] shrink-0 font-mono text-caption font-semibold text-text-secondary">
                    {item.orderId}
                  </span>
                  <span className="flex-1 text-caption text-text-secondary">
                    {item.action}
                  </span>
                  <Badge variant={item.badge as "success" | "warning" | "error" | "info" | "neutral"} size="sm">
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

/** Inline "couldn't load" note used in place of a skeleton that would
 *  otherwise spin forever after a fetch failure. */
function UnavailableNote() {
  return (
    <div role="status" className="py-12 text-caption text-text-tertiary">
      Unavailable — retry above.
    </div>
  );
}

function BarSegment({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex-1 h-[8px] bg-surface-tertiary rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-[width] duration-normal ease-out"
        style={{ width: `${pct}%`, background: color || "var(--color-brand)" }}
      />
    </div>
  );
}

function InfoRow({ label, value, mono, valueColor }: { label: string; value: string; mono?: boolean; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-body text-text-tertiary">{label}</span>
      <span
        className={cn("text-body font-semibold", mono ? "font-mono" : "font-sans")}
        style={{ color: valueColor || "var(--color-text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}
