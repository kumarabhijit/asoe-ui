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

import { Tags } from "lucide-react";

import { ConfidenceDisplay } from "@/components/ui/ConfidenceDisplay";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import type { EntitiesAnalysisData } from "@/types/exceptions";

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
          <li
            key={`${entity.key}-${idx}`}
            className="px-12 py-8 bg-surface-secondary rounded-sm border border-border-subtle"
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
          </li>
        ))}
      </ul>
    </section>
  );
}
