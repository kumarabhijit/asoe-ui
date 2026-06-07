/**
 * ExceptionDetailPanel action-host + section-order lock.
 *
 * Pattern A (source-grep) per CLAUDE.md test strategy.
 *
 * ADR-045 CP3 supersedes ADR-041 P3e §2.2: the separate
 * `StickyActionRibbon` is retired and the action buttons are
 * consolidated into the single Agent Recommendation pane
 * (`AgentReasoningCard`). The above-the-fold guarantee the ribbon used
 * to provide is now preserved by keeping `AgentAnalysisSection`
 * collapsed by default (expanded only for HITL states), so the
 * Recommendation card's actions sit near the top of the scroll.
 *
 * Invariants locked here:
 *   1. The file resolves the V2 flag via `casesRowV2Enabled` (the flag
 *      still gates the Analysis-above-Recommendation reorder).
 *   2. There is NO `StickyActionRibbon` — neither import nor mount.
 *      The single action host is `AgentReasoningCard`.
 *   3. `AgentReasoningCard` is NOT passed `hideActionMatrix` — the
 *      matrix always renders inside the card (it is the sole host).
 *   4. When V2 is on, `<AgentAnalysisSection>` renders ABOVE
 *      `<AgentReasoningCard>` (cognitive sequence: diagnose → act).
 *   5. The legacy `<AgentAnalysisSection>` mount (below the card) is
 *      guarded by `!CASES_ROW_V2` so it doesn't render twice.
 *   6. Every `<AgentAnalysisSection>` mount binds `defaultOpen` to the
 *      HITL predicate — collapsed by default, expanded only for a
 *      human-in-the-loop state. This keeps the card's actions above
 *      the fold now that the ribbon is gone.
 *
 * Bug shape this catches: a refactor reintroduces a second action host,
 * drops the card's matrix, or makes Agent Analysis expand by default
 * (pushing the actions below the fold on long analyses).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PANEL = readFileSync(
  path.join(__dirname, "../../src/app/exceptions/ExceptionDetailPanel.tsx"),
  "utf-8",
);

describe("ExceptionDetailPanel action host + section order (ADR-045 CP3)", () => {
  it("resolves the V2 flag via the shared `casesRowV2Enabled` helper", () => {
    expect(PANEL).toMatch(/casesRowV2Enabled/);
    expect(PANEL).toMatch(
      /import\s*\{[^}]*casesRowV2Enabled[^}]*\}\s*from\s*["']@\/lib\/flags["']/,
    );
  });

  it("does NOT import or mount a separate StickyActionRibbon (retired)", () => {
    // Explanatory comments documenting the retirement are fine; what must
    // be gone is the import and the JSX mount.
    expect(PANEL).not.toMatch(/import[^;]*StickyActionRibbon/);
    expect(PANEL).not.toMatch(/<StickyActionRibbon\b/);
  });

  it("does NOT pass hideActionMatrix — the card is the sole action host", () => {
    // With the ribbon gone the matrix must always render inside the
    // Agent Recommendation pane; suppressing it would leave no host.
    expect(PANEL).not.toMatch(/hideActionMatrix=/);
  });

  it("mounts AgentReasoningCard as the action host", () => {
    expect(PANEL).toMatch(/<AgentReasoningCard\b/);
  });

  it("V2-only AgentAnalysisSection mount precedes the AgentReasoningCard", () => {
    const v2AnalysisIdx = PANEL.search(
      /CASES_ROW_V2\s*&&\s*analysis\s*&&[^<]*<AgentAnalysisSection/,
    );
    const cardIdx = PANEL.indexOf("<AgentReasoningCard");
    expect(v2AnalysisIdx).toBeGreaterThan(-1);
    expect(cardIdx).toBeGreaterThan(-1);
    expect(v2AnalysisIdx).toBeLessThan(cardIdx);
  });

  it("legacy AgentAnalysisSection mount is suppressed when V2 is on", () => {
    expect(PANEL).toMatch(/!CASES_ROW_V2\s*&&\s*analysis\s*&&[^<]*<AgentAnalysisSection/);
  });

  it("Agent Analysis is collapsed by default, expanded only for HITL", () => {
    // The above-the-fold guarantee: with the ribbon retired, actions
    // stay near the top because Analysis is collapsed unless the
    // exception is in a human-in-the-loop state. Every mount must bind
    // defaultOpen to the HITL predicate (no hardcoded `defaultOpen` /
    // `defaultOpen={true}`).
    const mounts = PANEL.match(/<AgentAnalysisSection[\s\S]{0,200}?defaultOpen=\{[^}]+\}/g) ?? [];
    expect(mounts.length).toBeGreaterThan(0);
    for (const m of mounts) {
      expect(m).toMatch(/defaultOpen=\{isHumanInTheLoopState\(/);
    }
  });
});
