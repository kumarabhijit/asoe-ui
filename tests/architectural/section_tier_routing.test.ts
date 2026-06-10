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

  it("renders the evidence + audit tiers inline in their stacked surfaces", () => {
    // Stacked-collapsible layout (main 2026-06-08, tabs retired):
    // evidence-tier sections stack above EvidenceGrid inside the evidence
    // group. The cockpit review-before-send reorder (council 2026-06-10)
    // wraps them in a ternary (Modern uses evidenceSectionsNoDraft, Legacy
    // evidenceSections) and renders the draft AFTER the grid — assert the
    // ternary marker precedes the grid, and the draft follows it.
    const evidenceIdx = PANEL.indexOf("COCKPIT ? evidenceSectionsNoDraft : evidenceSections");
    const gridIdx = PANEL.indexOf("<EvidenceGrid");
    expect(evidenceIdx).toBeGreaterThan(-1);
    expect(evidenceIdx).toBeLessThan(gridIdx);
    // Draft reply renders LAST (after the grid) in Modern — Send terminal.
    const draftIdx = PANEL.indexOf("{COCKPIT && draftReplyNested}");
    expect(draftIdx).toBeGreaterThan(gridIdx);

    // Audit-tier sections stack above the raw trace (DiagnosticsSection)
    // inside the Diagnostics group. The cockpit (Modern) splits this tier
    // into otherAuditSections + an "Audit only" group; Legacy keeps the
    // flat {auditSections}. BOTH branches place the audit sections before
    // their DiagnosticsSection — assert per branch (there are now two
    // DiagnosticsSection occurrences, one per branch).
    const legacyAuditIdx = PANEL.indexOf("{auditSections}");
    const modernAuditIdx = PANEL.indexOf("{otherAuditSections}");
    expect(legacyAuditIdx).toBeGreaterThan(-1);
    expect(modernAuditIdx).toBeGreaterThan(-1);
    // Modern: otherAuditSections precede the FIRST DiagnosticsSection.
    expect(modernAuditIdx).toBeLessThan(PANEL.indexOf("<DiagnosticsSection"));
    // Legacy: {auditSections} precede the LAST DiagnosticsSection.
    expect(legacyAuditIdx).toBeLessThan(PANEL.lastIndexOf("<DiagnosticsSection"));
  });
});
