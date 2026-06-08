/**
 * Deliverable lock (Pattern A, council 2026-06-07) — enrichment sections
 * are routed by the backend `presentation.section_tiers` authority into
 * Layer 1 / the Evidence tab / the Diagnostics tab. They are NOT rendered
 * as a flat Layer-1 stack (the "audit ledger" Guardrail #0 retired).
 *
 * Reverting to the flat stack, dropping the tier routing, or moving the
 * placement decision into the UI (re-deciding instead of honoring the
 * backend authority) must fail here. Verify by removing the routing
 * locally — these assertions break.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const PANEL = readFileSync(
  join(__dirname, "..", "..", "src", "app", "exceptions", "ExceptionDetailPanel.tsx"),
  "utf-8",
);

describe("section_tier routing", () => {
  it("routes sections by the backend section_tiers authority, fail-open to evidence", () => {
    // The UI HONORS placement; it never re-decides it (Guardrail #0/#1).
    expect(PANEL).toContain("sectionTierOf");
    expect(PANEL).toMatch(
      /section_tiers\?\.\[[^\]]+\]\s*\?\?\s*"evidence"/,
    );
  });

  it("partitions enrichment sections into operator / evidence / audit tiers", () => {
    expect(PANEL).toContain("operatorSections");
    expect(PANEL).toContain("evidenceSections");
    expect(PANEL).toContain("auditSections");
  });

  it("hands the evidence + audit tiers to the Evidence / Diagnostics tabs", () => {
    expect(PANEL).toContain("evidenceExtras={evidenceSections}");
    expect(PANEL).toContain("auditExtras={auditSections}");
    // DetailLowerTabs renders them atop the matching tab.
    expect(PANEL).toContain("{evidenceExtras}");
    expect(PANEL).toContain("{auditExtras}");
  });
});
