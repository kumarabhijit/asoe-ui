/**
 * ERP label-map coverage test.
 *
 * Every intent that asoe-ui's mock health serves must have a label
 * entry in `ERP_LABEL_MAPS.GENERIC.intents`. The resolver has a
 * title-case fallback so missing entries don't break runtime — but
 * a missing GENERIC entry means the intent renders machine-ish
 * ("Back_order" instead of "Back Order") until someone notices.
 * Cheaper to catch here.
 *
 * Why iterate `MOCK_HEALTH.allowed_intents` rather than a hand-
 * written set: the mock vocabulary is the single source of truth for
 * what the UI will encounter in demos. Real-backend parity is
 * enforced in `tests/architectural/type_contracts.test.ts`.
 */

import { MOCK_HEALTH } from "../fixtures";
import { ERP_LABEL_MAPS, SUPPORTED_ERP_VENDORS } from "@/config/erp-label-map";

describe("ERP label-map coverage", () => {
  it("every canonical intent has a GENERIC label", () => {
    const genericIntents = ERP_LABEL_MAPS.GENERIC.intents;
    for (const intent of MOCK_HEALTH.allowed_intents) {
      expect(genericIntents[intent]).toBeTruthy();
    }
  });

  it("GENERIC acts as the fallback for every other vendor", () => {
    // Any intent absent from a specific vendor map must still resolve
    // because `intentLabelFor` cascades vendor → GENERIC → title-case.
    // This test asserts the middle tier is always populated — the
    // cascade's correctness is separately tested in erp-label-map.test.ts.
    const genericKeys = new Set(Object.keys(ERP_LABEL_MAPS.GENERIC.intents));
    expect(genericKeys.size).toBeGreaterThanOrEqual(
      MOCK_HEALTH.allowed_intents.length,
    );
  });

  it("every supported vendor has at least one intent entry", () => {
    for (const vendor of SUPPORTED_ERP_VENDORS) {
      const size = Object.keys(ERP_LABEL_MAPS[vendor].intents).length;
      expect(size).toBeGreaterThan(0);
    }
  });
});
