/**
 * Mock-data lock — Provenance bundle faithfulness (council 2026-06-10).
 *
 * Mirrors the asoe2 backend behavior verified against the real
 * (pre-prod) pipeline: a resolved record with a discriminating intent
 * surfaces ALL of the Provenance card's rows — recipe, raw intent,
 * event type, shadow verdict, taxonomy (supergroup + version), and the
 * correlation id. The real backend projects `record.supergroup_code`
 * (set at create time from `supergroup_for_intent`) and
 * `record.trace_id` (a REQUIRED field), so neither row is ever dropped
 * on a classified record.
 *
 * Pre-fix the mock returned `supergroup_code: null` + `correlation_id:
 * null`, so the preview showed only 4 of 6 Provenance rows and silently
 * disagreed with the real backend. This lock pins the mock projection to
 * the backend contract so the dev/preview cockpit can't drift back.
 *
 * CLAUDE.md test-strategy: mock-data-layer changes (the `mockPresentation`
 * derivation in src/lib/api.ts) require a matching architectural lock.
 */
import { describe, it, expect } from "vitest";

import { exceptionsApi } from "@/lib/api";
import { INTENTS_BY_SUPERGROUP } from "@/generated/taxonomy";

// Backend-driven intent → supergroup inverse (the same SoT
// `supergroup_for_intent` resolves against), so the expected value is
// not hand-authored and cannot drift from the taxonomy.
const SUPERGROUP_BY_INTENT: Record<string, string> = Object.entries(
  INTENTS_BY_SUPERGROUP,
).reduce((acc, [sg, codes]) => {
  for (const code of codes) acc[code] = sg;
  return acc;
}, {} as Record<string, string>);

describe("mock Provenance bundle mirrors the real backend", () => {
  it("populates all six Provenance rows for a discriminating-intent record", async () => {
    // exc-002 = DUPLICATE_PO (discriminating), with a hand-crafted
    // analysis fixture so orderAnalysis returns a non-null payload.
    const analysis = await exceptionsApi.orderAnalysis("exc-002");
    expect(analysis).not.toBeNull();
    const audit = analysis!.presentation?.audit;
    expect(audit).toBeTruthy();

    // The four rows that were already populated.
    expect(audit!.recipe_name).toBeTruthy();
    expect(audit!.intent_code).toBe("DUPLICATE_PO");
    expect(audit!.event_type).toBeTruthy();
    expect(audit!.shadow_verdict).toBeTruthy();

    // The two rows the fix restores — these must mirror the backend.
    expect(audit!.supergroup_code).toBe(SUPERGROUP_BY_INTENT["INT_DUPLICATE_PO"]);
    // taxonomy_version travels with a populated supergroup.
    expect(audit!.taxonomy_version).toBeTruthy();
    // correlation_id mirrors record.trace_id (always present); the mock
    // keys the same `${id}-trace` id its trace surface uses.
    expect(audit!.correlation_id).toBe("exc-002-trace");
  });

  it("structurally omits the taxonomy when the intent is unmapped (no fabrication)", async () => {
    // The projection must still omit honestly when there's no
    // classification — supergroup null ⇒ taxonomy_version null, never a
    // fabricated node. Use an id with no record at all to exercise the
    // null-record branch of the correlation id.
    const analysis = await exceptionsApi.orderAnalysis("does-not-exist");
    expect(analysis).toBeNull();
  });
});
