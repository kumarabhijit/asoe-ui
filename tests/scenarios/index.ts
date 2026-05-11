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
import { CONTRACTUAL_CORRECTION__price_band_review } from "./contractual_correction__price_band_review";
import { CREDIT_BLOCK__finance_release } from "./credit_block__finance_release";
import { MASS_PRICING_ERROR__bulk_admin_release } from "./mass_pricing_error__bulk_admin_release";
import { PRICE_HOLD_RELEASE__finance_authorised } from "./price_hold_release__finance_authorised";
import { EDI_MISMATCH__partner_mapping_error } from "./edi_mismatch__partner_mapping_error";
import { OVER_MAX__customer_request_allowed } from "./over_max__customer_request_allowed";
import { MIN_ORDER_QTY__round_up_applied } from "./min_order_qty__round_up_applied";
import { PALLET_CONFIG__tie_layer_overridden } from "./pallet_config__tie_layer_overridden";
import { DELIVERY_DELAY__customer_accepts_new_date } from "./delivery_delay__customer_accepts_new_date";

import type { BehaviourScenario, SloCategory } from "./_types";

export type { BehaviourScenario, SloCategory } from "./_types";

export const SCENARIOS: readonly BehaviourScenario[] = [
  // P1-blocking: cosign banner path + terminal-state edge case.
  DUPLICATE_PO__high_value_needs_cosign,
  MANUAL_ORDER_INTAKE__low_confidence_clarify_buyer,
  BACK_ORDER__failed_terminal,
  // S12 fill-in: one per remaining curated intent.
  CONTRACTUAL_CORRECTION__price_band_review,
  CREDIT_BLOCK__finance_release,
  MASS_PRICING_ERROR__bulk_admin_release,
  PRICE_HOLD_RELEASE__finance_authorised,
  EDI_MISMATCH__partner_mapping_error,
  OVER_MAX__customer_request_allowed,
  MIN_ORDER_QTY__round_up_applied,
  PALLET_CONFIG__tie_layer_overridden,
  DELIVERY_DELAY__customer_accepts_new_date,
] as const;

export function scenariosBySloCategory(category: SloCategory): readonly BehaviourScenario[] {
  return SCENARIOS.filter((s) => s.slo_category === category);
}
