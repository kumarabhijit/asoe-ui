# Customer Inbox Port — Frontend TDD/BDD Strategy (companion)

**Authority:** `asoe2/docs/test-strategy/customer-inbox-tdd-strategy.md`
(converged 2026-05-24 expert panel). This is the asoe-ui-specific half.
**Mode:** AUTONOMOUS, STRICT TDD/BDD — tests written first.

Builds on `docs/test-strategy/README.md` and the `CLAUDE.md` test gates.

## Layers (existing, no new framework)

| Layer | Home | Contents |
|---|---|---|
| Unit | `tests/components/`, `tests/hooks/` | section data-presence (Present / Structurally-omitted / Context-not-required), `useOrderExtraction` 4-state machine |
| Contract | `tests/architectural/openapi_drift.test.ts`, `type_contracts.test.ts` | OpenAPI→`generated.ts` parity incl. per-type autonomy union |
| Tripwire | `tests/architectural/` (grep) | locks — **tripwires only**, not one per section |
| Journey (BDD) | `tests/browser/operator-journeys/` | Given/When/Then operator flows (Playwright) |
| a11y | `tests/accessibility/component_sweep.test.tsx` | new top-level components |

## Test-first rules specific to asoe-ui

1. **Contract first.** Before any section: extend `openapi_drift.test.ts` to
   fail on the L3-vs-L4 drift. **Per-type unions** — `EdiMismatchAnalysisData`
   stays `L1|L2|L3`; `EmailOrderEntryAnalysisData` is `L1|L2|L3|L4`. Do NOT
   blanket-widen `exceptions.ts`; that would mask a real backend distinction.
   Use the `extractLiteralValues` parity pattern (OpenAPI emits Literals as
   bare `string[]`), not a regen diff alone.
2. **Autonomy ordering from health.** No `Ln` string-parsing for ordering.
   `autonomyLevelLabel(level, health)` is a lookup into
   `health.allowed_autonomy_levels` sorted by `rank`; `AUTONOMY_LEVEL_DESCRIPTIONS`
   shrinks to a transition fallback. Add a Guardrail-#1 lock asserting no
   ordering literal. When health is absent the surface **blocks** (mirror
   `pickQuickActionReasonTag` returning `null`).
3. **Dumb projectors.** Each section renders `analysis.*` via `<EvidenceBlock>`;
   a data-presence vitest is written **before** the JSX. No `?? "—"`.
4. **Writes via disposition.** No bespoke `/cases` write-verb clients; reuse
   `useExceptionActions` (disposition + cosign) and the `refreshCaseDetail` /
   `isCaseInvalidationEvent` seam. `useOrderExtraction` owns *extraction view
   state* only — not a second source of truth for the disposition write.
5. **Deliverable-completeness locks** (Pattern A grep + Pattern B render) per
   new lazy section, verified by deleting the section locally.

## BDD journey (write first)

`tests/browser/operator-journeys/email-entry-order-intake.spec.ts` — the
EMAIL_ENTRY happy path (see authority doc §5). Model on
`tests/browser/cases-workspace-case-switch.spec.ts`; assert against re-fetched
backend state, never `activeElement`/UI-derived truth.

## Phase-0 frontend backlog (RED first)

1. `tests/architectural/type_contracts.test.ts` — per-type autonomy union parity
   (fails today: `exceptions.ts` pins both to L1–L3).
2. `tests/architectural/openapi_drift.test.ts` — extend for the new section
   types + WS event types.
3. `tests/architectural/autonomy_ordering_lock.test.ts` — no `Ln` parse; label
   comes from health.
4. `tests/components/email-entry/*_data_presence.test.tsx` — one per section,
   before JSX.
5. `tests/browser/operator-journeys/email-entry-order-intake.spec.ts` — red
   journey spec.
6. `e2e/.../email-render-xss.spec.ts` — untrusted email field renders escaped;
   CSP blocks inline (security gate 10).

## CI gates

PR-green: `tsc --noEmit`, `vitest run` (incl. the locks above), `npm run build`,
Playwright journeys + deliverable-completeness, axe sweep, `verify-types`.
`verify-types` is the load-bearing seam; `verify:reason-tags` only if reason-tag
vocab changes. Nightly: visual-regression baselines + full browser suite.
