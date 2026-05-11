# `/api/v1/cases` cursor pagination — deferred ADR tracker

**Status:** Deferred (backend contract change requires ADR amendment).
**Owner:** Backend Platform + Frontend Platform; co-sign required.
**Skip-test:** `tests/contract/test_cases_cursor_pagination_deferred.test.ts`
**Plan reference:** `docs/plans/gap-remediation-rollout.md` row S4 (re-scoped).

## Why this is deferred

The 2026-05-11 gap analysis identified that the case-projected `/exceptions` queue lost the cursor-loop pagination the May-7 `/exceptions/page.tsx` carried (`do { exceptionsApi.list({ cursor }); } while (cursor)`). The rollout plan's S4 originally proposed porting that loop into `useCases`.

Mid-S4 the autonomous run hit the plan's §4 emergency-stop trigger:

> "A backend route signature in `api/routes/exceptions.py` would have to change to satisfy a UI expectation. The backend contract is binding; the UI must adapt, not the other way round, unless an ADR amendment is filed first."

The backend's `/api/v1/cases` response shape (`CaseListResponse` in `asoe2/api/schemas.py`) is `{ items, total }` — no `cursor` / `has_more` field. Only `/api/v1/exceptions` (`ExceptionListResponse`) supports cursor pagination, and the case-projected `/exceptions` UI no longer talks to that route. Porting the cursor loop unilaterally would require either (a) a new backend route signature or (b) reverting `/exceptions` to its pre-case-projection ancestor — both reach into ADR-038 territory.

## What S4 actually shipped

1. `useCases({ limit })` — wires the existing backend `limit` parameter through the hook.
2. Mock `casesApi.list` honours `limit` (default 200, max 500 — matches the asoe2 contract).
3. `UseCasesReturn.truncated: boolean` — flips when `total > cases.length`, so pages can render a "Showing N of M" disclosure without rolling their own derivation.
4. This tracking doc + a `.skip` regression guard in the contract test below.

## What S4 deliberately does not ship

- No cursor / `has_more` synthesis on the UI side. Faking a cursor against a non-cursor-paginated backend would hide the gap from observability rather than expose it.
- No silent client-side pagination of the truncated set. The operator must see "you are not seeing everything" or no UI assumption (analytics, count totals) can be trusted.

## Acceptance criteria to un-skip

1. asoe2 ADR-amendment ratifies cursor pagination on `/api/v1/cases` — `CaseListResponse` gains `cursor: Optional[str]` and `has_more: bool` fields. The amendment must clarify whether `/exceptions` retires entirely or remains as the per-event cursor-paginated surface.
2. asoe2 implementation lands; OpenAPI document carries the new fields.
3. `useCases` adopts a `do { ... } while (cursor)` loop accumulating items across pages, with `truncated` repurposed for backend-truncated responses (a separate signal from "more pages exist locally").
4. `tests/contract/test_cases_cursor_pagination_deferred.test.ts` skip is removed; the test body becomes the active lock.

## Related work

- Original gap analysis: A3 in the 2026-05-11 chat transcript.
- May-7 cursor-loop reference: `git show 44ecf51:src/app/exceptions/page.tsx` lines 154–190.
- Backend route: `asoe2/api/routes/cases.py::list_cases` (limit-only today).
