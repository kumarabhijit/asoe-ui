/**
 * reasonCodeClusters — ADR-033 §D unit tests.
 *
 * Verifies the UI-side cluster mapping for DUPLICATE_PO and the
 * notes-required predicate. The dialog's runtime behaviour
 * (rendering, intersection with allowedReasonTags, fall-back to a
 * flat list) is covered by component tests in tests/components/
 * — these tests pin the data-shape contract.
 */

import {
  REASON_CODE_CLUSTERS,
  NOTES_REQUIRED_REASON_CODES,
  clustersForIntent,
  notesRequiredForReason,
} from "@/app/exceptions/reasonCodeClusters";

describe("reasonCodeClusters — DUPLICATE_PO mapping (ADR-033 §D)", () => {
  it("maps DUPLICATE_PO to exactly 3 clusters", () => {
    const clusters = clustersForIntent("DUPLICATE_PO");
    expect(clusters).not.toBeNull();
    expect(clusters!.length).toBe(3);
  });

  it("first cluster is the single-item Confirm-the-agent group", () => {
    const clusters = clustersForIntent("DUPLICATE_PO")!;
    expect(clusters[0].label).toBe("Confirm the agent");
    expect(clusters[0].codes).toEqual(["CONFIRMED_DUPLICATE"]);
  });

  it("second cluster contains the six structured override reasons", () => {
    const clusters = clustersForIntent("DUPLICATE_PO")!;
    expect(clusters[1].label).toBe("Override with a structured reason");
    expect(clusters[1].codes).toEqual([
      "INTENTIONAL_REORDER",
      "AMENDED_PO",
      "DIFFERENT_SHIP_TO",
      "BLANKET_RELEASE",
      "SYSTEM_RETRY_VALID",
      "PARTIAL_OVERLAP",
    ]);
  });

  it("third cluster is the OTHER edge-case group", () => {
    const clusters = clustersForIntent("DUPLICATE_PO")!;
    expect(clusters[2].label).toBe("Edge case");
    expect(clusters[2].codes).toEqual(["OTHER"]);
  });

  it("union of all DUPLICATE_PO clusters covers exactly 8 codes", () => {
    const clusters = clustersForIntent("DUPLICATE_PO")!;
    const all = clusters.flatMap((c) => c.codes);
    expect(all.length).toBe(8);
    expect(new Set(all).size).toBe(8); // no duplicates across clusters
  });

  it("DUPLICATE_PO codes match the curated 8 from ADR-033 §A", () => {
    const clusters = clustersForIntent("DUPLICATE_PO")!;
    const all = new Set(clusters.flatMap((c) => c.codes));
    expect(all).toEqual(
      new Set([
        "INTENTIONAL_REORDER",
        "AMENDED_PO",
        "BLANKET_RELEASE",
        "SYSTEM_RETRY_VALID",
        "DIFFERENT_SHIP_TO",
        "CONFIRMED_DUPLICATE",
        "PARTIAL_OVERLAP",
        "OTHER",
      ]),
    );
  });
});

describe("reasonCodeClusters — clustersForIntent fallback", () => {
  it("returns null for intents without a mapping", () => {
    expect(clustersForIntent("CREDIT_BLOCK")).toBeNull();
    expect(clustersForIntent("MASS_PRICING_ERROR")).toBeNull();
    expect(clustersForIntent("EDI_MISMATCH")).toBeNull();
  });

  it("returns null for undefined / null / empty intent", () => {
    expect(clustersForIntent(undefined)).toBeNull();
    expect(clustersForIntent(null)).toBeNull();
    expect(clustersForIntent("")).toBeNull();
  });
});

describe("reasonCodeClusters — notesRequiredForReason (ADR-033 §D.3)", () => {
  it("requires notes when reason is curated OTHER (uppercase)", () => {
    expect(notesRequiredForReason("OTHER")).toBe(true);
  });

  it("requires notes when reason is legacy other (lowercase)", () => {
    expect(notesRequiredForReason("other")).toBe(true);
  });

  it("does NOT require notes for any structured DUPLICATE_PO code", () => {
    const structuredCodes = [
      "INTENTIONAL_REORDER",
      "AMENDED_PO",
      "BLANKET_RELEASE",
      "SYSTEM_RETRY_VALID",
      "DIFFERENT_SHIP_TO",
      "CONFIRMED_DUPLICATE",
      "PARTIAL_OVERLAP",
    ];
    for (const code of structuredCodes) {
      expect(notesRequiredForReason(code)).toBe(false);
    }
  });

  it("does NOT require notes for non-OTHER legacy codes", () => {
    const legacyCodes = [
      "customer_concession",
      "contract_stale",
      "data_error",
      "policy_exception",
      "agent_misclassification",
    ];
    for (const code of legacyCodes) {
      expect(notesRequiredForReason(code)).toBe(false);
    }
  });

  it("notes-required set is exactly { OTHER, other }", () => {
    expect(NOTES_REQUIRED_REASON_CODES.size).toBe(2);
    expect(NOTES_REQUIRED_REASON_CODES.has("OTHER")).toBe(true);
    expect(NOTES_REQUIRED_REASON_CODES.has("other")).toBe(true);
  });
});

describe("reasonCodeClusters — REASON_CODE_CLUSTERS frozen-shape sanity", () => {
  it("every cluster ends with codes derived from the OTHER fallback rule", () => {
    // ADR-033 §C.2: every per-intent vocabulary's last entry is OTHER
    // or other. The cluster mapping reflects that — the LAST cluster's
    // last code should be the OTHER fallback so the "Edge case" UI
    // group is consistent across intents.
    for (const intent of Object.keys(REASON_CODE_CLUSTERS)) {
      const clusters = REASON_CODE_CLUSTERS[intent];
      const lastCluster = clusters[clusters.length - 1];
      const lastCode = lastCluster.codes[lastCluster.codes.length - 1];
      expect(["OTHER", "other"]).toContain(lastCode);
    }
  });

  it("no duplicate codes across clusters within an intent", () => {
    for (const intent of Object.keys(REASON_CODE_CLUSTERS)) {
      const clusters = REASON_CODE_CLUSTERS[intent];
      const all = clusters.flatMap((c) => c.codes);
      expect(new Set(all).size).toBe(all.length);
    }
  });
});
