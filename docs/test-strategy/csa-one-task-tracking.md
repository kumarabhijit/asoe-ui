# CSA one-task flow — failing skip-test tracker

**Status:** Closed (S15a, 2026-05-12).
**Closing commit:** branch `claude/analyze-asoe-gaps-0LzG5`.
**Test file:** `tests/contract/test_csa_one_task_flow.test.tsx` (active lock; no skip marker).
**Plan reference:** `docs/plans/gap-remediation-rollout.md` in `asoe2` repo, row **S15a**.

## Why this exists

The 2026-05-11 gap analysis surfaced a regression in the CSA workflow caused by the post-#133 case-centric pivot:

- **May 7 baseline (ADR-034 Phase G.3 bridge):** clicking a `/inbox` row deep-linked to `/exceptions/{id}`. The CSA reached the **action ribbon** (Approve / Reject / Override / Escalate / Reanalyze) in **one click**.
- **Pre-S15a:** `/inbox` 308-redirects to `/cases?source=manual_order`; a row click navigates to `/cases/{id}`, which rendered `CaseDetailPanel` as a **read-only** view. To take action the operator had to click through to the per-record `/exceptions/{record.id}` deep-link. The flow was **two clicks** for single-record cases and **three** if the operator had to scan record IDs to find the right one.

The PO drove issue #133 specifically because the CSA's lived workflow is "one task end-to-end". A two-click action surface contradicted that ratification.

## What S15a shipped

1. **`CaseDetailPanel` mounts `ExceptionDetailPanel` inline** for the operator-selected record. The mount point lives below the attached-records picker and renders the full HITL surface — HeaderRibbon + ContextStrip + AgentAnalysis + EvidenceGrid + Diagnostics + cosign banner.
2. **Single-record cases auto-mount** via a `useEffect` that sets `selectedRecordId` to the only record on first render. The picker step collapses to zero clicks for the common case.
3. **Multi-record cases surface a per-record picker** (`role="radiogroup"` + `role="radio"`). One row per record; clicking it sets `selectedRecordId` and the URL `?record=<id>` query.
4. **`?record=<id>` URL parameter** keeps the selection bookmarkable and survives reload. Deep-links from emails / notifications land the operator straight on the right record's ribbon.
5. **`/exceptions/[id]` route deleted.** The case-centric pivot's promise that "exception is a record under a case" extends to the URL surface: there is no longer a standalone per-record page. Callers that previously linked to `/exceptions/<id>` (only `CaseDetailPanel` did) now compute `/cases/<parent_case_id>?record=<id>`. Browser specs use a new `exceptionUrl()` helper that performs the parent-case lookup.
6. **Cosign banner is per-record only** by construction — it lives inside `ExceptionDetailPanel` and gates on `detail.lifecycle_state === PENDING_COSIGN`. Mounting the panel under a different selected record hides the banner; selecting the cosign-pending record surfaces it.

## Locks

The active lock (`tests/contract/test_csa_one_task_flow.test.tsx`) asserts:

1. `CaseDetailPanel` imports + renders `ExceptionDetailPanel` with an `exceptionId` prop.
2. `CaseDetailPanel` renders a `role="radiogroup"` / `role="radio"` picker and accepts an `onSelectRecord` callback.
3. `/cases/[id]/page.tsx` reads the `?record=` query via `useSearchParams` and threads `selectedRecordId` + `onSelectRecord` into the panel.
4. `src/app/exceptions/[id]/page.tsx` does **not** exist.

If any of those four contracts regress (e.g. someone re-introduces `/exceptions/[id]` as a parallel surface, or removes the picker in favour of a navigation hop), the lock fires.

## Related work

- Original PO supersession: `asoe2/docs/adr/ADR-034-email-order-entry-skill.md` §6.1.
- May-11 gap analysis: chat transcript on branch `claude/analyze-asoe-gaps-0LzG5`.
- May-12 S15a delivery: same transcript; design decision was per-record picker + delete the redirect rather than carry a transitional redirect layer.
