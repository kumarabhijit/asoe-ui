/**
 * Deliverable locks — exception detail-pane information hierarchy
 * (UX optimisation pass 2026-06-07).
 *
 * The reconciled refactor (a) lifts the Priority-1 financial impact to an
 * always-visible ImpactBar at the top, (b) auto-expands the primary
 * comparison section via the backend `primary_section` hint, and (c)
 * isolates System Diagnostics into a dedicated tab (Priority 4) — without
 * reversing the SectionAnchorBar (S1 #10) or jump-to-expand (S1 #4)
 * deliverables, which keep their own locks.
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

describe("Priority-4 — Diagnostics isolated into a dedicated tab", () => {
  const panel = read(PANEL);

  it("uses the Tabs primitive via DetailLowerTabs", () => {
    expect(panel).toContain('import { Tabs } from "@/components/ui/Tabs"');
    expect(panel).toContain("<DetailLowerTabs");
    expect(panel).toContain("function DetailLowerTabs");
  });

  it("declares Evidence + Diagnostics tabs and keeps the diagnostics anchor", () => {
    expect(panel).toContain('label: "Evidence"');
    expect(panel).toContain('label: "Diagnostics"');
    // jump-to-expand target preserved inside the tabbed control.
    expect(panel).toContain('anchorId="section-diagnostics"');
    expect(panel).toContain('anchorId="section-evidence"');
  });

  it("Guardrail #4 — the Agent recommendation is NOT inside the tabs", () => {
    // AgentReasoningCard must render in the persistent flow, before the
    // tabbed lower region — never behind a tab.
    const cardIdx = panel.indexOf("<AgentReasoningCard");
    const tabsIdx = panel.indexOf("<DetailLowerTabs");
    expect(cardIdx).toBeGreaterThan(-1);
    expect(tabsIdx).toBeGreaterThan(-1);
    expect(cardIdx).toBeLessThan(tabsIdx);
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
