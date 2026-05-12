/**
 * T1 — schema unit tests for the flow YAML contract.
 *
 * Locks the contract against silent regressions where a future
 * relaxation would let the runner accept malformed flows that
 * silently degrade coverage (e.g. a click step without a
 * keyboard_equivalent).
 */
import { describe, expect, it } from "vitest";
import { flowSchema, parseFlow } from "../flow-schema";

const baseValid = {
  name: "inbox-load",
  kind: "golden" as const,
  journey: ["J1", "J2"] as const,
  arc: "orientation" as const,
  // Authenticated entry: schema requires authAs so the codegen
  // knows which seed user to loginAs() before page.goto.
  authAs: "MANAGER" as const,
  entry: "/inbox",
  steps: [
    {
      action: "assert_visible" as const,
      selector: '[data-testid="inbox-row"]',
    },
  ],
};

describe("flow-schema — valid inputs", () => {
  it("accepts a minimal golden flow with no state matrix", () => {
    expect(() => parseFlow(baseValid)).not.toThrow();
  });

  it("accepts a regression flow with a single journey", () => {
    expect(() =>
      parseFlow({
        ...baseValid,
        name: "email-order-entry-from-inbox",
        kind: "regression",
        journey: "J1",
      }),
    ).not.toThrow();
  });

  it("accepts a flow with a click step that declares a keyboard equivalent", () => {
    expect(() =>
      parseFlow({
        ...baseValid,
        steps: [
          {
            action: "click",
            selector: '[data-testid="inbox-row-3"]',
            keyboard_equivalent: {
              key: "Enter",
              focused_selector: '[data-testid="inbox-row-3"]',
            },
          },
          {
            action: "assert_focus_on",
            selector: '[data-testid="exception-detail-heading"]',
          },
        ],
      }),
    ).not.toThrow();
  });

  it("accepts a flow with full state matrix + matching fixtures", () => {
    expect(() =>
      parseFlow({
        ...baseValid,
        states: ["loading", "empty", "error", "partial_failure", "stale"],
        state_fixtures: {
          loading: { route: "/api/v1/exceptions", delay_ms: 2000 },
          empty: { route: "/api/v1/exceptions", body: [] },
          error: { route: "/api/v1/exceptions", status: 500 },
          partial_failure: {
            route: "/api/v1/exceptions",
            fixture: "inbox_partial_failure",
          },
          stale: {
            route: "/api/v1/exceptions",
            fixture: "case_status_changed_mid_view",
          },
        },
      }),
    ).not.toThrow();
  });

  it("accepts an aria-live announcement assertion", () => {
    expect(() =>
      parseFlow({
        ...baseValid,
        steps: [
          {
            action: "assert_announcement_text",
            text: "Exception resolved",
          },
        ],
      }),
    ).not.toThrow();
  });
});

