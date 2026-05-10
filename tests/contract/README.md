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

When asoe2 is not available as a sibling checkout (e.g., asoe-ui-only
CI clones), tests gracefully skip with a console warning rather than
fail. CI must clone both repos for the gates to bite.
