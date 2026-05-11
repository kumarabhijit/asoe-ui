// Scenario library entry point. Phases S6/S7 consume this via
// `describe.each(SCENARIOS)` for parameterised tests; S1 ships three
// scenarios that exercise the casing-fix paths end-to-end.
//
// Adding a new scenario:
//   1. Create `<intent>__<operator_situation>.ts` next to this file.
//   2. Export the named const matching the file name.
//   3. Append it to SCENARIOS below.
//   4. Verify `tests/contract/test_reason_tag_vocab_parity.test.ts`
//      passes — the override.reason_tags must be drawn from the
//      curated snapshot.
import { DUPLICATE_PO__high_value_needs_cosign } from "./duplicate_po__high_value_needs_cosign";
import { MANUAL_ORDER_INTAKE__low_confidence_clarify_buyer } from "./manual_order_intake__low_confidence_clarify_buyer";
import { BACK_ORDER__failed_terminal } from "./back_order__failed_terminal";

import type { BehaviourScenario, SloCategory } from "./_types";

export type { BehaviourScenario, SloCategory } from "./_types";

export const SCENARIOS: readonly BehaviourScenario[] = [
  DUPLICATE_PO__high_value_needs_cosign,
  MANUAL_ORDER_INTAKE__low_confidence_clarify_buyer,
  BACK_ORDER__failed_terminal,
] as const;

export function scenariosBySloCategory(category: SloCategory): readonly BehaviourScenario[] {
  return SCENARIOS.filter((s) => s.slo_category === category);
}