describe("flow-schema — invalid inputs", () => {
  it("rejects a click step that omits keyboard_equivalent (D6 a11y floor)", () => {
    const result = flowSchema.safeParse({
      ...baseValid,
      steps: [
        {
          action: "click",
          selector: '[data-testid="inbox-row-3"]',
          // no keyboard_equivalent
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" | ");
      expect(messages).toMatch(/keyboard_equivalent/);
    }
  });

  it("rejects a flow whose states[] declare a key without a matching fixture", () => {
    const result = flowSchema.safeParse({
      ...baseValid,
      states: ["error"],
      state_fixtures: {
        // declared but for the wrong state -> error fixture missing
        loading: { route: "/api/v1/exceptions", delay_ms: 2000 },
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" | ");
      expect(messages).toMatch(/state_fixtures/);
      expect(messages).toMatch(/error/);
    }
  });

  it("rejects an unknown state key", () => {
    const result = flowSchema.safeParse({
      ...baseValid,
      states: ["loading", "wat" as unknown as "loading"],
      state_fixtures: {
        loading: { route: "/api/v1/exceptions", delay_ms: 2000 },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-kebab-case flow name", () => {
    const result = flowSchema.safeParse({
      ...baseValid,
      name: "InboxLoad", // PascalCase
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" | ");
      expect(messages).toMatch(/kebab-case/);
    }
  });

  it("rejects an entry path that is not absolute", () => {
    const result = flowSchema.safeParse({
      ...baseValid,
      entry: "inbox", // missing leading slash
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" | ");
      expect(messages).toMatch(/start with \//);
    }
  });

  it("rejects unknown action values (no escape hatch into free-form Playwright)", () => {
    // safeParse takes `unknown`; the cast lets us pass an
    // intentionally invalid `action` without a ts-expect-error
    // that the typechecker rejects when zod's input type widens.
    const result = flowSchema.safeParse({
      ...baseValid,
      steps: [{ action: "double_click", selector: ".x" }],
    } as unknown);
    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level keys (strict schema)", () => {
    const result = flowSchema.safeParse({
      ...baseValid,
      // typo: "step" instead of "steps"
      step: baseValid.steps,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a fill step missing its value", () => {
    const result = flowSchema.safeParse({
      ...baseValid,
      steps: [
        {
          action: "fill",
          selector: '[data-testid="email-input"]',
          // value omitted
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" | ");
      expect(messages).toMatch(/value/);
    }
  });

  it("rejects an empty steps[] array", () => {
    const result = flowSchema.safeParse({ ...baseValid, steps: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a flow missing required fields", () => {
    const result = flowSchema.safeParse({ name: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects a flow without a journey field (every flow claims an archetype)", () => {
    const { journey: _drop, ...withoutJourney } = baseValid;
    const result = flowSchema.safeParse(withoutJourney);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("journey");
    }
  });

  it("rejects a flow without an arc field", () => {
    const { arc: _drop, ...withoutArc } = baseValid;
    const result = flowSchema.safeParse(withoutArc);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("arc");
    }
  });

  it("rejects an unknown arc value (trust/5y is not a test assertion)", () => {
    const result = flowSchema.safeParse({
      ...baseValid,
      arc: "trust" as unknown,
    });
    expect(result.success).toBe(false);
  });

  it("accepts the new auth-edge (J4) and auditor (J5) archetypes", () => {
    expect(() =>
      parseFlow({ ...baseValid, journey: "J4" }),
    ).not.toThrow();
    expect(() =>
      parseFlow({ ...baseValid, journey: ["J3", "J5"] }),
    ).not.toThrow();
  });

  it("rejects an authenticated entry without authAs", () => {
    const { authAs: _drop, ...withoutAuth } = baseValid;
    const result = flowSchema.safeParse(withoutAuth);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message).join(" | ");
      expect(msgs).toMatch(/authAs/);
    }
  });

  it("accepts a public /login entry without authAs", () => {
    const { authAs: _drop, ...rest } = baseValid;
    expect(() =>
      parseFlow({ ...rest, entry: "/login" }),
    ).not.toThrow();
  });

  it("accepts a public /auth/callback entry without authAs", () => {
    const { authAs: _drop, ...rest } = baseValid;
    expect(() =>
      parseFlow({ ...rest, entry: "/auth/callback" }),
    ).not.toThrow();
  });

  it("rejects a public entry that DOES declare authAs", () => {
    const result = flowSchema.safeParse({
      ...baseValid,
      entry: "/login",
      authAs: "MANAGER",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message).join(" | ");
      expect(msgs).toMatch(/public entry must not declare authAs/);
    }
  });

  it("rejects an unknown authAs role (no ad-hoc role names)", () => {
    const result = flowSchema.safeParse({
      ...baseValid,
      authAs: "SUPERUSER" as unknown,
    });
    expect(result.success).toBe(false);
  });

  // ────────────────────────────────────────────────────────────
  // A8 — opt-out justification structured enforcement.
  // ────────────────────────────────────────────────────────────

  it("rejects a flow with states[] missing opt-out justifications (A8)", () => {
    const result = flowSchema.safeParse({
      ...baseValid,
      states: ["loading"],
      state_fixtures: {
        loading: { route: "/api/v1/cases", delay_ms: 1000 },
      },
      // No state_opt_out_justifications -> empty, error,
      // partial_failure, stale all unjustified.
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message).join(" | ");
      expect(msgs).toMatch(/state_opt_out_justifications/);
      expect(msgs).toMatch(/A8/);
    }
  });

  it("accepts a flow with full opt-out justifications (A8)", () => {
    expect(() =>
      parseFlow({
        ...baseValid,
        states: ["loading"],
        state_fixtures: {
          loading: { route: "/api/v1/cases", delay_ms: 1000 },
        },
        state_opt_out_justifications: {
          empty: "covered elsewhere",
          error: "no inline error UI",
          partial_failure: "single GET",
          stale: "no live channel",
        },
      }),
    ).not.toThrow();
  });

  it("rejects a justification for a state that's IN states[] (A8)", () => {
    const result = flowSchema.safeParse({
      ...baseValid,
      states: ["loading", "empty"],
      state_fixtures: {
        loading: { route: "/api/v1/cases", delay_ms: 1000 },
        empty: { route: "/api/v1/cases", body: [] },
      },
      state_opt_out_justifications: {
        // loading is OPTED IN — a justification here is spurious
        loading: "spurious",
        error: "no inline error UI",
        partial_failure: "single GET",
        stale: "no live channel",
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message).join(" | ");
      expect(msgs).toMatch(/loading.*also has/);
    }
  });

  it("accepts a flow without states[] and without justifications (matrix opt-out)", () => {
    const { ...rest } = baseValid;
    expect(() => parseFlow(rest)).not.toThrow();
  });

  it("rejects an empty-string justification (no placeholder waivers)", () => {
    const result = flowSchema.safeParse({
      ...baseValid,
      states: ["loading"],
      state_fixtures: {
        loading: { route: "/api/v1/cases", delay_ms: 1000 },
      },
      state_opt_out_justifications: {
        empty: "",
        error: "x",
        partial_failure: "x",
        stale: "x",
      },
    });
    expect(result.success).toBe(false);
  });
});
