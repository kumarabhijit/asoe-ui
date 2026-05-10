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
    const result = flowSchema.safeParse({
      ...baseValid,
      steps: [
        // @ts-expect-error — action is intentionally invalid
        { action: "double_click", selector: ".x" },
      ],
    });
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
});
