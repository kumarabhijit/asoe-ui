/**
 * ERP label-map coverage test — ADR-045 revision.
 *
 * Before ADR-045 this file required `ERP_LABEL_MAPS.GENERIC.intents` to
 * carry an entry for every intent. ADR-045 reverses that: the operator-
 * facing label authority is the governed `/health` `display_labels` map,
 * and `erp-label-map.ts` is demoted to a *vendor-synonym overlay* that
 * deliberately does NOT cover ASOE-native intents (e.g.
 * MANUAL_ORDER_INTAKE — whose old GENERIC entry was the "Email Order
 * Intake" misnomer).
 *
 * So the coverage invariant moves to the new authority: every intent the
 * mock serves must resolve to a human (non-machine) label via
 * `display_labels`. The overlay only has to stay a valid subset (enforced
 * in tests/architectural/erp_label_map_overlay_guard.test.ts).
 */

import { MOCK_HEALTH } from "../fixtures";
import { ERP_LABEL_MAPS, SUPPORTED_ERP_VENDORS } from "@/config/erp-label-map";
import { intentLabel, intentCodeFor } from "@/lib/taxonomy-labels";

describe("intent label coverage (ADR-045)", () => {
  it("every canonical intent resolves to a human label via /health", () => {
    for (const intent of MOCK_HEALTH.allowed_intents) {
      const label = intentLabel(MOCK_HEALTH, intent);
      // Non-empty, and not the raw machine token.
      expect(label).toBeTruthy();
      expect(label).not.toBe(intent);
      expect(label).not.toBe(intentCodeFor(intent));
    }
  });

  it("display_labels (the authority) covers every served intent", () => {
    const intents = MOCK_HEALTH.display_labels!.intents;
    for (const intent of MOCK_HEALTH.allowed_intents) {
      expect(intents[intentCodeFor(intent)]).toBeTruthy();
    }
  });

  it("every supported vendor still has at least one synonym entry", () => {
    for (const vendor of SUPPORTED_ERP_VENDORS) {
      const size = Object.keys(ERP_LABEL_MAPS[vendor].intents).length;
      expect(size).toBeGreaterThan(0);
    }
  });
});
