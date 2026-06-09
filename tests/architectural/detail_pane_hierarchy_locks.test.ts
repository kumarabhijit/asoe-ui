/**
 * Deliverable locks — exception detail-pane information hierarchy
 * (UX optimisation pass 2026-06-07).
 *
 * The refactor (a) lifts the Priority-1 financial impact to an
 * always-visible ImpactBar at the top and (b) auto-expands the primary
 * comparison section via the backend `primary_section` hint — without
 * reversing the SectionAnchorBar (S1 #10) or jump-to-expand (S1 #4)
 * deliverables, which keep their own locks. (A short-lived experiment
 * that moved Diagnostics into a tab was reverted per PO ruling
 * 2026-06-07; Diagnostics stays an inline collapsed section.)
 *
 * Pattern A (source-grep canaries) here; Pattern B behavioural coverage
 * lives in tests/components/detail_pane_priority.test.tsx + the Playwright
 * detail specs. Removing any wiring below should fail the build.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

import { MOCK_ORDER_ANALYSES } from "@/lib/mock-data/order-analyses";

const SRC = path.resolve(__dirname, "../../src");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf-8");

const PANEL = "app/exceptions/ExceptionDetailPanel.tsx";
const CASE_PANEL = "app/cases/CaseDetailPanel.tsx";

// Field names that carry a comparison delta the operator weighs. Mirrors
// the precedence list in the mock layer and the backend adapter targets.
const PRIMARY_SECTION_KEYS = [
  "price_hold_analysis",
  "edi_mismatch_analysis",
  "price_analysis",
  "duplicate_detection",
  "order_comparison",
  "backorder_analysis",
  "overmax_analysis",
  "moq_analysis",
  "pallet_analysis",
  "delivery_delay_analysis",
] as const;

describe("Priority-1 — ImpactBar lifted to the top", () => {
  const panel = read(PANEL);

  it("ExceptionDetailPanel mounts ImpactBar with impact_metrics", () => {
    expect(panel).toContain("import { ImpactBar }");
    expect(panel).toContain("<ImpactBar impactMetrics={analysis?.impact_metrics}");
  });

  it("ContextStrip no longer receives impactMetrics (no double-render)", () => {
    const mount = panel.match(/<ContextStrip[\s\S]*?\/>/);
    expect(mount, "ContextStrip mount not found").not.toBeNull();
    expect(
      mount?.[0].includes("impactMetrics"),
      "impact metrics moved to the always-visible ImpactBar; ContextStrip " +
        "must carry the entity profile only so the figure is not rendered twice",
    ).toBe(false);
  });

  it("ImpactBar is a dumb projector (null when no metrics; no '—' fallbacks)", () => {
    const bar = read("app/exceptions/ImpactBar.tsx");
    expect(bar).toContain("if (!im) return null;");
    expect(bar).not.toContain('"—"');
    expect(bar).not.toContain('"N/A"');
  });
});

describe("Priority-2 — primary comparison auto-expands off the backend hint", () => {
  const panel = read(PANEL);

  it("derives primarySection from analysis.primary_section", () => {
    expect(panel).toContain("analysis?.primary_section ?? null");
  });

  it("every comparison section gates defaultOpen on the hint (data-driven)", () => {
    for (const key of PRIMARY_SECTION_KEYS) {
      expect(
        panel.includes(`defaultOpen={primarySection === "${key}"}`),
        `${key} section must auto-expand when it is the primary_section`,
      ).toBe(true);
    }
  });
});

describe("Evidence + Diagnostics are single grouped disclosures (no flat stack, no tab)", () => {
  const panel = read(PANEL);

  it("renders EvidenceGrid + DiagnosticsSection, not behind a Tabs control", () => {
    // PO ruling (follow-up 2026-06-07): the stacked-collapsible layout is
    // the operator-preferred surface; the short-lived Diagnostics-tab
    // experiment was reverted. The Tabs primitive must not return.
    expect(panel).not.toContain("DetailLowerTabs");
    expect(panel).not.toContain('@/components/ui/Tabs');
    expect(panel).toContain("<EvidenceGrid");
    expect(panel).toContain("<DiagnosticsSection");
  });

  it("gathers each tier under ONE CollapsibleSection, not a flat sibling stack", () => {
    // Stacked-GROUP layout (council 2026-06-07 / Guardrail #0): the
    // evidence-tier + audit-tier sections each live inside a single
    // disclosure — the audit ledger (every section its own always-visible
    // header) the cockpit was created to replace. Reverting to the flat
    // stack (`{evidenceSections}` as a bare sibling list) must fail here.
    expect(panel).toMatch(/<CollapsibleSection\s+title="Evidence"\s+id="section-evidence"/);
    expect(panel).toMatch(/<CollapsibleSection\s+title="Diagnostics & Audit"\s+id="section-diagnostics"/);
  });

  it("auto-opens Evidence for needs-human, never for Diagnostics (Guardrail #5)", () => {
    // Evidence auto-expands for HITL states so the justifying delta is
    // visible without a click; Diagnostics & Audit is always collapsed.
    expect(panel).toMatch(
      /title="Evidence"[\s\S]*?defaultOpen=\{isHumanInTheLoopState\(detail\.lifecycle_state\)\}/,
    );
    expect(panel).toMatch(/title="Diagnostics & Audit"[\s\S]*?defaultOpen=\{false\}/);
  });

  it("inner grid/trace carry their own jump anchors so cross-links still reveal", () => {
    // The group owns #section-evidence / #section-diagnostics; the grid and
    // trace keep distinct inner anchors, reached via the group's
    // extraAnchorIds (jump-to-expand #4).
    expect(panel).toContain('anchorId="section-line-items"');
    expect(panel).toContain('anchorId="section-trace"');
    expect(panel).toContain("extraAnchorIds={evidenceAnchorIds}");
    expect(panel).toContain("extraAnchorIds={auditAnchorIds}");
  });

  it("group headers outrank their nested sub-sections (council 2026-06-09)", () => {
    // The two tier groups render at the prominent `group` level; the
    // evidence/audit sub-sections are demoted to `nested` so the hierarchy
    // is visible. Regression = every header flat at one size.
    expect(panel).toMatch(/title="Evidence"\s+id="section-evidence"\s+level="group"/);
    expect(panel).toMatch(/title="Diagnostics & Audit"\s+id="section-diagnostics"\s+level="group"/);
    expect(panel).toContain('cloneElement(node as ReactElement<{ level?: CollapsibleLevel }>, { level: "nested" })');
  });
});

describe("Single Diagnostics & Audit surface — no duplicate drawer (council 2026-06-09)", () => {
  const panel = read(PANEL);
  const casePanel = read(CASE_PANEL);

  it("ExceptionDetailPanel exposes auditExtras and renders it inside the Diagnostics group", () => {
    expect(panel).toContain("auditExtras?: ReactNode");
    // Rendered inside the Diagnostics & Audit group, after the trace pane.
    expect(panel).toMatch(/<DiagnosticsSection[\s\S]*?\/>\s*\{\/\*[\s\S]*?\*\/\}\s*\{auditExtras\}/);
  });

  it("/cases workspace injects provenance into the panel and gates its own drawer on !selectedRecord", () => {
    // When a record is mounted, the panel owns the single drawer; the
    // standalone classification drawer renders ONLY when no record is
    // selected. Reverting to an unconditional standalone drawer (the
    // duplicate the operator flagged) must fail here.
    expect(casePanel).toContain("auditExtras={classificationProvenance}");
    expect(casePanel).toMatch(/\{!selectedRecord && classificationProvenance && \(/);
  });
});

describe("Diagnostics: no nested Show-Diagnostics toggle (council 2026-06-09)", () => {
  const diag = read("app/exceptions/DiagnosticsSection.tsx");
  const panel = read(PANEL);

  it("DiagnosticsSection drops the redundant inner Show/Hide Diagnostics toggle", () => {
    // The toggle was a SECOND disclosure inside the already-collapsed
    // Diagnostics & Audit group — open the group, then click again to see
    // anything. Removed: Pipeline / Trace Evidence render directly. Canary
    // on the toggle MECHANICS (state + label expression), not the prose —
    // this file's comment legitimately names the removed toggle.
    expect(diag).not.toContain("diagnosticsOpen");
    expect(diag).not.toMatch(/"Hide Diagnostics"\s*:\s*"Show Diagnostics"/);
  });

  it("Pipeline and Trace Evidence render as direct nested sub-sections", () => {
    // Peers of EDI 850 Audit / Knowledge Graph inside the group.
    expect(diag).toMatch(/title="Pipeline"\s+level="nested"/);
    expect(diag).toMatch(/title="Trace Evidence"\s+level="nested"/);
  });

  it("trace lazy-load moves to the Diagnostics & Audit group's onFirstOpen", () => {
    // With the inner toggle gone, opening the GROUP is what defers/triggers
    // the trace fetch — so the panel must wire ensureTraceLoaded there.
    expect(panel).toMatch(
      /title="Diagnostics & Audit"[\s\S]*?onFirstOpen=\{ensureTraceLoaded\}/,
    );
  });

  it("Trace Evidence keeps its useHashOpen(anchorId) reveal-on-jump", () => {
    // The #section-trace deep link must still expand + scroll the section.
    expect(diag).toContain("useHashOpen(anchorId");
  });
});

describe("Mock-data lock — primary_section stamped on comparison records", () => {
  it("every mock analysis with a comparison field carries a valid primary_section", () => {
    const entries = Object.entries(MOCK_ORDER_ANALYSES);
    expect(entries.length).toBeGreaterThan(0);
    for (const [id, a] of entries) {
      const rec = a as unknown as Record<string, unknown>;
      const hasComparison = PRIMARY_SECTION_KEYS.some((k) => rec[k] != null);
      if (!hasComparison) continue;
      expect(a.primary_section, `${id} has a comparison but no primary_section`).toBeTruthy();
      // The pointer must name a field that is actually present (no
      // partial-truth pointer — mirrors the backend invariant).
      expect(
        rec[a.primary_section as string] != null,
        `${id}.primary_section="${a.primary_section}" points at an absent field`,
      ).toBe(true);
    }
  });
});
