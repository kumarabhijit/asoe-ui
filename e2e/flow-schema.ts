/**
 * Flow YAML schema (W7 — amendment v1.2).
 *
 * The schema enforces the design + eng-review decisions locked in
 * docs/test-strategy/e2e-flow-plan.md (in the asoe2 repo):
 *
 *   D2  state matrix per flow with declarative fixtures
 *   D6  every interactive step must declare a keyboard equivalent
 *   D7  click modes = left-click + keyboard floor
 *   A8  per-flow opt-in via `states:`; opt-outs justified inline
 *   Q1  status-change announcements via the canonical StatusAnnouncer
 *   D4  prefer assert_url_equals; reserve assert_url_matches for
 *       genuine wildcards (server-generated UUIDs)
 *
 * The schema is the load-bearing contract for the runner: codegen
 * trusts the parsed shape, so anything not encoded here either
 * rots silently or has to be re-validated at codegen time. Keep
 * the schema strict.
 */
import { z } from "zod";

/** State keys a flow may opt into. See D2. */
export const STATE_KEYS = [
  "loading",
  "empty",
  "error",
  "partial_failure",
  "stale",
] as const;

export const stateKeySchema = z.enum(STATE_KEYS);

/** Journey archetype IDs from JOURNEYS.md. See D3.
 *  J4 (auth-edge operator) and J5 (auditor) added in v1.3.
 *  J6 (accessibility-first) reserved but not yet used by any flow. */
export const journeyIdSchema = z.enum(["J1", "J2", "J3", "J4", "J5"]);

/** Arc the flow exercises. See JOURNEYS.md "Arcs" section.
 *  - orientation: presence + reachability after navigation
 *  - task-completion: multi-step flow end-to-end
 *  trust (5y) is intentionally NOT a valid arc — it is a product
 *  KPI, observed via analytics, never asserted in a test. */
export const arcSchema = z.enum(["orientation", "task-completion"]);

const httpStatusSchema = z
  .number()
  .int()
  .min(100)
  .max(599);

/**
 * State fixture: how the flow should mock its dependencies for a
 * given state. Per A3 these are Playwright `page.route()` mocks —
 * `route` is the URL pattern, the rest are the response shape.
 */
export const stateFixtureSchema = z
  .object({
    route: z.string().min(1),
    delay_ms: z.number().int().min(0).optional(),
    status: httpStatusSchema.optional(),
    body: z.unknown().optional(),
    fixture: z.string().min(1).optional(),
    // Assertions exercised after the state mounts.
    assert_visible: z.string().min(1).optional(),
    assert_visible_count: z.string().min(1).optional(),
    assert_text_contains: z.array(z.string().min(1)).optional(),
  })
  .strict();

/** Keyboard equivalent for a mouse step. See D6. */
export const keyboardEquivalentSchema = z
  .object({
    key: z.string().min(1),
    focused_selector: z.string().min(1),
  })
  .strict();

/** Step `action` discriminator. */
export const actionSchema = z.enum([
  "click",
  "press",
  "fill",
  "navigate",
  // Browser back/forward — needed by V2's chrome-during-transition
  // assertions. No keyboard_equivalent required (Alt+ArrowLeft is
  // a UA-level shortcut, not a focus-receiving affordance).
  "back",
  "forward",
  "assert_visible",
  "assert_url_equals",
  "assert_url_matches",
  "assert_focus_on",
  "assert_announcement_text",
]);

/**
 * Every interactive step (click/press/fill) must declare a
 * keyboard_equivalent OR be a non-interactive assertion. The
 * refinement below enforces this — D6's "no a11y holes" rule.
 */
export const stepSchema = z
  .object({
    action: actionSchema,
    selector: z.string().min(1).optional(),
    key: z.string().min(1).optional(),
    value: z.string().optional(),
    url: z.string().min(1).optional(),
    pattern: z.string().min(1).optional(),
    text: z.string().optional(),
    keyboard_equivalent: keyboardEquivalentSchema.optional(),
  })
  .strict()
  .superRefine((step, ctx) => {
    // D6: click steps require a keyboard equivalent.
    if (step.action === "click" && !step.keyboard_equivalent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "click step must declare a keyboard_equivalent (D6 a11y floor)",
        path: ["keyboard_equivalent"],
      });
    }
    if (step.action === "click" && !step.selector) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "click step requires a selector",
        path: ["selector"],
      });
    }
    if (step.action === "press" && !step.key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "press step requires a key",
        path: ["key"],
      });
    }
    if (step.action === "fill") {
      if (!step.selector) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fill step requires a selector",
          path: ["selector"],
        });
      }
      if (step.value === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fill step requires a value",
          path: ["value"],
        });
      }
    }
    if (step.action === "assert_visible" && !step.selector) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "assert_visible step requires a selector",
        path: ["selector"],
      });
    }
    if (step.action === "assert_url_equals" && !step.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "assert_url_equals step requires a url",
        path: ["url"],
      });
    }
    if (step.action === "assert_url_matches" && !step.pattern) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "assert_url_matches step requires a pattern",
        path: ["pattern"],
      });
    }
    if (step.action === "assert_focus_on" && !step.selector) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "assert_focus_on step requires a selector",
        path: ["selector"],
      });
    }
    if (step.action === "assert_announcement_text" && step.text === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "assert_announcement_text step requires text",
        path: ["text"],
      });
    }
  });

