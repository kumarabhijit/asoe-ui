# UX/UI Review — Dashboard, Inbox, Settings Slice

Reviewer: Expert QA / UX-UI Evaluator
Scope: `src/app/dashboard/*`, `src/app/inbox/*`, `src/app/settings/*`, `src/app/settings/autonomy/*`
Domain: ASOE agent-first control tower for Order-to-Cash exceptions. Audience = O2C operators/analysts/managers (domain experts). Decisions are financially-binding, SOX-relevant, RBAC-gated.

Each finding cites `file:line`. Runtime contrast / pixel alignment claims are flagged for manual verification.

---

## Dashboard Page (`src/app/dashboard/page.tsx`)

**Context**
- Card/Pane Name: "Performance" — resolution analytics & agent-performance dashboard (Layout B, Section 11.5).
- Primary Goal: Give operators/managers an at-a-glance roll-up of resolution rate, agent throughput, exception distribution by intent/state/verdict, platform health, and recent activity.
- Target Audience: O2C managers and analysts monitoring fleet health.
- Composed UI components: `MetricTile` (×4 KPI strip), `Card` (×6), `Badge` + `verdictVariant`/`lifecycleVariant`, `NavBar`, plus inline `BarSegment` and `InfoRow` helpers. (No `GapBar` or `PipelineDAG` is used on this page despite the slice prompt mentioning them — they are not imported here.)

**Overall Verdict:** Needs Rework

**Correctness Issues**
- **`RECENT_ACTIVITY` is hardcoded mock data shipped in the page** (`page.tsx:40-47`). Six fully-fabricated order rows (`SO-3100`, `PENALTY_MATRIX_VIOLATION`, timestamps, statuses) are rendered as if live (`page.tsx:300-325`). On a SOX-relevant control tower this is a real correctness/credibility hazard: the operator cannot tell this card is fake, and it never updates despite the page's WebSocket live-refresh wiring (`page.tsx:95-101`) which only refreshes `stats`. Either drive this card from a real `recent activity` endpoint or label it clearly as sample data. This is the single most serious issue in the slice.
- **Guardrail #2 concern — verdict string literals in page logic** (`page.tsx:252-254`): the `BarSegment` color is chosen via `verdict === "GREEN" ? ... : verdict === "YELLOW" ? ...`. This is exactly the "switch on enum value in page-level logic" pattern Guardrail #2 forbids; the canonical `verdictVariant()` mapper (already imported, `page.tsx:27`) exists for this. Adding a new verdict would silently fall to the red/error color. Should delegate to a token mapper rather than inline literals.
- **Hardcoded hex-free but literal status strings in mock** (`page.tsx:41-46`) embed `status`/`badge` strings (`"RESOLVED"`, `"BLOCKED"`) that duplicate enum semantics outside `useHealth` — same Guardrail #2 smell, compounded by being mock.
- **Empty-state gap for KPI strip**: the KPI tiles only render when `stats` is truthy (`page.tsx:153`). When `stats` is `null` after a *failed* fetch (the `catch` only logs, `page.tsx:73-74`, and never sets an error flag), the four tiles silently vanish with no skeleton and no error message — the page looks half-broken. The inner cards show skeletons, but the top KPI row shows nothing. Inconsistent loading treatment.
- **Silent fetch failure** (`page.tsx:72-74`): `catch` does `console.error` only. There is no user-visible error state for a stats failure; `loading` is set false in `finally`, so a failed load renders a permanently empty dashboard (cards stuck on skeletons forever because `stats` stays null). Needs an error state distinct from loading.
- **`MetricTile` `value` prop type** — `Total Processed` passes a `number` (`page.tsx:183`) while others pass strings; `MetricTile` accepts `string | number` so this is fine, but note the em-dash fallback `"—"` at `page.tsx:167` and `page.tsx:176` is an ad-hoc partial-truth placeholder that Guardrail #6 explicitly calls an anti-pattern (`data.field ?? fallback` / `"—"`). These are KPI tiles not Layer-2 evidence rows, so the EvidenceBlock rule is arguably out of strict scope, but the inconsistency is worth a compliance note.
- **`grid grid-cols-2` is not responsive** (`page.tsx:190`): the 2-column analytics grid has no `md:`/`sm:` breakpoint, so on narrow viewports the cards (and the `min-w-[110px]`/`min-w-[80px]` badges + bar + count rows inside) will overflow or crush. The KPI strip above it *is* responsive (`auto-fit,minmax(200px,1fr)`, `page.tsx:154`) — inconsistent. Needs visual verification but the missing breakpoint is verifiable in code.

