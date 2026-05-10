# JOURNEYS — user-archetype storyboards for the flow registry

Decision D3 (`docs/test-strategy/e2e-flow-plan.md` in `kumarabhijit/asoe2`).

The W7 flow registry is anchored to three operator archetypes. Each
flow YAML references a journey ID via the `journey:` field; the
storyboards below are the source of truth for what each journey
exercises and why.

> Auto-generation from `journey:` tags is recommended for V1.1
> (Failure modes table — JOURNEYS.md drift). Until then, treat
> this file as the contract — quarterly journey review on the
> team calendar mitigates drift.

---

## J1 — New operator, day one

**Mental model.** Has a customer email open in another tab. Doesn't
yet know which surface to start on, doesn't know the difference
between Inbox and Exception Queue, doesn't trust the system to
have already done work.

**5-second arc.** Do they orient? Can they tell what's already
been classified vs what needs them?

**5-minute arc.** Can they finish a triage end-to-end without
asking a colleague?

**5-year arc.** Is the inbox a place they trust to surface what
matters and hide what doesn't?

**Flows that exercise J1.**
- `onboard/signin-to-home.yaml` — first authenticated load. Chrome
  invariant must hold; a returning operator must not be greeted by
  a blank pane mid-render.
- `triage/inbox-load.yaml` — full state matrix. Empty state must
  read as "you're caught up", not as a broken pane (D7).
- `triage/email-order-entry-from-inbox.yaml` — V1 regression. Back
  button from a detail page reached via inbox lands back on the
  inbox, not the queue.
- `triage/inbox-item-click-behavior-catalog.yaml` — V3 regression.
  Click semantics are uniform across item types; nothing is a
  silent no-op.
- `triage/case-to-exception-detail-roundtrip.yaml` — V2 regression.
  Forward/back navigation never drops chrome (CMT-2).

---

## J2 — Peak-load veteran

**Mental model.** 30 cases queued, keyboard-driven, no time for
mouse trips. Runs through dispositions in seconds. Will notice if
a Tab order is wrong before they notice if a colour is wrong.

**5-second arc.** Does the next case load instantly when they Enter
on a row?

**5-minute arc.** Do they finish a batch without context switches —
no surprise dialogs, no focus loss after action?

**5-year arc.** Do they reach for this tool first when a critical
exception lands, or do they fall back to email?

**Flows that exercise J2.**
- `triage/inbox-load.yaml` — full state matrix; loading state must
  not block keyboard advance (P1's deferred-promise pattern).
- `triage/inbox-item-click-behavior-catalog.yaml` — V3. Keyboard
  Enter must produce the same outcome as left-click for every
  declared item type (D6 + D7).
- `resolve/exception-triage-approval.yaml` — full keyboard path.
  StatusAnnouncer fires "Exception resolved" so the screen reader
  confirms the approval landed (Q1).
- `signout/signout-from-each-role.yaml` — focus restored to
  sign-in input after sign-out (D6).

---

## J3 — Recovery from misclick

**Mental model.** Misrouted a case to the wrong queue, just
realised. Wants to back out without losing data already entered.
A high-trust system makes recovery feel safe enough to take risks.

**5-second arc.** Do they see the misclick happen? (Status
announcement, undo affordance, breadcrumb that doesn't lie.)

**5-minute arc.** Can they recover without re-entering data?

**5-year arc.** Does the system make recovery feel safe enough
that they take risks (e.g. try a new resolve workflow) rather
than always picking the conservative path?

**Flows that exercise J3.**
- `triage/case-to-exception-detail-roundtrip.yaml` — V2. Back
  navigation from a detail surface must restore the prior queue
  state including selection.
- `recover/back-from-misroute.yaml` — golden. The recovery flow
  must preserve in-progress data (form values not cleared by
  the back navigation).

---

## Journey ↔ flow matrix

| Flow                                                     | J1 | J2 | J3 |
|----------------------------------------------------------|----|----|----|
| `onboard/signin-to-home.yaml`                            | ✅ |    |    |
| `triage/inbox-load.yaml`                                 | ✅ | ✅ |    |
| `triage/email-order-entry-from-inbox.yaml`               | ✅ |    |    |
| `triage/inbox-item-click-behavior-catalog.yaml`          | ✅ | ✅ |    |
| `triage/case-to-exception-detail-roundtrip.yaml`         | ✅ |    | ✅ |
| `resolve/exception-triage-approval.yaml`                 |    | ✅ |    |
| `signout/signout-from-each-role.yaml`                    |    | ✅ |    |
| `recover/back-from-misroute.yaml`                        |    |    | ✅ |

Each row's `✅` columns must match the flow YAML's `journey:` field.
A meta-test will lock this in V1.1 (`/plan-eng-review` Approach C
auto-generation territory).