const stateFixturesSchema = z.record(stateKeySchema, stateFixtureSchema);

export const flowKindSchema = z.enum(["golden", "regression"]);

/** A single flow YAML, post-parse. */
export const flowSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9-]*$/, {
        message:
          "flow name must be kebab-case (lowercase a-z, digits, hyphens)",
      }),
    kind: flowKindSchema,
    /** Journey archetype(s) the flow exercises. See D3.
     *  Required, not optional — every flow must claim at least
     *  one archetype so the journey-coverage meta-test can
     *  detect orphan flows. */
    journey: z.union([journeyIdSchema, z.array(journeyIdSchema).min(1)]),
    /** Arc the flow exercises. See JOURNEYS.md.
     *  Required: every flow asserts EITHER orientation (single-
     *  screen presence + reachability) OR task-completion
     *  (multi-step end-to-end). A flow that wants both should
     *  be split into two YAMLs. */
    arc: arcSchema,
    /** Path the flow starts on (must be absolute). */
    entry: z.string().regex(/^\//, { message: "entry must start with /" }),
    /**
     * Override the registry-level back-target rule for this flow.
     * Most flows omit this — the registry rule wins by default
     * (D1: most-specific-precedence is per-flow).
     */
    back_target_override: z.string().optional(),
    /**
     * State matrix opt-in. See D2 + A8. Empty array = flow opts
     * out of the matrix entirely; opt-out requires a justification
     * comment in the YAML, which the linter (not the schema)
     * enforces because comments are stripped by the YAML parser.
     */
    states: z.array(stateKeySchema).optional(),
    state_fixtures: stateFixturesSchema.optional(),
    steps: z.array(stepSchema).min(1),
  })
  .strict()
  .superRefine((flow, ctx) => {
    // Cross-field check: every state in `states` must have a
    // matching fixture entry. The runner needs the fixture to
    // generate the route mock; missing fixture = silent no-op
    // and a coverage hole.
    if (flow.states && flow.states.length > 0) {
      const fixtures = flow.state_fixtures ?? {};
      for (const state of flow.states) {
        if (!(state in fixtures)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `state "${state}" declared in states[] but missing from state_fixtures`,
            path: ["state_fixtures", state],
          });
        }
      }
    }
  });

export type StateKey = z.infer<typeof stateKeySchema>;
export type StateFixture = z.infer<typeof stateFixtureSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type JourneyId = z.infer<typeof journeyIdSchema>;
export type Arc = z.infer<typeof arcSchema>;

/** All archetypes the meta-test enforces coverage for.
 *  J6 is declared in JOURNEYS.md but deferred to V1.1 — excluded
 *  here so the meta-test doesn't fail until it is real. */
export const ENFORCED_JOURNEYS: readonly JourneyId[] = [
  "J1",
  "J2",
  "J3",
  "J4",
  "J5",
] as const;

/** Arcs the meta-test enforces coverage for. Trust (5y) is a
 *  product KPI, not a testable arc — see JOURNEYS.md. */
export const ENFORCED_ARCS: readonly Arc[] = [
  "orientation",
  "task-completion",
] as const;

/** Normalise the journey field to an array regardless of single vs list. */
export function journeysOf(flow: Flow): JourneyId[] {
  return Array.isArray(flow.journey) ? [...flow.journey] : [flow.journey];
}

/**
 * Parse a raw object (typically `YAML.parse(fs.readFileSync(path))`)
 * and return a typed Flow. Throws zod's ZodError on invalid input —
 * codegen surfaces the error path back at the YAML file.
 */
export function parseFlow(raw: unknown): Flow {
  return flowSchema.parse(raw);
}