**Usability Issues**
- **`document.title = "Performance"` but the route is `/dashboard`** and the H1 is "Performance" (`page.tsx:64,143`). The nav tab is `activeTab="dashboard"` (`page.tsx:111`). The triple naming (route "dashboard" / title "Performance" / breadcrumb "Performance") is a minor wayfinding inconsistency; acceptable but worth noting for support/runbook clarity.
- **Recent Activity dot relies on color alone** (`page.tsx:308-311`): the leading `8x8` colored dot encodes status by color only (`background: item.color`). The row does also carry a `Badge` with text (`page.tsx:321-323`), so the row as a whole is WCAG-1.4.1 compliant, but the dot itself is decorative-by-color and not marked `aria-hidden`; it adds redundant color-only signal. Minor.
- **No headings landmark structure issue**, but the four analytics `Card`s use `<h3>` (`page.tsx:193` etc.) directly under the page `<h1>` (`page.tsx:143`) with no `<h2>` — a skipped heading level (h1 → h3). Screen-reader outline gap. Verifiable in code.
- **Bar segments have no accessible value** (`BarSegment`, `page.tsx:334-344`): the visual bar conveys proportion but exposes no `aria-label`/`role="img"`/text alternative; the numeric count beside it (`page.tsx:204-206` etc.) carries the data, so it is not a blocker, but the bar is purely decorative and unlabeled.
- **Unused imports** `AlertTriangle`, `CheckCircle`, `ShieldX` (`page.tsx:18-21`) are imported but never used — dead code, will trip lint/`no-unused-vars` and adds bundle noise.

**Simplicity Opportunities**
- Remove `RECENT_ACTIVITY` mock or move it behind the real API; it is the largest block of fake content on a trust-critical surface.
- Collapse the three near-identical distribution cards (by_intent / by_lifecycle_state / by_shadow_verdict, `page.tsx:192-265`) into a single reusable `<DistributionCard>` — they share the BarSegment + count + label row structure verbatim, only the left cell differs. Large duplication.
- Drop the unused lucide imports (`page.tsx:18-21`).
- The inline `verdict === "GREEN" ? ...` color ternary (`page.tsx:251-255`) can be deleted in favor of the existing variant mapper, simplifying and fixing the Guardrail #2 issue at once.

**Top 3 Actionable Recommendations:**
1. Replace the hardcoded `RECENT_ACTIVITY` array (`page.tsx:40-47`) with a real endpoint feeding the live-refresh path, or visibly badge the card as "Sample data". This is a trust/correctness blocker on a SOX surface.
2. Add a real error state for the stats fetch (`page.tsx:72-74`): set an error flag in `catch`, and render an inline alert + retry instead of leaving KPI tiles absent and cards stuck on skeletons forever.
3. Replace the inline `verdict === "GREEN"` color logic (`page.tsx:251-255`) with a token-driven mapper, make the analytics grid responsive (`page.tsx:190`), and remove the three unused icon imports.

---

## Inbox Page (`src/app/inbox/page.tsx`)

**Context**
- Card/Pane Name: `/inbox` — server-side permanent redirect to `/cases?source=manual_order`.
- Primary Goal: Preserve deep-links to the deprecated Customer Inbox while routing users to the consolidated case-list surface.
- Target Audience: Anyone hitting a stale `/inbox` link (notification emails, history, runbooks).

**Overall Verdict:** Pass

