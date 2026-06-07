# ASOE UI — Component-Level UX/UI Audit

Expert QA / UX evaluation of **every page, section, and pane** in `asoe-ui`,
conducted component-by-component against three dimensions — **Correctness,
Usability, Simplicity** — using the standard review template (see
[Method](#method)).

- **Scope:** 97 components — 11 routes, the global chrome (left nav + top bar),
  the cases master-detail workspace, all exception detail sections
  (core scaffolding + 13 intent-specific evidence projectors), the **shared
  component library** (`src/components/ui/`), and every per-route
  error/loading state.
- **Coverage note:** reports 06–08 were added in a second verification pass
  that found the shared library and bespoke page-states had been missed by the
  first partition. The first pass's findings were independently spot-checked
  and held up (no hallucinated line numbers).
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
| 06 | [Shared — data-viz & evidence cards](./06-shared-dataviz-evidence-cards.md) | MetricTile, GapBar, PipelineDAG, PricingWaterfall, WaterfallStepper, ConstraintsPipeline, EventsTimeline, ConfidenceDisplay, EvidenceBlock, ClassificationHistoryPanel |
| 07 | [Shared — chrome/status/banners + page states](./07-shared-chrome-status-and-page-states.md) | CaseViewBanner, PreprodIdentityBanner, ChromeBoundary, HotkeyCheatsheet, StatusAnnouncer, SlaBandAnnouncer, ThemeToggle, Logo, GravitationalOrbs, VerdictDot, PolicyHitBadge, ComplianceHitCountChip, Badge + 8 per-route error/loading states |
| 08 | [Shared — interactive primitives](./08-shared-interactive-primitives.md) | Button, Input, Select, Combobox, MultiSelect, Dialog, DropdownMenu, Card, Toast, ActivityIndicator, AttachmentDownloadButton, AttachmentPreview, ErasureCertificateButton |

---

## Scorecard

| Slice | Pass | Minor | Rework | Total |
|-------|:----:|:-----:|:------:|:-----:|
| 01 Chrome & entry | 4 | 3 | 2 | 9 |
| 02 Dashboard/Inbox/Settings | 3 | 1 | 1 | 5 |
| 03 Cases workspace | 3 | 6 | 2 | 11 |
| 04 Exceptions core | 6 | 8 | 0 | 14 |
| 05 Exceptions enrichment | 7 | 5 | 1 | 13 |
| 06 Shared data-viz & evidence | 4 | 5 | 1 | 10 |
| 07 Shared chrome/status | 9 | 3 | 1 | 13 |
| 07 Per-route page states | 4 | 4 | 0 | 8 |
| 08 Shared interactive primitives | 5 | 8 | 0 | 13 |
| AgentReasoningCard (sep.) | — | 1 | — | 1 |
| **Total** | **45** | **44** | **8** | **97** |

> **Remediation progress (batches 1–4):** 3 of 11 Rework items fully resolved
> and flipped to Pass — **PricingWaterfall** (06, signed money + record guard),
> **ActivityIndicator** (08, Guardrail #2 + aria-live), **ErasureCertificateButton**
> (08, aria-busy + role/aria-live + token). Many "Minor" components had their
> flagged issues fixed too but retain other minor items (swept in Batch 6), so
> they stay Minor for now. See `REMEDIATION.md`.

### Needs Rework (priority queue)

1. **Login Page** (`src/app/login/page.tsx`) — hardcoded SSO allow-list, "enter any password" demo copy, fabricated agent/exception counts on a public screen.
2. **Auth Callback** (`src/app/auth/callback/page.tsx:21-27`) — ignores OAuth `code`, signs everyone in as a fixed `jane@acme.com` identity.
3. **Dashboard** (`src/app/dashboard/page.tsx`) — hardcoded `RECENT_ACTIVITY` rendered as live; fetch failure only `console.error`s (tiles vanish / skeletons hang forever).
4. **Cases `[id]` route** (`src/app/cases/[id]/page.tsx`) — dead 404 path (`setNotFound(true)` instead of `notFound()`), hardcoded `agentCount={3}`, missing keyboard nav present on the workspace.
5. **Cases `not-found.tsx`** — never reached (see #4); also uses the undefined `text-h4` token.
6. **OverMaxSection** (`src/app/exceptions/OverMaxSection.tsx`) — partial-truth `—` fallbacks bypassing EvidenceBlock (Guardrail #6) + client-side `reduce` of audit totals.
7. **GapBar** (`src/components/ui/GapBar.tsx:47-48`) — both `isExcess` and `isShortfall` require `primaryQty > secondaryQty`, so the back-order/MOQ shortfall case (ordered < available) is **never** rendered as a shortfall; severity also rides on color alone.
8. ~~**PricingWaterfall**~~ — ✅ **Resolved (Batch 4)**: signed via `fmtSignedPrice`/`fmtMoney`; negative RESULT keeps its sign; `step.record` empty-chip guarded.
9. **GravitationalOrbs** (`src/components/ui/GravitationalOrbs.tsx`) — perpetual `requestAnimationFrame` with no `prefers-reduced-motion` guard (WCAG 2.3.3), hardcoded RGB/hex colors, hardcoded light background breaks dark mode, decorative canvas missing `aria-hidden`.
10. ~~**ActivityIndicator**~~ — ✅ **Resolved (Batch 2+3)**: templated via `intentLabelFor` (no enum literals); `role="status"`+`aria-live="polite"`.
11. ~~**ErasureCertificateButton**~~ — ✅ **Resolved (Batch 1+3)**: `aria-busy`; single `role="alert"` rule; `text-error` token.

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

> ✅ **Resolved — Batch 4** (see `REMEDIATION.md`). Added canonical
> `fmtSignedPrice` (explicit +/-) and `fmtMoney` (sign-preserving, no forced +)
> in `@/lib/format`; switched the 6 signed-delta sites (HeaderRibbon, ContextStrip,
> BackOrderSection freight, PricingWaterfall) to them so the sign is textual.
> `fmtPrice` stays magnitude-only (defensive) for the 18 always-positive sites
> per the expert subagent's call. 10 regression tests added.

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

> ✅ **Resolved — Batch 3** (see `REMEDIATION.md`). `ActivityIndicator` is now a
> polite live region; `Button`/`AttachmentDownloadButton`/`ErasureCertificateButton`
> expose `aria-busy` (Button retains its label while loading); the attachment
> download surfaces failures via `role="alert"`; `Toast` announces errors
> assertively; `PipelineDAG` keeps its focus ring; `ConfidenceDisplay` dropped the
> stray `tabIndex`; `/home` has a real `<main>` skip-link target; Sidebar/NavBar
> icon controls are 44px hit targets. (`text-h4` token fixed in Batch 1.)
> 11 regression tests added.

### T6 — Vocabulary & label inconsistency
Raw enums in one place, humanized labels in another, on the same journey:
- `RecordListPane` shows raw `lifecycle_state` (`:182`) vs queue rows' `STATUS_LABEL`.
- Raw action codes in cosign `pending.action` and EmailOrderEntry `recommended_action` vs humanized in OverrideChooserDialog.
- Stale directional copy ("on the right" when records stack below, `RecordListPane.tsx:132`).

### T7 — Type-safety & route hygiene
- `as unknown as` / `as { … }` casts to read `email`/`title`/initials off the auth contract — should be typed.
- Dead 404 path + workspace/`[id]` route drift (T1/#4 above).
- V2 + `FAILED` + no `shadow_verdict` may leave a manager with **no action surface** (ribbon suppressed `ExceptionDetailPanel.tsx:633`, card matrix hidden `:856`, error banner action-less `:881`) — verify against intended V2 behavior.

### T8 — Undefined design tokens & typo'd CSS classes (added in pass 2)
Classes that name a token/utility that doesn't exist, so the element silently
renders unstyled — invisible in code review, visible only at runtime:
- `text-h4` — undefined font-size; **all four** route `error.tsx` files (`:16`) plus `cases/error.tsx` / `cases/not-found.tsx`. Correct token: `text-heading`.
- `text-status-error` — undefined color class (real token: `text-error`); `ErasureCertificateButton.tsx:103`, `OrderEntrySection.tsx:39`, `DraftReplySection.tsx:135,176,214` → compliance/error messages render unstyled.
- `pl-30` — undefined spacing token (scale jumps 24→32), `EventsTimeline.tsx:250`.
- Hardcoded numeric `fontSize` / RGB-hex in SVG viz (PipelineDAG, EventsTimeline, GravitationalOrbs).
- **Fix theme:** a CI lint guard failing on Tailwind classes not resolvable to a token would kill this whole class of bug.

> ✅ **Resolved — Batch 1** (see `REMEDIATION.md`). All `text-h4`/`text-h2`,
> `text-status-*`, `pl-30` and off-scale `-14` classes mapped to real tokens;
> PipelineDAG SVG `fontSize` now token-backed; `GravitationalOrbs` colour/motion
> deferred to Batch 5 (full rework). The CI guard
> (`tests/architectural/token_class_resolution.test.ts`) now fails the build on
> any unresolvable spacing/font-size/colour class and caught 4 latent extras.

### T9 — Missing default-fallback in enum→display maps (added in pass 2)
Maps keyed off backend enums with no `default` branch render **blank** for a new
enum value — the inverse of Guardrail #2 (not hardcoded, but silently dropped):
- `EventsTimeline` `statusIndicator`, `ClassificationHistoryPanel` classifier maps, `WaterfallStepper` "skipped" (icon-only, no text).
- Hard Guardrail #2 violation found in pass 2: `ActivityIndicator.tsx:20-41` hardcodes the intent enum as map keys.
- **Fix theme:** every enum→display map needs a `default` fallback + icon+text, mirroring `verdictVariant()` in `Badge.tsx`.

> ✅ **Resolved — Batch 2** (see `REMEDIATION.md`). `ActivityIndicator` now
> templates domain-aware copy through `intentLabelFor` (no hardcoded intent
> literals; new intents need zero UI change); `EventsTimeline.statusIndicator`
> and `ClassificationHistoryPanel` got neutral default fallbacks;
> `WaterfallStepper` "skipped" gained a text cue; the dashboard verdict bar
> routes colour through `variantColorVar(verdictVariant())`. Also fixed a latent
> double-icon bug in every classifier badge. Six regression tests added (each
> fails on the parent commit).

### Reinforced by pass 2
- **T3 (signed money)** now also covers the shared `PricingWaterfall` (`fmtPrice` `Math.abs`) — fix the helper at the source, once.
- **T5 (accessibility)** gained: `aria-busy` missing on every async control (Button also loses its accessible name while loading; AttachmentDownloadButton; ErasureCertificateButton); `ActivityIndicator` has no `aria-live`; `Toast` announces errors politely not assertively; `PipelineDAG` `outline:none` with no focus replacement; `AttachmentDownloadButton` swallows download failures (`try/finally`, no `catch`) on a SOX evidence surface.

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
