/**
 * EntitiesSection — Customer Inbox "Entities" tab (ADR-042 Phase 2).
 *
 * Dumb projector (Guardrail #6): renders `analysis.entities_analysis.extracted`
 * exactly as the backend supplies it. Backend ownership: the intake-extraction
 * composer adapter projects `EntitiesAnalysisData` (preview-only until that
 * adapter lands). Mounts in `ExceptionDetailPanel` by data presence — no
 * per-intent dispatch.
 *
 * Compliance posture: `extracted` is contextual evidence (the operator's
 * binding controls remain recommended_action / autonomy_level). Per-row
 * `confidence` / `source_span` are optional and flow through `<EvidenceBlock>`
 * — never an ad-hoc "—" placeholder.
 */
"use client";

import { Tags, Crosshair } from "lucide-react";

import { ConfidenceDisplay } from "@/components/ui/ConfidenceDisplay";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import { useEvidenceSelection } from "@/hooks/useEvidenceSelection";
import { cn } from "@/lib/utils";
import type { EntitiesAnalysisData, ExtractedEntity } from "@/types/exceptions";

interface EntitiesSectionProps {
  data: EntitiesAnalysisData;
}

export function EntitiesSection({ data }: EntitiesSectionProps) {
  return (
    <section
      aria-label="Extracted entities"
      className="bg-surface-primary rounded-md shadow-sm p-16"
    >
      <div className="flex items-center gap-8 mb-12">
        <Tags size={14} className="text-text-tertiary" aria-hidden />
        <span className="text-subhead font-semibold text-text-primary">
          Extracted entities
        </span>
        <span className="ml-auto text-caption text-text-tertiary font-normal">
          ({data.extracted.length})
        </span>
      </div>

      <ul className="m-0 p-0 list-none flex flex-col gap-6">
        {data.extracted.map((entity, idx) => (
          <EntityRow key={`${entity.key}-${idx}`} entity={entity} />
        ))}
      </ul>
    </section>
  );
}

/**
 * One extracted-entity row. When the entity carries a backend-authoritative
 * `evidence_ref` (ADR-043), the row gets a keyboard-operable "Show in source"
 * control that foregrounds the matching in-document anchor via the shared
 * evidence selection — and lights up when that ref is the active selection
 * (e.g. the operator clicked the matching safety-bar row in the document
 * viewer). When `evidence_ref` is absent (today's preview default) the row is
 * non-interactive, exactly as before — no placeholder, no dead affordance.
 */
function EntityRow({ entity }: { entity: ExtractedEntity }) {
  const { selectedRef, selectRef } = useEvidenceSelection();
  const ref = entity.evidence_ref ?? null;
  const isSelected = ref !== null && selectedRef === ref;

  return (
    <li
      data-supports-ref={ref ?? undefined}
      data-selected={isSelected || undefined}
      className={cn(
        "px-12 py-8 bg-surface-secondary rounded-sm border border-border-subtle",
        isSelected && "ring-2 ring-brand border-brand",
      )}
    >
      <div className="flex items-center gap-8">
        <span className="text-label font-bold uppercase tracking-wider text-text-quaternary">
          {entity.kind}
        </span>
        <span className="text-body font-semibold text-text-primary">
          {entity.key}
        </span>
        <span className="ml-auto font-mono text-body text-text-primary break-all">
          {entity.value}
        </span>
      </div>

      {/* Confidence — contextual; suppressed when absent. Rendered
          through the canonical cross-case ConfidenceDisplay. */}
      <EvidenceBlock tier="contextual" value={entity.confidence}>
        {(value) => (
          <div className="mt-4">
            <ConfidenceDisplay
              value={Number(value)}
              scale="unit"
              variant="inline"
              label={`${entity.key} confidence`}
            />
          </div>
        )}
      </EvidenceBlock>

      {/* Source span — contextual provenance; suppressed when absent. */}
      <EvidenceBlock tier="contextual" value={entity.source_span}>
        {(value) => (
          <div className="mt-4 text-caption text-text-tertiary italic break-words">
            “{String(value)}”
          </div>
        )}
      </EvidenceBlock>

      {/* Field↔source link — only when the producer stamped an authoritative
          evidence_ref. Toggles the shared selection so the document viewer
          foregrounds the matching anchor + overlay. */}
      {ref !== null && (
        <button
          type="button"
          aria-pressed={isSelected}
          onClick={() => selectRef(ref)}
          className={cn(
            "mt-6 inline-flex items-center gap-6 text-caption font-semibold rounded-sm px-6 py-2",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
            isSelected ? "text-brand" : "text-text-tertiary hover:text-text-secondary",
          )}
        >
          <Crosshair size={12} aria-hidden />
          {isSelected ? "Showing in source" : "Show in source"}
        </button>
      )}
    </li>
  );
}
