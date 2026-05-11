import { buildOpenActionableScenario } from "./_template";

export const DELIVERY_DELAY__customer_accepts_new_date = buildOpenActionableScenario({
  id: "DELIVERY_DELAY__customer_accepts_new_date",
  intent: "DELIVERY_DELAY",
  curatedVocab: [
    "CUSTOMER_ACCEPTS_NEW_DATE",
    "EXPEDITE_APPROVED",
    "CANCELLATION_ACCEPTED",
    "PARTIAL_SPLIT_SHIPMENT",
    "OTHER",
  ],
  recipeName: "DeliveryDelayResolutionRecipe.py",
  recordEventType: "DELIVERY_DELAY",
});
