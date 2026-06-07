/**
 * ADR-045 — erp-label-map is a vendor-synonym overlay, not the authority.
 *
 * The operator-facing label authority is the governed `/health`
 * `display_labels` map (Guardrail #2). `erp-label-map.ts` may only carry
 * cross-ERP synonyms (Credit Block vs Credit Hold) and must never:
 *   1. introduce a label for a code that isn't a real contract intent, or
 *   2. resurface the "Email Order Intake" misnomer that mislabelled
 *      MANUAL_ORDER_INTAKE (wrong for EDI/fax/phone orders).
 *
 * The misnomer assertions below fail on the parent commit (where GENERIC
 * mapped MANUAL_ORDER_INTAKE → "Email Order Intake") and pass after the
 * demotion — the regression-fails-on-parent guard for this change.
 */
import { describe, it, expect } from "vitest";

import { ERP_LABEL_MAPS, SUPPORTED_ERP_VENDORS, intentLabelFor } from "@/config/erp-label-map";
import { healthApi } from "@/lib/api";

describe("erp-label-map overlay guard (ADR-045)", () => {
  it("every intent key is a real contract intent (Guardrail #2)", async () => {
    const allowed = new Set((await healthApi.get()).allowed_intents);
    for (const vendor of SUPPORTED_ERP_VENDORS) {
      for (const code of Object.keys(ERP_LABEL_MAPS[vendor].intents)) {
        expect(
          allowed.has(code),
          `erp-label-map[${vendor}] labels "${code}", which is not a ` +
            `contract intent in /health.allowed_intents`,
        ).toBe(true);
      }
    }
  });

  it("the 'Email Order Intake' misnomer appears in no vendor map", () => {
    for (const vendor of SUPPORTED_ERP_VENDORS) {
      const labels = Object.values(ERP_LABEL_MAPS[vendor].intents);
      expect(
        labels,
        `erp-label-map[${vendor}] still carries the "Email Order Intake" ` +
          `misnomer — MANUAL_ORDER_INTAKE's label belongs to /health`,
      ).not.toContain("Email Order Intake");
    }
  });

  it("MANUAL_ORDER_INTAKE no longer resolves to the email misnomer", () => {
    // ASOE-native intent: not in the overlay, so intentLabelFor falls back
    // to the title-cased code — the correct channel-neutral label.
    expect(intentLabelFor("MANUAL_ORDER_INTAKE")).not.toBe("Email Order Intake");
    expect(intentLabelFor("MANUAL_ORDER_INTAKE")).toBe("Manual Order Intake");
  });
});
