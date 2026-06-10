/**
 * ProvenanceCard — the Diagnostics & Audit "Provenance" key/value card
 * (council 2026-06-10).
 *
 * A dumb projector (Guardrail #6) of `analysis.presentation.audit`: the
 * engine-internal provenance that reconstructs HOW the system decided —
 * recipe, raw intent, originating event, shadow verdict, taxonomy
 * classification + version, and the trace correlation id. It composes
 * nothing; it renders the backend-authoritative bundle as given.
 *
 * Placement: `presentation_tier: audit` — the Diagnostics & Audit
 * drawer, never operator-facing Layer 1 (Guardrail #0).
 *
 * Presence: every row goes through <EvidenceBlock tier="contextual">, so
 * an absent field is structurally omitted (no dash placeholder, no
 * fabricated value — Verdict 2026-04-22). When the whole bundle is empty
 * the card renders nothing so the drawer never shows an empty box.
 */
"use client";

import type { ReactNode } from "react";
import { Badge, verdictVariant } from "./Badge";
import { EvidenceBlock, isPresent } from "./EvidenceBlock";
import type { PresentationAudit } from "@/types/exceptions";

interface ProvenanceCardProps {
  audit?: PresentationAudit | null;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-label uppercase tracking-wider text-text-tertiary font-semibold">
        {label}
      </dt>
      <dd className="font-mono text-mono-sm text-text-primary m-0 break-words">
        {children}
      </dd>
    </>
  );
}

export function ProvenanceCard({ audit }: ProvenanceCardProps) {
  if (!audit) return null;

  // Nothing to show → render nothing (no empty card in the drawer).
  const anyPresent = [
    audit.recipe_name,
    audit.intent_code,
    audit.event_type,
    audit.shadow_verdict,
    audit.supergroup_code,
    audit.correlation_id,
  ].some(isPresent);
  if (!anyPresent) return null;

  return (
    <section aria-label="Provenance" className="flex flex-col gap-8">
      <h4 className="text-subhead font-semibold text-text-primary m-0">
        Provenance
      </h4>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-16 gap-y-8 items-baseline m-0">
        <EvidenceBlock tier="contextual" value={audit.recipe_name}>
          {(v) => <Row label="Recipe">{v as string}</Row>}
        </EvidenceBlock>
        <EvidenceBlock tier="contextual" value={audit.intent_code}>
          {(v) => <Row label="Raw intent">{v as string}</Row>}
        </EvidenceBlock>
        <EvidenceBlock tier="contextual" value={audit.event_type}>
          {(v) => <Row label="Event type">{v as string}</Row>}
        </EvidenceBlock>
        <EvidenceBlock tier="contextual" value={audit.shadow_verdict}>
          {(v) => (
            <Row label="Shadow verdict">
              {/* token-driven verdict treatment (icon + text via Badge) */}
              <Badge variant={verdictVariant(v as string)}>{v as string}</Badge>
            </Row>
          )}
        </EvidenceBlock>
        <EvidenceBlock tier="contextual" value={audit.supergroup_code}>
          {(v) => (
            <Row label="Taxonomy">
              {v as string}
              {isPresent(audit.taxonomy_version) && (
                <span className="text-text-tertiary"> · v{audit.taxonomy_version}</span>
              )}
            </Row>
          )}
        </EvidenceBlock>
        <EvidenceBlock tier="contextual" value={audit.correlation_id}>
          {(v) => <Row label="Correlation">{v as string}</Row>}
        </EvidenceBlock>
      </dl>
    </section>
  );
}
