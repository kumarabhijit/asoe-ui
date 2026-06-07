# UX/UI Review — Cases Workspace (master-detail, incl. LEFT list pane)

**Reviewer:** QA / UX-UI Evaluator
**Date:** 2026-06-06
**Scope:** `/cases` two-pane workspace, `/cases/[id]` focused view, left list pane (`RecordListPane`), queue rows (V1/V2), `CaseDetailPanel`, audit-rail tenants, and the App-Router state files (`error`/`loading`/`not-found`).
**Method:** Full read of each file; findings cite `file:line`. Runtime contrast/pixel items flagged for manual verification. Project guardrails (token-mapped Tailwind classes, `useHealth` enums, icon+text status, Pydantic-mirrored types) were treated as intended and not raised.

---

## Summary verdict counts

| Verdict | Count | Components |
|---|---|---|
| Pass | 3 | `loading.tsx`, `ComplianceHitsRail.tsx`, `RecordPreviewRail.tsx` |
| Needs Minor Tweaks | 5 | `page.tsx`, `RecordListPane.tsx`, `CasesQueueRow.tsx`, `CasesQueueRowV2.tsx`, `CaseDetailPanel.tsx` |
| Needs Rework | 2 | `[id]/page.tsx`, `not-found.tsx` (shared `text-h4` defect also hits `error.tsx`) |

---

### CasesPage / CasesWorkspace — `src/app/cases/page.tsx`

**Context**
- Pane/Goal: Outlook-style master-detail work surface; left queue (SLA-sorted) + right case detail, URL-driven via `?case=` / `?record=`, with an optional xl audit rail.
- Audience: O2C operators/analysts working a live, agent-driven queue.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- Dead imports increase noise and risk lint failure: `Badge` (`page.tsx:35`), `AlertTriangle` (`:27`), `PackageCheck` (`:31`), and the module-level `ORIGIN_ICON` map (`:88-92`) are declared but never referenced in this file — the queue rows own their own chrome now. `ORIGIN_LABEL` (`:82`) is used only for chip labels; the icon map is fully dead.
- `STATUS_LABEL` imported at `:48` is not used in `page.tsx` (rows render the status). Confirm before removal, but it reads as leftover from the pre-extraction monolith.
- Empty-state copy is filter-agnostic: `:607` always says "No cases match the current filters" even when **no filter is active** (origin null + status null) and the queue is genuinely empty. For a true empty queue this misleads the operator into thinking a filter is hiding work. Differentiate "No open cases" vs "No cases match these filters."
- Auto-advance after an action (`handleRecordActionComplete`, `:401-413`) silently relocates the operator to the next case via `router.replace` with no announcement. On a SOX-relevant surface, a silent context switch after Approve/Reject is disorienting and not surfaced to screen-reader users. Recommend an `aria-live` confirmation ("Resolved. Advanced to case X").

**Usability Issues**
- The xl audit rail is gated on `CASES_ROW_V2 && railHasContent` (`:523`, `:757`). When V2 is **off** (production default per the flag comment), Compliance hits never get the dedicated column and only appear inline inside the detail panel — fine, but it means the prominent "always-visible audit rail" is invisible in the shipping config. Worth confirming this is the intended production posture.
- Keyboard discoverability is good (`↑/↓ move · F6 switch panes`, `:551-554`; `HotkeyCheatsheet`, `:783`), but the cheatsheet is self-mounted with "lives on /cases only" (`:778-782`) — operators on `/cases/[id]` get no hotkey help, and that focused view has no keyboard list nav at all (see that component).
- The listbox uses `aria-activedescendant` with a container Tab stop (`:611-625`) — correct APG pattern. But `aria-activedescendant` is only set when `selectedCaseId` is truthy (`:615-617`); on first load with focus in the list and nothing selected, arrow keys move selection (via the hook) yet no active descendant is announced until a case is selected. Minor SR gap.
- Empty right-pane state (`:678-687`) is clear and well-written. Good.

