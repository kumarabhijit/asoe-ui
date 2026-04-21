/**
 * ERP label-map resolver tests.
 *
 * Verifies: per-vendor intent labels, per-vendor sub_type labels,
 * GENERIC fallback when the active vendor lacks an entry, and
 * title-case fallback when neither vendor nor GENERIC has the code.
 */

import {
  DEFAULT_ERP_VENDOR,
  ERP_LABEL_MAPS,
  SUPPORTED_ERP_VENDORS,
  intentLabelFor,
  subTypeLabelFor,
  type ErpVendor,
} from "@/config/erp-label-map";

describe("ERP label map — canonical vocabulary coverage", () => {
  const canonicalIntents = [
    "CONTRACTUAL_CORRECTION",
    "CREDIT_BLOCK",
    "MASS_PRICING_ERROR",
    "DUPLICATE_PO",
    "PRICE_HOLD_RELEASE",
    "EDI_MISMATCH",
  ];

  const canonicalSubTypes = [
    "SKU_MISMATCH",
    "QTY_MISMATCH",
    "UOM_MISMATCH",
    "SHIP_TO_MISMATCH",
  ];

  for (const vendor of SUPPORTED_ERP_VENDORS) {
    it(`${vendor} has a label for every canonical intent`, () => {
      for (const intent of canonicalIntents) {
        expect(ERP_LABEL_MAPS[vendor].intents[intent]).toBeTruthy();
      }
    });

    it(`${vendor} has a label for every canonical sub_type`, () => {
      for (const st of canonicalSubTypes) {
        expect(ERP_LABEL_MAPS[vendor].sub_types?.[st]).toBeTruthy();
      }
    });
  }

  it("DEFAULT_ERP_VENDOR is a supported vendor", () => {
    expect(SUPPORTED_ERP_VENDORS).toContain(DEFAULT_ERP_VENDOR);
  });
});

describe("intentLabelFor — vendor-specific resolution", () => {
  it("SAP uses SD pricing vocabulary for CONTRACTUAL_CORRECTION", () => {
    expect(intentLabelFor("CONTRACTUAL_CORRECTION", "SAP")).toBe("SD Pricing Variance");
  });

  it("ORACLE uses Price Discrepancy for CONTRACTUAL_CORRECTION", () => {
    expect(intentLabelFor("CONTRACTUAL_CORRECTION", "ORACLE")).toBe("Price Discrepancy");
  });

  it("SALESFORCE uses Price Override for CONTRACTUAL_CORRECTION", () => {
    expect(intentLabelFor("CONTRACTUAL_CORRECTION", "SALESFORCE")).toBe("Price Override");
  });

  it("GENERIC preserves the canonical friendly form", () => {
    expect(intentLabelFor("CONTRACTUAL_CORRECTION", "GENERIC")).toBe("Contractual Correction");
  });

  it("SAP and ORACLE disagree on PRICE_HOLD_RELEASE", () => {
    expect(intentLabelFor("PRICE_HOLD_RELEASE", "SAP")).toBe("Pricing Block Release");
    expect(intentLabelFor("PRICE_HOLD_RELEASE", "ORACLE")).toBe("Price Hold Release");
  });

  it("CREDIT_BLOCK is SAP-native so all vendors use a recognisable synonym", () => {
    expect(intentLabelFor("CREDIT_BLOCK", "SAP")).toBe("Credit Block");
    expect(intentLabelFor("CREDIT_BLOCK", "ORACLE")).toBe("Credit Hold");
  });
});

describe("intentLabelFor — fallback behaviour", () => {
  it("falls back to the title-cased code when the intent is unknown", () => {
    expect(intentLabelFor("FUTURE_INTENT_NOT_YET_MAPPED", "SAP")).toBe(
      "Future Intent Not Yet Mapped",
    );
  });

  it("uses the default vendor when the caller omits one", () => {
    // Default vendor is GENERIC → canonical friendly form.
    expect(intentLabelFor("CONTRACTUAL_CORRECTION")).toBe("Contractual Correction");
  });

  it("coerces an invalid vendor to GENERIC-equivalent output", () => {
    // Type-asserted to simulate a runtime-invalid vendor string.
    const bogus = "NOT_A_VENDOR" as unknown as ErpVendor;
    expect(intentLabelFor("CONTRACTUAL_CORRECTION", bogus)).toBe("Contractual Correction");
  });
});

describe("subTypeLabelFor — EDI sub_type resolution", () => {
  it("SAP uses Material Master Mismatch for SKU_MISMATCH", () => {
    expect(subTypeLabelFor("SKU_MISMATCH", "SAP")).toBe("Material Master Mismatch");
  });

  it("ORACLE uses Invalid Item Number for SKU_MISMATCH", () => {
    expect(subTypeLabelFor("SKU_MISMATCH", "ORACLE")).toBe("Invalid Item Number");
  });

  it("GENERIC renders SKU_MISMATCH as SKU Mismatch", () => {
    expect(subTypeLabelFor("SKU_MISMATCH", "GENERIC")).toBe("SKU Mismatch");
  });

  it("falls back to title-case for unknown sub_types", () => {
    expect(subTypeLabelFor("ALLERGEN_MISMATCH", "SAP")).toBe("Allergen Mismatch");
  });
});
