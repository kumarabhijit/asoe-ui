import { buildOpenActionableScenario } from "./_template";

export const OVER_MAX__customer_request_allowed = buildOpenActionableScenario({
  id: "OVER_MAX__customer_request_allowed",
  intent: "OVER_MAX",
  curatedVocab: [
    "TRIM_APPLIED",
    "OVER_MAX_ALLOWED_CUSTOMER_REQUEST",
    "OVER_MAX_ALLOWED_SEASONAL",
    "CUSTOMER_MAX_STALE",
    "OTHER",
  ],
  recipeName: "OverMaxTrimRecipe.py",
  recordEventType: "OVER_MAX_QTY",
});