**Correctness Issues**
- Clean. `redirect("/cases?source=manual_order")` (`inbox/page.tsx:20`) is the correct App Router pattern; the JSDoc (`inbox/page.tsx:1-16`) documents the consolidation rationale (PO #1/#7/#9) well.
- Minor note: this is a *client-perceived* permanent move, but `next/navigation` `redirect()` issues a 307 (temporary) by default in a Server Component render, not a 308. The comment says "permanent server redirect" (`inbox/page.tsx:13`). If true permanence / SEO-grade 308 is desired, this belongs in `next.config` `redirects()` with `permanent: true` or `middleware`. Functionally correct either way for internal app navigation; flagging the comment/behavior mismatch only.

**Usability Issues**
- The redirect is instantaneous and server-side, so there is no flash-of-empty-page; good. No loading/error UX needed here (the `inbox/error.tsx` + `inbox/loading.tsx` boundaries still exist and are harmless fallbacks).

**Simplicity Opportunities**
- `inbox/error.tsx` and `inbox/loading.tsx` (`ChromeBoundary activeTab="inbox"`) are effectively dead now that the route always redirects before rendering chrome — they will essentially never display. Candidate for removal to reduce surface, though keeping them is low-cost insurance.

**Top 3 Actionable Recommendations:**
1. If durable/SEO-correct permanence is intended, move the redirect to `next.config.js` `redirects()` with `permanent: true` (matches the "permanent" comment at `inbox/page.tsx:13`); otherwise soften the comment to "server redirect".
2. Consider deleting the now-unreachable `inbox/loading.tsx` / `inbox/error.tsx` boundaries.
3. No other action needed — this is a clean, well-documented consolidation.

---

## Settings Index Page (`src/app/settings/page.tsx`)

**Context**
- Card/Pane Name: "Settings" — platform configuration landing grid.
- Primary Goal: RBAC-gate the settings area and present a 2-column card menu of config sections (User Management, SSO, Autonomy, Agent Config, Notifications).
- Target Audience: Managers/admins with `rules:write`, `policy:write`, or `users:manage`.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- **RBAC gate is correct but the redirect race is subtle**: access is computed with `hasPermission` (`settings/page.tsx:41`) and the effect redirects when `!hasSettingsAccess` (`settings/page.tsx:43-47`). The render guard at `settings/page.tsx:49` correctly blocks content while loading/denied. Solid. One nit: the `useEffect` dependency array (`settings/page.tsx:47`) omits `hasSettingsAccess`'s underlying `hasPermission` — but since `hasSettingsAccess` is in the deps this is fine.
- **Four of five sections are non-interactive "Coming soon" cards** (`settings/page.tsx:26-30`) yet render visually identical to the one live "Autonomy" card aside from the small status label. The only affordance difference is the `href` → wrapping `<Link>` (`settings/page.tsx:137-147`). A user cannot tell at a glance which card is clickable; the live card has no hover/cursor distinction beyond the focus ring. Affordance correctness gap.
- **Status label is the only signal differentiating "View" (actionable) from "Coming soon" (inert)** (`settings/page.tsx:131-133`), rendered in `text-text-quaternary` (lowest-contrast token) uppercase micro-text. For the one actionable card the most important affordance cue is the least visible element. Needs visual contrast verification, but the hierarchy inversion is verifiable in code.

**Usability Issues**
- **Inert cards are not marked as disabled** for assistive tech (`settings/page.tsx:145-147`): "Coming soon" cards render as plain `<Card>` with no `aria-disabled`, no `aria-description`. A screen-reader user gets a card with a label and a "coming soon" string but no programmatic disabled state. Minor a11y gap.
- **Page header uses `text-display`** (`settings/page.tsx:106`) while the dashboard's H1 uses `text-title` (`dashboard/page.tsx:143`) — inconsistent H1 sizing token across two top-level pages in the same slice. Verifiable; worth aligning.
- **Hardcoded `SETTINGS_PERMISSIONS` literal array** (`settings/page.tsx:20`) — these are permission strings, not the health-sourced enums Guardrail #2 governs, so this is acceptable (RBAC permission keys aren't intent/lifecycle/verdict/recipe enums). Noted only to confirm it is NOT a false finding. Note autonomy page uses the typed `PERMISSIONS` constant from `@/lib/roles` (`autonomy/page.tsx:25,36`) — settings index could use the same for consistency.

**Simplicity Opportunities**
- The "Coming soon" cards (4 of 5) add visual noise and could be visually de-emphasized (reduced opacity / explicit disabled styling) so the single live destination stands out — currently the page is 80% dead ends presented at full visual weight.
- `SETTING_SECTIONS` mixing `status: "View"` + `href` for one row and `status: "Coming soon"` for others (`settings/page.tsx:25-31`) would read more clearly as an explicit `disabled: true` / `href` discriminated shape than inferring interactivity from `"href" in section` (`settings/page.tsx:118`).

**Top 3 Actionable Recommendations:**
1. Give the one actionable card a clear affordance distinct from the four inert ones (`settings/page.tsx:117-148`): e.g., hover lift + a `Badge` or chevron on the live card, and visible `aria-disabled` + dimmed styling on "Coming soon" cards.
2. Replace the low-contrast `text-text-quaternary` status label (`settings/page.tsx:131`) as the primary actionability cue with a higher-contrast badge/icon; do not rely on the dimmest token to signal the one thing the user can click.
3. Align the H1 type token with the dashboard (`text-display` vs `text-title`, `settings/page.tsx:106`) and consider sourcing settings permissions from `@/lib/roles` `PERMISSIONS` for consistency with the autonomy page.

---

## Settings → Autonomy Page (`src/app/settings/autonomy/page.tsx`)

**Context**
- Card/Pane Name: "Autonomy & Review Quality" — automation-bias review-scrutiny SLIs.
- Primary Goal: Show managers/admins whether operators are genuinely reviewing evidence vs. rubber-stamping, gating a safe path to greater agent autonomy. Read-only.
- Target Audience: Managers/admins (`exceptions:override` — mirrors backend `require_role("manager","admin")`).
- Composes: `ReviewQualityPanel` (reviewed below) + `NavBar`.

**Overall Verdict:** Pass

**Correctness Issues**
- **RBAC is exemplary**: gated on `PERMISSIONS.EXCEPTIONS_OVERRIDE` (`autonomy/page.tsx:36`), redirect effect (`autonomy/page.tsx:41-43`), and render guard (`autonomy/page.tsx:62-77`). The JSDoc explicitly ties the permission to the backend role check (`autonomy/page.tsx:6-9`) — strong contract discipline.
- **Three-state fetch handling is correct and complete** (`autonomy/page.tsx:129-144`): `loadError` → `role="alert"` error card; `data` → panel; else → `aria-busy` skeletons. The fetch effect properly guards with a `cancelled` flag (`autonomy/page.tsx:46-60`) to avoid setState-after-unmount. This is the model the dashboard page should follow.
- No correctness defects found.

**Usability Issues**
- **Loading skeleton vs. data-shape mismatch** (`autonomy/page.tsx:139-143`): three `80px` skeleton blocks are shown, but the real panel renders a tile grid + multiple sections (`ReviewQualityPanel`), so the skeleton does not approximate the eventual layout. Cosmetic; minor layout shift on load. Needs visual verification.
- Error card text (`autonomy/page.tsx:129-135`) is clear and actionable ("Try refreshing.") with `role="alert"` — good. Could add an explicit retry button (the dashboard error boundary has one) rather than relying on manual refresh, but acceptable for a read-only metrics surface.

**Simplicity Opportunities**
- Page is tight and single-purpose; little to remove. The breadcrumb (Home / Settings / Autonomy, `autonomy/page.tsx:99-115`) is correctly a 3-level trail with real links — better wayfinding than the dashboard's 2-level breadcrumb.

**Top 3 Actionable Recommendations:**
1. Match the skeleton shape to the real panel (`autonomy/page.tsx:139-143`) — a tile-row skeleton + section skeletons — to reduce load-time layout shift.
2. (Optional) Add a retry button to the error state (`autonomy/page.tsx:129-135`) for parity with the route error boundary.
3. No further action — this page is the reference-quality example for RBAC + fetch-state handling in this slice.

---

## ReviewQualityPanel (`src/components/ui/ReviewQualityPanel.tsx`) — as used by Autonomy

**Context**
- Card/Pane Name: Review-scrutiny SLI panel (tiles + cohort A/B + dwell histogram + "not measurable yet" cards).
- Primary Goal: Project a backend `ReviewerActivitySnapshot` honestly — including explicitly naming metrics with no data source rather than fabricating them.
- Target Audience: Managers/admins evaluating automation-bias risk.

**Overall Verdict:** Pass

**Correctness Issues**
- **`dwellBars` decomposition is sound** (`ReviewQualityPanel.tsx:37-50`): cumulative-histogram → per-bucket via `count - prevCount`, clamped at 0, with a correct `> Ns` / `≤ Ns` labeling for the open-ended last bucket. This is pure presentation of backend-measured data (documented `ReviewQualityPanel.tsx:8-9`), consistent with the "dumb projector" guardrail — no synthesized metric.
- **`highlightRegression` derivation** (`ReviewQualityPanel.tsx:60-63`): compares cohort scrutiny rates only when both cohorts have decisions, avoiding a false signal on empty cohorts. Correct guard. The interpretive copy is tied to ADR-043 §2.7 (`ReviewQualityPanel.tsx:57-58,135`). This is borderline "UI computing a verdict," but it is a pure comparison of two backend-measured rates for display emphasis, not a business decision — acceptable.
- **Honesty cards are correct** (`ReviewQualityPanel.tsx:174-186`): STP-counterfactual and calibration both render `NotAvailableCard` naming the missing source — exactly the partial-truth-avoidance Guardrail #6 demands. Strong.
- Tint thresholds (`ReviewQualityPanel.tsx:94`: `>= 0.5` → success/warning) is a UI-side numeric threshold. Per CLAUDE.md "no threshold calculations" this is a *display* tint, not a policy decision, so it is defensible — but flag it: a `0.5` literal driving a red/green signal on a compliance surface ideally comes from backend/config rather than the component. Worth a compliance note.

**Usability Issues**
- **Scrutiny tile color relies on tint + value, text label present** (`ReviewQualityPanel.tsx:91-95`): the tile carries label + numeric value + subtitle, so WCAG 1.4.1 is satisfied (not color-alone). Good.
- The dwell-distribution bars (`ReviewQualityPanel.tsx:153-168`) pair each bar with a text label and numeric count — accessible. The bar `<div>` itself is unlabeled but redundant to the count.
- `role="note"` / `role="alert"` switch on the cohort callout (`ReviewQualityPanel.tsx:126`) correctly escalates the regression case to an assertive announcement. Nice detail.

**Simplicity Opportunities**
- Clean, well-factored (sub-components `CohortStat`, `NotAvailableCard`). No notable removals.

**Top 3 Actionable Recommendations:**
1. Source the `0.5` scrutiny tint threshold (`ReviewQualityPanel.tsx:94`) from backend/config rather than a UI literal, to keep all decision thresholds backend-authoritative on this SOX surface.
2. (Optional) Add `role="img"` + `aria-label` (e.g. "67% scrutiny") to the dwell/scrutiny bars for parity, though the adjacent text already carries the value.
3. No further action — the honest "no data source yet" pattern is exemplary and should be the template elsewhere.

---

## Cross-cutting observations (this slice)

- **Inconsistent fetch-error handling across pages.** The autonomy page has a complete loading/error/data tri-state with `role="alert"` and cancellation (`autonomy/page.tsx:45-60,129-144`); the dashboard only `console.error`s and has no user-visible error or empty state (`dashboard/page.tsx:72-74`). Standardize on the autonomy pattern.
- **Hardcoded/mock content on a trust-critical surface.** The dashboard's `RECENT_ACTIVITY` (`dashboard/page.tsx:40-47`) is fully fabricated and indistinguishable from live data — the highest-severity issue in the slice for a SOX control tower.
- **Enum/threshold literals leaking into presentation logic.** `verdict === "GREEN"` color ternary on the dashboard (`dashboard/page.tsx:251-255`) and the `0.5` tint threshold in ReviewQualityPanel (`ReviewQualityPanel.tsx:94`) both push enum/threshold decisions into UI code where Guardrails #2 and the determinism rule want token-mappers / backend config.

---

## Verdict summary

| Surface | Verdict |
|---|---|
| Dashboard | Needs Rework |
| Inbox (redirect) | Pass |
| Settings index | Needs Minor Tweaks |
| Settings → Autonomy | Pass |
| ReviewQualityPanel (in context) | Pass |

Pass: 3 · Needs Minor Tweaks: 1 · Needs Rework: 1
