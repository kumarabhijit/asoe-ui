/**
 * Deliverable lock (Pattern A) — cockpit redesign wiring (cockpit-refactor).
 *
 * The cockpit is an OPT-IN presentational recomposition selected in-UI
 * via the Legacy/Modern view toggle (`useViewMode`). `cockpitEnabled()`
 * (NEXT_PUBLIC_COCKPIT) survives only as the *default seed* inside the
 * provider — Legacy is the default, so the classic layout and every
 * lock/e2e pinning it is untouched until an operator opts into Modern.
 * These source-greps assert the wiring is actually present (a
 * behavioural test can't catch "the feature was supposed to ship but
 * wasn't built") AND that the mode is read reactively, never inlined as
 * a module const again. Removing any wiring below must fail the build.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf-8");

describe("cockpit flag (env default seed)", () => {
  it("flags.ts exports an opt-in cockpitEnabled() (default off)", () => {
    const src = read("lib/flags.ts");
    expect(src).toContain("export function cockpitEnabled()");
    // Opt-in: returns true only on explicit NEXT_PUBLIC_COCKPIT === "1".
    expect(src).toMatch(/NEXT_PUBLIC_COCKPIT === "1"/);
  });
});

describe("in-UI Legacy/Modern view toggle", () => {
  it("useViewMode seeds from the env flag but defaults to Legacy and persists", () => {
    const hook = read("hooks/useViewMode.tsx");
    expect(hook).toContain("export function ViewModeProvider");
    expect(hook).toContain("export function useViewMode()");
    // Env is the default *seed* only; absent it, Legacy wins.
    expect(hook).toContain("cockpitEnabled");
    expect(hook).toMatch(/cockpitEnabled\(\) \? "modern" : "legacy"/);
    // Per-user choice persists in localStorage (survives reloads).
    expect(hook).toContain("localStorage");
    // Hydration-safe: render the env default until mounted.
    expect(hook).toContain("mounted");
  });

  it("ViewModeToggle is a NavBar control wired to useViewMode", () => {
    const toggle = read("components/ui/ViewModeToggle.tsx");
    expect(toggle).toContain("useViewMode");
    expect(toggle).toContain("setMode");
    // Two explicit, governed options (icon + label, a11y radio).
    expect(toggle).toContain('"legacy"');
    expect(toggle).toContain('"modern"');
    expect(toggle).toContain('role="menuitemradio"');

    const nav = read("components/ui/NavBar.tsx");
    expect(nav).toContain("import { ViewModeToggle }");
    expect(nav).toContain("<ViewModeToggle />");
  });

  it("the provider wraps the app so the toggle and pages share one context", () => {
    const providers = read("app/providers.tsx");
    expect(providers).toContain("ViewModeProvider");
    expect(providers).toMatch(/<ViewModeProvider>[\s\S]*<\/ViewModeProvider>/);
  });
});

describe("confidence ring is gated on the recommendation by view mode", () => {
  const panel = read("app/exceptions/ExceptionDetailPanel.tsx");
  it("passes the ring variant only in the Modern view, read reactively", () => {
    // The mode is selected in-UI and read via the hook so flipping the
    // toggle re-renders the ring with no reload. The old module-const
    // `cockpitEnabled()` read must be gone from the panel.
    expect(panel).toContain("useViewMode");
    expect(panel).toMatch(/const COCKPIT = useViewMode\(\)\.mode === "modern";/);
    expect(panel).not.toContain("cockpitEnabled");
    expect(panel).toMatch(/confidenceVariant=\{COCKPIT \? "ring" : "bar"\}/);
  });

  it("gives the situation a hero treatment only in the Modern view", () => {
    // Same governed situation_headline; the classic compact subhead is
    // preserved for Legacy, so no lock on the classic markup breaks.
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

  it("is mounted in the /cases rail strictly in the Modern view", () => {
    const page = read("app/cases/page.tsx");
    expect(page).toContain("import { AgentActivityRail }");
    expect(page).toContain('const COCKPIT = useViewMode().mode === "modern";');
    expect(page).not.toContain("cockpitEnabled");
    // Gated render — the rail must not appear in the Legacy view.
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

describe("cockpit Evidence/Diagnostics restructuring (council 2026-06-10)", () => {
  const panel = read("app/exceptions/ExceptionDetailPanel.tsx");

  it("ProvenanceCard is a dumb projector of presentation.audit", () => {
    const card = read("components/ui/ProvenanceCard.tsx");
    // Renders the backend-authoritative bundle as given — no compose, no
    // fetch, no fallback chains (Guardrail #6).
    expect(card).toContain("PresentationAudit");
    expect(card).toContain("EvidenceBlock");
    expect(card).toContain("audit.correlation_id");
    expect(card).toContain("audit.event_type");
    // Null bundle → renders nothing.
    expect(card).toContain("if (!audit) return null");
    // No partial-truth placeholders.
    expect(card).not.toContain('"—"');
    expect(card).not.toContain('"N/A"');
  });

  it("mounts the Provenance card in the Diagnostics drawer, Modern only", () => {
    expect(panel).toContain("import { ProvenanceCard }");
    // Fed analysis.presentation.audit (no UI compose).
    expect(panel).toMatch(/<ProvenanceCard audit=\{analysis\?\.presentation\?\.audit\} \/>/);
  });

  it("keeps Knowledge Graph its own section and demotes raw internals to 'Audit only'", () => {
    // KG kept as its own node (operator adjustment 2026-06-10) — not folded
    // into the Audit-only group.
    expect(panel).toContain("knowledgeGraphNode");
    // Audit-only sub-group gathers the rawest internals (declutter, #7).
    expect(panel).toContain('title="Audit only"');
    expect(panel).toContain("otherAuditSections");
  });

  it("surfaces the draft-reply L1 cue (not a duplicate) jumping to the draft", () => {
    // A single status line in L1, gated on a real drafted reply, linking to
    // the draft that lives LAST in Evidence (review-before-send).
    expect(panel).toMatch(/COCKPIT && analysis\?\.draft_reply/);
    expect(panel).toContain('href="#section-draft-reply"');
  });

  it("applies the Modern card variant to nested tier sections (visual only)", () => {
    // The cockpit lifts nested children onto cards via the additive
    // CollapsibleSection `variant` — placement unchanged.
    expect(panel).toMatch(/variant: "card"/);
    const shared = read("app/exceptions/shared.tsx");
    expect(shared).toContain('variant?: "default" | "card"');
  });

  it("mirrors the backend PresentationAudit provenance fields (Guardrail #3)", () => {
    const types = read("types/exceptions.ts");
    for (const field of [
      "event_type",
      "shadow_verdict",
      "supergroup_code",
      "taxonomy_version",
      "correlation_id",
    ]) {
      expect(types.includes(field), `PresentationAudit must mirror ${field}`).toBe(true);
    }
  });

  it("the mock presentation composer mirrors the new provenance fields", () => {
    // Mock-data layer must not drift from the backend bundle shape.
    const api = read("lib/api.ts");
    expect(api).toMatch(/event_type: exc\?\.event_type/);
    expect(api).toMatch(/shadow_verdict: exc\?\.shadow_verdict/);
    expect(api).toContain("supergroup_code: exc?.supergroup_code");
    expect(api).toContain("taxonomy_version");
  });
});
