import { buildOpenActionableScenario } from "./_template";

export const CONTRACTUAL_CORRECTION__price_band_review = buildOpenActionableScenario({
  id: "CONTRACTUAL_CORRECTION__price_band_review",
  intent: "CONTRACTUAL_CORRECTION",
  curatedVocab: [
    "CONTRACT_STALE_PRICE",
    "PROMO_WINDOW_EXPIRED",
    "SAP_MASTER_PRICE_ERROR",
    "CUSTOMER_CONCESSION_LOW",
    "CUSTOMER_CONCESSION_HIGH",
    "BAND_REVIEW_OVERRIDDEN",
    "OTHER",
  ],
  recipeName: "PriceAdjustmentRecipe.py",
  recordEventType: "EDI_850_PRICE_VARIANCE",
});
