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

/** Seed user roles available to the generated specs. Mirrors the
 *  USERS map in tests/browser/_helpers.ts; the codegen emits
 *  `loginAs(page, USERS[<role>])` before page.goto() when the
 *  flow's entry is not a public surface. Keep this enum in lockstep
 *  with the helper's USERS map.
 *
 *  Roles chosen per the seed permission grid:
 *    - ADMIN     — full permissions, all tabs visible
 *    - MANAGER   — exceptions:{override, approve, escalate}
 *    - MANAGER_2 — same as MANAGER, distinct sub (for SoD flows)
 *    - ANALYST   — exceptions:{approve, escalate} only
 */
export const authRoleSchema = z.enum([
  "ADMIN",
  "MANAGER",
  "MANAGER_2",
  "ANALYST",
]);

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
     * Seed user role the codegen authenticates as before the
     * happy-path page.goto. Required when the entry surface is
     * authenticated (i.e. not /login or /auth/*); omitted for
     * sign-in flows that drive the login form themselves.
     *
     * The codegen emits one line at the top of the happy-path
     * test body:
     *   await loginAs(page, USERS.<authAs>);
     *
     * Pick the LEAST-privileged role that can complete the flow.
     * Flows that exercise role-restricted affordances (override,
     * cosign) should specify MANAGER. Read-only flows can use
     * ANALYST.
     *
     * No default: ambiguity here turns into silent auth-skip
     * failures. The schema enforces that authenticated entries
     * declare a role via a superRefine() below.
     */
    authAs: authRoleSchema.optional(),
    /**
     * Mark the flow as skipped in CI. The codegen emits
     * `test.describe.fixme(...)` so Playwright reports the
     * skip with the citation but does not fail.
     *
     * Required uses:
     *   - A flow YAML lands BEFORE the selectors / login plumbing
     *     it depends on are validated end-to-end. The schema-side
     *     contract (parse + codegen + journey-coverage ratchet)
     *     still holds; only the browser-driven run is paused.
     *   - A regression flow lands ahead of the underlying UI
     *     refactor (the test is "ready"; the surface is not).
     *
     * Every skip MUST carry a `reason` so reviewers can challenge
     * the deferral and a follow-up commit can un-skip it.
     */
    skip: z
      .object({ reason: z.string().min(1) })
      .strict()
      .optional(),
    /**
     * State matrix opt-in. See D2 + A8.
     *
     * Empty array (or field omitted) = flow opts out of the matrix
     * entirely; no per-state justifications required. Use this for
     * flows whose contract is not state-matrix-shaped (e.g., a
     * pure navigation flow).
     *
     * Non-empty array = flow engages the matrix. For every
     * STANDARD state (loading | empty | error | partial_failure |
     * stale) NOT in this list, a structured justification MUST
     * appear in `state_opt_out_justifications`. A8 originally
     * required a justification comment; comments are stripped at
     * YAML parse time, so the schema couldn't enforce them. The
     * structured field closes that gap.
     */
    states: z.array(stateKeySchema).optional(),
    /**
     * A8 opt-out justifications. Maps each state key the flow
     * does NOT opt into to a free-text justification. Reviewers
     * can challenge weak justifications in PR review; a missing
     * entry fails the schema loudly.
     *
     * Format:
     *   state_opt_out_justifications:
     *     error: >-
     *       /cases has no inline error UI branch; the App Router
     *       error boundary owns hard errors via CMT-3 coverage.
     *     partial_failure: >-
     *       Single-GET surface — no per-row failure mode.
     */
    state_opt_out_justifications: z
      .record(stateKeySchema, z.string().min(1))
      .optional(),
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

      // A8 — every standard state NOT in `states` must carry a
      // justification. Flows that engage the matrix at all opt
      // into structured opt-outs. Flows that omit `states`
      // entirely (or set [] empty) opt out of the matrix
      // concept and need no justifications.
      const optedIn = new Set(flow.states);
      const justifications = flow.state_opt_out_justifications ?? {};
      for (const state of STATE_KEYS) {
        if (optedIn.has(state)) {
          // Justifications for OPTED-IN states are spurious —
          // the state is engaged, not opted out.
          if (state in justifications) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `state "${state}" is in states[] but also has a state_opt_out_justifications entry — pick one`,
              path: ["state_opt_out_justifications", state],
            });
          }
          continue;
        }
        if (!(state in justifications)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `state "${state}" opted out of states[] requires a state_opt_out_justifications.${state} entry (A8)`,
            path: ["state_opt_out_justifications", state],
          });
        }
      }
    }

    // Authenticated entries must declare an authAs role. Public
    // entries (/login or /auth/*) must NOT, since the codegen
    // would otherwise emit a redundant loginAs() against a route
    // that doesn't require it.
    const isPublicEntry =
      flow.entry === "/login"
      || flow.entry === "/auth"
      || flow.entry.startsWith("/auth/")
      || flow.entry.startsWith("/login?")
      || flow.entry.startsWith("/login#");

    if (!isPublicEntry && flow.authAs === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "authenticated entry requires an authAs role — the codegen needs to know which seed user to loginAs() before page.goto()",
        path: ["authAs"],
      });
    }
    if (isPublicEntry && flow.authAs !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "public entry must not declare authAs — the codegen does not emit loginAs() for public routes (sign-in flows drive the form themselves)",
        path: ["authAs"],
      });
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
