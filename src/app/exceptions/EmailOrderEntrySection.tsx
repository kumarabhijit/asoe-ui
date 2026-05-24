/**
 * EmailOrderEntrySection — Data-presence-driven enrichment (ADR-034 Phase C).
 *
 * Renders ONLY when `analysis.email_order_entry_analysis` is present.
 * Backend ownership: `EmailOrderEntryRecipe.classify_email_order_entry`
 * → composer projects into `EmailOrderEntryAnalysisData`.
 *
 * The four `floor_status` booleans surface the "non-disable-able floor"
 * check results so the operator sees exactly which compliance precondition
 * passed or failed. Per Pillar 3, these fields are audit-bearing — the
 * adapter must populate every floor field once the gateway evidence path
 * is wired up (Phase B).
 */
"use client";

import {
  AlertTriangle, CheckCircle2, Clock, Mail, ShieldCheck, ShieldX,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ConstraintsPipeline } from "@/components/ui/ConstraintsPipeline";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import { autonomyLevelLabel } from "@/lib/cases";
import { useHealth } from "@/hooks/useHealth";
import type {
  EmailOrderEntryAnalysisData,
  EmailOrderEntryClassification,
} from "@/types/exceptions";

interface EmailOrderEntrySectionProps {
  data: EmailOrderEntryAnalysisData;
}

/**
 * Visual mapping table — classification → badge variant + label.
 * Mirrors the variant fallback pattern in Badge.tsx::verdictVariant().
 * Forward-compatibility (Guardrail #1): an unknown classification value
 * falls back to a neutral badge with the raw value as the label rather
 * than crashing.
 */
const CLASSIFICATION_BADGE: Record<
  EmailOrderEntryClassification,
  { variant: "success" | "warning" | "error" | "neutral"; label: string }
> = {
  ONE_CLICK_APPROVE: { variant: "success", label: "One-click approve" },
  STANDARD_REVIEW:   { variant: "warning", label: "Standard review" },
  LOW_CONFIDENCE:    { variant: "warning", label: "Low confidence" },
  FATAL_REJECT:      { variant: "error",   label: "Fatal reject" },
};

const FLOOR_LABELS: Record<keyof EmailOrderEntryAnalysisData["floor_status"], string> = {
  sender_authorized:  "Sender authorised",
  customer_resolved:  "Customer resolved",
  duplicate_po_clear: "Duplicate PO clear",
  credit_clear:       "Credit clear",
};

