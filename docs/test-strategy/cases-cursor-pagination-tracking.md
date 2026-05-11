# `/api/v1/cases` cursor pagination — landed 2026-05-11

**Status:** Active (ADR-038 §D7 amendment shipped).
**Owner:** Backend + Frontend Platform.
**Plan reference:** `docs/plans/gap-remediation-rollout.md` row S4 + follow-on.

## Outcome

Cursor pagination is live on `/api/v1/cases`. Both repos updated in lockstep:

### asoe2 (binding contract)

- `api/schemas.py::CaseListResponse` — gained `cursor: Optional[str]` and `has_more: bool` fields.
- `api/routes/cases.py::list_cases` — accepts `?cursor=<token>`. Sort is now (opened_at DESC, case_id DESC tiebreak) for cursor determinism. Slicing is cursor-anchored; unknown cursors fall through to start-of-list (grandfathered, matches `exception_store.list`).
- `tests/test_routes_cases.py::TestCursorPagination` — five locks: cursor present on first page when more exist, cursor null on last page, full loop covers every case exactly once, unknown cursor falls through, cursor pagination respects filters.
- `openapi/asoe2.openapi.json` — regenerated; `CaseListResponse` schema now publishes `cursor` + `has_more`.

### asoe-ui

- `src/lib/api.ts::casesApi.list` — added `cursor?: string` param; return type widened to `{ items, total, cursor, has_more }`. Mock branch now slices by cursor with the same stable sort.
- `src/hooks/useManualOrderCases.ts::useCases` — switched to a bounded `for` loop (max 200 iterations) that accumulates pages until `has_more === false`. Stalled-cursor guard breaks the loop if the backend returns the same cursor twice. `truncated` is now a defensive disclosure (should always be false in normal operation).
- `tests/hooks/useCases.limit.test.ts` — rewritten to exercise the cursor loop end-to-end including the stalled-cursor guard.
- `tests/contract/test_cases_cursor_pagination_deferred.test.ts` — `it.skip` flipped to active; structural locks verify both the hook source and the OpenAPI shape.

## Why this matters

The 2026-05-11 gap report flagged that the case-projected exception queue silently capped at the first page (limit=200). For tenants with more than 200 open cases, the UI's filter chips and aggregate counters were operating on a slice the operator could not see. The bug was invisible in mock-mode because `MOCK_CASES` has fewer than 200 entries.

## Acceptance criteria (all met)

1. asoe2 `CaseListResponse` carries `cursor: Optional[str]` and `has_more: bool`. ✓
2. asoe2 `list_cases` route accepts `?cursor=<token>` and slices deterministically. ✓
3. asoe2 OpenAPI document publishes both fields. ✓
4. asoe-ui `useCases` walks every page until `has_more` is false. ✓
5. asoe-ui mock paginates with the same stable sort + cursor scheme. ✓
6. Tests on both sides lock the invariants (5 backend + 6 frontend). ✓

## Related work

- Cursor convention reference: `asoe2/db/repository.py::exception_store.list` (created_at DESC anchor).
- Stable-sort tiebreaker rationale: cursor determinism requires a total ordering; `opened_at` is not unique across cases opened in the same millisecond.
- Backend-bug guard rationale: a real `exception_store` cursor-loop bug in 2025 went undetected for a sprint because the UI returned `loading=false` after the first page; we now break + surface via `truncated` instead of looping forever.
