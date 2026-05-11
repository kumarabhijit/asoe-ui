import { buildOpenActionableScenario } from "./_template";

export const PRICE_HOLD_RELEASE__finance_authorised = buildOpenActionableScenario({
  id: "PRICE_HOLD_RELEASE__finance_authorised",
  intent: "PRICE_HOLD_RELEASE",
  curatedVocab: [
    "OPERATIONS_AUTHORISED",
    "FINANCE_AUTHORISED",
    "CONTRACT_VERIFIED",
    "BULK_RELEASE_APPROVED",
    "OTHER",
  ],
  recipeName: "PriceHoldReleaseRecipe.py",
  recordEventType: "EDI_850_PRICE_HOLD",
});
