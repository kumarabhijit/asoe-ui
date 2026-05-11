/**
 * /cases — primary CSR work surface (ADR-038 §6 / Phase H.6).
 *
 * Single page that shows every OrderCase the operator can act on,
 * sorted by SLA deadline (most-urgent first). Filter chips for case
 * source and status. Existing /inbox and /exceptions retain as
 * filtered case-list views per ADR-038 §12.5 (next commit).
 *
 * Architecturally:
 *   * No per-intent dispatch — a case is a case regardless of which
 *     intent its child exceptions carry. Guardrail #1 preserved.
 *   * Source vocabulary from ALLOWED_CASE_SOURCES (api.ts boundary
 *     layer); page code never names the literal strings inline.
 *   * SLA visualisation is a pure derivation (slaSnapshot helper).
 *     No threshold logic in page code; the band thresholds sit in
 *     this file's helper as visual policy and are ratified by
 *     Frontend Platform.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  PackageCheck,
} from "lucide-react";

import { signOut } from "next-auth/react";
import { Badge } from "@/components/ui/Badge";
import { NavBar } from "@/components/ui/NavBar";
import { ALLOWED_CASE_SOURCES, casesApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useHealth } from "@/hooks/useHealth";
import { STATUS_LABEL } from "@/lib/cases";
import { cn } from "@/lib/utils";
import type {
  CaseSource,
  CaseStatus,
  OrderCase,
  SlaBand,
  SlaSnapshot,
} from "@/types/cases";


/* ── Visual mappings (vendor-neutral; per-source / per-status badge style) ── */

/** Source → human label + icon. New sources land here without
 *  rerunning the page; the table is data-driven. */
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

// STATUS_LABEL is imported from src/lib/cases.ts — the Phase 28.5.x
// §D1 audit consolidated the four duplicate maps into a single
// source. Default fallback per Guardrail #1 stays the same.

const SLA_BAND_VARIANT: Record<SlaBand, "error" | "warning" | "success" | "neutral"> = {
  breached: "error",
  at_risk: "warning",
  today: "warning",
  comfortable: "success",
  none: "neutral",
};


/**
 * Derive the SLA visualisation snapshot for a case. Pure function —
 * tests assert against it directly.
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

const NAV_TABS = [
  { id: "inbox", label: "Customer Inbox", href: "/inbox" },
  { id: "exceptions", label: "Exception Queue", href: "/exceptions" },
  { id: "cases", label: "Cases", href: "/cases" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "settings", label: "Settings", href: "/settings" },
];


export default function CasesPage() {
  const router = useRouter();
  const { user, visibleTabs } = useAuth();
  const { health } = useHealth();
  const [cases, setCases] = useState<OrderCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CasesFilters>({
    source: null,
    status: null,
  });

  const userName = user?.name || "User";
  const userInitials = (
    (user as { avatar_initials?: string } | null)?.avatar_initials
    || userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  );
  const userTitle = (user as { title?: string } | null)?.title || "";
  const filteredTabs = visibleTabs.length > 0
    ? NAV_TABS.filter((t) => visibleTabs.includes(t.id))
    : NAV_TABS;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    casesApi
      .list({
        source: filters.source ?? undefined,
        status: filters.status ?? undefined,
      })
      .then((res) => {
        if (!cancelled) setCases(res.items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters.source, filters.status]);

  // SLA-driven sort — most-urgent (lowest ms_until_deadline) first.
  // Cases with no SLA sink to the bottom.
  const sorted = useMemo(() => {
    const now = new Date();
    return [...cases]
      .map((c) => ({ case_: c, sla: slaSnapshot(c, now) }))
      .sort((a, b) => {
        const aMs = a.sla.ms_until_deadline ?? Number.POSITIVE_INFINITY;
        const bMs = b.sla.ms_until_deadline ?? Number.POSITIVE_INFINITY;
        return aMs - bMs;
      });
  }, [cases]);

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
        onSignOut={() => signOut({ callbackUrl: "/login" })}
      />
    <main className="p-32 max-w-[1280px] mx-auto">
      <header className="mb-24">
        <h1 className="text-display font-bold text-text-primary mb-4">
          Cases
        </h1>
        <p className="text-body text-text-secondary leading-normal">
          Every order needing attention, sorted by SLA. Cases unify the
          email + ERP sides of one business order — open one to see
          source, agent recommendations, and resolution actions.
        </p>
      </header>

      {/* Filter chips. ALLOWED_CASE_SOURCES comes from the api.ts
          boundary; page code never names the source literals
          inline (Guardrail #1). */}
      <div
        role="toolbar"
        aria-label="Case filters"
        className="flex items-center gap-8 mb-16"
      >
        <span className="text-label uppercase tracking-wider text-text-quaternary">
          Source:
        </span>
        <FilterChip
          label="All"
          active={filters.source === null}
          onClick={() =>
            setFilters((f) => ({ ...f, source: null }))
          }
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

      {loading && (
        <div role="status" className="text-text-tertiary py-24" aria-live="polite">
          Loading cases…
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div role="status" className="text-text-tertiary py-24">
          <CheckCircle2 size={16} className="inline mr-6" aria-hidden />
          No cases match the current filters.
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <ul role="list" className="m-0 p-0 list-none">
          {sorted.map(({ case_, sla }) => (
            <li
              key={case_.case_id}
              className="border-b border-border-subtle"
            >
              <button
                type="button"
                onClick={() => router.push(`/cases/${case_.case_id}`)}
                className={cn(
                  "w-full text-left py-12 px-16 hover:bg-surface-secondary",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                  "transition-colors duration-fast",
                )}
                aria-label={`Open case ${case_.case_id}`}
              >
                <div className="flex items-center gap-12">
                  <Badge variant="neutral" size="sm">
                    {SOURCE_ICON[case_.source as CaseSource] ??
                      SOURCE_ICON.default}
                    <span className="ml-4">
                      {SOURCE_LABEL[case_.source as CaseSource] ??
                        SOURCE_LABEL.default}
                    </span>
                  </Badge>
                  <span className="font-mono text-body text-text-primary">
                    {case_.customer_po_number ??
                      case_.sales_order_id ??
                      case_.case_id}
                  </span>
                  <span className="text-text-tertiary text-caption ml-auto">
                    {STATUS_LABEL[case_.status] ?? case_.status}
                  </span>
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
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
    </div>
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
