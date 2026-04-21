/**
 * ERP-specific label map for ASOE intent codes.
 *
 * ## Why this file exists
 *
 * Backend intent codes (CONTRACTUAL_CORRECTION, PRICE_HOLD_RELEASE, etc.)
 * are ASOE-internal canonical names and MUST remain the single source of
 * truth for control flow (Guardrail #1 — no UI branching on intent strings).
 *
 * Different ERPs describe the *same* operational exception with different
 * terminology, though: SAP calls a credit-based order hold a "Credit Block"
 * (VKM3), Oracle OM calls it a "Credit Hold", Salesforce Order Management
 * uses the same term as Oracle. When rendering an exception to an operator
 * who thinks in their ERP's vocabulary, we want to surface their words.
 *
 * This config maps each canonical intent (and optionally sub_type) to a
 * vendor-specific display string. The currently active vendor comes from
 * `useErpProfile()` (src/hooks/useErpProfile.ts), which reads the
 * NEXT_PUBLIC_ASOE_ERP_VENDOR env var. Adding a new ERP = add a key to
 * ERP_LABEL_MAPS + document the vendor string. Zero code changes elsewhere.
 *
 * ## What this file is NOT
 *
 * - NOT a feature flag. Labels are display-only; control flow never
 *   branches on the ERP vendor.
 * - NOT a backend contract. Intent codes stay canonical across vendors —
 *   the backend never sees these strings.
 * - NOT a complete i18n system. Pure English labels only; a future i18n
 *   pass would layer locale on top of ERP vendor.
 */

/**
 * Supported ERP vendors. Extend this union + add an entry to
 * ERP_LABEL_MAPS to support a new vendor. GENERIC is the canonical
 * fallback — it always has an entry for every intent and is used when
 * a vendor-specific map has a hole.
 */
export type ErpVendor = "SAP" | "ORACLE" | "SALESFORCE" | "GENERIC";

/** Default vendor when NEXT_PUBLIC_ASOE_ERP_VENDOR is unset or invalid. */
export const DEFAULT_ERP_VENDOR: ErpVendor = "GENERIC";

/** All supported vendor codes — useful for test iteration. */
export const SUPPORTED_ERP_VENDORS: readonly ErpVendor[] = [
  "SAP", "ORACLE", "SALESFORCE", "GENERIC",
] as const;

export interface ErpLabelMap {
  /**
   * Canonical ASOE intent code → vendor-specific display label.
   * If an intent is absent, the resolver falls back to GENERIC and
   * then to a title-cased transform of the code.
   */
  intents: Record<string, string>;
  /**
   * Optional: canonical EDI sub_type → vendor-specific display label.
   * Only populated where a vendor has distinctive terminology; otherwise
   * falls back to GENERIC (which uses the code verbatim with underscores
   * replaced).
   */
  sub_types?: Record<string, string>;
}

/**
 * Per-vendor label maps. Canonical intent codes come from asoe2's
 * `AllowedIntent` Literal in constraints/specs.py — keep keys in sync
 * when adding new intents.
 */
