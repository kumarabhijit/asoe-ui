# Pre-Code Session — asoe-ui

```text
You are about to make a code change to the asoe-ui codebase. Before writing or
modifying any file, complete the mandatory pre-flight reads, the orientation
block, and the scope-specific reads below. This prompt applies to all code
changes — new pages, components, bug fixes, refactors, type updates, and
test additions.

---

## MANDATORY PRE-FLIGHT READS

Read these documents in full before touching any source file. These are not
optional. Do not skim. Do not skip because "the task looks small".

1. CLAUDE.md             — 5 core guardrails, engineering rules, definition of done
2. ui_architecture.md    — authoritative UI architecture (pages, components, layout, state)
3. DESIGN.md             — module map, component contracts, file-level conventions
4. consol_arch.md        — consolidated architecture (cross-stack contracts the UI must honour)
5. tasks.md              — phase checklist, current status, open items

Then read every file you intend to modify so you understand its current
state, conventions, and test coverage.

---

## ORIENTATION & PLANNING (MANDATORY OUTPUT)

Before writing or modifying any code, you MUST output a <pre_flight_analysis>
block. This block makes your assumptions visible so the user can catch errors
before code is written.

In the block, briefly and explicitly answer:

1. **Surface identification:** Which UI surface(s) does this change touch?
   - src/app/             — Next.js routes, pages, layouts
   - src/components/      — reusable presentational + composite components
   - src/components/ui/   — design-system primitives (shadcn-style)
   - src/lib/             — client-side helpers (api client, roles, utils)
   - src/hooks/           — React hooks (data fetching, websocket, RBAC)
   - src/types/           — TypeScript contracts mirroring backend
   - src/store/           — client state (if applicable)
   - tests/               — vitest suite
   - skills/              — design-system SKILL.md and references

2. **Boundary crossing:** Does this change cross a layer boundary
   (e.g., page ↔ component, component ↔ hook, hook ↔ api client,
   types ↔ backend contracts)? If yes, list every file on both sides
   that needs coordinated updates.

3. **Backend contract alignment:** Does this touch a type, API call, or
   websocket event? If yes, acknowledge the corresponding asoe2 source
   of truth and confirm alignment:
   - asoe2/contracts/models.py   ↔ src/types/exceptions.ts
   - asoe2/api/schemas.py        ↔ src/types/api.ts
   - asoe2/api/events.py         ↔ src/types/websocket.ts
   - asoe2/api/deps.py           ↔ src/lib/roles.ts, src/types/auth.ts

4. **Checklist confirmation:** Explicitly state:
   "I confirm all Change Planning Checklist items are met."

   The checklist items are:
   - [ ] I have identified the exact files I will modify.
   - [ ] I have read each of those files in their current state.
   - [ ] I know which tests cover the code I am changing.
   - [ ] My change does not hardcode enum values in .tsx (Guardrail #2).
   - [ ] My change does not hardcode hex colours, px sizes, or raw spacing
         (design tokens only).
   - [ ] My change keeps src/types/* in lockstep with backend contracts.
   - [ ] My change preserves keyboard accessibility and screen-reader
         semantics for any interactive element it touches.
   - [ ] Status indicators use icon + text (no colour-only signalling).
   - [ ] Layer 1 / Layer 2 pattern is respected where applicable.
   - [ ] My change does not add speculative features beyond the stated task.
   - [ ] If I am updating docs, I am following prompts/update_docs.md.

Only after completing the <pre_flight_analysis> block may you proceed with
code changes.

---

## SCOPE-SPECIFIC READS

In addition to the mandatory reads above, read these when the change
touches the relevant area:

- Building a page, component, or layout
  → ui_architecture.md (re-read the relevant section in depth)
  → skills/asoe-ui-design/SKILL.md
  → skills/asoe-ui-design/references/component-patterns.md
  → skills/asoe-ui-design/references/layout-templates.md

- Adding or modifying API calls
  → consol_arch.md Section 6
  → asoe2/api/schemas.py (current backend contract)

- Touching WebSocket integration
  → consol_arch.md Section 8
  → asoe2/api/events.py (current event contracts)

- Touching auth, RBAC, or security
  → consol_arch.md Section 9
  → asoe2/api/deps.py (current role + permission model)

---

## ARCHITECTURAL INVARIANTS — DO NOT VIOLATE

These come from CLAUDE.md and are enforced by review and tests. Any change
that breaks them is wrong.

1.  No hardcoded enum string literals in .tsx — import from src/types/.
2.  No hardcoded hex, px, or raw spacing values — use design tokens.
3.  src/types/* mirrors backend contracts exactly. No drift.
4.  No `any`. No silent type widening to make TypeScript stop complaining.
5.  Status communicated by icon + text, never colour alone.
6.  Interactive elements are keyboard accessible and have an accessible name.
7.  Components do not fetch directly — data flows through hooks / api client.
8.  Page-level layouts follow the Layer 1 / Layer 2 pattern documented in
    ui_architecture.md.

If your change would require violating any invariant, HALT and request
architectural clarification.

---

## IMPLEMENTATION RULES

### Scope
- Make the smallest viable increment. One concern per change.
- Do not refactor, rename, or "improve" code outside the scope of the task.
- Do not add comments, JSDoc, or type annotations to unchanged code.
- Do not add error handling for scenarios that cannot happen.
- Three similar lines of code is better than a premature abstraction.

### Code style
- Small components, typed props, explicit contracts, pure functions where practical.
- Narrow interfaces, readable code, no hidden side effects.
- Prefer composition over configuration flags.
- Co-locate component, styles, and tests where the project already does so.

### State and contracts
- Keep separate: server data (fetched), derived view-model, transient UI state.
- Do not overload props with mixed meanings.
- Do not duplicate backend enums — import the type and reference it.

---

## TESTING RULES

- Write or update tests with every code change.
- Tests go in the existing test file for the module (do not create new test
  files unless clearly warranted).
- Test both the happy path and the failure / edge paths (loading, empty,
  error, unauthorised).
- Make test failures specific and actionable (assert on exact values, not
  truthiness).
- No flaky tests, no timing dependencies, no real network calls.
- Run `npm run build` and `npm test` after every change. Both must pass
  before commit.

---

## COMMIT RULES

- Once build and tests pass, run `git add` and `git commit` yourself — do
  not print the suggested commands and wait for the user to execute them.
- Stage only the files changed by this task.
- Commit message format: "<type>: <concise description>"
  Types: feat, fix, refactor, test, docs, chore
- If the change spans multiple concerns, prefer multiple small commits over
  one large commit.
- Do not commit files containing secrets (.env, credentials, API keys).

---

## HALT CONDITIONS — STOP AND ASK IF:

1. The intended UI behaviour is unclear or contradicts ui_architecture.md.
2. The required backend contract does not exist or disagrees with src/types/*.
3. A design token, role, or permission value needs to be invented.
4. The change requires violating an architectural invariant.
5. A new shared component is needed but an existing one is close enough that
   it is unclear whether to reuse, extend, or fork.
6. The change requires a new API call or websocket event that asoe2 does not
   yet expose.
7. You are unsure whether something belongs in a page, a component, a hook,
   or src/lib/.

In all halt cases, output:
  HALT — <one-sentence reason>
  Question for architect: <specific question>
  Do not proceed until answered.

---

## WORKING-STYLE CONSTRAINTS (operational hygiene)

Non-negotiable for any session that writes or reads files in this
repo. Mirrors the same rules in asoe2/prompts/pre_code_session.md so
cross-repo sessions behave identically.

1. **Write and read in small, section-wise chunks.** Long single
   writes (>200 lines in one operation) and long single reads
   (>300 lines) have historically timed out mid-edit and corrupted
   intermediate state. Prefer multiple focused `Edit` operations
   over one monolithic `Write`; prefer targeted reads with line
   ranges over dumping whole files. If a file legitimately needs
   to grow large, build it up in successive edits with build/test
   verification between them.

2. **Respect the audit-bearing field registry on the backend side.**
   When adding or renaming a field on any UI `*AnalysisData` type in
   `src/types/exceptions.ts`, the corresponding change on the backend
   side (`asoe2/api/schemas.py` + `asoe2/compliance/audit_bearing_registry.yaml`)
   must land in the same PR chain. The asoe2 fitness test
   (`tests/test_audit_registry_coverage.py`) will fail otherwise.
   The compliance team is CODEOWNERS of the registry — plan a
   review cycle with them for any change that touches an enrichment
   field classification.

3. **`// preview-only` markers are contracts.** Fields in
   `OrderAnalysis` carrying `// preview-only` are mock-backed; the
   real backend does NOT yet populate them. Do not hide the marker
   by refactor; drop it only when the matching adapter + registry
   classification land in asoe2. See drift register D18 in
   `ui_architecture.md` §9.

## POST-CHANGE VERIFICATION

After completing the change:

1. Run `npm run build` — must pass with no errors and no new warnings.
2. Run `npm test` — all tests must pass.
3. Verify no `any` was introduced and no enum strings were hardcoded in .tsx.
4. Verify src/types/* still matches the corresponding asoe2 contracts.
5. Verify keyboard navigation and accessible names for any interactive
   element you touched.
6. Confirm the change is small and reviewable.
7. Confirm docs are updated if the change affects user-facing behaviour
   (use prompts/update_docs.md).
8. If any `*AnalysisData` field was added / renamed / removed, confirm
   the corresponding asoe2 registry row exists and the asoe2 CI is
   green on that cross-repo PR.

Return: a concise summary of what was changed, files touched, tests
added/modified, and confirmation that build + tests pass.
```
