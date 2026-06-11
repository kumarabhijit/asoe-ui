"use client";

/**
 * ControlTower — the Modern /dashboard surface (sign-off 2026-06-10,
 * design study: design-explorations/control-tower/).
 *
 * Answers, top to bottom: how much is the system handling on its own,
 * where do I need to step in next, and what is it costing right now.
 * Replaces (in Modern only — Legacy keeps the Performance page
 * byte-unchanged) the count-based BI tiles with:
 *   1. KPI band — auto-resolved %, open·needs-you, avg time, $ at risk
 *   2. Resolution throughput — agents vs humans, per hour
 *   3. Exception mix — by $ at risk, not by count
 *   4. Agent activity — live per-domain roster (replaces sample feed)
 *   5. SLA risk (next 8h) — the decision queue, deep-links to /cases
 *
 * Dumb projector of the backend-composed `ControlTowerResponse`
 * (Guardrail #6 — no UI aggregation/math beyond presentation): null /
 * empty payload surfaces are structurally omitted, never zero-filled;
 * the backend RBAC-strips dollars, so a money-less payload simply
 * renders the tower without $ surfaces. Domain / intent tokens render
 * through governed label helpers, never raw (Guardrail #2). The SLA
 * "due in" labels tick live off `sla_due_at` timestamps via the shared
 * banding rule.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, DollarSign, TrendingUp, Users, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { MetricTile } from "@/components/ui/MetricTile";
import { Button } from "@/components/ui/Button";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useHealth } from "@/hooks/useHealth";
import { isCaseInvalidationEvent } from "@/hooks/useManualOrderCases";
import { useSlaTicker } from "@/hooks/useSlaTicker";
import { slaSnapshotFromDeadline } from "@/lib/sla";
import { exceptionsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { supergroupLabel } from "@/lib/taxonomy-labels";
import { intentLabelFor } from "@/config/erp-label-map";
import { useErpProfile } from "@/hooks/useErpProfile";
import type { ControlTowerResponse, ThroughputBucket } from "@/types/api";

const SLA_TONE: Record<string, string> = {
  breached: "text-error font-bold",
  at_risk: "text-warning font-bold",
  today: "text-warning font-semibold",
  comfortable: "text-text-secondary",
  none: "text-text-tertiary",
};

export function ControlTower() {
  const [data, setData] = useState<ControlTowerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const erp = useErpProfile();
  const { health } = useHealth();
  const now = useSlaTicker();

  const refetch = useCallback(async (silent: boolean) => {
    try {
      const payload = await exceptionsApi.controlTower();
      setData(payload);
      setLoadError(false);
    } catch (err) {
      console.error("Failed to fetch control tower:", err);
      setLoadError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch(false);
  }, [refetch]);

  // Live refresh on case state changes — same Guardrail #4 posture as
  // the Legacy page (WS silent refresh + reconnect/poll fallback).
  const silentRefetch = useCallback(() => {
    void refetch(true);
  }, [refetch]);
  useWebSocket({
    onEvent: (ev) => {
      if (isCaseInvalidationEvent(ev)) silentRefetch();
    },
    onReconnect: silentRefetch,
    onPollFallback: silentRefetch,
  });

  if (loadError && !data) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-12 rounded-md border border-error-border bg-error-subtle p-20"
      >
        <div className="flex items-center gap-8">
          <AlertTriangle size={16} className="text-error shrink-0" aria-hidden />
          <span className="text-body font-semibold text-text-primary">
            Couldn&apos;t load the control tower
          </span>
        </div>
        <Button
          variant="neutral"
          size="sm"
          onClick={() => {
            setLoading(true);
            void refetch(false);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (loading || !data) {
    return <div className="skeleton h-[420px] rounded-md" aria-hidden />;
  }

  const { kpis } = data;
  const maxMixCents = Math.max(
    1,
    ...data.mix_by_intent.map((m) => m.dollar_at_risk.amount_cents),
  );
  const anySlaDollar = data.sla_risk.some((r) => r.dollar_impact);

  return (
    <div className="flex flex-col gap-20">
      {/* ── 1. KPI band ─────────────────────────────────────────── */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-16">
        {typeof kpis.auto_resolved_pct === "number" && (
          <MetricTile
            icon={<TrendingUp size={20} />}
            label="Auto-resolved by agents"
            value={`${kpis.auto_resolved_pct}%`}
            tint="var(--color-success)"
          />
        )}
        <MetricTile
          icon={<Users size={20} />}
          label="Open · needs you"
          value={kpis.open_needs_human}
          tint="var(--color-warning)"
        />
        {typeof kpis.avg_resolution_time_seconds === "number" && (
          <MetricTile
            icon={<Clock size={20} />}
            label="Avg time to resolve"
            value={`${Math.round(kpis.avg_resolution_time_seconds / 60)}m`}
            tint="var(--color-cat-teal)"
          />
        )}
        {kpis.dollar_at_risk && (
          <MetricTile
            icon={<DollarSign size={20} />}
            label="$ at risk now"
            value={formatCurrency(
              kpis.dollar_at_risk.amount_cents,
              kpis.dollar_at_risk.currency,
            )}
            subtitle={`across ${kpis.open_needs_human} open exceptions`}
            tint="var(--color-error)"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
        {/* ── 2. Resolution throughput ─────────────────────────── */}
        {data.throughput.length > 0 && (
          <Card elevated className="p-20">
            <div className="mb-16 flex items-baseline gap-8">
              <h3 className="m-0 text-subhead font-semibold text-text-primary">
                Resolution throughput
              </h3>
              <span className="ml-auto text-label uppercase tracking-wider text-text-quaternary">
                agents vs humans · per hour
              </span>
            </div>
            <ThroughputChart buckets={data.throughput} />
            <div className="mt-12 flex gap-16 text-label text-text-tertiary">
              <span className="flex items-center gap-4">
                <span aria-hidden className="h-[8px] w-[8px] rounded-full bg-brand" />
                Resolved by agents
              </span>
              <span className="flex items-center gap-4">
                <span aria-hidden className="h-[8px] w-[8px] rounded-full bg-border-default" />
                Routed to humans
              </span>
            </div>
          </Card>
        )}

        {/* ── 3. Exception mix by $ ────────────────────────────── */}
        {data.mix_by_intent.length > 0 && (
          <Card elevated className="p-20">
            <div className="mb-16 flex items-baseline gap-8">
              <h3 className="m-0 text-subhead font-semibold text-text-primary">
                Exception mix
              </h3>
              <span className="ml-auto text-label uppercase tracking-wider text-text-quaternary">
                by $ at risk
              </span>
            </div>
            <div className="flex flex-col gap-12">
              {data.mix_by_intent.map((m) => (
                <div key={m.intent} className="flex items-center gap-12">
                  <span className="flex-1 min-w-0 truncate text-caption text-text-secondary">
                    {intentLabelFor(m.intent, erp)}
                  </span>
                  <div className="flex-[2] h-[7px] bg-surface-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{
                        width: `${(m.dollar_at_risk.amount_cents / maxMixCents) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="min-w-[64px] text-right font-mono text-caption font-semibold text-text-primary">
                    {formatCurrency(
                      m.dollar_at_risk.amount_cents,
                      m.dollar_at_risk.currency,
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── 4. Agent activity ────────────────────────────────── */}
        {data.agent_activity.length > 0 && (
          <Card elevated className="p-20">
            <div className="mb-12 flex items-baseline gap-8">
              <h3 className="m-0 text-subhead font-semibold text-text-primary">
                Agent activity
              </h3>
              <span className="ml-auto text-label uppercase tracking-wider text-text-quaternary">
                live
              </span>
            </div>
            <ul className="m-0 p-0 list-none flex flex-col">
              {data.agent_activity.map((a) => {
                const working = a.resolving_now > 0;
                return (
                  <li
                    key={a.domain}
                    className="flex items-center gap-10 py-10 border-b border-border-subtle last:border-b-0"
                  >
                    <span
                      aria-hidden
                      className={`h-[8px] w-[8px] shrink-0 rounded-full ${working ? "bg-success" : "bg-border-default"}`}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-caption font-semibold text-text-primary">
                        {supergroupLabel(health, a.domain)}
                      </span>
                      <span className="block text-label text-text-tertiary">
                        {working ? `Resolving ${a.resolving_now} · ` : ""}
                        {a.resolved_today} resolved today
                      </span>
                    </span>
                    {/* Icon/dot never alone — explicit text state (WCAG 1.4.1). */}
                    <span
                      className={`text-label font-semibold ${working ? "text-success" : "text-text-quaternary"}`}
                    >
                      {working ? "working" : "idle"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {/* ── 5. SLA risk — the decision queue ─────────────────── */}
        {data.sla_risk.length > 0 && (
          <Card elevated className="p-20">
            <div className="mb-12 flex items-baseline gap-8">
              <h3 className="m-0 text-subhead font-semibold text-text-primary">
                SLA risk — next 8 hours
              </h3>
              <span className="ml-auto text-label uppercase tracking-wider text-text-quaternary">
                needs human · by deadline
              </span>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Type</Th>
                  <Th>Due in</Th>
                  {anySlaDollar && <Th align="right">$ at risk</Th>}
                </tr>
              </thead>
              <tbody>
                {data.sla_risk.map((row) => {
                  const sla = slaSnapshotFromDeadline(row.sla_due_at, now);
                  return (
                    <tr key={row.case_id}>
                      <Td>
                        <Link
                          href={`/cases/${row.case_id}`}
                          className="font-semibold text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm"
                        >
                          {row.customer_name ?? row.case_id}
                        </Link>
                      </Td>
                      <Td>
                        {/* Structural omission when unclassified. */}
                        {row.intent ? intentLabelFor(row.intent, erp) : null}
                      </Td>
                      <Td>
                        <span className={`font-mono ${SLA_TONE[sla.band] ?? SLA_TONE.none}`}>
                          {sla.label}
                        </span>
                      </Td>
                      {anySlaDollar && (
                        <Td align="right">
                          {row.dollar_impact ? (
                            <span className="font-mono font-semibold text-text-primary">
                              {formatCurrency(
                                row.dollar_impact.amount_cents,
                                row.dollar_impact.currency,
                              )}
                            </span>
                          ) : null}
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}

/** Hourly stacked bars. Pure CSS; each bar carries a text alternative
 *  so the chart is not color/size-only (WCAG 1.4.1). */
function ThroughputChart({ buckets }: { buckets: ThroughputBucket[] }) {
  const maxTotal = Math.max(
    1,
    ...buckets.map((b) => b.by_agents + b.by_humans),
  );
  const MAX_BAR_PX = 110;
  return (
    <div className="flex items-end gap-8" style={{ height: `${MAX_BAR_PX + 26}px` }}>
      {buckets.map((b) => {
        const hour = new Date(b.hour_start);
        const hourLabel = Number.isNaN(hour.getTime())
          ? b.hour_start
          : String(hour.getHours()).padStart(2, "0");
        return (
          <div
            key={b.hour_start}
            className="flex-1 flex flex-col justify-end items-stretch gap-2 min-w-0"
            role="img"
            aria-label={`${hourLabel}:00 — ${b.by_agents} resolved by agents, ${b.by_humans} routed to humans`}
          >
            {b.by_humans > 0 && (
              <div
                aria-hidden
                className="rounded-t-sm bg-border-default"
                style={{ height: `${(b.by_humans / maxTotal) * MAX_BAR_PX}px` }}
              />
            )}
            {b.by_agents > 0 && (
              <div
                aria-hidden
                className="rounded-t-sm bg-brand"
                style={{ height: `${(b.by_agents / maxTotal) * MAX_BAR_PX}px` }}
              />
            )}
            <span aria-hidden className="text-center text-label text-text-quaternary mt-4">
              {hourLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      className={`pb-6 px-8 text-label uppercase tracking-wider font-semibold text-text-quaternary border-b border-border-subtle ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <td
      className={`py-10 px-8 text-caption border-b border-border-subtle ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </td>
  );
}
