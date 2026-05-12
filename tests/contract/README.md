# tests/contract — Spec-as-Oracle Tests (asoe-ui)

Spec-anchored contract tests that fail when the UI's hand-written
types / fixtures drift from asoe2's machine-readable specifications.

Reference: `docs/test-strategy/design.md`,
`docs/test-strategy/eng-review-test-plan.md`.

## The pattern

Every test in this directory reads from one of these spec sources and
asserts that the implementation matches:

| Spec source                                            | Owner role        |
|--------------------------------------------------------|-------------------|
| `../asoe2/contracts/models.py` (TerminalStatus, lifecycle) | State machine     |
| `../asoe2/constraints/specs.py` (Literal vocabularies)  | Architecture      |
| `../asoe2/openapi/asoe2.openapi.json` (artifact)        | API contract      |

## Files

- `test_terminal_status_parity.test.ts` — `TerminalStatus` union in
  `src/types/exceptions.ts` matches asoe2's `TerminalStatus` enum,
  including `AUDIT_CONTEXT_MISSING`.
- `test_lifecycle_state_no_executing.test.ts` — no fixture, mock, or
  type union contains the retired `EXECUTING` state.
- `test_enum_parity.test.ts` — `MOCK_HEALTH.allowed_*` arrays plus
  the `ResolutionAction` and `LifecycleState` unions match the
  corresponding asoe2 Literals.
- `test_section_render_coverage.test.tsx` — every audit-bearing
  `*AnalysisData` interface has a section-component render path
  declared via the self-describing `RENDERS` export pattern.
- `test_audit_context_missing_render.test.tsx` — the
  `AUDIT_CONTEXT_MISSING` terminal status renders an explicit
  placeholder section in the detail panel (not a generic fallback).
- `test_navigation_chrome.test.ts` — every authenticated detail page
  routes sign-out through `useSignOut` (Q1) and the `?from=`
  referrer query map (R1–R3).
- `test_back_target_registry_coverage.test.ts` — Phase 5a meta-test:
  every `?from=<X>` producer's `X` exists in `BACK_TARGETS`; every
  `BACK_TARGETS` href resolves to an authenticated route; every
  `BACK_TARGETS` key has a matching `back_target_rules` entry in
  `e2e/flows/_registry.yaml`.
- `test_status_announcer_wiring.test.ts` — Phase 1 contract: every
  successful action handler emits via `useStatusAnnouncer().announce()`
  (Q1); `useSignOut` announces before navigation; no authenticated
  page imports `signOut` directly.

When asoe2 is not available as a sibling checkout (e.g., asoe-ui-only
CI clones), tests gracefully skip with a console warning rather than
fail. CI must clone both repos for the gates to bite.

---

## W7 — Flow registry (`e2e/flows/`)

YAML-declared user flows that codegen into Playwright `.spec.ts`
files. Anchored to the **JOURNEYS.md archetypes** (J1–J5) with two
testable arcs (`orientation`, `task-completion`).

| Surface                                | Owner test              |
|----------------------------------------|-------------------------|
| `e2e/flow-schema.ts`                   | `e2e/__tests__/flow-schema.test.ts` |
| `e2e/flow-codegen.ts`                  | `e2e/__tests__/flow-codegen.test.ts` (golden snapshot) |
| `e2e/journey-matrix.ts`                | `e2e/__tests__/journey-matrix.test.ts` (drift) |
| `e2e/flows-gen.ts`                     | `e2e/__tests__/flows-gen.test.ts` (drift) |
| `e2e/contract/authenticated-routes.ts` | `e2e/__tests__/meta-test-self-check.test.ts` |
| `e2e/flows/JOURNEYS.md` archetypes     | `e2e/__tests__/journey-coverage.test.ts` (ratchet) |
| `requiresAuth` page markers            | `e2e/__tests__/requires-auth-marker.test.ts` |

### Authoring a new flow

1. Pick a category directory under `e2e/flows/` (`onboard | triage |
   resolve | signout | recover`).
2. Author the YAML. The schema enforces:
   - `name` (kebab-case), `kind` (`golden|regression`)
   - `journey` (J1–J5 — required)
   - `arc` (`orientation|task-completion` — required; `trust`/5y is
     NOT a valid arc, see `JOURNEYS.md`)
   - `entry`, `steps`, optional `states` + `state_fixtures`
   - Every `click` step requires a `keyboard_equivalent` (D6 a11y floor)
3. Run `npm run flows:gen` to emit the `.spec.ts` into
   `e2e/flows-generated/`. Commit the diff alongside the YAML.
4. Run `npm run flows:matrix` to refresh the JOURNEYS.md matrix block.
   The pre-commit hook (`scripts/pre-commit.sh`) automates steps 3+4
   — install via `ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit`.

### CI gates

- `npm run flows:check` exits non-zero if `e2e/flows-generated/` is
  out of sync with `e2e/flows/`.
- `npm run flows:coverage` prints a journey × arc coverage matrix
  (✅ / ⏸ / ❌). `npm run flows:coverage:check` exits non-zero
  if any enforced cell is empty — wire this into a CI job once
  the J4 + J5 flows land.
- The journey-coverage meta-test reports a structured `(journey × arc)`
  gap list. `SOFT_GAP_THRESHOLD` is the ratchet ceiling; lower it as
  flows close cells.
- Empirically-covered cells live in `guaranteedCovered`; removing a
  flow that fills one fails CI.

### Test-driven development with the flow runner

The intended TDD cycle (Phase 8 of the BDD plan):

1. **Red** — author a new flow YAML for the feature you are about
   to build. Give it a clear `name`, the smallest plausible step
   list, and the matching `journey:` + `arc:` tags. Run
   `npm run flows:gen` and `npm run test:browser`. The new
   generated spec fails because the UI doesn't yet exist.
2. **Green** — implement the page / handler / surface until the
   spec passes locally. The Playwright HTML report's per-tag
   filter (`--grep "@flow-<name>"`) is the fastest signal during
   the iteration.
3. **Refactor** — clean up. The chrome-invariant + back-target
   meta-tests catch regressions on the surrounding surface, so
   the refactor only has to keep the new flow green.
4. **Lock** — when the flow lands, the journey-coverage ratchet
   pulls down by one and the coverage report's matrix gains a ✅.
   Removing the flow later fails the meta-test loud.

Every generated spec carries observability tags emitted by the
codegen (Item 14 of the plan):

- `@flow-<name>` — every flow tagged with its YAML name.
- `@arc-orientation` / `@arc-task-completion`.
- `@kind-golden` / `@kind-regression`.
- `@journey-J1` … `@journey-J5` — one tag per claimed archetype.

Filter Playwright by tag with `npx playwright test --grep
"@journey-J3"`. The HTML report's tag pills appear inline next to
each test name.
