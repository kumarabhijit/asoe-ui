/**
 * ChangeAnalysisSection — Customer Inbox "Change Analysis" tab (ADR-042 Phase 6).
 *
 * Dumb projector (Guardrail #6): renders the deterministic order-change
 * evaluation (`analysis.change_analysis`) exactly as the recipe-homed evaluator
 * supplies it (preview-only until that producer lands). No business logic, no
 * threshold maths client-side — the recipe owns evaluation in asoe2.
 *
 * Variable cardinality: it renders the N constraint checks and M scenarios the
 * backend returns (not the prototype's fixed 10/7). Layer 1 is the decision
 * panel (recommendation + confidence); Layer 2 is the constraint + scenario
 * evidence. Optional fields flow through <EvidenceBlock>.
 */
"use client";

import { GitCompareArrows, CircleCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import type {
  ChangeAnalysis,
  ConstraintCheck,
  ScenarioOption,
} from "@/types/exceptions";

interface ChangeAnalysisSectionProps {
  data: ChangeAnalysis;
}

// Visual mapping (allowed — default fallback, not enum dispatch).
function statusVariant(status: string): "success" | "warning" | "error" | "neutral" {
  switch (status.toUpperCase()) {
    case "PASS":
      return "success";
    case "CONDITIONAL":
      return "warning";
    case "WARNING":
      return "error";
    default:
      return "neutral";
  }
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatUsd(Math.abs(value))}`;
}

export function ChangeAnalysisSection({ data }: ChangeAnalysisSectionProps) {
  const { evaluation, scenarios, decision } = data;
  return (
    <section
      aria-label="Order change analysis"
      className="bg-surface-primary rounded-md shadow-sm p-16 flex flex-col gap-16"
    >
      <div className="flex items-center gap-8">
        <GitCompareArrows size={14} className="text-text-tertiary" aria-hidden />
        <span className="text-subhead font-semibold text-text-primary">
          Change Analysis
        </span>
        <span className="ml-auto flex items-center gap-6">
          <Badge variant="success" size="sm">{evaluation.pass_count} pass</Badge>
          <Badge variant="warning" size="sm">{evaluation.conditional_count} conditional</Badge>
          <Badge variant="error" size="sm">{evaluation.warning_count} warning</Badge>
        </span>
      </div>

      {/* Layer 1 — decision panel */}
      <DecisionPanel decision={decision} />

      {/* Lifecycle stage bar */}
      {evaluation.lifecycle_stages.length > 0 && (
        <LifecycleBar
          stages={evaluation.lifecycle_stages}
          index={evaluation.lifecycle_index}
        />
      )}

      {/* Requested changes (from → to) */}
      <EvidenceBlock tier="contextual" value={evaluation.change_items}>
        {() => (
          <div>
            <SectionLabel>Requested changes</SectionLabel>
            <ul className="m-0 p-0 list-none flex flex-col gap-4">
              {evaluation.change_items.map((ci, idx) => (
                <li
                  key={`${ci.field}-${idx}`}
                  className="flex items-center gap-10 px-10 py-6 bg-surface-secondary rounded-sm border border-border-subtle text-caption"
                >
                  <span className="font-semibold text-text-primary w-120 shrink-0">
                    {ci.field}
                  </span>
                  <span className="font-mono text-text-tertiary">{ci.from_value}</span>
                  <span className="text-text-quaternary">→</span>
                  <span className="font-mono text-text-primary">{ci.to_value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </EvidenceBlock>

      {/* Constraint checks (variable cardinality) */}
      <div>
        <SectionLabel>Constraints ({evaluation.checks.length})</SectionLabel>
        <ul className="m-0 p-0 list-none grid grid-cols-2 gap-8">
          {evaluation.checks.map((c, idx) => (
            <ConstraintCard key={`${c.name}-${idx}`} check={c} />
          ))}
        </ul>
      </div>

      {/* Scenario simulation (variable cardinality) */}
      {scenarios.length > 0 && (
        <div>
          <SectionLabel>Scenarios ({scenarios.length})</SectionLabel>
          <ul className="m-0 p-0 list-none flex flex-col gap-8">
            {scenarios.map((s, idx) => (
              <ScenarioCard key={`${s.name}-${idx}`} scenario={s} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function DecisionPanel({ decision }: { decision: ChangeAnalysis["decision"] }) {
  return (
    <div className="rounded-md border border-border-default bg-surface-secondary p-12 flex flex-col gap-8">
      <div className="flex items-center gap-8">
        <CircleCheck size={14} className="text-brand" aria-hidden />
        <span className="text-body font-semibold text-text-primary">
          {decision.recommended_action}
        </span>
        <span className="ml-auto font-mono text-caption text-text-secondary">
          {Math.round(decision.confidence * 100)}% confidence
        </span>
      </div>
      <EvidenceBlock tier="contextual" value={decision.rationale}>
        {(v) => <p className="m-0 text-caption text-text-tertiary">{String(v)}</p>}
      </EvidenceBlock>
      <div className="flex items-center gap-12 flex-wrap">
        <EvidenceBlock tier="contextual" value={decision.revenue_impact_usd}>
          {(v) => (
            <span className="text-caption text-text-secondary">
              Revenue impact{" "}
              <span className="font-mono text-text-primary">{formatUsd(Number(v))}</span>
            </span>
          )}
        </EvidenceBlock>
        {decision.requires_cosign && (
          <Badge variant="warning" size="sm" icon={<Users size={11} aria-hidden />}>
            Cosign required
          </Badge>
        )}
      </div>
      <EvidenceBlock tier="contextual" value={decision.sap_actions}>
        {() => (
          <ul className="m-0 p-0 list-none flex flex-wrap gap-6">
            {decision.sap_actions.map((a, idx) => (
              <li
                key={`${a}-${idx}`}
                className="font-mono text-label text-text-tertiary px-8 py-2 bg-surface-tertiary rounded-sm border border-border-subtle"
              >
                {a}
              </li>
            ))}
          </ul>
        )}
      </EvidenceBlock>
    </div>
  );
}

function LifecycleBar({
  stages,
  index,
}: {
  stages: string[];
  index?: number | null;
}) {
  const current = typeof index === "number" ? index : -1;
  return (
    <div>
      <SectionLabel>Order lifecycle</SectionLabel>
      <ol className="m-0 p-0 list-none flex items-center gap-4">
        {stages.map((stage, idx) => {
          const done = idx <= current;
          return (
            <li key={stage} className="flex items-center gap-4 flex-1 min-w-0">
              <div
                className={`flex items-center gap-6 px-8 py-4 rounded-sm border w-full ${
                  done
                    ? "bg-brand-subtle border-border-brand text-brand"
                    : "bg-surface-secondary border-border-subtle text-text-tertiary"
                }`}
              >
                <span
                  aria-hidden
                  className={`inline-block w-6 h-6 rounded-full shrink-0 ${
                    done ? "bg-brand" : "bg-border-default"
                  }`}
                />
                <span className="text-label font-medium truncate">{stage}</span>
                {idx === current && (
                  <span className="sr-only">(current stage)</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ConstraintCard({ check }: { check: ConstraintCheck }) {
  return (
    <li className="px-10 py-8 bg-surface-secondary rounded-sm border border-border-subtle flex flex-col gap-4">
      <div className="flex items-center gap-8">
        <span className="text-body font-semibold text-text-primary truncate">
          {check.name}
        </span>
        <Badge variant={statusVariant(check.status)} size="sm" className="ml-auto">
          {check.status}
        </Badge>
      </div>
      <p className="m-0 text-caption text-text-tertiary">{check.detail}</p>
      <EvidenceBlock tier="contextual" value={check.metric}>
        {(v) => <span className="font-mono text-label text-text-secondary">{String(v)}</span>}
      </EvidenceBlock>
      <EvidenceBlock tier="contextual" value={check.system_ref}>
        {(v) => (
          <span className="text-label text-text-quaternary">
            {check.agent ? `${check.agent} · ` : ""}
            {String(v)}
          </span>
        )}
      </EvidenceBlock>
    </li>
  );
}

function ScenarioCard({ scenario }: { scenario: ScenarioOption }) {
  return (
    <li
      className={`px-10 py-8 rounded-sm border flex flex-col gap-4 ${
        scenario.recommended
          ? "bg-brand-subtle border-border-brand"
          : "bg-surface-secondary border-border-subtle"
      }`}
    >
      <div className="flex items-center gap-8">
        <span className="text-body font-semibold text-text-primary truncate">
          {scenario.name}
        </span>
        {scenario.recommended && (
          <Badge variant="brand" size="sm" className="ml-auto">
            Recommended
          </Badge>
        )}
      </div>
      <p className="m-0 text-caption text-text-tertiary">{scenario.description}</p>
      <div className="flex items-center gap-12 flex-wrap">
        <EvidenceBlock tier="contextual" value={scenario.impact}>
          {(v) => <span className="text-label text-text-secondary">{String(v)}</span>}
        </EvidenceBlock>
        <EvidenceBlock tier="contextual" value={scenario.financial_delta_usd}>
          {(v) => (
            <span className="ml-auto font-mono text-caption text-text-primary">
              {formatDelta(Number(v))}
            </span>
          )}
        </EvidenceBlock>
      </div>
    </li>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
      {children}
    </div>
  );
}