export function EmailOrderEntrySection({ data }: EmailOrderEntrySectionProps) {
  // Autonomy labels come from health (Guardrail #1), not a hardcoded map.
  const { health } = useHealth();
  const classification = CLASSIFICATION_BADGE[data.classification] ?? {
    variant: "neutral" as const,
    label: String(data.classification),
  };

  const confidencePct = Math.round(data.composite_confidence * 100);

  return (
    <section
      aria-label="Email order intake analysis"
      className="bg-surface-primary rounded-md shadow-sm p-16"
    >
      {/* Section header */}
      <div className="flex items-center gap-8 mb-12">
        <Mail size={14} className="text-text-tertiary" />
        <span className="text-subhead font-semibold text-text-primary">
          Email Order Intake
        </span>
        <Badge variant={classification.variant} size="sm">
          {classification.label}
        </Badge>
      </div>

      {/* Composite-confidence display.
          aria-live="polite" so a re-classification announces the new
          confidence to screen-reader users (WCAG 4.1.3). */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mb-16"
      >
        <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
          Composite extraction confidence
        </div>
        <div className="flex items-baseline gap-8">
          <span className="text-display font-bold text-text-primary leading-tight">
            {confidencePct}%
          </span>
          <span className="text-caption text-text-tertiary">
            (raw {data.composite_confidence.toFixed(2)})
          </span>
        </div>
      </div>

      {/* Constraints pipeline — graphical projection of the gate
          sequence (PO #14, issue #133). Renders the four floor
          checks + validations summary + terminal classification as
          a left-to-right flow so the operator can see exactly which
          gate broke. Wrapped in EvidenceBlock to inherit the
          audit-bearing absence handling — if floor_status is missing,
          the dev warning fires and the section is hidden. */}
      <div className="mb-16">
        <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
          Constraints pipeline
        </div>
        <EvidenceBlock tier="audit-bearing" value={data.floor_status}>
          {() => (
            <div className="overflow-x-auto">
              <ConstraintsPipeline data={data} />
            </div>
          )}
        </EvidenceBlock>
      </div>

      {/* Detail row for the deterministic floor checks. Kept as the
          textual evidence breakdown beneath the graph so audit users
          can read each gate's status without parsing the SVG. */}
      <div className="mb-16">
        <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
          Floor checks
        </div>
        <EvidenceBlock tier="audit-bearing" value={data.floor_status}>
          {(floor) => {
            const status = floor as EmailOrderEntryAnalysisData["floor_status"];
            return (
              <div className="grid grid-cols-2 gap-8">
                {(Object.keys(FLOOR_LABELS) as Array<keyof typeof FLOOR_LABELS>).map(
                  (key) => (
                    <FloorRow
                      key={key}
                      label={FLOOR_LABELS[key]}
                      passed={status[key]}
                    />
                  ),
                )}
              </div>
            );
          }}
        </EvidenceBlock>
      </div>

      {/* Validations — contextual list. Empty list = nothing rendered.
          PO #14 (issue #133): operator vocabulary is "validations"
          (or "constraints"); the older "failures" copy was both
          negatively framed and unclear about what the section is
          actually showing — the constraints that didn't hold. */}
      <EvidenceBlock
        tier="contextual"
        value={data.validation_failures.length > 0 ? data.validation_failures : null}
      >
        {(failures) => (
          <div className="mb-16">
            <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
              Validations
            </div>
            <ul className="m-0 pl-20 text-body text-text-secondary leading-normal">
              {(failures as string[]).map((code) => (
                <li key={code} className="font-mono">{code}</li>
              ))}
            </ul>
          </div>
        )}
      </EvidenceBlock>

      {/* Reject reason — conditional on classification === FATAL_REJECT.
          When the predicate fails, EvidenceBlock renders nothing; when
          it holds and the field is absent, the block flags the gap. */}
      <EvidenceBlock
        tier="conditional"
        predicateHolds={data.classification === "FATAL_REJECT"}
        value={data.reject_reason_code}
      >
        {(code) => (
          <div className="mb-16 p-12 bg-error-subtle rounded-sm border border-error">
            <div className="text-label font-bold uppercase tracking-wider text-error mb-4">
              Reject reason
            </div>
            <div className="font-mono font-semibold text-body text-text-primary">
              {String(code)}
            </div>
          </div>
        )}
      </EvidenceBlock>

      {/* Recommended action */}
      <div className="mb-12">
        <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
          Recommended action
        </div>
        <div className="border-l-[3px] border-brand pl-10 text-body font-semibold text-brand leading-normal">
          {data.recommended_action}
        </div>
        <EvidenceBlock tier="contextual" value={data.notification_template}>
          {(template) => (
            <div className="mt-4 pl-10 flex items-center gap-6 text-caption text-text-tertiary">
              <span className="font-mono font-semibold">Notification:</span>
              <span className="font-mono">{String(template)}</span>
            </div>
          )}
        </EvidenceBlock>
      </div>

      {/* Autonomy footer — PO #15 (issue #133): bare "L1"/"L2"/"L3"
          codes don't tell the operator what the level means in
          plain language. `autonomyLevelLabel` is the shared map
          (Guardrail #1 default-fallback). */}
      <div className="flex items-center gap-8 px-12 py-8 bg-surface-secondary rounded-sm text-caption">
        <Clock size={12} className="text-text-tertiary" />
        <span className="text-text-tertiary font-semibold">Autonomy:</span>
        <span className="text-text-secondary">{autonomyLevelLabel(data.autonomy_level, health)}</span>
      </div>
    </section>
  );
}

function FloorRow({ label, passed }: { label: string; passed: boolean }) {
  // Status indicator pairs an icon with text — never colour alone (WCAG 1.4.1).
  const Icon = passed ? CheckCircle2 : ShieldX;
  const iconWrapClass = passed ? "text-success" : "text-error";
  const labelClass = passed ? "text-text-secondary" : "text-error font-semibold";
  const stateLabel = passed ? "passed" : "breached";

  return (
    <div className="flex items-center gap-8 px-10 py-8 bg-surface-secondary rounded-sm">
      <Icon size={14} className={iconWrapClass} aria-hidden />
      <span className={`text-body ${labelClass}`}>{label}</span>
      <span className="ml-auto text-caption text-text-tertiary font-semibold uppercase tracking-wider">
        {stateLabel}
      </span>
      {/* Aria-only redundant label so the icon's meaning isn't colour-bound. */}
      <span className="sr-only">— {stateLabel}</span>
      {!passed && <AlertTriangle size={12} className="text-error" aria-hidden />}
      {passed && <ShieldCheck size={12} className="text-success" aria-hidden />}
    </div>
  );
}
