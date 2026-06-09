/**
 * Deliverable lock (Pattern A) — cockpit redesign wiring (cockpit-refactor).
 *
 * The cockpit is an OPT-IN presentational recomposition gated by
 * `cockpitEnabled()` (NEXT_PUBLIC_COCKPIT). These source-greps assert the
 * wiring is actually present (a behavioural test can't catch "the feature
 * was supposed to ship but wasn't built") AND that it stays flag-gated, so
 * the classic layout — and every lock/e2e pinning it — is untouched when
 * the flag is off. Removing any wiring below must fail the build.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const SRC = join(__dirname, "..", "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf-8");

describe("cockpit flag", () => {
  it("flags.ts exports an opt-in cockpitEnabled() (default off)", () => {
    const src = read("lib/flags.ts");
    expect(src).toContain("export function cockpitEnabled()");
    // Opt-in: returns true only on explicit NEXT_PUBLIC_COCKPIT === "1".
    expect(src).toMatch(/NEXT_PUBLIC_COCKPIT === "1"/);
  });
});

describe("confidence ring is flag-gated on the recommendation", () => {
  const panel = read("app/exceptions/ExceptionDetailPanel.tsx");
  it("passes the ring variant only when the cockpit flag is on", () => {
    expect(panel).toContain("cockpitEnabled");
    expect(panel).toMatch(/confidenceVariant=\{COCKPIT \? "ring" : "bar"\}/);
  });

  it("gives the situation a hero treatment only under the cockpit flag", () => {
    // Same governed situation_headline; the classic compact subhead is
    // preserved for flag-off, so no lock on the classic markup breaks.
    expect(panel).toMatch(/COCKPIT \? \(/);
    expect(panel).toContain("situation_headline");
    expect(panel).toContain("text-subhead font-semibold text-text-primary m-0");
  });
});

describe("AgentActivityRail tenant", () => {
  it("is a self-contained projector of the trace (Guardrail #6)", () => {
    const rail = read("app/cases/AgentActivityRail.tsx");
    expect(rail).toContain("exceptionsApi");
    expect(rail).toContain(".trace(");
    expect(rail).toContain("EventsTimeline");
    // Null-on-empty contract (no fabricated activity).
    expect(rail).toContain("if (!hasContent) return null;");
  });

  it("is mounted in the /cases rail strictly behind the cockpit flag", () => {
    const page = read("app/cases/page.tsx");
    expect(page).toContain("import { AgentActivityRail }");
    expect(page).toContain("const COCKPIT = cockpitEnabled();");
    // Gated render — the rail must not appear when the flag is off.
    expect(page).toMatch(/COCKPIT && \(\s*<AgentActivityRail/);
  });
});
