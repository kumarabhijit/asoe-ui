import { buildOpenActionableScenario } from "./_template";

export const MIN_ORDER_QTY__round_up_applied = buildOpenActionableScenario({
  id: "MIN_ORDER_QTY__round_up_applied",
  intent: "MIN_ORDER_QTY",
  curatedVocab: [
    "ROUND_UP_APPLIED",
    "PARTIAL_FULFILMENT_ACCEPTED",
    "CANCELLATION_ACCEPTED",
    "OPT_OUT_VIOLATION_ROUND_UP",
    "OTHER",
  ],
  recipeName: "MOQRoundUpRecipe.py",
  recordEventType: "MIN_ORDER_QTY",
});
