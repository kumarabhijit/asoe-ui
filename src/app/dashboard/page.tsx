/**
 * Dashboard — analytics page (Section 11.5, Layout B).
 *
 * 2-column grid: resolution rates, agent performance, exception trends.
 * All KPIs from Section 11.6.
 */
"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  ShieldX,
  Users,
} from "lucide-react";
import { NavBar } from "@/components/ui/NavBar";
import { MetricTile } from "@/components/ui/MetricTile";
import { Card } from "@/components/ui/Card";
import { Badge, verdictVariant, lifecycleVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useHealth } from "@/hooks/useHealth";
import { exceptionsApi } from "@/lib/api";
import type { StatsResponse } from "@/types/api";

const NAV_TABS = [
  { id: "exceptions", label: "Exception Queue", href: "/exceptions" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "settings", label: "Settings", href: "/settings" },
];

export default function DashboardPage() {
  const { health } = useHealth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const data = await exceptionsApi.stats();
        setStats(data);
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  const autoResolvedPct = stats && stats.total_exceptions > 0
    ? Math.round((stats.auto_resolved / stats.total_exceptions) * 100)
    : 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-surface-page)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <NavBar
        tabs={NAV_TABS}
        activeTab="dashboard"
        onTabChange={(id) => {
          if (id === "exceptions") window.location.href = "/exceptions";
          if (id === "settings") window.location.href = "/settings";
        }}
        userName="Jane Doe"
        userInitials="JD"
        agentCount={3}
      />

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "var(--space-24)" }}>
        {/* Header */}
        <div style={{ marginBottom: "var(--space-24)" }}>
          <h1
            style={{
              fontSize: "var(--font-size-title)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "var(--space-8)",
            }}
          >
            <BarChart3 size={22} />
            Dashboard
          </h1>
          <p
            style={{
              fontSize: "var(--font-size-body)",
              color: "var(--color-text-tertiary)",
              margin: "var(--space-4) 0 0",
            }}
          >
            Resolution analytics and agent performance metrics
          </p>
        </div>

        {/* Top KPI Tiles */}
        {stats && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--space-16)",
              marginBottom: "var(--space-24)",
            }}
          >
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
              tint="var(--color-category-teal)"
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
              tint="var(--color-category-blue)"
            />
          </div>
        )}

        {/* 2-column grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-20)",
          }}
        >
          {/* By Intent breakdown */}
          <Card elevated style={{ padding: "var(--space-20)" }}>
            <h3 style={{ fontSize: "var(--font-size-subhead)", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 var(--space-16)" }}>
              Exceptions by Intent
            </h3>
            {stats?.by_intent ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-10)" }}>
                {Object.entries(stats.by_intent).map(([intent, count]) => (
                  <div key={intent} style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
                    <span style={{ flex: 1, fontSize: "var(--font-size-body)", color: "var(--color-text-secondary)" }}>
                      {intent.replace(/_/g, " ")}
                    </span>
                    <BarSegment value={count} max={stats.total_exceptions} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-caption)", fontWeight: 600, color: "var(--color-text-primary)", minWidth: 24, textAlign: "right" }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="skeleton" style={{ height: 100, borderRadius: "var(--radius-sm)" }} />
            )}
          </Card>

          {/* By Lifecycle State */}
          <Card elevated style={{ padding: "var(--space-20)" }}>
            <h3 style={{ fontSize: "var(--font-size-subhead)", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 var(--space-16)" }}>
              Exceptions by State
            </h3>
            {stats?.by_lifecycle_state ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-10)" }}>
                {Object.entries(stats.by_lifecycle_state).map(([state, count]) => (
                  <div key={state} style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
                    <Badge variant={lifecycleVariant(state)} size="sm" style={{ minWidth: 110 }}>
                      {state.replace(/_/g, " ")}
                    </Badge>
                    <BarSegment value={count} max={stats.total_exceptions} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-caption)", fontWeight: 600, color: "var(--color-text-primary)", minWidth: 24, textAlign: "right" }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="skeleton" style={{ height: 100, borderRadius: "var(--radius-sm)" }} />
            )}
          </Card>

          {/* By Shadow Verdict */}
          <Card elevated style={{ padding: "var(--space-20)" }}>
            <h3 style={{ fontSize: "var(--font-size-subhead)", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 var(--space-16)" }}>
              Shadow Verdict Distribution
            </h3>
            {stats?.by_shadow_verdict ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-10)" }}>
                {Object.entries(stats.by_shadow_verdict).map(([verdict, count]) => (
                  <div key={verdict} style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
                    <Badge variant={verdictVariant(verdict)} size="sm" style={{ minWidth: 80 }}>
                      {verdict}
                    </Badge>
                    <BarSegment value={count} max={stats.total_exceptions} color={
                      verdict === "GREEN" ? "var(--color-success)" :
                      verdict === "YELLOW" ? "var(--color-warning)" :
                      "var(--color-error)"
                    } />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-caption)", fontWeight: 600, color: "var(--color-text-primary)", minWidth: 24, textAlign: "right" }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="skeleton" style={{ height: 80, borderRadius: "var(--radius-sm)" }} />
            )}
          </Card>

          {/* Platform Health */}
          <Card elevated style={{ padding: "var(--space-20)" }}>
            <h3 style={{ fontSize: "var(--font-size-subhead)", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 var(--space-16)" }}>
              Platform Health
            </h3>
            {health ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
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
              <div className="skeleton" style={{ height: 80, borderRadius: "var(--radius-sm)" }} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function BarSegment({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ flex: 1, height: 8, background: "var(--color-surface-tertiary)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color || "var(--color-brand)", borderRadius: "var(--radius-full)", transition: "width var(--dur-normal) var(--ease-out)" }} />
    </div>
  );
}

function InfoRow({ label, value, mono, valueColor }: { label: string; value: string; mono?: boolean; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-tertiary)" }}>{label}</span>
      <span style={{ fontSize: "var(--font-size-body)", fontWeight: 600, fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)", color: valueColor || "var(--color-text-primary)" }}>{value}</span>
    </div>
  );
}
