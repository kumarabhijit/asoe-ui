# ASOE UI — Component-Level UX/UI Audit

Expert QA / UX evaluation of **every page, section, and pane** in `asoe-ui`,
conducted component-by-component against three dimensions — **Correctness,
Usability, Simplicity** — using the standard review template (see
[Method](#method)).

- **Scope:** 53 components — 11 routes, the global chrome (left nav + top bar),
  the cases master-detail workspace, and all exception detail sections
  (core scaffolding + 13 intent-specific evidence projectors).
- **Method:** static, code-grounded. Every finding cites `file:line`. Runtime
  contrast and pixel-alignment items are marked "needs visual/manual
  verification" rather than asserted.
- **Not changed:** this is an evaluation. No source code was modified.

> The flagship `AgentReasoningCard` ("Agent Recommendation" pane) was reviewed
> separately (see the session backlog) and is **Needs Minor Tweaks**. It is
> included in the totals below but its detail lives with the action-button
> backlog, not in these files.

---

## Reports

| # | Report | Coverage |
|---|--------|----------|
| 01 | [Chrome & entry pages](./01-chrome-and-entry-pages.md) | Left Nav (Sidebar), NavBar, layout, providers, root, home, login, 403, auth callback |
| 02 | [Dashboard / Inbox / Settings](./02-dashboard-inbox-settings.md) | Dashboard, Inbox, Settings index, Settings→Autonomy, ReviewQualityPanel (as used) |
| 03 | [Cases workspace](./03-cases-workspace.md) | Cases page, `[id]` route, **left list pane (RecordListPane)**, queue rows V1/V2, CaseDetailPanel, rails, error/loading/not-found |
| 04 | [Exceptions — core sections](./04-exceptions-core-sections.md) | ExceptionDetailPanel, ContextStrip, HeaderRibbon, AgentAnalysis, Diagnostics, Entities, EvidenceGrid, DraftReply, Email*, OrderEntry, KnowledgeGraph, OverrideChooserDialog, shared |
| 05 | [Exceptions — enrichment sections](./05-exceptions-enrichment-sections.md) | 13 intent-specific evidence projectors (PriceHold, EdiMismatch, DuplicateDetection, MOQ, OverMax, …) |

---

## Scorecard

| Slice | Pass | Minor | Rework | Total |
|-------|:----:|:-----:|:------:|:-----:|
| 01 Chrome & entry | 4 | 3 | 2 | 9 |
| 02 Dashboard/Inbox/Settings | 3 | 1 | 1 | 5 |
| 03 Cases workspace | 3 | 6 | 2 | 11 |
| 04 Exceptions core | 6 | 8 | 0 | 14 |
| 05 Exceptions enrichment | 7 | 5 | 1 | 13 |
| AgentReasoningCard (sep.) | — | 1 | — | 1 |
| **Total** | **23** | **24** | **6** | **53** |

### Needs Rework (priority queue)

1. **Login Page** (`src/app/login/page.tsx`) — hardcoded SSO allow-list, "enter any password" demo copy, fabricated agent/exception counts on a public screen.
2. **Auth Callback** (`src/app/auth/callback/page.tsx:21-27`) — ignores OAuth `code`, signs everyone in as a fixed `jane@acme.com` identity.
3. **Dashboard** (`src/app/dashboard/page.tsx`) — hardcoded `RECENT_ACTIVITY` rendered as live; fetch failure only `console.error`s (tiles vanish / skeletons hang forever).
4. **Cases `[id]` route** (`src/app/cases/[id]/page.tsx`) — dead 404 path (`setNotFound(true)` instead of `notFound()`), hardcoded `agentCount={3}`, missing keyboard nav present on the workspace.
5. **Cases `not-found.tsx`** — never reached (see #4); also uses the undefined `text-h4` token.
6. **OverMaxSection** (`src/app/exceptions/OverMaxSection.tsx`) — partial-truth `—` fallbacks bypassing EvidenceBlock (Guardrail #6) + client-side `reduce` of audit totals.

---

## Cross-cutting themes

Ranked by severity. These recur across slices and are best fixed as themes, not
one component at a time.

### T1 — Demo/fabricated data presented as live (highest severity)
Mock content is rendered indistinguishably from real, audited data on
SOX-relevant surfaces:
- Auth identity is faked (`auth/callback/page.tsx:21-27`); login shows fabricated counts (`login/page.tsx:272-280`).
- Dashboard `RECENT_ACTIVITY` is a hardcoded array (`dashboard/page.tsx:40-47`, rendered `:300-325`), untouched by the WS refresh.
- NavBar "{n} Agents Live" is fed `health.allowed_intents.length` (`home/page.tsx:157`) — an enum cardinality, not a live-agent count.
- Cases `[id]` route hardcodes `agentCount={3}`.

**Fix theme:** wire to real sources or visibly mark non-live data; never present a fabricated operational signal as live.

### T2 — Conflated loading / empty-zero / failed states
Three semantically distinct states render the same or wrong on a surface where
"no data," "still loading," and "load failed" carry very different audit meaning:
- EvidenceGrid shows "Loading line items…" forever for a genuinely zero-line record (`EvidenceGrid.tsx:106-110`).
- "(0)" headers with empty lists and no terminal empty-state in Entities / OrderEntry / KnowledgeGraph.
- Dashboard has no error/retry state (`dashboard/page.tsx:72-74`).
- **Reference pattern to standardize on:** Settings→Autonomy tri-state with `role="alert"` + cancellation (`autonomy/page.tsx:45-60,129-144`).

### T3 — Signed-money formatting bug
`fmtPrice` applies `Math.abs` (`shared.tsx:218`), stripping the sign from
deltas. A negative freight delta (a saving) renders as a positive dollar amount
with **direction conveyed by color only** (WCAG 1.4.1 risk):
- HeaderRibbon (`:99-103`), ContextStrip (`:80`), BackOrderSection (`:162`).
- Signed helpers already exist and disagree (`OrderEntrySection.formatUsd`, `formatDelta` in DeliveryDelay/ChangeAnalysis).

**Fix theme:** one canonical signed-currency formatter used everywhere; never rely on color alone for sign.

### T4 — Partial-truth & client-side composition (Guardrail #6)
- Hard violation: OverMaxSection `—` fallbacks (`:166-183`) instead of EvidenceBlock.
- Audit totals computed in the UI via `reduce`: MOQSection (`:29-30`), OverMaxSection (`:28-29`).
- UI-side thresholds/severity bands: PriceAnalysis (`:53-57`), BackOrder (`:301-305`), PalletConfig (`:175-185`), ReviewQualityPanel `0.5` (`:94`), dashboard `verdict === "GREEN" ? …` color switch despite importing `verdictVariant()` (`dashboard/page.tsx:251-255`).

**Fix theme:** absence via EvidenceBlock; totals/thresholds from backend or token-mappers, never derived in the projector.

### T5 — Accessibility gaps
- Sub-44px icon-only hit targets (Sidebar, NavBar).
- Mouse-only selection: EvidenceGrid rows lack `tabIndex`/role/key handler (`:130-151`).
- Missing semantics: Diagnostics tabs lack `role="tab"` (`:333`); `CollapsibleHeader` has `aria-expanded` but no `aria-controls` (affects every section); silent loading skeletons.
- Broken skip-link target on `/home` (empty `<div id="main-content" />`, `home/page.tsx:191`; no `<main>` landmark).
- Undefined `text-h4` token renders headings at body size (`cases/error.tsx:16`, `cases/not-found.tsx:14`).

### T6 — Vocabulary & label inconsistency
Raw enums in one place, humanized labels in another, on the same journey:
- `RecordListPane` shows raw `lifecycle_state` (`:182`) vs queue rows' `STATUS_LABEL`.
- Raw action codes in cosign `pending.action` and EmailOrderEntry `recommended_action` vs humanized in OverrideChooserDialog.
- Stale directional copy ("on the right" when records stack below, `RecordListPane.tsx:132`).

### T7 — Type-safety & route hygiene
- `as unknown as` / `as { … }` casts to read `email`/`title`/initials off the auth contract — should be typed.
- Dead 404 path + workspace/`[id]` route drift (T1/#4 above).
- V2 + `FAILED` + no `shadow_verdict` may leave a manager with **no action surface** (ribbon suppressed `ExceptionDetailPanel.tsx:633`, card matrix hidden `:856`, error banner action-less `:881`) — verify against intended V2 behavior.

---

## Method

Each component was evaluated with this template (fill the bracketed context,
then score the three dimensions):

> **Role:** Expert QA Engineer and UX/UI Evaluator.
> **Context:** Card/Pane Name · Primary Goal · Target Audience.
> **1. Correctness** — data types/formatting (currency, dates); interactive
> elements mapped to actions; visual alignment intact; error/edge/empty states
> handled without breaking layout.
> **2. Usability** — clear visual hierarchy; legible text/contrast; obvious
> affordances; feedback (hover, loading).
> **3. Simplicity** — anything removable; single obvious CTA; concise,
> jargon-free language; uncluttered/breathable.
> **Output:** Overall Verdict (Pass / Needs Minor Tweaks / Needs Rework) ·
> Correctness Issues · Usability Issues · Simplicity Opportunities ·
> Top 3 Actionable Recommendations.

Findings respect project guardrails: token-backed Tailwind spacing
(`px-16` → `var(--space-16)`) and `useHealth`-sourced enums are **not** flagged
as hardcoding; icon+text status indicators are credited; backend-mirrored types
are expected.

## Relationship to the action-button backlog
The `AgentReasoningCard` / action-relocation backlog (Groups A & B from the
prior session) is separate. T3 (signed money) and T4 (partial-truth) overlap
with the compliance posture that backlog already tracks; sequence shared
formatter/EvidenceBlock work once, not twice.
