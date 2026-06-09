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
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");
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

describe("cockpit flag-on browser e2e deliverable (Phase 4)", () => {
  it("ships a dedicated flag-on config, spec, npm script, and CI workflow", () => {
    // A flag-on journey needs its OWN server (the shared mock server can't
    // flip the flag without breaking classic specs), so the deliverable is
    // the whole quartet. Removing any piece must fail.
    expect(existsSync(join(ROOT, "playwright.cockpit.config.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "tests/browser-cockpit/cockpit-cases.spec.ts"))).toBe(true);
    expect(existsSync(join(ROOT, ".github/workflows/browser-e2e-cockpit.yml"))).toBe(true);
    expect(readFileSync(join(ROOT, "package.json"), "utf-8")).toContain("test:browser:cockpit");
  });

  it("the dedicated server actually turns the flag ON (else it tests classic)", () => {
    const cfg = readFileSync(join(ROOT, "playwright.cockpit.config.ts"), "utf-8");
    expect(cfg).toContain('NEXT_PUBLIC_COCKPIT: "1"');
    // Distinct port from mock mode (3101) so the servers can coexist.
    expect(cfg).toContain("--port 3102");
  });
});

describe("cockpit parity — it ADDS, it never hides (Guardrail #7)", () => {
  const panel = read("app/exceptions/ExceptionDetailPanel.tsx");

  it("has no cockpit-exclusive gate that hides a classic surface", () => {
    // The cockpit is additive: it swaps the confidence renderer (ring vs
    // bar), elevates the situation, and adds the rail at the page level.
    // It must never wrap a classic surface in a `!COCKPIT &&` gate — that
    // would hide something the classic layout shows (a Guardrail #7
    // partial-truth regression).
    expect(panel).not.toContain("!COCKPIT");
  });

  it("keeps every classic detail surface mounted regardless of the flag", () => {
    // These render on the single (flag-independent) path, so the operator
    // sees the same evidence whether the cockpit is on or off.
    for (const mount of [
      "<HeaderRibbon",
      "<ImpactBar",
      "<ContextStrip",
      "<AgentReasoningCard",
      "<EvidenceGrid",
      "<DiagnosticsSection",
    ]) {
      expect(panel.includes(mount), `${mount} must stay mounted under the cockpit`).toBe(true);
    }
  });
});
