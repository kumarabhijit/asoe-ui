import { buildOpenActionableScenario } from "./_template";

export const EDI_MISMATCH__partner_mapping_error = buildOpenActionableScenario({
  id: "EDI_MISMATCH__partner_mapping_error",
  intent: "EDI_MISMATCH",
  curatedVocab: [
    "EDI_PARTNER_MAPPING_ERROR",
    "CUSTOMER_EDI_MISCONFIGURED",
    "SAP_MASTER_DIFF",
    "TOLERANCE_BAND_ACCEPTED",
    "RESUBMITTED_TO_PARTNER",
    "OTHER",
  ],
  recipeName: "EdiMismatchRecipe.py",
  recordEventType: "EDI_850_LINE_MISMATCH",
});
