import { buildOpenActionableScenario } from "./_template";

export const CREDIT_BLOCK__finance_release = buildOpenActionableScenario({
  id: "CREDIT_BLOCK__finance_release",
  intent: "CREDIT_BLOCK",
  curatedVocab: [
    "FINANCE_RELEASED_ONE_TIME",
    "CREDIT_LINE_ADJUSTED",
    "CUSTOMER_PREPAY_ARRANGED",
    "RISK_ACCEPTED_OPS",
    "OTHER",
  ],
  recipeName: "CreditHoldReleaseRecipe.py",
  recordEventType: "EDI_850_CREDIT_HOLD",
});
