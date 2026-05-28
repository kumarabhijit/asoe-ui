/**
 * ExceptionDetailPanel section reorder lock — ADR-041 P3e §2.2.
 *
 * Pattern A (source-grep) per CLAUDE.md test strategy. Locks the
 * structural invariants the panel signed off on for the
 * Analysis-above-Recommendation reorder:
 *
 *   1. The file reads NEXT_PUBLIC_CASES_ROW_V2 — the flag must
 *      gate the reorder; default flag-off keeps today's order.
 *   2. `<StickyActionRibbon>` is imported and mounted (the
 *      Compliance reversal condition for the reorder).
 *   3. `AgentReasoningCard` receives `hideActionMatrix={CASES_ROW_V2}`
 *      so the matrix doesn't render twice when V2 is on.
 *   4. When V2 is on, `<AgentAnalysisSection>` is rendered ABOVE
 *      `<AgentReasoningCard>` — the cognitive-sequence fix.
 *   5. The legacy `<AgentAnalysisSection>` mount (below the card)
 *      is suppressed when V2 is on — otherwise it renders twice.
 *
 * Bug shape this catches: a refactor flips the order back, or
 * removes the sticky ribbon while keeping the reorder (SOX failure
 * mode: Approve drops below the fold on long Analysis sections),
 * or accidentally drops `hideActionMatrix` so the card re-renders
 * the button matrix below the sticky ribbon.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PANEL = readFileSync(
  path.join(__dirname, "../../src/app/exceptions/ExceptionDetailPanel.tsx"),
  "utf-8",
);

describe("ExceptionDetailPanel section reorder (ADR-041 P3e §2.2)", () => {
  it("resolves the V2 flag via the shared `casesRowV2Enabled` helper", () => {
    // Pre-rollout-policy refactor (commit 7a3d256) this checked
    // for `process.env.NEXT_PUBLIC_CASES_ROW_V2` inline. The
    // policy now lives in `src/lib/flags.ts::casesRowV2Enabled`;
    // both consumers (page.tsx + this file) call through it.
    expect(PANEL).toMatch(/casesRowV2Enabled/);
    expect(PANEL).toMatch(
      /import\s*\{[^}]*casesRowV2Enabled[^}]*\}\s*from\s*["']@\/lib\/flags["']/,
    );
  });

  it("imports and mounts StickyActionRibbon", () => {
    expect(PANEL).toMatch(
      /import\s*\{\s*StickyActionRibbon\s*\}\s*from\s*["']@\/components\/ui\/StickyActionRibbon["']/,
    );
    expect(PANEL).toMatch(/<StickyActionRibbon\b/);
  });

  it("StickyActionRibbon is gated on the V2 flag (not unconditional)", () => {
    expect(PANEL).toMatch(/CASES_ROW_V2\s*&&[^<]*<StickyActionRibbon/);
  });

  it("AgentReasoningCard receives hideActionMatrix bound to the flag", () => {
    // The matrix must not double-render when V2 is on (sticky ribbon
    // above + card below would both show it).
    expect(PANEL).toMatch(/hideActionMatrix=\{CASES_ROW_V2\}/);
  });

  it("V2-only AgentAnalysisSection mount precedes the AgentReasoningCard", () => {
    // The V2 mount of Agent Analysis must appear BEFORE the card in
    // file order (the cognitive sequence: diagnose → recommend → act).
    const v2AnalysisIdx = PANEL.search(
      /CASES_ROW_V2\s*&&\s*analysis\s*&&[^<]*<AgentAnalysisSection/,
    );
    const cardIdx = PANEL.indexOf("<AgentReasoningCard");
    expect(v2AnalysisIdx).toBeGreaterThan(-1);
    expect(cardIdx).toBeGreaterThan(-1);
    expect(v2AnalysisIdx).toBeLessThan(cardIdx);
  });

  it("legacy AgentAnalysisSection mount is suppressed when V2 is on", () => {
    // The original mount sat AFTER the card. When V2 is on, the
    // earlier V2-only mount replaces it; the legacy mount must be
    // guarded by `!CASES_ROW_V2` so the section doesn't render twice.
    expect(PANEL).toMatch(/!CASES_ROW_V2\s*&&\s*analysis\s*&&[^<]*<AgentAnalysisSection/);
  });
});
