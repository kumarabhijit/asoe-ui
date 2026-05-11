import { buildOpenActionableScenario } from "./_template";

export const PALLET_CONFIG__tie_layer_overridden = buildOpenActionableScenario({
  id: "PALLET_CONFIG__tie_layer_overridden",
  intent: "PALLET_CONFIG",
  curatedVocab: [
    "TIE_LAYER_OVERRIDDEN",
    "PALLET_HEIGHT_OVERRIDDEN",
    "FREIGHT_CLASS_OVERRIDDEN",
    "CASE_COUNT_OVERRIDDEN",
    "OTHER",
  ],
  recipeName: "PalletAlignmentRecipe.py",
  recordEventType: "PALLET_CONFIG_VIOLATION",
});
