import { buildOpenActionableScenario } from "./_template";

export const MASS_PRICING_ERROR__bulk_admin_release = buildOpenActionableScenario({
  id: "MASS_PRICING_ERROR__bulk_admin_release",
  intent: "MASS_PRICING_ERROR",
  curatedVocab: [
    "BULK_DATA_ERROR_CONFIRMED",
    "BULK_PROMO_EXTENSION",
    "MASS_CONCESSION_HONOURED",
    "FALSE_POSITIVE",
    "OTHER",
  ],
  // No recipe — RED-blocking admin-release path per asoe2 panel B11.
  recordEventType: "MASS_PRICING_FLAGGED",
});
