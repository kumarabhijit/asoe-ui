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
    // The mount may include an intermediate wrapper div (chrome
    // around the ribbon when it lives outside the scroll container);
    // assert the gate-then-ribbon proximity within ~400 chars.
    expect(PANEL).toMatch(/CASES_ROW_V2[\s\S]{0,400}?<StickyActionRibbon/);
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

  it("StickyActionRibbon mounts ABOVE the inner scroll container", () => {
    // The first iteration mounted the ribbon INSIDE the
    // `<div className="flex-1 overflow-auto p-16">` scroll
    // container. That broke pinning relative to the inner scroll
    // (the ribbon's sticky reference was the same surface the
    // user's scroll happened against, so it scrolled away with
    // its content). The ribbon now mounts as a SIBLING of (and
    // ABOVE) the inner scroll container.
    const ribbonIdx = PANEL.indexOf("<StickyActionRibbon");
    const scrollContainerIdx = PANEL.indexOf("flex-1 overflow-auto");
    expect(ribbonIdx).toBeGreaterThan(-1);
    expect(scrollContainerIdx).toBeGreaterThan(-1);
    expect(
      ribbonIdx,
      "StickyActionRibbon must mount BEFORE the inner " +
        "`<div className=\"flex-1 overflow-auto p-16\">` scroll " +
        "container in file order — otherwise the ribbon scrolls " +
        "away with its content (see commit history).",
    ).toBeLessThan(scrollContainerIdx);
  });

  it("ribbon wrapper applies position: sticky against the right-pane scroll", () => {
    // The lift-out-of-inner-scroll fix (commit c8d226d) only
    // addressed scroll surface (B) — the inner ExceptionDetailPanel
    // overflow-auto. Scroll surface (A) — the outer right-pane
    // `<section aria-label="Case workspace" lg:overflow-y-auto>` —
    // was still pulling the ribbon away when the operator scrolled
    // past the slim header / classification / records picker. The
    // wrapper must carry `position: sticky` so the ribbon pins to
    // the right-pane viewport at lg+ and to the document viewport
    // (offset by --nav-height) below lg.
    //
    // The user reported this twice; protect it with a lock so the
    // sticky wiring can't regress.
    const wrapperMatch = PANEL.match(
      /<div\s+className=\{[\s\S]{0,400}?\}\s*>\s*<StickyActionRibbon/,
    );
    expect(
      wrapperMatch,
      "Could not find the wrapper <div> around <StickyActionRibbon>",
    ).not.toBeNull();
    const wrapperClassName = wrapperMatch?.[0] ?? "";
    expect(
      wrapperClassName,
      "Ribbon wrapper must include `sticky` class (CSS " +
        "`position: sticky`) so it pins to the nearest scrolling " +
        "ancestor — without it the ribbon scrolls away with the " +
        "right-pane outer scroll surface.",
    ).toMatch(/\bsticky\b/);
    expect(
      wrapperClassName,
      "Ribbon wrapper must include a `top-` offset class — below " +
        "lg the NavBar is also sticky `top: 0` so the ribbon needs " +
        "to anchor below it (e.g. `top-[var(--nav-height)]`).",
    ).toMatch(/\btop-(?:0|\[)/);
    expect(
      wrapperClassName,
      "Ribbon wrapper must include a `z-` class above the scroll " +
        "content so the cards underneath don't bleed through.",
    ).toMatch(/\bz-\d+\b/);
  });
});