**Simplicity Opportunities**
- The two near-identical `lastActivityLabel` IIFEs live in `CaseDetailPanel`, not here — fine. In this file, the large block comments (e.g. `:244-254`, `:447-468`) are valuable as ADR provenance but make the 200-line `CasesWorkspace` function hard to scan; consider extracting `handleRecordActionComplete`'s auto-advance into a small named hook.
- `slaSnapshot` + `formatDeltaShort` (`:109-151`) are exported pure functions co-located with the page; reasonable, but a `lib/sla.ts` home would let rows import them without depending on the page module (`CaseDetailPanel` already imports `slaSnapshot` from `./page` at `CaseDetailPanel.tsx:43`, a slightly smelly page→panel→page coupling).

**Top 3 Actionable Recommendations**
1. Remove dead imports/maps (`Badge`, `AlertTriangle`, `PackageCheck`, `ORIGIN_ICON`, possibly `STATUS_LABEL`) — `:27-48`, `:88-92`.
2. Make the empty-state copy filter-aware (`:604-609`).
3. Announce the post-action auto-advance via `aria-live` (`:401-413`).

---

### Case detail page — `src/app/cases/[id]/page.tsx`

**Context**
- Pane/Goal: Focused single-case view for deep links / notifications; mounts the same `CaseDetailPanel`.
- Audience: Operators arriving from a notification or shared URL.

**Overall Verdict:** Needs Rework

**Correctness Issues**
- Hardcoded `agentCount={3}` (`:111`). The workspace page derives this from `health?.allowed_intents?.length` (`page.tsx:198`); here it is a literal 3. The "system status visible everywhere" agent count is fabricated on this route. Wire `useHealth` like the workspace does.
- This page renders its own in-component not-found branch (`:133-137`, `setNotFound(true)`) instead of calling Next's `notFound()`. As a result the sibling `not-found.tsx` boundary **is never reached** (see that component) — the documented 404 chrome is dead code. The inline branch also lacks the NavBar-less full-chrome treatment the boundary provides... actually it keeps the NavBar, which is fine, but the divergence means two different "not found" presentations exist and only one is wired.
- No `?record=` clearing on case identity: `handleSelectRecord` (`:54-60`) writes `?record=` but there is no guard equivalent to the workspace's fast-switch race fix (`page.tsx:698-707`). On this single-case route the case id is fixed, so the race is lower risk, but a stale deep-linked `?record=` that doesn't exist on the case will silently render the picker with nothing mounted.

**Usability Issues**
- No keyboard list navigation. The workspace wires `useKeyboardListNav` + `usePaneFocusCycle` (`page.tsx:476-499`); this route mounts `CaseDetailPanel` with the same `RecordListPane` picker but no F6 pane cycling and no hotkey cheatsheet, so keyboard parity between the two case surfaces is inconsistent.
- Back affordance is a text button "← All cases" using `router.push` (`:118-125`) rather than a semantic link; acceptable but a real `<Link>` would give middle-click/open-in-new-tab and is what `not-found.tsx` already uses.

**Simplicity Opportunities**
- The fetch effect (`:68-103`) is a near-duplicate of the workspace's detail effect (`page.tsx:304-351`) minus the null-out-first race guard. Extracting a shared `useCaseDetail(caseId)` hook would collapse the duplication and let the race guard + policyHits handling live in one place.

**Top 3 Actionable Recommendations**
1. Replace `agentCount={3}` with the `useHealth`-derived count (`:111`).
2. Either call `notFound()` here so the boundary fires, or delete `not-found.tsx` as unreachable — don't ship both (`:133-137`).
3. Extract a shared `useCaseDetail` hook to unify this route with the workspace and gain keyboard/F6 parity.

---

### RecordListPane (LEFT/attached-records master list) — `src/app/cases/RecordListPane.tsx`

