# CSA one-task flow — failing skip-test tracker

**Status:** Deferred (PO-ratified).
**Owner:** Frontend Platform; PO sign-off required to un-skip.
**Test file:** `tests/contract/test_csa_one_task_flow.test.tsx`
**Plan reference:** `docs/plans/gap-remediation-rollout.md` in `asoe2` repo, row **S2**.

## Why this exists

The 2026-05-11 gap analysis surfaced a regression in the CSA workflow caused by the post-#133 case-centric pivot:

- **May 7 baseline (ADR-034 Phase G.3 bridge):** clicking a `/inbox` row deep-linked to `/exceptions/{id}`. The CSA reached the **action ribbon** (Approve / Reject / Override / Escalate / Reanalyze) in **one click**.
- **Today (post-#133):** `/inbox` 308-redirects to `/cases?source=manual_order`; a row click navigates to `/cases/{id}`, which renders `CaseDetailPanel` — a **read-only** view. To take action the operator must click through to the per-record `/exceptions/{record.id}` deep-link. The flow is now **two clicks** for single-record cases and **three** if the operator has to scan record IDs to find the right one.

The PO drove issue #133 specifically because the CSA's lived workflow is "one task end-to-end". A two-click action surface contradicts that ratification.

## Why this is a skip-test rather than a fix

The rollout plan's **P4** (deferred) lists "HITL action ribbon on `/cases/[id]`" outside the current sprint. Stopping work to ship the ribbon would push the higher-priority test/stub-alignment phases (S3–S11) past the live-HITL casing fix deadline.

The skip-test exists so the deferral is **visible**:

- `npm run test` lists the skip with the message body — a code reviewer encounters it in CI output and the gap is searchable in the codebase (`grep -rn csa-one-task tests/`).
- The test body **describes the expected flow** so the un-skip is a one-line change once `CaseDetailPanel` mounts the action ribbon (P4, future ADR amendment).
- The tracking doc (this file) is linked from the test so anyone touching the case-detail surface lands here first.

## Acceptance criteria to un-skip

The test becomes ready-for-execution when **all** the following hold:

1. `CaseDetailPanel` mounts an action ribbon for cases whose terminal record carries an actionable `lifecycle_state` (`PENDING_REVIEW`, `PENDING_COSIGN`, `ESCALATED`).
2. The ribbon's Approve / Reject / Override / Escalate / Reanalyze handlers wire through `useExceptionActions` against the case's **canonical** child record (single-record cases) or surface a record-pick step (multi-record cases) before action.
3. A formal ADR amendment ratifies the binding: is `/exceptions/{id}` retired in favour of `/cases/{id}` as the action surface, or do both surfaces coexist permanently? The plan defers this question; the un-skip implies the answer.

When all three hold, change `it.skip(...)` to `it(...)` in the test file and remove the `.skip` marker. The body is already written.

## Related work

- Original PO supersession: `asoe2/docs/adr/ADR-034-email-order-entry-skill.md` §6.1.
- May-11 gap analysis: chat transcript on branch `claude/analyze-asoe-gaps-0LzG5`.
- Reviewer-panel feedback: same transcript; PO's recommendation was to capture the gap as a failing test, which is what this file documents.
