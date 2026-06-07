/**
 * ADR-045 — taxonomy display-label resolvers + the qualifier rule.
 *
 * These pure helpers are the label authority's projection layer: they turn
 * the governed `/health` `display_labels` payload into operator strings,
 * and encode the summary qualifier rule (show the intent only when its
 * supergroup fans out to >1 intent).
 */
import { describe, it, expect } from "vitest";

import { MOCK_HEALTH } from "../fixtures";
import {
  intentCodeFor,
  intentFanout,
  intentLabel,
  showsIntentQualifier,
  supergroupLabel,
  titleCaseCode,
} from "@/lib/taxonomy-labels";

describe("taxonomy-labels", () => {
  it("intentCodeFor normalises bare wire intents to INT_ codes", () => {
    expect(intentCodeFor("MANUAL_ORDER_INTAKE")).toBe("INT_MANUAL_ORDER_INTAKE");
    expect(intentCodeFor("INT_MANUAL_ORDER_INTAKE")).toBe("INT_MANUAL_ORDER_INTAKE");
  });

  it("titleCaseCode strips the axis prefix and humanises the rest", () => {
    expect(titleCaseCode("SG_NEW_ORDER")).toBe("New Order");
    expect(titleCaseCode("INT_MANUAL_ORDER_INTAKE")).toBe("Manual Order Intake");
  });

  it("intentLabel resolves the governed label for a bare wire intent", () => {
    expect(intentLabel(MOCK_HEALTH, "MANUAL_ORDER_INTAKE")).toBe("Manual Order Intake");
    // The defect under guard: never the channel-specific misnomer.
    expect(intentLabel(MOCK_HEALTH, "MANUAL_ORDER_INTAKE")).not.toBe("Email Order Intake");
  });

  it("supergroupLabel resolves the governed supergroup label", () => {
    expect(supergroupLabel(MOCK_HEALTH, "SG_NEW_ORDER")).toBe("New Order");
  });

  it("falls back to title-case when health is unavailable", () => {
    expect(intentLabel(null, "MANUAL_ORDER_INTAKE")).toBe("Manual Order Intake");
    expect(supergroupLabel(undefined, "SG_NEW_ORDER")).toBe("New Order");
  });

  it("falls back to title-case for an unknown code", () => {
    expect(intentLabel(MOCK_HEALTH, "INT_TOTALLY_NEW")).toBe("Totally New");
  });

  describe("qualifier rule", () => {
    it("hides the intent qualifier for a 1:1 supergroup (SG_NEW_ORDER)", () => {
      expect(intentFanout(MOCK_HEALTH, "SG_NEW_ORDER")).toBe(1);
      expect(showsIntentQualifier(MOCK_HEALTH, "SG_NEW_ORDER")).toBe(false);
    });

    it("shows the intent qualifier for a fan-out supergroup", () => {
      expect(intentFanout(MOCK_HEALTH, "SG_BLOCK_AVAILABILITY")).toBeGreaterThan(1);
      expect(showsIntentQualifier(MOCK_HEALTH, "SG_BLOCK_AVAILABILITY")).toBe(true);
    });

    it("hides the qualifier for a null/unknown supergroup", () => {
      expect(showsIntentQualifier(MOCK_HEALTH, null)).toBe(false);
      expect(showsIntentQualifier(MOCK_HEALTH, "SG_DOES_NOT_EXIST")).toBe(false);
    });
  });
});
