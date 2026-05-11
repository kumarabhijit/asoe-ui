# JOURNEYS — user-archetype storyboards for the flow registry

Decision D3 (`docs/test-strategy/e2e-flow-plan.md` in `kumarabhijit/asoe2`).

The W7 flow registry is anchored to operator archetypes. Each
flow YAML references a journey ID via the `journey:` field; the
storyboards below are the source of truth for what each journey
exercises and why.

## Arcs

Every flow declares an `arc:` field. Two values are testable; the
third is a product KPI, not a test assertion.

| Arc | What it tests | Test shape | Time budget? |
|---|---|---|---|
| `orientation` | Can the operator find the right affordance after navigating to the surface? | Single-screen assertion: chrome present, focus on a sensible element, expected affordance reachable in ≤1 interaction. | No — orientation is about *presence + reachability*, not wall-clock. Performance budgets are deferred (e2e-flow-plan NOT-in-scope). |
| `task-completion` | Can the operator finish a task end-to-end without context switches? | Multi-step flow: click + keyboard equivalent on each step; focus restoration on every navigation; status announcement on every state change. | No — flow completion is the property, not duration. |
| `trust` (5-year arc) | Does the operator reach for this tool first when a critical exception lands? Do they feel safe taking risks because recovery is reliable? | **NOT A TEST.** This is a product KPI consumed via observability + product analytics. Documented here so the test layer does not pretend to assert it. | n/a |

Rule: the 5s arcs from prior versions of this doc were rhetorical,
not budgeted. A flow with `delay_ms: 2000` on the loading state
does not violate the orientation arc — it tests that the skeleton
is reachable, which is the orientation property. Web Vitals
budgets are a separate workstream.

## Archetypes

### J1 — New operator, day one

**Mental model.** Has a customer email open in another tab. Doesn't
yet know which surface to start on, doesn't know the difference
between Inbox and Exception Queue, doesn't trust the system to
have already done work.

**Orientation arc.** Can they tell what's already classified vs
what needs them, from the first screen they land on?

**Task-completion arc.** Can they finish a triage end-to-end
without asking a colleague?

**Trust KPI.** Is the inbox a place they trust to surface what
matters and hide what doesn't? (Out of test scope.)

### J2 — Peak-load veteran

**Mental model.** 30 cases queued, keyboard-driven, no time for
mouse trips. Runs through dispositions in seconds. Will notice if
a Tab order is wrong before they notice if a colour is wrong.

**Orientation arc.** When the next case loads, is the next action
already focused?

**Task-completion arc.** Do they finish a batch without surprise
dialogs or focus loss after an action?

**Trust KPI.** Do they reach for this tool first when a critical
exception lands, or fall back to email? (Out of test scope.)

### J3 — Recovery from misclick

**Mental model.** Mis-routed a case to the wrong queue, just
realised. Wants to back out without losing data already entered.
A high-trust system makes recovery feel safe enough to take risks.

**Orientation arc.** Does the operator see the misclick happen?
(Status announcement, undo affordance, breadcrumb that doesn't
lie.)

**Task-completion arc.** Can they recover the prior state — form
data preserved, selection restored — without re-entering anything?

**Trust KPI.** Does the system make recovery feel safe enough that
the operator picks risky/correct paths over conservative
workarounds? (Out of test scope.)

### J4 — Auth-edge operator (NEW in v1.3)

**Mental model.** The infrastructure is unreliable around them.
Session expired mid-action. Role was revoked between login and
the dispatch click. Browser back-button bounced them across two
detail pages while a 500 was in flight on a third.

**Orientation arc.** When the chrome is in a transitional state
(forward/back nav, bfcache restore, App Router boundary file like
`loading.tsx` / `error.tsx` / `not-found.tsx`), is the sign-out
+ user-menu still reachable? Does the operator have an exit?

**Task-completion arc.** When auth degrades mid-flow (session
expires while an override dialog is open; role lost between
shadow and execute), does the system fail explicitly to a
documented terminal state — `BLOCKED`, `MANUAL_REVIEW_REQUIRED`,
`FAIL_TO_HUMAN` — rather than silently partial-execute?

**Trust KPI.** Do operators trust the system to *not* take a
financially-binding action on a degraded auth context? (Out of
test scope.)

**Flows owned by J4.**
- The chrome invariant's CMT-2 transition + bfcache work.
- The chrome invariant's CMT-3 boundary-file coverage.
- Future: session-expiry-mid-flow and role-revocation-mid-flow
  flows.

### J5 — Auditor / compliance reviewer (NEW in v1.3)

**Mental model.** Reads, never writes. Pulled this case up
because internal audit flagged the override. Wants to reconstruct
the decision chain: what evidence was visible, what verdict the
shadow returned, what reason tag the operator selected, in what
order. SOX-relevant.

**Orientation arc.** From the case detail surface, can the
auditor find the override reason tag and the shadow verdict
within one click of the audit pane opening?

**Task-completion arc.** Can the auditor reconstruct the full
chain — `OrderEvent` → classified intent → selected recipe →
shadow verdict → override reason (if any) → executed action →
status announcement — without leaving the case detail surface?
Every audit-bearing field declared in
`compliance/audit_bearing_registry.yaml` must be present or
explicitly placeholder-rendered (`AUDIT_CONTEXT_MISSING` /
"Context Not Required for Resolution").

**Trust KPI.** When the audit lands six quarters from now, are
these traces still parseable from the registry shape alone, with
no oral history? (Out of test scope.)

**Flows owned by J5.**
- `compliance/audit-transcript-reconstructs.yaml` (V1.1) — assert
  the StatusAnnouncer transcript + EvidenceBlock presence map
  reconstructs the decision chain.
- `compliance/audit-bearing-registry-render-coverage.yaml` (V1.1)
  — every registry-required field renders or carries the
  documented `AUDIT_CONTEXT_MISSING` marker.

### J6 — Accessibility-first operator (DEFERRED to V1.1)

Slot reserved. Keyboard-only is already an implicit floor for J2;
this archetype owns the full a11y story (screen-reader replay,
`prefers-reduced-motion`, high-contrast, `aria-live` transcript
correctness). Listed here so the gap is visible.

---

## Journey × arc coverage matrix (auto-generated)

This matrix is regenerated from each flow YAML's `journey:` +
`arc:` fields by `e2e/__tests__/journey-coverage.test.ts`. The
matrix below is updated by hand until the auto-generation tool
ships in V1.1. The meta-test asserts the YAML side matches the
expected matrix at the bottom of this file.

<!-- BEGIN MATRIX -->
| Flow | Journey | Arc |
|---|---|---|
| `triage/inbox-load.yaml` | J1, J2 | orientation |
<!-- END MATRIX -->

Until the full flow set lands, the journey-coverage meta-test
will fail with structured gap reports — that is the desired
behaviour. Each gap is a flow to author next.

---

## Notes for plan readers

- **5y arcs are KPIs, not test assertions.** The 5-year arcs in
  the original D3 design were rhetorical framing. The test layer
  asserts orientation + task-completion only. Trust is observed,
  not tested.
- **Adversarial coverage is J4.** Forward/back navigation, bfcache
  restore, App Router boundary files all live under J4 — this is
  the archetype that owns CMT-2 + CMT-3 from the e2e flow plan.
- **Compliance is J5.** The audit reviewer is a first-class
  archetype. This binds the W7 flow registry to the audit-bearing
  registry workstream in Lane 1 (asoe2) so the two sides cannot
  drift.
- **J6 is acknowledged but deferred.** Keyboard floor is already
  enforced per-step (D6). Full a11y replay lands in V1.1.