**Context**
- Pane/Goal: The attached-records picker — the master list the operator picks from to mount the per-record HITL ribbon. (Header comment still labels it the "middle column of the three-pane workspace," `:1-2`, but it currently stacks at the top of the detail pane.)
- Audience: Operators choosing which exception record within a case to act on.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- Stale header comment: `:1-21` describes a three-pane "middle column" layout that P3 did not ship (the picker stacks in the detail pane per `page.tsx:507-535`). Misleading to the next maintainer.
- `record.lifecycle_state` is rendered raw (`:182`) with no `STATUS_LABEL`/label mapping, unlike queue rows which map status to human labels (`CasesQueueRow.tsx:120`). The operator sees the raw enum (e.g. `PENDING_REVIEW`) here but a friendly label elsewhere — inconsistent vocabulary on the same screen. (Guardrail #1 still satisfied: rendering an API-provided string is allowed; this is a consistency/legibility issue, not a hardcoded-enum issue.)
- `record.intent ?? "UNCLASSIFIED"` (`:175`) is a hardcoded fallback literal. It is a *display label*, not a filter/select value, so it's defensible — but it is a string literal in JSX adjacent to enum territory; prefer a shared "Unclassified" constant or `EvidenceBlock`'s placeholder to stay consistent with the V2 row's `EvidenceBlock` discipline.

**Usability Issues**
- Roving-tabindex radiogroup (`:141-192`) is implemented correctly (one Tab stop, arrow/j/k/Home/End, `stopPropagation` to avoid double-firing with the queue nav — `:104-119`). Strong.
- The single-record copy ("Single record attached — auto-mounted on the right.", `:132`) says "on the right," but in the stacked layout the mounted ribbon is **below**, not to the right. Directional language is wrong for the shipped layout.
- The `caseId` is shown via `<code>` only when `records.length > 1` (`:133-138`); a single-record case never shows which case it belongs to in this pane. Minor, since the header carries it.

**Simplicity Opportunities**
- The conditional copy assembly (`:130-138`) interleaves three ternaries and a `<code>`; it is hard to read and produced the "on the right" bug. Split into two explicit branches (single vs multi).

**Top 3 Actionable Recommendations**
1. Fix the "on the right" directional copy and the stale three-pane header comment (`:1-21`, `:132`).
2. Map `lifecycle_state` through the shared status-label map for vocabulary consistency with queue rows (`:182`).
3. Replace the `?? "UNCLASSIFIED"` literal with the shared placeholder/`EvidenceBlock` pattern used by V2 (`:175`).

---

### CasesQueueRow (V1) — `src/app/cases/CasesQueueRow.tsx`

**Context**
- Pane/Goal: Legacy three-line left-queue row (origin/SLA/pinned chips, identifier, status). Shipping default (V2 flag OFF in prod).
- Audience: Operators scanning the SLA-sorted queue.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- Status indicators correctly pair icon + text (SLA `Clock`/`AlertTriangle` + label, `:98-102`) — WCAG 1.4.1 satisfied.
- The SLA badge is the only color-load-bearing element; `breached` adds `AlertTriangle` but `at_risk`/`today` both map to `warning` (`:48-49`) and are visually identical with no icon difference. "Due in 90m" (at_risk) and "Due in 18h" (today) look the same urgency despite materially different pressure. Consider distinguishing at_risk.
- Origin chrome is duplicated here vs `page.tsx` and `CaseDetailPanel.tsx` (`:31-41`); the comment (`:28-30`) flags this as intentional-for-rollback, so noted not raised — but three copies of `ORIGIN_LABEL`/`ORIGIN_ICON`/`SLA_BAND_VARIANT` is a real drift risk.

**Usability Issues**
- The primary identifier line (`:114-118`) shows `customer_po_number ?? sales_order_id ?? case_id` with no label, so the operator can't tell whether they're reading a PO, an SO, or a case id — three different identifier spaces rendered identically in mono. A tiny prefix ("PO", "SO") would disambiguate.
- `role="option"` + `aria-selected` + roving tabindex (`:73-76`) — correct listbox-option semantics. Good.

**Simplicity Opportunities**
- Three stacked rows with three chips is already lean. No removable elements.

**Top 3 Actionable Recommendations**
1. Label the identifier so PO/SO/case_id aren't ambiguous (`:114-118`).
2. Visually distinguish `at_risk` from `today` (both `warning` today) (`:48-49`, `:93-103`).
3. Centralize the duplicated origin/SLA maps once V2 lands to kill drift (`:31-52`).

---

### CasesQueueRowV2 — `src/app/cases/CasesQueueRowV2.tsx`

**Context**
- Pane/Goal: Four-line richer row (origin·SLA·status·verdict-dot / case_id·customer / SKU·title·problem / intent·currency) with density toggle and pinned left stripe. Flag-gated (preview/non-prod default).
- Audience: Operators wanting denser, evidence-rich scanning.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- Strong `EvidenceBlock` discipline on every audit-bearing field (`:152`, `:199`, `:225`) — Guardrail #6 honored, no `?? "—"`.
- `VerdictDot color={v as "R" | "A" | "G"}` (`:153`) casts an arbitrary backend string to a 3-value union with no runtime guard. If the backend ever emits a 4th verdict color, `VerdictDot` receives an out-of-union value silently. Confirm `VerdictDot` has a `default` fallback (the cast itself is a type-safety smell on a SOX surface).
- The dollar amount is `aria-hidden` (`:231`) with the a11y form folded into the row's `aria-label` (`:284-333`) — correct dedup. Good.
- Line 1 chips can wrap (`flex-wrap`, `:131`); on a 360px column the origin "Customer Inbox" + SLA + status + verdict dot will wrap to two lines at comfortable density, partly defeating the "four-line" contract. Needs visual/manual verification at 360px.

**Usability Issues**
- Compact density collapses to lines 1+3 (`:158`, `:180`) hiding case_id, customer, intent, and **dollar impact** — hiding the financial magnitude in compact mode removes the single most decision-relevant number from the scan. Reconsider keeping currency visible in compact.
- The pinned stripe is `aria-hidden` with the semantic carried in `aria-label` (`:99-108`) — correct. The 3px stripe + `pl-[19px]` vs `pl-16` offset (`:123`) is a precise touch; needs visual verification that text doesn't shift jarringly between pinned/unpinned rows.
- The `+N intents` secondary badge (`:215-223`) puts the underlying intent list only in a `title=` tooltip — not keyboard/touch reachable. Acceptable as progressive disclosure but the count is the only always-visible signal.

**Simplicity Opportunities**
- Four lines + density toggle + verdict dot + two intent badges + currency is a lot of simultaneous signal; this is the opposite extreme from V1. The comment justifies each field via ADR, but field-count alone risks scan overload — worth a usability test before promoting V2 to default.

**Top 3 Actionable Recommendations**
1. Keep dollar impact visible in compact density (`:180`, `:225-240`).
2. Add a runtime-safe fallback (or confirm `VerdictDot`'s default) instead of the `as "R"|"A"|"G"` cast (`:153`).
3. Verify line-1 wrapping at 360px so the "four-line" anatomy holds (`:131`).

---

### CaseDetailPanel — `src/app/cases/CaseDetailPanel.tsx`

**Context**
- Pane/Goal: Right-pane case detail — header (slim/full), compliance hits, classification history, records picker, and inline-mounted per-record HITL ribbon.
- Audience: Operators reviewing a case and acting on a record.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- The slim-header disclosure button (`:286-295`) only opens (`setShowFullCaseHeader(true)`); the matching "Hide case details" close button lives in the *full* header branch (`:392-403`). This works, but the open button's `aria-controls="case-full-header"` (`:289`) points at an id that only exists when `showFullCaseHeader` is true (`:299`). While collapsed, `aria-controls` references a non-existent element — an ARIA integrity gap.
- Two `lastActivityLabel` IIFEs (`:261-279` slim, `:337-352` full) duplicate the same logic with different wrapper markup. Drift risk; one helper component would do.
- `slaSnapshot` is imported from `./page` (`:43`) — a panel importing from the page that renders it. Circular-ish coupling; should live in a lib module.

**Usability Issues**
- Strong two-layer behavior: slim context strip when a record is mounted, full header on demand (`:193`, `:204`), skip-link to `#action-ribbon` (`:215-220`), SLA band announcer (`:203`), explicit `aria-live="off"` on the noisy ticker label (`:271`, `:344`). This is careful, well-reasoned a11y work.
- Multi-record cases defer auto-mount (`:180-184`) so the picker is scannable first — good call, matches the "scan before drill" mental model.
- The full-header grid was aggressively pruned to just "Opened" + "Sales order" (`:384-391`); reasonable per the cited findings, but "Opened" renders `orderCase.opened_at` raw via `Field` (`:385`) with no date formatting — operators see an ISO timestamp rather than a localized/relative date. Inconsistent with the humanized `lastActivityLabel` elsewhere.

**Simplicity Opportunities**
- The slim vs full header is two large nearly-parallel JSX branches (`:204-405`). A single header component taking a `variant` prop would halve the surface and remove the duplicated activity/SLA/status rendering.

**Top 3 Actionable Recommendations**
1. Fix the dangling `aria-controls="case-full-header"` while the full header is unmounted (`:289`).
2. Format `opened_at` for humans instead of rendering raw ISO (`:385`).
3. De-duplicate the slim/full header branches and the two `lastActivityLabel` IIFEs into one component/helper.

---

### ComplianceHitsRail — `src/app/cases/ComplianceHitsRail.tsx`

**Context**
- Pane/Goal: Compliance Shadow hits surface (inline card or 320px rail variant); L1 rule names plain, L2 LLM-derived carry an AI badge.
- Audience: Operators/managers needing evidence-of-review for SOX.

**Overall Verdict:** Pass

**Correctness Issues**
- Pure projector, returns null on empty (`:39`) per Guardrail #6. Clean. `key={hit}` (`:65`) assumes hits are unique strings; if `aggregated_policy_hits` can contain duplicates post-dedup-failure, React keys collide — low risk since the backend dedupes, noted only.

**Usability Issues**
- `ShieldAlert` icon + "Compliance hits" heading + count (`:50-58`) — clear, icon+text. The explanatory caption (`:59-62`) is helpful. Heading uses `text-heading` (valid token). Good.

**Simplicity Opportunities**
- None material — the component is appropriately small and single-purpose.

**Top 3 Actionable Recommendations**
1. (Optional) Use a stable composite key if duplicate hit strings are ever possible (`:65`).
2. No other changes needed.
3. —

---

### RecordPreviewRail — `src/app/cases/RecordPreviewRail.tsx`

**Context**
- Pane/Goal: Per-record xl-rail preview tenant; fetches order analysis and renders the AI draft reply read-only, reporting contentful state up so the page can collapse the rail.
- Audience: Operators glancing at the drafted buyer reply without leaving the case.

**Overall Verdict:** Pass

**Correctness Issues**
- Pure projector, `draft != null` gate, returns null otherwise (`:78-92`). The fetch is best-effort with cancellation (`:57-76`) — correct.
- `onContentfulChange` effect (`:85-90`) reports `false` on unmount — correct, prevents a stuck-open rail. One subtlety: `onContentfulChange` is in the dep array (`:90`); if the parent passes a non-memoized callback the effect re-runs each render. The parent passes `setPreviewHasContent` (a stable setter, `page.tsx:773`), so fine in practice.

**Usability Issues**
- Read-only with a clear "edit has one canonical home" rationale and a hash link to the detail editor (`:102-112`). Good separation of concerns; avoids a second editable copy of a financially-relevant reply.
- No loading state while `orderAnalysis` is in flight — the section simply pops in when the draft arrives. Acceptable for a secondary rail; a skeleton would be nicer but not required.

**Simplicity Opportunities**
- None material.

**Top 3 Actionable Recommendations**
1. (Optional) Add a lightweight loading affordance while analysis loads.
2. No other changes needed.
3. —

---

### error.tsx — `src/app/cases/error.tsx`

**Context**
- Pane/Goal: App-Router error boundary for `/cases` and descendants; message + digest + Retry.
- Audience: Any operator hitting a load failure.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- **`text-h4` is not a defined font-size token** (`:16`). The type scale in `tailwind.config` is display/title/heading/subhead/body/caption/label — there is no `h4`. `text-h4` therefore applies no font-size; the heading falls back to inherited body sizing. This is a real visual defect (the "Cases failed to load" h1 is not heading-sized). Use `text-heading`. (Same defect in `not-found.tsx:14`.)
- Retry button is `text-brand hover:underline` with no `focus-visible` ring (`:29`), unlike every other interactive element in this slice. Keyboard focus is invisible on the only recovery action.

**Usability Issues**
- `role="alert"` (`:15`) is correct for an error surface. Message + digest are surfaced for support. Good.
- Raw `error.message` (`:18`) is shown directly to operators; backend error strings may be technical/unfriendly. Consider a friendly default with the raw message behind the digest.

**Simplicity Opportunities**
- Lean and appropriate.

**Top 3 Actionable Recommendations**
1. Replace `text-h4` with `text-heading` (`:16`).
2. Add `focus-visible:ring-2 focus-visible:ring-brand-ring` to the Retry button (`:29`).
3. Wrap `error.message` in a friendly fallback.

---

### loading.tsx — `src/app/cases/loading.tsx`

**Context**
- Pane/Goal: Route-level loading boundary; chrome + "Loading cases…".
- Audience: Operators during navigation/suspense.

**Overall Verdict:** Pass

**Correctness Issues**
- `role="status"` + `aria-live="polite"` (`:7`) — correct. Renders inside `ChromeBoundary` so the NavBar persists. Clean.

**Usability Issues**
- Plain text only, no skeleton. Acceptable for a control tower; a queue-shaped skeleton would reduce perceived latency but isn't required.

**Simplicity Opportunities**
- None.

**Top 3 Actionable Recommendations**
1. (Optional) Add a queue/detail skeleton to reduce layout shift.
2. No other changes needed.
3. —

---

### not-found.tsx — `src/app/cases/not-found.tsx`

**Context**
- Pane/Goal: 404 boundary for `/cases` and `/cases/[id]`; "Case not found" + link back.
- Audience: Operators following a stale/deleted case link.

**Overall Verdict:** Needs Rework

**Correctness Issues**
- **Unreachable in practice.** The header comment says it renders "when `notFound()` is called from `/cases/[id]/page.tsx`" (`:3-6`), but that page never calls `notFound()` — it uses an in-component `setNotFound(true)` branch (`[id]/page.tsx:133-137`). A `Grep` for `notFound()` in `src/app/cases` finds only comments. So this boundary is dead code and the documented 404 chrome never shows; the operator instead sees the inline "Case not found: <code>id</code>" text inside the detail page.
- Same `text-h4` token defect as `error.tsx` (`:14`) — `text-h4` is undefined; "Case not found" is not heading-sized. Use `text-heading`.

**Usability Issues**
- The component itself is fine: `<Link>` back to `/cases` with `aria-label` (`:18-24`), apostrophe escaped. If it were reachable it would be a good 404. The problem is purely that nothing routes to it.

**Simplicity Opportunities**
- Either delete it (and the `[id]` inline branch becomes the single source of 404 truth) or make `[id]` call `notFound()` so this becomes live — having both is redundant and confusing.

**Top 3 Actionable Recommendations**
1. Decide one 404 path: call `notFound()` from `[id]/page.tsx` to make this live, OR delete this file (`:3-6` / `[id]/page.tsx:133-137`).
2. Fix `text-h4` → `text-heading` (`:14`).
3. Align the header comment with reality once the routing decision is made.

---

## Cross-cutting issues (this slice)

1. **`text-h4` is an undefined font-size token** used in `error.tsx:16` and `not-found.tsx:14` (and the same pattern recurs in sibling route error files). The project type scale has no `h4`, so these headings silently render at body size — a real visual defect across the App-Router boundary chrome. Fix to `text-heading`.

2. **The documented not-found path is dead.** `not-found.tsx` is never reached because `[id]/page.tsx` resolves missing cases with an in-component `setNotFound` branch instead of Next's `notFound()`. The two case surfaces also diverge on `agentCount` (hardcoded `3` on `[id]` vs `useHealth`-derived on the workspace) and on keyboard support (F6/list-nav/cheatsheet only on the workspace). The `/cases/[id]` route needs to be brought to parity or consolidated behind a shared `useCaseDetail` hook.

3. **Identifier and status vocabulary is inconsistent within the same screen.** Queue rows humanize status via `STATUS_LABEL` and show an unlabeled `PO ?? SO ?? case_id` identifier; the record picker shows the raw `lifecycle_state` enum and the slim-header copy says records auto-mount "on the right" when they actually mount below. Operators see raw enums in one pane and friendly labels in another, ambiguous identifiers, and stale directional language — all small, all eroding trust on a SOX-relevant surface.
