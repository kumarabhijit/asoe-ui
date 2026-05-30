/**
 * Mock supergroup ↔ taxonomy parity lock.
 *
 * The mock case layer used to hand-author an intent→supergroup
 * switch (`supergroupFor` in `src/lib/mock-data/cases.ts`). It
 * silently disagreed with the governed backend taxonomy for
 * `CONTRACTUAL_CORRECTION` — the mock said `SG_BLOCK_PRICING`, the
 * source-of-truth `INTENTS_BY_SUPERGROUP` (generated from
 * `asoe2/db/seeds/case_taxonomy.yaml`) says `SG_BLOCK_ORDER_INTEGRITY`
 * (it is grouped with DUPLICATE_PO / EDI_MISMATCH on the SAP
 * `ABGRU` block field, not the pricing `LIFSK` family).
 *
 * The mock now DERIVES supergroup from the generated taxonomy, so
 * "UI is driven by the backend" holds and the mapping cannot drift.
 * This lock pins that: every block-intent mock case must carry the
 * supergroup the taxonomy assigns. It fails on the pre-fix commit
 * (which rendered SG_BLOCK_PRICING for CONTRACTUAL_CORRECTION).
 *
 * The CUSTOMER `event_type`→supergroup heuristic (MANUAL_ORDER_INTAKE
 * reused across email shapes) is deliberately mock-fixture plumbing,
 * not a taxonomy claim, and is excluded — it is locked separately by
 * `case_pivot_mock_wiring.test.ts`.
 */
import { describe, it, expect } from "vitest";

import { INTENTS_BY_SUPERGROUP } from "@/generated/taxonomy";
import { MOCK_EXCEPTIONS } from "@/lib/mock-data/exceptions";
import { caseFromMockException } from "@/lib/mock-data/cases";

// Inverse of the generated SoT: intent code → supergroup.
const SUPERGROUP_BY_INTENT_CODE: Record<string, string> = {};
for (const [sg, intents] of Object.entries(INTENTS_BY_SUPERGROUP)) {
  for (const code of intents) SUPERGROUP_BY_INTENT_CODE[code] = sg;
}

describe("mock supergroup ↔ taxonomy parity", () => {
  it("the taxonomy SoT classifies CONTRACTUAL_CORRECTION as order-integrity", () => {
    // Documents the corrected expectation explicitly; fails loudly if
    // the regenerated taxonomy ever moves the intent.
    expect(SUPERGROUP_BY_INTENT_CODE["INT_CONTRACTUAL_CORRECTION"]).toBe(
      "SG_BLOCK_ORDER_INTEGRITY",
    );
  });

  it("every block-intent mock case matches the taxonomy supergroup", () => {
    let checked = 0;
    for (const exc of MOCK_EXCEPTIONS) {
      const intent = exc.intent ?? "";
      // MANUAL_ORDER_INTAKE is the event_type-driven CUSTOMER variety
      // case (locked elsewhere); skip it. Unmapped intents fall to a
      // sentinel and make no taxonomy claim.
      if (!intent || intent === "MANUAL_ORDER_INTAKE") continue;
      const expected = SUPERGROUP_BY_INTENT_CODE[`INT_${intent}`];
      if (!expected) continue;

      const c = caseFromMockException(exc);
      expect(
        c.supergroup_code,
        `case for ${exc.id} (intent=${intent}) must be ${expected} ` +
          `per the taxonomy SoT, got ${c.supergroup_code}`,
      ).toBe(expected);
      checked += 1;
    }
    // Guard against the sweep silently checking nothing.
    expect(checked).toBeGreaterThan(0);
  });

  it("specifically: CONTRACTUAL_CORRECTION mock cases render order-integrity", () => {
    const ccCases = MOCK_EXCEPTIONS.filter(
      (e) => e.intent === "CONTRACTUAL_CORRECTION",
    ).map(caseFromMockException);
    expect(ccCases.length).toBeGreaterThan(0);
    for (const c of ccCases) {
      expect(c.supergroup_code).toBe("SG_BLOCK_ORDER_INTEGRITY");
    }
  });
});
