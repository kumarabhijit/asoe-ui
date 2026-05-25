/**
 * CP-B RED gate (ADR-043 §2.2, decision D4) — the `EvidenceAnchor` type surface
 * the viewer consumes. Locks the backend-authoritative anchor contract on the UI
 * side: the audit-tuple fields, the `anchor_source` discriminator, and the
 * deterministic `match_key` must all be present so the viewer can *locate* known
 * evidence without inventing any (Guardrail #6).
 *
 * Written test-first; `it.fails` (vitest xfail-strict analog) keeps CI honest
 * until the type lands at CP-C. Source-grep only (no import of the not-yet-built
 * type), so `tsc --noEmit` stays clean.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const TS_TYPES = path.resolve(__dirname, "../..", "src/types/exceptions.ts");

describe("EvidenceAnchor type surface (ADR-043)", () => {
  // RED until CP-C. Remove `.fails` when the interface lands.
  it.fails("exceptions.ts declares EvidenceAnchor with the audit-tuple + discriminator", () => {
    const ts = readFileSync(TS_TYPES, "utf-8");
    const block = ts.match(/export interface EvidenceAnchor\s*\{([\s\S]*?)\n\}/);
    expect(block, "EvidenceAnchor interface not found in exceptions.ts").not.toBeNull();
    const body = block![1];

    for (const field of [
      "attachment_id",
      "source_sha256",
      "text",
      "supports_ref",
      "supports_kind",
      "anchor_source",
      "match_key",
      "label",
    ]) {
      expect(body, `EvidenceAnchor missing field: ${field}`).toContain(field);
    }

    // The discriminator must span both phases (Phase-1 text, Phase-2 spatial).
    expect(body).toMatch(/anchor_source[\s\S]*"text_derived"/);
    expect(body).toMatch(/anchor_source[\s\S]*"spatial_extracted"/);
  });
});