export const ERP_LABEL_MAPS: Record<ErpVendor, ErpLabelMap> = {
  // ─── SAP (SD / FI-AR / IDOC) ──────────────────────────────────────
  // Native SAP terminology where possible; see the field comments for
  // the transaction / table reference an SAP practitioner would use.
  SAP: {
    intents: {
      CONTRACTUAL_CORRECTION: "SD Pricing Variance",            // SD pricing conditions (VK11/VK12)
      CREDIT_BLOCK:           "Credit Block",                   // VKM3 / VBAK-CMGST
      MASS_PRICING_ERROR:     "Mass Pricing Update Failure",    // VK14 / MASS transaction
      DUPLICATE_PO:           "Duplicate Customer PO",          // VOV8 AUFABCHECK
      PRICE_HOLD_RELEASE:     "Pricing Block Release",          // VBKD pricing block
      EDI_MISMATCH:           "Inbound Order Validation Failure", // IDOC ORDERS05 (WE02/WE05)
    },
    sub_types: {
      SKU_MISMATCH:     "Material Master Mismatch",   // MARA
      QTY_MISMATCH:     "Order Quantity Variance",
      UOM_MISMATCH:     "UoM Conversion Mismatch",
      SHIP_TO_MISMATCH: "Ship-To Partner Mismatch",   // KNA1 / partner function SH
    },
  },

  // ─── Oracle (Order Management / Oracle Cloud ERP) ────────────────
  ORACLE: {
    intents: {
      CONTRACTUAL_CORRECTION: "Price Discrepancy",
      CREDIT_BLOCK:           "Credit Hold",
      MASS_PRICING_ERROR:     "Bulk Price Update Error",
      DUPLICATE_PO:           "Duplicate Order",
      PRICE_HOLD_RELEASE:     "Price Hold Release",
      EDI_MISMATCH:           "Order Import Validation Error",
    },
    sub_types: {
      SKU_MISMATCH:     "Invalid Item Number",
      QTY_MISMATCH:     "Quantity Variance",
      UOM_MISMATCH:     "UOM Mismatch",
      SHIP_TO_MISMATCH: "Ship-To Site Mismatch",
    },
  },

  // ─── Salesforce (Commerce Order Management) ──────────────────────
  SALESFORCE: {
    intents: {
      CONTRACTUAL_CORRECTION: "Price Override",
      CREDIT_BLOCK:           "Credit Hold",
      MASS_PRICING_ERROR:     "Mass Update Error",
      DUPLICATE_PO:           "Duplicate Order",
      PRICE_HOLD_RELEASE:     "Order Hold Release",
      EDI_MISMATCH:           "Order Validation Error",
    },
    sub_types: {
      SKU_MISMATCH:     "Invalid Product Code",
      QTY_MISMATCH:     "Quantity Discrepancy",
      UOM_MISMATCH:     "Unit of Measure Mismatch",
      SHIP_TO_MISMATCH: "Ship-To Address Mismatch",
    },
  },

  // ─── GENERIC (ASOE's own vocabulary — always the safe fallback) ──
  GENERIC: {
    intents: {
      CONTRACTUAL_CORRECTION: "Contractual Correction",
      CREDIT_BLOCK:           "Credit Block",
      MASS_PRICING_ERROR:     "Mass Pricing Error",
      DUPLICATE_PO:           "Duplicate PO",
      PRICE_HOLD_RELEASE:     "Price Hold Release",
      EDI_MISMATCH:           "EDI Mismatch",
    },
    sub_types: {
      SKU_MISMATCH:     "SKU Mismatch",
      QTY_MISMATCH:     "Qty Mismatch",
      UOM_MISMATCH:     "UoM Mismatch",
      SHIP_TO_MISMATCH: "Ship-To Mismatch",
    },
  },
};

/**
 * Title-case an UPPER_SNAKE_CASE code as a final fallback when neither
 * the vendor-specific map nor GENERIC has an entry. Keeps the UI from
 * ever rendering raw machine codes.
 */
function titleCaseCode(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/**
 * Resolve a canonical intent code to a human-readable label for the
 * active ERP vendor. Two-tier fallback: vendor-map → GENERIC → title-case.
 */
export function intentLabelFor(
  intent: string,
  vendor: ErpVendor = DEFAULT_ERP_VENDOR,
): string {
  const vendorMap = ERP_LABEL_MAPS[vendor] ?? ERP_LABEL_MAPS.GENERIC;
  return (
    vendorMap.intents[intent]
    ?? ERP_LABEL_MAPS.GENERIC.intents[intent]
    ?? titleCaseCode(intent)
  );
}

/**
 * Resolve a canonical EDI sub_type code (or any sub-vocabulary code)
 * to a human-readable label. Same two-tier fallback as intentLabelFor.
 */
export function subTypeLabelFor(
  subType: string,
  vendor: ErpVendor = DEFAULT_ERP_VENDOR,
): string {
  const vendorMap = ERP_LABEL_MAPS[vendor] ?? ERP_LABEL_MAPS.GENERIC;
  return (
    vendorMap.sub_types?.[subType]
    ?? ERP_LABEL_MAPS.GENERIC.sub_types?.[subType]
    ?? titleCaseCode(subType)
  );
}
