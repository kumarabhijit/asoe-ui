# ASOE UI Architecture

**Repository:** `asoe-ui`
**Authoritative Source:** `consol_arch.md` (Sections 6, 8, 9, 11)
**Status:** Living document — tracks alignment and intentional drift between the UI implementation and the consolidated architecture.

> **Relationship to `consol_arch.md`:** This document extracts, mirrors, and extends the UI-relevant portions of the consolidated platform architecture. Where the implementation aligns with `consol_arch.md`, this document references the relevant section. Where the implementation intentionally drifts, the drift is documented with rationale. Proposed backend changes are collected in Section 10.

---

## Table of Contents

1. [Design Paradigm](#1-design-paradigm)
2. [Component Strategy](#2-component-strategy)
3. [Design Tokens](#3-design-tokens)
4. [Tech Stack](#4-tech-stack)
5. [Pages](#5-pages)
6. [API Contract (UI Surface)](#6-api-contract-ui-surface)
7. [WebSocket Protocol](#7-websocket-protocol)
8. [Auth, RBAC & Security](#8-auth-rbac--security)
9. [Alignment & Drift Register](#9-alignment--drift-register)
10. [Proposed Backend Changes (asoe2)](#10-proposed-backend-changes-asoe2)
11. [ADR References](#11-adr-references)
12. [Override Action Governance (Option A)](#12-override-action-governance-option-a)

---

## 1. Design Paradigm

**Source:** `consol_arch.md` Section 11.1

### Agent-First Control Tower

The UI is not a dashboard. It is a **control tower** where the system is the primary actor and humans intervene at decision points.

| Traditional Dashboard | ASOE Agent-First |
|---|---|
| User initiates every action | System active by default — agents always working |
| Static screens, manual refresh | UI in motion — real-time pipeline progress |
| AI hidden in a separate tab | AI activity visible everywhere (pulse dots, activity indicators) |
| Linear workflows | Multiple concurrent exception threads |

### Two-Layer Cognition Model

Every agent-facing detail surface implements a two-layer information architecture:

- **Layer 1 (Always visible):** Agent recommendation + confidence, 2-3 key data points, action button. Answerable in under 3 seconds: "What do I do?"
- **Layer 2 (Expandable on demand):** Evidence waterfall, structured reasoning trace, precedents, raw signals. Never shown by default (except YELLOW/RED auto-expand).

**Implementation:** `AgentReasoningCard` component (`src/components/ui/AgentReasoningCard.tsx`).

### Verdict-Specific UI States

| Shadow Verdict | Layer 1 | Layer 2 | Actions |
|---|---|---|---|
| **GREEN** | Green badge, "Auto-resolved", confidence bar | Collapsed (expandable) | "View Details" |
| **YELLOW** | Amber badge, "Review Required", recommendation | **Auto-expanded** with evidence | Approve (primary), Reject, Escalate |
| **RED** | Red badge, "Blocked by Policy", policy rules | **Auto-expanded** with policy violation details | Acknowledge, Override (admin + notes), Escalate |

> **RED design rationale (from spec):** RED exceptions are rare and high-stakes. Layer 2 auto-expands and the primary action button is removed to prevent accidental dismissal. Override is gated to `admin` and requires `resolution_notes` recorded in `policy_audit_log` for SOX compliance.

**Alignment status:** ALIGNED with `consol_arch.md` Section 11.1.

---

## 2. Component Strategy

**Source:** `consol_arch.md` Section 11.2

### Principle

Shadcn/ui adopted **only for non-agent primitives**. Agent-first components are custom-built because they implement domain-specific behavior (two-layer cognition, brand restraint, pipeline visualization) that Shadcn does not provide (ADR-005).

### Component Reconciliation Table

| Component | Spec Source | Implementation | Status |
|---|---|---|---|
| **Button** | Custom (spec) | `src/components/ui/Button.tsx` | ALIGNED |
| **Card** | Custom (spec) | `src/components/ui/Card.tsx` | ALIGNED |
| **Input** | Custom (spec) | `src/components/ui/Input.tsx` | ALIGNED |
| **Logo** | Custom (spec) | `src/components/ui/Logo.tsx` | ALIGNED |
| **NavBar** | Custom (spec) | `src/components/ui/NavBar.tsx` | ALIGNED |
| **MetricTile** | Custom (spec) | `src/components/ui/MetricTile.tsx` | ALIGNED |
| **AgentReasoningCard** | Custom (spec) | `src/components/ui/AgentReasoningCard.tsx` | ALIGNED |
| **WaterfallStepper** | Custom (spec) | `src/components/ui/WaterfallStepper.tsx` | ALIGNED |
| **ActivityIndicator** | Custom (spec) | `src/components/ui/ActivityIndicator.tsx` | ALIGNED |
| **Badge/Pill** | Custom (spec) | `src/components/ui/Badge.tsx` | ALIGNED (extended with 5 variant mappers) |
| **Sidebar** | Custom (spec) | `src/components/ui/Sidebar.tsx` | ALIGNED |
| **Toast** | Custom (spec) | `src/components/ui/Toast.tsx` | ALIGNED |
| **GravitationalOrbs** | Custom (pre-spec) | `src/components/ui/GravitationalOrbs.tsx` | Pre-existing, not in spec table |
| **PricingWaterfall** | **DRIFT** | `src/components/ui/PricingWaterfall.tsx` | UI enrichment — not in spec (see below) |
| **Select** | Shadcn (spec) | `src/components/ui/Select.tsx` | ALIGNED (Radix + Tailwind, Phase 8.9) |
| **DropdownMenu** | Shadcn (spec) | `src/components/ui/DropdownMenu.tsx` | ALIGNED (Radix + Tailwind, Phase 8.9) |
| **Dialog** | Shadcn (spec) | `src/components/ui/Dialog.tsx` | ALIGNED (Radix + Tailwind, Phase 8.9) |
| DataTable | Shadcn (spec) | Not yet installed | PENDING |
| Tooltip | Shadcn (spec) | Not yet installed | PENDING |

**Spec count:** 12 custom + 4 Shadcn = 16 total.
**Actual count:** 14 custom + 3 Shadcn = 17 total (DataTable and Tooltip pending).

### Intentional Drift: PricingWaterfall

`PricingWaterfall` is a UI enrichment component not specified in `consol_arch.md` Section 11.2. It visualizes the pricing condition chain for order line items (BASE → CONTRACT → TPR → UOM → RESULT/ERROR) — distinct from `WaterfallStepper` which visualizes the 10-node pipeline execution.

**Rationale:** The pre-merge sample screen (`samples/asoe-sample-screen.jsx`) demonstrated this visualization as core to the exception resolution experience. CPG pricing disputes require condition-level visibility. This component requires backend endpoints for line-item and waterfall data (see Section 10).

**Status:** Documented here as the authoritative UI architecture reference. `consol_arch.md` Section 11 is a stub pointer to this document.

### Intentional Drift: Badge Variant Mappers

The spec lists `Badge/Pill` as one component. The implementation extends it with 5 visual mapping functions that follow Guardrail #2 (default fallback for unknown values):

| Mapper | Purpose | Used By |
|---|---|---|
| `verdictVariant()` | Shadow verdict → badge variant | Exception Queue, Detail |
| `lifecycleVariant()` | Lifecycle state → badge variant | Exception Queue, Detail, Dashboard |
| `rootCauseVariant()` | Root cause → badge variant | Line-item grids |
| `categoryVariant()` | Inbox category → badge variant | Inbox page |
| `inboxStatusVariant()` | Inbox status → badge variant | Inbox page |

These are visual mapping functions (not hardcoded enums) — adding a new root cause or category requires zero code changes.

### Loading State UX (WaterfallStepper)

Per spec, each pipeline node renders with explicit state treatment:

| Node State | Visual | Implementation |
|---|---|---|
| Pending | Muted text + empty circle | Hollow border circle |
| In Progress | Pulsing purple dot + ActivityIndicator | Border circle + pulse animation + domain-aware text |
| Completed | Green checkmark + inline summary | Green filled circle + data summary |
| Failed | Red X + error summary; subsequent nodes "Skipped" | Red circle + dashed skipped nodes |

**Alignment status:** ALIGNED for spec components. DRIFTED for PricingWaterfall (intentional enrichment).

---

## 3. Design Tokens

**Source:** `consol_arch.md` Section 11.3

All visual decisions are expressed as CSS custom properties in `src/styles/design-tokens.css`. **Zero hardcoded hex values in component code** (Guardrail #2).

| Token Category | Prefix | Spec Count | Actual Count |
|---|---|---|---|
| Colors (brand, surface, text, border, status, category) | `--color-*` | 45+ | ~50 |
| Typography | `--font-*` | 18+ | ~20 |
| Spacing | `--space-*` | 15 | 15 |
| Elevation | `--shadow-*` | 5+4 | 9 |
| Radius | `--radius-*` | 5 | 5 |
| Motion | `--dur-*`, `--ease-*` | 8 | 8 |
| Layout | `--nav-height`, `--sidebar-width`, `--z-*` | 10+ | 10+ |
| **Total** | | **45+** | **149** |

### Brand Restraint

`--color-brand: #5A4BD6` (purple) appears in exactly **3 element types**:
1. Primary CTA button (`brand` variant)
2. Nav logo mark
3. Active tab underline

All other elements use neutrals. Status colors are semantic and map to shadow verdicts.

### WCAG 2.1 AA Compliance

- All status color values meet 4.5:1 (normal text) and 3:1 (large text, UI components)
- Status indicators never rely on color alone — every status is paired with icon + text label
- Badge/pill components use tinted backgrounds with text labels
- Validated by a layered test bundle (see `docs/test-strategy/UX_ACCESSIBILITY.md`):
  - **Token-level contrast lock** parses `design-tokens.css` and asserts shipped foreground/background pairs at AA thresholds.
  - **Component-level axe sweep** on every top-level interactive component (Badge, Button, Sidebar, MetricTile, Input, AgentReasoningCard, NavBar, ThemeToggle, EvidenceBlock, EventsTimeline, Dialog, DropdownMenu, Select, status-panel sections).
  - **Source-level UX-clutter invariants** lock z-index discipline, skip-link plumbing, StatusAnnouncer mount, landmark presence, and a `MAX_PRIMARY_ACTIONS=3` cap on the action ribbon.
  - **Focus-management invariants** on Sidebar (focus-on-open, ESC close, dialog semantics) and the skip-to-main link.
  - **Route-level `@axe-core/playwright` sweep** with a per-route ratchet baseline (regressions fail; existing debt tolerated and tracked).
  - **Viewport overflow + reduced-motion smoke** at 1280 / 1440 / 1920; reduced-motion collapses the `--dur-*` ladder via a `@media (prefers-reduced-motion: reduce)` block in design tokens.
  - **Keyboard-only operator journey** from login → /cases → record action with `[data-testid="status-announcer"]` aria-live mutation asserted at the announcement step.

### Figma Sync (from spec)

`design-tokens.css` is the code-side source of truth. A Figma plugin export produces `design-tokens.json` diffed against `design-tokens.css` in CI. Drift produces a warning (blocker in V1.5).

**Alignment status:** ALIGNED. Token count exceeds spec minimum.

---

## 4. Tech Stack

**Source:** `consol_arch.md` Section 11.4

| Layer | Spec | Actual | Status |
|---|---|---|---|
| Framework | Next.js 16 (App Router, React 19, TypeScript) | Next.js 16.2.3 (App Router, React 19) | ALIGNED |
| Styling | CSS custom properties + Tailwind CSS | CSS custom properties + Tailwind CSS + CVA | ALIGNED |
| Components | Shadcn/ui for non-agent primitives | Shadcn/ui (Select, DropdownMenu, Dialog) + 14 custom | ALIGNED |
| Dark Mode | — | System-default via `next-themes` (`prefers-color-scheme`) | NEW (Phase 8.9) |
| Icons | Lucide React (16/20/24px — never emoji) | Lucide React | ALIGNED |
| Fonts | SF Pro Display / Inter, SF Mono / JetBrains Mono | Inter (Google Fonts), SF Mono (system) | ALIGNED |
| Auth | NextAuth.js → FastAPI auth endpoints | NextAuth.js with mock auth API | ALIGNED (mock) |
| Validation | Zod | Zod (installed, limited use so far) | ALIGNED |
| Testing | Not specified in tech stack | Vitest + React Testing Library | ALIGNED (242 tests passing) |

**Styling architecture (Phase 8.9):** Tailwind CSS utility classes are the primary styling mechanism. Design tokens remain in `design-tokens.css` (light + dark mode variants). `tailwind.config.ts` maps all 137 tokens to Tailwind theme extensions. CVA (`class-variance-authority`) is used for multi-variant components (Button, Badge). `cn()` utility (`src/lib/utils.ts`) merges classes. Only 18 inline `style={{}}` remain — all data-driven dynamic values.

**Alignment status:** ALIGNED.

---

## 5. Pages

**Source:** `consol_arch.md` Section 11.5

### Spec vs Implementation

| Page | Spec (Section 11.5) | Route | Status |
|---|---|---|---|
| Login | Centered card, SSO + email/password | `/login` | ALIGNED |
| Exception Queue | Three-pane Outlook master-detail | `/exceptions` | ALIGNED (evolved from Layout A — see 5.1) |
| Exception Detail | Detail pane (inline) or full-page | `/exceptions` (right pane) / `/exceptions/[id]` | ALIGNED (polymorphic) |
| Dashboard | 2-column grid (Layout B) | `/dashboard` | ALIGNED (enriched) |
| Settings / Admin | Standard layout | `/settings` | PENDING (Phase 9) |
| **Customer Inbox** | **NOT IN SPEC** | `/inbox` | **DRIFT — new page** |

### 5.1 Cases Workspace (`/cases`) — canonical case-centric workspace (ADR-041 P3)

**Spec evolution (consolidated 2026-05-13):**
* V5.0 — three-pane Outlook master-detail at `/exceptions` driven by `ExceptionListPane`.
* V5.1 / V5.1.1 (Phase 28.5 / 28.5.x) — `/exceptions` re-grounded on `casesApi.list()`; `CaseListPane` mounted with the full filter / search / saved-views / keyboard-nav surface.
* S15a (PR #153) — retired `/exceptions/[id]`; per-record HITL ribbon mounts inline on `/cases/[id]?record=<id>` via `CaseDetailPanel`.
* **ADR-041 (PRs #156 / #157 / #158 / #160)** — retired the duplicate `/exceptions` queue route entirely. `/cases` is the single canonical workspace, two-pane (queue + detail), URL-driven via `?case=<caseId>&record=<recordId>`. `/exceptions` and `/exceptions/:path*` permanent-redirect to `/cases`. `ExceptionListPane`, `CaseListPane`, `SavedViewsMenu`, `searchParser` and the `/exceptions` route files are deleted in P4.

**Layout (three-pane at xl, URL-driven):**
- **Top Rail (NavBar):** 56px sticky global navigation. ADR-041 P2 dropped the "Exception Queue" tab; the remaining tabs are Home / Cases / Performance / Settings (consolidated in `src/config/nav-tabs.ts`).
- **Left Pane (Case Queue, 320-360px):** Filter chips iterating `ALLOWED_CASE_SOURCES` (Manual / Automated). Status filter applied client-side. SLA-sorted rows (nearest deadline first); `useSlaTicker` re-evaluates every 60s without a refetch. Rows render `role="option"` inside `role="listbox"` with `aria-selected` + `data-keyboard-nav-id` for `useKeyboardListNav` (ArrowUp/Down / j / k / Home / End). Pin-selection guard: when the active filter or a WS-driven refetch would exclude `selectedCaseId`, the row stays at the top with a "Pinned" badge.
- **Middle Pane (Record List, 280px — xl only):** `RecordListPane` — the attached-records picker (`role="radiogroup"`) lifted out of `CaseDetailPanel` into a dedicated column (ADR-041 P3d-remaining). One row per `ExceptionRecord` attached to the selected case; selecting a row writes `?record=`. Multi-record cases (one PO carrying several coincident exceptions) surface every sibling here.
- **Right Pane (Case Workspace, flex):** When `?case=` is set and `orderCase.case_id === selectedCaseId` (render guard), mounts `CaseDetailPanel` with:
  - Slim case-context strip (when a record is inline-mounted; PR #154) OR full case header card (otherwise) — single source for SLA / status / channel / customer PO.
  - Compliance Hits section (`policyHits` aggregated from `getRecords()`).
  - Inline records picker — the same `RecordListPane`, rendered here as the **below-xl fallback** (`inlineRecordListHiddenAtXl`: `xl:hidden`, so it shows below 1280px where the middle column is collapsed and hides at xl+ where the middle column takes over). Closes the P3e gap — see §9 drift entry D31.
  - Inline `ExceptionDetailPanel` — the per-record HITL surface (HeaderRibbon → ContextStrip → AgentReasoningCard → enrichment sections → EvidenceGrid → DiagnosticsSection). See §5.2.
- **Responsive layout (current):** two-pane CSS grid `lg:grid-cols-[360px_minmax(0,1fr)]` ≥1024px (queue + detail), single column below 1024px. The attached-records picker (`RecordListPane`) is stacked at the top of the detail pane — full width, no truncated labels — rather than a dedicated column; a narrow 3rd column squeezed the record rows and clipped their labels at common laptop widths, so the picker was lifted back onto the detail pane (supersedes the earlier `xl` three-column layout, drift entry D31).

**URL state:** `?case=<caseId>` selects the case; `?record=<recordId>` selects the record. Both writes use `router.replace` with `{ scroll: false }` — selection is an in-place workspace update, not a page navigation; the default App Router scroll-to-top would otherwise yank the viewport away from the row the operator just clicked (see §9 drift entry D32). Back/forward + reload preserve the cursor. Switching cases drops the prior `?record=` so the auto-mount picks the new case's first record.

**Race-fix invariants** (ADR-041 P3c, source-locked in `tests/architectural/cases_workspace_render_guard.test.ts`):
1. The fetch `useEffect` on `[selectedCaseId]` clears `orderCase` / `records` / `policyHits` BEFORE the new `casesApi.get` — eagerly null-out stale prior-case state.
2. The JSX render guard `orderCase.case_id === selectedCaseId` prevents `CaseDetailPanel` from mounting with mismatched data and writing the wrong `?record=` back into the URL via its auto-mount effect.

Two layers because the bug ("many cases don't show detailed view" — see §9 drift register) had two failure modes; both were closed.

**Pin-selection invariant** (ADR-041 P3d): the `cases` useMemo lists `selectedCaseId` in its deps AND produces an `isPinned: true` row when the filter excludes the selection. Source-locked in the same arch-lock file. Visual: `Pinned` badge alongside source / SLA.

**Filter values** sourced from `useHealth()` per Guardrail #2. `STATUS_LABEL` + cluster grouping + `isAwaitingHuman` + `sourceChannelLabel` + `lastActivityLabel` helpers consolidated in `src/lib/cases.ts`.

**Governance:** Human acts as **Review Authority** only — Approve, Reject, Override (managers), Escalate (analysts), Re-analyze (managers) via `AgentReasoningCard`. No "Execute Recipe" or manual execution triggers. Shadow Verdict displayed as read-only badge.

**Data flow:**
```
useCases(filters.source)             // silent-refetch hook, cursor-walks /api/v1/cases
useWebSocket({ onEvent, onReconnect, onPollFallback })
  ↳ isCaseInvalidationEvent → refetch()   // case_* events trigger silent refresh
  ↳ reconnect / poll-fallback → refetch() // Section 8.4 silent recovery

When ?case=<id> changes:
  setOrderCase(null); setRecords([]); setPolicyHits([])   // race-fix clear
  Promise.all([casesApi.get(id), casesApi.getRecords(id)])
    → setOrderCase / setRecords / setPolicyHits
  When orderCase.case_id === selectedCaseId (render guard):
    mount CaseDetailPanel → inline ExceptionDetailPanel for the selected record
```

**`/cases/[id]` (focused single-case view)** survives for notification deep-links + bookmark contexts that prefer a clean case viewport. Mounts the same `CaseDetailPanel`. Two surfaces, two intents: `/cases?case=<id>` = workspace with queue chrome; `/cases/<id>` = focus.


### 5.2 Exception Detail Panel (Right Pane / Full-Page)

**Spec alignment:** Implements AgentReasoningCard (Layer 1/2), WaterfallStepper per Section 11.1, 11.2. Polymorphic — adapts to any exception intent (pricing, credit, duplicate PO).

**Decomposition (Phase 8.8):** The detail panel is decomposed along the **5-layer axis** into focused sub-components:

| Sub-Component | File | Purpose |
|---|---|---|
| `HeaderRibbon` | `src/app/exceptions/HeaderRibbon.tsx` | Breadcrumb context, lifecycle/verdict badges, total value |
| `ContextStrip` | `src/app/exceptions/ContextStrip.tsx` | Entity Profile + Impact Metrics two-column grid (collapsible) |
| `AgentAnalysisSection` | `src/app/exceptions/AgentAnalysisSection.tsx` | Problem / Root Cause / Recommendation narratives |
| `EvidenceGrid` | `src/app/exceptions/EvidenceGrid.tsx` | Collapsible line-item table + pricing waterfall |
| `DiagnosticsSection` | `src/app/exceptions/DiagnosticsSection.tsx` | Pipeline progress + trace evidence tabs (behind toggle) |
| `DuplicateDetectionSection` | `src/app/exceptions/DuplicateDetectionSection.tsx` | Data-presence enrichment: original vs duplicate order comparison |
| `OrderComparisonSection` | `src/app/exceptions/OrderComparisonSection.tsx` | Data-presence enrichment: side-by-side order line-item comparison |
| `PriceHoldSection` | `src/app/exceptions/PriceHoldSection.tsx` | Data-presence enrichment for `PRICE_HOLD_RELEASE`: PO vs SAP base price, signed variance %, tolerance / hard-block thresholds, recipe action (AUTO_RELEASE / ESCALATE / HARD_BLOCK), reason. Renders only when `analysis.price_hold_analysis` is present. |
| `EdiMismatchSection` | `src/app/exceptions/EdiMismatchSection.tsx` | Data-presence enrichment for `EDI_MISMATCH`: `sub_type` (verbatim badge), `expected_value` vs `received_value` cards (any shape), `classification` badge (HARD_REJECT / REVIEW / ESCALATE), recommended action, autonomy level. PRICE_MISMATCH events route to `CONTRACTUAL_CORRECTION` at backend classifier time and never mount this section — see Section 9 (Drift Register). |
| `EntitiesSection` | `src/app/exceptions/EntitiesSection.tsx` | ADR-042 P2 — AI-extracted email/attachment entities (`analysis.entities_analysis`). |
| `SapDataSection` | `src/app/exceptions/SapDataSection.tsx` | ADR-042 P2 — SAP system-of-record context (`analysis.sap_data_analysis`). |
| `OrderEntrySection` | `src/app/exceptions/OrderEntrySection.tsx` | ADR-042 P3 — extracted order form: header, customer (MDM-match), line items, validation flags (`analysis.order_entry_extraction`). |
| `Edi850Section` | `src/app/exceptions/Edi850Section.tsx` | ADR-042 P5 — ANSI X12 5010 EDI 850 viewer with three sub-views (Decoded / Raw X12 + copy / Segment Map), built server-side (`analysis.edi_850_audit`). |
| `ChangeAnalysisSection` | `src/app/exceptions/ChangeAnalysisSection.tsx` | ADR-042 P6 — order-change evaluation: Layer-1 decision panel + lifecycle bar + from→to change grid + variable-cardinality constraint cards (PASS/CONDITIONAL/WARNING) + scenario cards (`analysis.change_analysis`). |
| `KnowledgeGraphSection` | `src/app/exceptions/KnowledgeGraphSection.tsx` | ADR-042 P7 — derived entity graph: deterministic radial SVG + accessible relationships list (`analysis.knowledge_graph`). |
| `DraftReplySection` | `src/app/exceptions/DraftReplySection.tsx` | ADR-042 P7 — AI reply-draft evidence: recipient/subject/body/edits for a DRAFTED reply, reason for REJECTED (`analysis.draft_reply`). |
| `shared` | `src/app/exceptions/shared.tsx` | CollapsibleHeader, CollapsibleSection (+ `Layer2OpenContext` — DoR #11 Layer-2-open telemetry signal), fmtPrice helpers |

The orchestrator (`ExceptionDetailPanel.tsx`, ~357 lines) composes these sub-components. Each sub-component is **intent-agnostic** — driven by data, not intent strings.

**Structure (5 layers + enrichment):**
1. **Dynamic Header Ribbon** — breadcrumb context: Reference ID > Customer Name > Location > Primary SKU or "N Lines Affected". Lifecycle badge + Shadow Verdict (read-only) + total value.
2. **Context Strip** (two-column) — Entity Profile (customer, BP number, tier, VIP, credit standing, location) | Impact Metrics (revenue at risk, delta amount/%, SLA priority/deadline, affected lines).
3. **Agent Analysis** — "The Problem" (diagnosis narrative), "Root Cause" (deterministic cause), "Recommendation" (one-line action). Followed by AgentReasoningCard with Layer 1/2 and Approve/Reject/Escalate actions. **Plus** data-presence-driven enrichment sections (DuplicateDetection, OrderComparison).
4. **Evidence Grid** — collapsed by default to reduce cognitive load. Expandable: line-item table (Line, SKU, Description, Qty, ERP, PO, Root Cause), line selector pills, PricingWaterfall for selected line.
5. **Supporting Context** — Pipeline progress (WaterfallStepper), Trace Evidence tabs (Evidence | SAP Data | Change Analysis), Resolution data (JSON).

**Types driving polymorphism:**
- `EntityProfile` — customer master data (name, BP, tier, VIP, credit standing, location, region)
- `ImpactMetrics` — blast radius (revenue at risk, delta, SLA priority, affected lines)
- `OrderAnalysis` extended with `root_cause`, `recommendation`, `entity_profile`, `impact_metrics`
- `DuplicateDetectionData` — original/duplicate order snapshots, detection method, confidence, recommended action, autonomy level
- `OrderComparisonData` — side-by-side orders with matching/differing field indicators and line-item comparison
- `PriceAnalysisData` — ERP vs PO price, variance, at-risk value, SAP doc context, rule_id, condition refs
- `BackOrderAnalysisData` — gap qty/%, ATP date, alternate warehouses, substitutes, ranked resolution options
- `OverMaxAnalysisData` — exceedance %, per-line trim plan (TRIM / SKIP / OK)
- `MOQAnalysisData` — shortfall %, round-up plan (ROUND_UP / ACCEPT_BELOW / ESCALATE), SAP execution steps
- `PalletAnalysisData` — per-line fill %, loose cases, suggested plan (round-down / accept-as-is)
- `DeliveryDelayAnalysisData` — planned vs projected ETA, days-late, delay category, ranked alternate options
- `PriceHoldAnalysisData` — PO vs SAP base price, signed variance, tolerance / hard-block thresholds, action
- `EdiMismatchAnalysisData` — sub_type (verbatim), expected vs received values, classification, autonomy level

**Intent-specific rendering: data-presence pattern (not component dispatch).**

The detail panel is polymorphic via data, not via intent-string dispatch. Different intents produce different optional fields in `OrderAnalysis` and `resolution_data`. The UI renders sections based on **whether the data is present**, not on which intent string the exception carries:

```tsx
// CORRECT: data-presence-driven sections
{analysis?.duplicate_detection && <DuplicateDetectionSection data={analysis.duplicate_detection} />}
{analysis?.order_comparison && <OrderComparisonSection data={analysis.order_comparison} />}
{analysis?.price_hold_analysis && <PriceHoldSection data={analysis.price_hold_analysis} />}
{analysis?.edi_mismatch_analysis && <EdiMismatchSection data={analysis.edi_mismatch_analysis} />}
```

This preserves Guardrail #2: a new intent added in `asoe2` that populates `duplicate_detection` automatically gets the section rendered — zero UI code changes. A new intent with no specialized data gets the full generic 5-layer layout.

**Forbidden:** Dispatching to intent-named components via switch/map on the intent string (e.g., `switch (intent) { case 'DUPLICATE_PO': ... }`). This would couple the UI to the intent vocabulary and fail the Guardrail #2 zero-change test. See `prompts/exception_queue_duplicate_po.md` for full rationale.

**WebSocket integration:** The page orchestrator connects via `useWebSocket` and routes events to the detail panel. `pipeline_progress`, `exception_update`, and `task_complete` events trigger data refresh for the currently viewed exception.

### 5.3 Dashboard (`/dashboard`) — Layout B

**Spec alignment:** Implements Layout B (2-column grid) per Section 11.5. All KPIs from Section 11.6.

**Enrichments beyond spec:**
- **Breadcrumb navigation** (Home > Dashboard)
- **Recent Activity feed** — full-width timeline card showing last 6 exception state changes (timestamp, order ID, action, status badge)

**Spec KPIs (Section 11.6) vs implementation:**

| KPI | Spec | Implemented | Status |
|---|---|---|---|
| Resolution rate | `COMPLETE` + `COMPLETE_WITH_CHILDREN` / total | Auto-resolved % | PARTIAL (see Section 10) |
| Avg time-to-resolution | p50, p95 by intent | Single avg value | PARTIAL |
| Auto-resolved % | By intent, by tenant | Global only | PARTIAL |
| HITL intervention rate | By intent, by shadow_verdict | Global % | PARTIAL |
| Dollar value recovered | Sum by intent, by tenant, by period | Not yet | PENDING |
| FAIL_TO_HUMAN rate | By intent | Not yet | PENDING |

**Note:** The spec's KPI breakdown dimensions (by intent, by tenant, by period) require the `StatsResponse` to be significantly richer than the current backend schema. See Section 10.

### 5.4 Customer Inbox (`/inbox`) — INTENTIONAL DRIFT

**This page is NOT in `consol_arch.md` Section 11.5.** It is an intentional addition representing the AI-powered email triage and classification surface — a natural extension of the ASOE control tower for inbound customer communications.

**Layout:** Two-pane (380px inbox queue + detail panel)

**Features:**
- **Inbox queue:** Searchable list with sender avatar, subject, preview, category badge, status badge
- **Email header card:** Sender info, metadata, source mailbox
- **Agent Analysis card:** Confidence bar, summary, recommendation, action buttons (Approve/Override/Escalate) — follows Layer 1 pattern
- **Detail tabs:** Email, Entities, SAP Data, Change Analysis, Knowledge Graph

**Current state:** Mock data, uses shared component library (NavBar, Badge, MetricTile, Button). Category and status values rendered via `categoryVariant()` / `inboxStatusVariant()` mapping functions with default fallback (Guardrail #2 pattern).

**Recommended consol_arch.md update:**
- Add Customer Inbox to Section 11.5 Key Pages table
- Define inbox data model and API endpoints (see Section 10)
- Specify how inbox items relate to exceptions (are they a source that creates exceptions, or a parallel concept?)

### 5.5 Login (`/login`)

**Spec alignment:** Implements centered card with SSO + email/password per Section 9.1. Multi-step: email → password → SSO redirect. Agent activity footer shows system is alive.

**Alignment status:** ALIGNED.

### 5.6 Settings / Admin (`/settings`)

**Spec alignment:** Referenced in Section 11.5. Implementation pending (Phase 9).

**Scope from spec:** User management (admin-only), SSO config, policy overrides (`PUT /api/v1/policies/{tenant_id}`), agent settings (kill switch, explain mode), RBAC enforcement.

---

## 6. API Contract (UI Surface)

**Source:** `consol_arch.md` Section 6

### REST Endpoints Used by UI

| API Method | Spec Endpoint | Auth | Implementation | Status |
|---|---|---|---|---|
| `authApi.login()` | `POST /api/auth/login` | public | Mock | ALIGNED |
| `authApi.mfaVerify()` | `POST /api/auth/mfa/verify` | public | Mock | ALIGNED |
| `authApi.ssoInit()` | `POST /api/auth/sso/init` | public | Mock | ALIGNED |
| `authApi.me()` | `GET /api/auth/me` | any | Mock | ALIGNED |
| `authApi.refresh()` | `POST /api/auth/refresh` | public | Mock | ALIGNED |
| `healthApi.get()` | `GET /api/v1/health` | public | Mock | ALIGNED |
| `exceptionsApi.list()` | `GET /api/v1/exceptions` | analyst+ | Mock | ALIGNED |
| `exceptionsApi.get()` | `GET /api/v1/exceptions/{id}` | analyst+ | Mock | ALIGNED |
| `exceptionsApi.resolve()` | `POST /api/v1/exceptions/resolve` | analyst+ | Mock | ALIGNED |
| `exceptionsApi.resolveAsync()` | `POST /api/v1/exceptions/resolve/async` | analyst+ | Mock | ALIGNED |
| `exceptionsApi.explain()` | `POST /api/v1/exceptions/resolve/explain` | analyst+ | Mock | ALIGNED |
| `exceptionsApi.disposition()` | `PATCH /api/v1/exceptions/{id}/disposition` | analyst+ / manager+ (sub_type-dependent) | Mock | ALIGNED (Phase 3 consolidation — replaces override/approve/reject) |
| `exceptionsApi.escalate()` | `POST /api/v1/exceptions/{id}/escalate` | `exceptions:escalate` | Mock | ALIGNED |
| `exceptionsApi.cosign()` | `POST /api/v1/exceptions/{id}/cosign` | manager+ (non-initiator) | Mock | ALIGNED (four-eyes) |
| `exceptionsApi.reanalyze()` | `POST /api/v1/exceptions/{id}/reanalyze` | manager+ | Mock | ALIGNED |
| `exceptionsApi.trace()` | `GET /api/v1/exceptions/{id}/trace` | analyst+ | Mock | ALIGNED |
| `exceptionsApi.stats()` | `GET /api/v1/exceptions/stats` | analyst+ | Mock | ALIGNED |
| `exceptionsApi.lineItems()` | `GET /api/v1/exceptions/{id}/line-items` | analyst+ | Mock | ALIGNED |
| `exceptionsApi.orderAnalysis()` | `GET /api/v1/exceptions/{id}/analysis` | analyst+ | Mock | ALIGNED |

### Error Envelope (from spec)

```json
{
  "error": {
    "code": "SHADOW_BLOCKED",
    "message": "Compliance Shadow returned RED — execution halted by policy.",
    "trace_id": "uuid",
    "details": { "shadow_verdict": "RED", "policy_hits": ["PENALTY_MATRIX_VIOLATION"] }
  }
}
```

Environment-aware: JWT `env` claim mismatch returns generic 403 with no `details` field.

### Pagination (from spec)

Cursor-based on all list endpoints: `{ data: [...], cursor: "...", has_more: true }`.

### Type Contract Drift

All type contract drift items resolved during architecture alignment (2026-04-11):

| UI Type | Backend Type | Status |
|---|---|---|
| `StatsResponse` | `StatsResponse` (schemas.py) | **ALIGNED** — fields renamed and added in backend (T1-T5) |
| `TerminalStatus` | `TerminalStatus` (models.py) | **ALIGNED** — `COMPLETE_WITH_CHILDREN` added to backend (T6) |
| `OverrideRequest.notes` | `Optional[str]` in backend | **ALIGNED** — UI updated to optional (T7) |
| `ExceptionUpdatePayload.updated_fields` | `List[str]` in backend | **ALIGNED** — UI updated to `string[]` (T8) |
| `TaskCompletePayload.explanation` | `Optional[str]` in backend | **ALIGNED** — UI updated to optional (T9) |
| `LineItem` | `LineItem` (schemas.py) | **ALIGNED** — Pydantic model added to backend (D3) |
| `PricingWaterfallStep` | `PricingWaterfallStep` (schemas.py) | **ALIGNED** — Pydantic model added to backend (D4) |
| `OrderAnalysis` / `AnalysisResponse` | `AnalysisResponse` (schemas.py) | **ALIGNED** — Pydantic model added to backend (D4) |

**Alignment status:** FULLY ALIGNED. All 21 endpoints aligned. All type contracts aligned.

---

## 7. WebSocket Protocol

**Source:** `consol_arch.md` Section 8

### Connection Lifecycle

1. Client opens `ws://host/api/v1/ws`
2. Client sends auth: `{ type: "auth", token: "eyJ...", last_seen: "ISO8601" }`
3. Server subscribes to Redis `asoe:ws:{tenant_id}`
4. Server forwards events to client
5. On disconnect: unsubscribe

**Implementation:** `src/hooks/useWebSocket.ts`

### Event Envelope

```typescript
interface WSEvent {
  type: "pipeline_progress" | "exception_update" | "task_complete" | "error";
  trace_id: string;
  exception_id: string;
  tenant_id: string;
  timestamp: string;
  payload: PipelineProgressPayload | ExceptionUpdatePayload | TaskCompletePayload;
}
```

### Resilience

| Mechanism | Spec | Implementation | Status |
|---|---|---|---|
| Reconnection | Exponential backoff (1s → 30s max) | `useWebSocket` with backoff | ALIGNED |
| Event replay | `last_seen_timestamp` on reconnect, 60-sec Redis buffer | Sends `last_seen` in auth message | ALIGNED |
| Fallback | Poll `GET /api/v1/exceptions/{id}` every 3s | After `POLL_FALLBACK_THRESHOLD = 5` consecutive failed reconnects, the hook switches to interval polling and emits `onPollFallback`. `onReconnect` fires when the WS comes back. Required because Container Apps closes idle WS at 4 minutes. | **ALIGNED** (resolves D19) |
| Auth | First message `{type:"auth", token}` per Section 8 | Uses real backend access token from session storage (was `'mock-ws-token'` placeholder pre-2026-05-01) | ALIGNED |

### Type Drift in Payloads

| Payload | Spec Type | UI Type | Drift |
|---|---|---|---|
| `ExceptionUpdatePayload.updated_fields` | `List[str]` | `Record<string, unknown>` | UI type wrong — should be `string[]` |
| `TaskCompletePayload.explanation` | `Optional[str]` | `string` (required) | UI should mark optional |

**Alignment status:** ALIGNED on protocol. Minor type drift in two payload fields.

---

## 8. Auth, RBAC & Security

**Source:** `consol_arch.md` Section 9

### Authentication Flows

| Flow | Spec | Implementation | Status |
|---|---|---|---|
| SSO (primary) | SAML 2.0 / OIDC via Okta, Azure AD, Ping | SSO domain detection + redirect | ALIGNED (mock) |
| Email/password (admin fallback) | Admin-only, MFA mandatory | Multi-step form, MFA flow | ALIGNED (mock) |
| MFA verification | TOTP code → JWT with `auth_method: "password+mfa"` | `authApi.mfaVerify()` | ALIGNED (mock) |
| Token storage | httpOnly cookies (never client JS) | NextAuth default | ALIGNED |
| Session strategy | JWT, 7-day expiry | NextAuth JWT strategy | ALIGNED |
| Route protection | Middleware checks JWT on every navigation | `src/middleware.ts` | ALIGNED |

### RBAC (from spec Section 9.2)

| Role | Permissions | UI Enforcement |
|---|---|---|
| `analyst` | `exceptions:read`, `exceptions:approve`, `exceptions:escalate`, `dashboard:read` | View queue, approve/reject, escalate |
| `manager` | analyst + `exceptions:override`, `rules:write` | Override… (override chooser), cosign, bulk actions |
| `admin` | manager + `users:manage`, `policy:write`, `audit:read` | User mgmt, settings, override + cosign |
| `viewer` | `exceptions:read`, `dashboard:read` | View only — no action buttons |
| `partner` | `exceptions:read` (scoped to own orders) | Scoped view within tenant |

**Implementation:** `src/lib/roles.ts` — `ROLE_PERMISSIONS` mapping matches `asoe2/api/deps.py::_ROLE_PERMISSIONS` exactly (verified in pre-session audit).

### Verdict-Action RBAC Matrix (Option A — Phase 3)

| Verdict | analyst | manager | admin | viewer |
|---|---|---|---|---|
| GREEN | View Details | View Details, **Override…** | View Details, **Override…** | View Details |
| YELLOW | Approve, Reject, Escalate | Approve, Reject, **Override…**, Escalate | Approve, Reject, **Override…**, Escalate | None |
| RED | Escalate | **Override…**, Escalate | **Override…**, Escalate | None |
| FAILED | Escalate for Triage | Escalate for Triage | Escalate for Triage | None |
| PENDING_COSIGN | (awaiting-cosign banner, read-only) | Approve cosign / Reject cosign (if non-initiator) | Approve cosign / Reject cosign (if non-initiator) | None |

**Option A rationale:** analysts clear YELLOW in one click with the primary Approve/Reject verbs. Managers get the `Override…` affordance (override chooser) where they have `exceptions:override`. The prior `Acknowledge` verb was removed — it was calling Approve silently and hid the semantic choice. See Section 9 drift entry D12.

### Multi-Tenancy

- JWT `org` claim → `tenant_id` (application layer)
- PostgreSQL RLS on `exceptions`, `traces`, `policy_overrides`, `checkpoints` (database layer)
- Redis channels scoped: `asoe:ws:{tenant_id}`
- Partner role: additional RLS restricting to own orders

### trace_id Propagation

UI sends `X-Trace-ID` header on API calls. The trace_id flows through: `OrderEvent.metadata` → `GraphState.shadow.trace_id` → `ExecutionLog.trace_id` → `TraceRecord.trace_id` → `WSEvent.trace_id`.

**Alignment status:** ALIGNED. RBAC permissions match backend exactly.

---

## 9. Alignment & Drift Register

Summary of all alignments and drifts between `consol_arch.md` and the actual `asoe-ui` implementation.

### ALIGNED (no action needed)

| Area | Spec Reference | Notes |
|---|---|---|
| Design paradigm (agent-first, two-layer) | Section 11.1 | Fully implemented |
| Verdict-specific UI states | Section 11.1 | GREEN/YELLOW/RED behavior matches |
| 14 custom components | Section 11.2 | All 14 built and operational (updated from 12 during alignment) |
| Design tokens (149 tokens, 45+ minimum) | Section 11.3 | Exceeds spec |
| Brand restraint (purple in 3 places only) | Section 11.3 | Enforced |
| WCAG 2.1 AA (icon + text on all status) | Section 11.3 | Enforced |
| Tech stack (Next.js 16, React 19, Tailwind) | Section 11.4 | Exact match |
| All 21 REST endpoints | Section 6.2 | All mock-implemented (approve/reject, line-items, analysis added to spec) |
| WebSocket protocol + reconnection | Section 8 | Implemented in useWebSocket |
| RBAC roles + permissions | Section 9.2 | Exact match with asoe2 |
| Auth flows (SSO + password + MFA) | Section 9.1 | Mock-implemented |
| Multi-tenancy model | Section 9.3 | JWT org claim + scoped queries |
| trace_id propagation | Section 9.4 | X-Trace-ID header support |
| Customer Inbox page (D1) | Section 11.5 | Incorporated into consol_arch.md during alignment |
| PricingWaterfall component (D2) | Section 11.2 | Incorporated into consol_arch.md during alignment |
| Line-item API (D3) | Section 6.2 | Endpoint added to spec + backend implementation |
| Order analysis API (D4) | Section 6.2 | Endpoint added to spec + backend implementation |
| Expandable order rows → Outlook layout (D5) | Section 11.5 | Evolved: Layout A → three-pane Outlook master-detail. consol_arch.md updated. |
| Badge variant mappers (D6) | Section 11.2 | 5 mappers documented in consol_arch.md |
| Component count (D7) | Section 11.2 | Updated to 14 in consol_arch.md |
| StatsResponse fields (T1-T5) | Section 6.2 | Backend renamed + UI fields added |
| TerminalStatus COMPLETE_WITH_CHILDREN (T6) | Section 1 V1 Scope | Added to backend enum |
| OverrideRequest.notes optional (T7) | Section 6.2 | UI updated to optional |
| ExceptionUpdatePayload.updated_fields (T8) | Section 8 | UI updated to `string[]` |
| TaskCompletePayload.explanation optional (T9) | Section 8 | UI updated to optional |
| CaseListPane V5.1.1 (Phase 28.5.x §D1-D8) | `asoe2/docs/workshops/2026-05-11-case-list-pane-decisions.md` | Single PR delivery (operator-chosen split). Filter chips sourced from `useHealth().allowed_case_statuses` + cluster grouping in `src/lib/cases.ts`. `role="listbox"`/`role="option"` swap on rows; one Playwright selector update locked in the same PR. v2 saved-views with `surface` discriminator + idempotent v1→v2 migration. vitest-axe scaffolding added (4 a11y locks); zero-coverage gap from the §D5 audit is closed. `STATUS_LABEL` consolidated from four duplicate maps + two hardcoded `OPEN_AWAITING_HUMAN` comparisons retired (§D1 Guardrail #1 corrections from the lens audit). |

### INTENTIONAL DRIFT (UI enrichment — needs spec update)

_D1-D7 resolved during architecture alignment (2026-04-11)._

| ID | Area | Description | Status |
|---|---|---|---|
| D8 | Exception Queue layout | Evolved from Layout A (queue + sidebar) to three-pane Outlook master-detail with resizable panels (`react-resizable-panels`). Sidebar component available but not used. | **RESOLVED** — consol_arch.md Section 11.5 updated (2026-04-12) |
| D9 | Polymorphic detail view | ExceptionDetailPanel adapts per intent via EntityProfile + ImpactMetrics. Dynamic header ribbon, context strip, Problem/Root Cause/Recommendation narrative. | **RESOLVED** — consol_arch.md Section 11.5 updated (2026-04-12) |
| D10 | Governance: Review Authority model | Removed "Execute Recipe" button. Human acts as Review Authority only (Approve/Reject/Escalate). Shadow Verdict displayed as read-only badge. Execution triggered by backend on approval. | **RESOLVED** — consol_arch.md Section 11.5 updated, AUDITOR_GUIDE updated (2026-04-12) |
| D11 | Intent-specific detail rendering | Adopted **data-presence pattern** over intent-dispatch pattern. The detail panel renders optional sections based on data fields present in `OrderAnalysis` (e.g., `duplicate_detection`, `pricing_waterfall`), not by branching on the intent string. This preserves Guardrail #2 and the polymorphic data-driven architecture. Full rationale in `prompts/exception_queue_duplicate_po.md`. | **RESOLVED** — architectural decision documented (2026-04-15) |
| D12 | Override action verb — rename and revert | Phase 1/2 shipped the button as `Override…`. Phase 3 briefly renamed it to `Decide…` after voice-of-user research found "override" carried negative connotation for analysts. Phase 4 **reverted** to `Override…` after the UX panel reconvened and noted (a) the button is only visible to manager+ with `exceptions:override` — analysts never saw it, so the original research population didn't match the audience; (b) SOX §404 names this control "management override of controls," and the backend sub_type + audit event already use that word; (c) the red/destructive button variant reads as congruent with "Override" and mixed with "Decide." Net effect: visible label is `Override…`; aria-label and hover tooltip remain the long-form "Choose different action" for screen-reader and mouse-over parity. One vocabulary end-to-end (button → permission → API sub_type → audit row). | **RESOLVED** — visible label `Override…` restored (2026-04-18) |
| D13 | Disposition endpoint consolidation | `PATCH /override` + `POST /approve` + `POST /reject` collapsed into a single `PATCH /disposition` with a server-derived `sub_type` (APPROVE / REJECT / OVERRIDE). Client methods `exceptionsApi.override/approve/reject` deleted in Phase 3 — every disposition flows through `exceptionsApi.disposition(id, { action, notes, reason_tag })`. Mirrors asoe2 Phase 19 backend consolidation. | **RESOLVED** — documented in Section 6 + Section 12 (2026-04-18) |
| D14 | Four-eyes cosign UI | New `PENDING_COSIGN` lifecycle state and cosign banner on the exception detail view. Mirrors asoe2 Phase 20 hash-chained audit + four-eyes staging. `LifecycleState` union dropped `EXECUTING`, added `PENDING_COSIGN`. | **RESOLVED** — documented in Section 12 (2026-04-18) |
| D15 | OM coverage expansion: PRICE_HOLD_RELEASE + EDI_MISMATCH | Two new asoe2 intents added (asoe2 ADR-024). UI follows the data-presence pattern (D11) with two new sections: `PriceHoldSection` (renders when `analysis.price_hold_analysis` is present) and `EdiMismatchSection` (renders when `analysis.edi_mismatch_analysis` is present). The PRICE_MISMATCH backend classifier-fork is honoured in the UI by data presence: routed-to-pricing events carry `analysis.price_analysis` (not `edi_mismatch_analysis`), so they render `PriceAnalysisSection` and never mount `EdiMismatchSection`. A non-double-render contract test in `tests/e2e/edi_mismatch_data_flow.test.tsx` blocks UI regressions. | **RESOLVED** — documented in DESIGN Section 2 + Section 5.2 (2026-04-21) |
| D16 | ERP-vendor display labels | New `src/config/erp-label-map.ts` + `src/hooks/useErpProfile.ts` resolve canonical intent / EDI sub_type codes to vendor-specific display strings (SAP / Oracle / Salesforce / GENERIC). Active vendor sourced from `NEXT_PUBLIC_ASOE_ERP_VENDOR` (default `SAP`, committed in `next.config.mjs`). Display-only — control flow still keys on canonical codes; Guardrail #1 preserved. Wired in dashboard stats, exception list filter + row badge, AgentReasoningCard. Two-tier fallback (vendor → GENERIC → title-cased code) so the UI never renders a raw machine string. | **RESOLVED** — documented in DESIGN Section 8.1 (2026-04-21) |
| D17 | Per-intent override reason_tag vocabularies match between mock and real backend | Cross-repo review H4 flagged a suspected drift: mock `/api/v1/health.allowed_override_reason_tags_by_intent` was thought to carry non-trivial per-intent curation while the real backend seeded every intent with the global list. Verification (2026-04-22) shows both sides seed every intent with `_GLOBAL_REASON_TAGS` (asoe2 `constraints/specs.py:112-114` + asoe-ui `src/lib/api.ts:600-604`). The chooser dialog behaves identically in demo and real modes. Real per-intent curation is blocked on asoe2 Phase 5 ("Deferred — curated per-intent reason_tag vocabularies") and review item L4; when it lands the mock must sync. | **RESOLVED** — no active drift; follow-up tracked in asoe2 Phase 5 (2026-04-22) |
| D18 | `OrderAnalysis` enrichment fields — adapter-by-adapter backend backing | Cross-repo review L2 / H5 flagged enrichment sections rendering from mock-only fields; the real backend `AnalysisResponse` originally carried only `diagnosis / confidence / risk / resolution / lines[]`. The Verdict workshop (2026-04-22) prescribed a three-pillar fix; all three landed: (1) `GraphState.enrichment_context` persisted (Pillar 1, V004 dedicated JSONB column, in-memory bridge retired); (2) `build_analysis` graph node enforces the `compliance/audit_bearing_registry.yaml` and emits `TerminalStatus.AUDIT_CONTEXT_MISSING` with structured trace fields when coverage fails (Pillar 2); (3) `EvidenceBlock` UI primitive enforces structural omission OR "Context Not Required for Resolution" instead of dashes (Pillar 3). **Backend-backed (10 of 10):** `price_hold_analysis`, `edi_mismatch_analysis`, `delivery_delay_analysis`, `overmax_analysis`, `moq_analysis`, `pallet_analysis`, `duplicate_detection`, `order_comparison`, `backorder_analysis`, `price_analysis`. **All grandfather clauses retired** (Verdict full-close engagement, 2026-04-22): `price_analysis_gateway_gap` (T4), `delivery_delay_financial_gap` / `overmax_gateway_gap` / `moq_gateway_gap` (T5). Gateway READS for previously-grandfathered fields land via SAP doc / contract / block-status / customer-master / promotion / SLA contract gateways (registered as StubGateways in tests; real SAP integration is a separate platform track). Architectural follow-up: gateway READS run only after shadow_audit GREEN, so OVER_MAX / MIN_ORDER_QTY / DELIVERY_DELAY / BACK_ORDER on RED/YELLOW shadow currently route to AUDIT_CONTEXT_MISSING — moving READS before shadow is tracked separately. | **SHIPPED 10/10** — all enrichment sections backend-backed; all grandfather clauses retired (2026-04-22) |
| D19 | WebSocket polling fallback (Section 8.4 — was PENDING) | The Section 8.4 spec required a 3-second poll on `/api/v1/exceptions/{id}` when the WS connection fails repeatedly. Pre-2026-05-01 this was unimplemented (Container Apps closes idle WS at 4 minutes; long YELLOW reviews showed stale detail panels). `useWebSocket` now switches to interval polling after `POLL_FALLBACK_THRESHOLD = 5` consecutive failed reconnects, emits `onPollFallback` so consumers can adjust their refresh strategy, and emits `onReconnect` when the WS comes back. Detail panel reconciles with a silent refresh on either event. | **RESOLVED** — Section 8.4 ALIGNED, polling fallback shipped (2026-05-01) |
| D20 | Confidence pill — fabricated 80 sentinel retired | Pre-2026-05-01 the deployed UI showed every record's `Agent Analysis → Confidence` at 80%, regardless of the real classifier output. Root cause was an asoe2 read-path hardcode (`confidence = 80 if intent_selected else 0`) and a UI synthesis on the pipeline classify-row. Both are retired: asoe2 persists `state.confidence` into `trace_data["intent_confidence"]` at every `/resolve` and `/reanalyze` write site and reads it back scaled (`max(0, min(100, round(raw * 100)))`); `buildNodeData` in `src/app/exceptions/shared.tsx` projects `analysis.confidence / 100` instead of synthesising. Per-node `duration_ms = Math.random()` synthesis also removed (Verdict 2026-04-22 / Guardrail #6 — UI never fabricates values the backend doesn't emit). Regression locked by `tests/test_analysis_confidence_persistence.py` (asoe2). | **RESOLVED** — confidence sourced from real classifier value end-to-end (2026-05-01) |
| D21 | FAILED-state render — pipeline failure banner replaces "Shadow has not yet completed" | Pre-2026-05-01 a record with `lifecycle_state = "FAILED"` rendered the same Layer-1 copy as a record where shadow_audit hadn't yet run ("Shadow has not yet completed"). This conflated two different states and produced misleading guidance for SMK-CB-001 (cross-check disagreement halt at classify rendered as a shadow-pending record). `ExceptionDetailPanel` now adds an `executionError` render branch between verdict-present and shadow-pending fallback, showing "Pipeline failed at <node>" with the trace explanation and timestamp. `AgentReasoningCard` consumes `executionError !== undefined` to drive the FAILED banner; distinct from RED verdict (compliance decision). The pipeline-view question "should the WaterfallStepper show the actual halt node, not always apply_effects?" is the larger architectural follow-up tracked by ADR-027 (Proposed). | **RESOLVED** in detail-panel render path; topology-view fix follows ADR-027 (2026-05-01) |
| D22 | Pane defaults + duplicate "Agent Analysis" labels (Phase 8.13) | Two issues, one fix. (a) The detail pane originally rendered every section flat — Entity Profile, Agent Analysis prose, AgentReasoningCard, all enrichment sections — overwhelming the operator scanning the queue. (b) Both the action card and the prose pane carried the heading "Agent Analysis", with no disambiguator. PO request #4 prescribed: minimise everything except the Recommendation; auto-expand the Agent Analysis prose only when human action is expected. Implemented as: Context Strip + Agent Analysis + Evidence Grid + Diagnostics collapsed by default; enrichment sections wrapped in `CollapsibleSection` (always collapsed — operator drills in on demand); Agent Analysis prose auto-expands when `lifecycle_state ∈ HUMAN_IN_THE_LOOP_STATES = { PENDING_REVIEW, ESCALATED, PENDING_ADMIN_REVIEW, PENDING_COSIGN, BLOCKED }`. The action card heading was renamed `Agent Analysis → Agent Recommendation` (matches PO's existing vocabulary from request #4 — "the Recommendation card stays action-focused"); the prose pane keeps "Agent Analysis". A new `expandSection(page, /title/i)` helper in `tests/browser/_helpers.ts` updates the eight Playwright specs that assert text inside an enrichment section. | **RESOLVED** — Phase 8.13 (2026-05-03) |
| D23 | Outlook-style affordances on the queue (Phase 8.13) | Three operator-experience gaps the PO flagged on the Azure deployment: (a) list sorted by insertion order rather than recency, so a fresh batch of FAILED records dominated the top; (b) no keyboard navigation through the list; (c) the lifecycle badge and shadow-verdict badge in `HeaderRibbon` were unlabelled colored pills, asking operators to memorise which colour mapped to which fact. Fixes: list sorted by `updated_at desc, created_at desc` in `page.tsx` (stays stable across silent WS refreshes); document-level keyboard handler for `ArrowUp/Down`, `j/k`, `Home`, `End` with focus-follow for `:focus-visible` parity; `HeaderRibbon` prefixes the badges with `Current State:` and `Audit Result:` labels. The list-card surface drops the verdict pill (density), preserved on the detail surface under the explicit `Audit Result:` label so the partial-truth guard holds. | **RESOLVED** — Phase 8.13 (2026-05-03) |
| D24 | Self-override allowance (Phase 8.13 — paired with asoe2 ADR/policy change) | Pre-2026-05-03 the asoe2 backend rejected a second `/disposition` from the same user who previously resolved a record (`SOD_VIOLATION`). Operators reported legitimate "I made a mistake on my earlier override and need to correct it" cases were forced into escalation churn. PO ruling 2026-05-03 relaxed the SoD self-block. Backend: `routes/exceptions.py` removes the self-block; reanalysis_history still records every initiator/timestamp/reason_tag for SOX evidence; `test_override_escalate.TestSegregationOfDuties` flipped to assert the new behaviour. UI: the `tests/browser/override-and-sod.spec.ts` Playwright spec now asserts a successful self-re-override with **no `Segregation of duties` toast** (regression guard). The four-eyes cosign rule on high-value overrides (`POLICY_FOUR_EYES_THRESHOLD` → `PENDING_COSIGN` → distinct cosigner) remains the SOX §404 control of record. | **RESOLVED** — Phase 8.13 / asoe2 paired PR (2026-05-03) |
| D25 | Mock-data drift from backend S15a invariant — "many cases don't show detailed view" preview-mode bug (ADR-041 P-fix / PR #155) | The asoe2 backend's S15a invariant (`api/case_resolver.py::should_materialise() -> True`) guarantees every record has a parent case. The asoe-ui mock layer didn't mirror that: no `MOCK_EXCEPTIONS` entry had `parent_case_id` set, so `casesApi.getRecords(case_id).items` was always empty in mock mode. The /cases/[id] page rendered only the case header — picker had no rows, inline `ExceptionDetailPanel` never mounted, no Approve / Reject / Override / Escalate ribbon. Live-backend e2e specs (running against asoe2 sandbox) hid the gap because the sandbox materialises cases on demand. Fix: PR #155 added the forEach mutation that sets `parent_case_id = case-for-${id}` on every mock exception + replaced the three hand-crafted MOCK_CASES with `MOCK_EXCEPTIONS.map(caseFromMockException)` (every case is derived 1:1 so getRecords is always non-empty). Architectural lock at `tests/architectural/case_pivot_mock_wiring.test.ts` asserts the invariants (every exception has parent_case_id, every case has ≥1 record, every case has `case_type ∈ {EMAIL_ENTRY, BLOCK}`). The systemic gap the bug surfaced — "mock-data drift from backend invariants is invisible to CI because tests bias toward live-backend mode" — drove the test-strategy doc work (see `docs/test-strategy/README.md` Gap 3). | **RESOLVED** — mock wiring closed + arch lock locked + test-strategy gate codified (2026-05-13) |
| D26 | `/cases` workspace case-switch race — "many cases don't show detailed view" (ADR-041 P3c / PR #158) | Clicking case A then case B in the `/cases` queue could leave the URL at `/cases?case=B&record=<record-belonging-to-A>` — wrong record id from a stale auto-mount. The right pane rendered the attached-records picker but never the action ribbon, because `selectedRecordId` referenced a record that didn't exist on the new case. Cause: a render slipped through between "URL changed" and "new fetch landed" where `CaseDetailPanel` saw the prior case's records still in state and its auto-mount effect fired `onSelectRecord(records[0].id)` with the wrong id. Fix in two layers: (1) the parent fetch `useEffect` clears `orderCase` / `records` / `policyHits` BEFORE the new `casesApi.get`; (2) JSX renders `CaseDetailPanel` only when `orderCase.case_id === selectedCaseId` — so even if state hasn't been cleared between renders, the panel can't mount with mismatched data. Source-locked at `tests/architectural/cases_workspace_render_guard.test.ts`; behavioural lock at `tests/browser/cases-workspace-case-switch.spec.ts` drives two queue clicks in sequence and verifies the URL's `?record=` always belongs to the URL's `?case=`. The systemic gap the bug surfaced — "no multi-step operator-journey browser e2e tests; all specs deeplink to a single record" — drove the test-strategy doc work (see `docs/test-strategy/README.md` Gaps 1 + 2). | **RESOLVED** — race closed + two-layer source lock + multi-step e2e lock (2026-05-13) |
| D27 | `/exceptions` queue route retired — `/cases` is the single canonical workspace (ADR-041 P2/P3/P4) | Pre-ADR-041 the UI had two queue surfaces projecting the same case data: `/exceptions` (with `CaseListPane`) and `/cases` (simple list). The architect panel called this "paying rent on a synonym". P2 added a `next.config.mjs` redirect + dropped the "Exception Queue" NavBar tab; P3 promoted `/cases` to the canonical two-pane workspace (queue + inline detail, URL-driven via `?case=&record=`); P4 deleted the orphan route files (`page.tsx`, `error.tsx`, `loading.tsx`, `ExceptionListPane.tsx`, `CaseListPane.tsx`, `SavedViewsMenu.tsx`, `searchParser.ts`) — ~2600-line net deletion. The architectural locks that referenced the deleted page were refactored to either point at `/cases/page.tsx` where the contract carries over (Guardrail #2, sign-out routing, case-projection data source) or become tombstones with notes for follow-on restoration. `/cases/[id]` survives as the focused single-case view for notification deep-links. | **RESOLVED** — single canonical workspace; 10 PRs across both repos closed the gap (2026-05-13) |
| D28 | ADR-041 case-type axis — `EMAIL_ENTRY` / `BLOCK` orthogonal to `manual_order` / `automated_order` | PO requested two case types (`EMAIL_ENTRY`, `BLOCK`) with sub-classification (per-intake email classification for EMAIL_ENTRY; per-block-reason `sap_block_code` on records for BLOCK). The ADR-041 domain modeller's panel review pushed back on collapsing the new axis into the existing `manual_order`/`automated_order` source field: they answer different questions. `source` = "how did the order originate?"; `case_type` = "why did ASOE materialise this case?". A `manual_order` arriving by phone is NOT EMAIL_ENTRY. An `automated_order` (EDI 850) that later gets SAP-blocked IS a BLOCK case. Decision: add `case_type` + `email_classification` to `OrderCase` (defaults from `source` via Pydantic `mode="before"` validator so all ~30 existing fixtures keep working); add `sap_block_code?` to `ExceptionRecord`. Pydantic `model_validator` enforces EMAIL_ENTRY ⇒ `email_classification` non-None and BLOCK ⇒ `email_classification` is None. UI types mirrored 1:1; mock fixture wiring maps `event_type` to the new axis. | **RESOLVED** — paired asoe2 #154 + asoe-ui #156 (2026-05-13) |
| D29 | UX / accessibility / screen-clutter coverage codified into a permanent layered test bundle (PR #163) | Pre-2026-05-14 the WCAG 2.1 AA work referenced in Section 11.3 was real but uneven: only Badge / Button / Sidebar / MetricTile / Input and two enrichment sections had axe sweeps; nothing locked focus management on overlay surfaces, design-token contrast, viewport overflow, reduced-motion respect, or keyboard-only operator reachability. A virtual expert panel (UX / QA / DevOps / A11y / Frontend Platform) identified seven gaps; PR #163 shipped a minimal-but-complete layered bundle that closes each one: token-level contrast lock, expanded component axe sweep, source-level UX-clutter invariants (z-index ladder, landmark plumbing, StatusAnnouncer mount, `MAX_PRIMARY_ACTIONS=3` cap on AgentReasoningCard), focus-management invariants on Sidebar + skip-link, route-level `@axe-core/playwright` sweep with per-route ratchet baseline, viewport-overflow smoke at 1280/1440/1920, reduced-motion check, and a single keyboard-only operator journey with StatusAnnouncer announcement assertion. Companion source fixes: `id="main-content"` on `/cases` + `/cases/[id]`, `@media (prefers-reduced-motion: reduce)` block + `--z-skip-link` token in `design-tokens.css`, NavBar inactive tab text bumped from `text-tertiary` (3.92:1) to `text-secondary` (8.46:1) to meet AA. Strategy doc: `docs/test-strategy/UX_ACCESSIBILITY.md`. Two shortfalls recorded explicitly: white-on-dark-brand button (3.32:1) marked `it.todo` until token-darkening pass; small-caption tertiary/quaternary uses across every route held by the route-axe `ROUTE_BASELINE` ratchet (regressions fail, current debt tolerated per-route). | **RESOLVED** — UX/A11y bundle shipped + strategy doc + DoD entry in CLAUDE.md (PR #163, 2026-05-14) |
| D30 | Multi-issue mock cases — `MOCK_CASES` evolved from 1:1 derivation to group-by-`parent_case_id` (PR #165) | D25 closed the empty-picker bug by deriving `MOCK_CASES` 1:1 from `MOCK_EXCEPTIONS` (`MOCK_EXCEPTIONS.map(caseFromMockException)`) — one case per record. That left the records-picker workflow uncovered in preview mode: every case had exactly one record, so the `RecordListPane` picker never showed more than one row and the operator's "pick a record to act on" path was untested. Real CPG POs routinely trip several coincident exceptions on one order. PR #165 adds three multi-issue clusters — Walmart Q1 reset (price-hold + back-order + duplicate retry), Costco EOQ (over-max + pallet-config), Kroger WK-15 (MOQ + delivery-delay) — 7 records sharing a `parent_case_id`, each with a realistic verdict mix (some GREEN auto-resolved, some YELLOW awaiting human, one RED blocked). `cases.ts` now groups `MOCK_EXCEPTIONS` by `parent_case_id` and `aggregateCaseStatus` rolls the per-record `CaseStatus` up to the case by dominance order (`OPEN_AWAITING_HUMAN > BLOCKED > FAILED > RESOLVED`) — a case stays open while any sibling record is still in review. Architectural lock at `tests/architectural/case_pivot_mock_wiring.test.ts` asserts at least one case has N>1 records and every sibling is independently fetchable. Backend contracts unchanged — `ExceptionSummary.parent_case_id` + the case-aggregation pattern already exist (`asoe2/api/case_resolver.py::should_materialise() -> True`); this exercises them in the mock layer. | **RESOLVED** — multi-issue mock coverage + N>1 arch lock (PR #165, 2026-05-15) |
| D31 | Records picker unreachable below the xl breakpoint — P3e gap closed (PR #168) | ADR-041 P3d-remaining lifted the records picker into a dedicated middle column (`RecordListPane`) wrapped in `hidden xl:block` — it only renders at ≥1280px. The right pane mounted `CaseDetailPanel` with `showInlineRecordList={false}`, suppressing the inline fallback at every viewport. Net effect: on a 1024-1279px screen (the most common laptop width) a deep-link to a multi-record case showed only two panes — queue + case header — with no records picker anywhere, so the Agent Recommendation card stayed hidden unless the operator hand-typed a record id into `?record=`. The original code path acknowledged the gap as "P3e — not in scope here". Fix: `CaseDetailPanel` gains `inlineRecordListHiddenAtXl` (default false); the `/cases` workspace passes `showInlineRecordList={true}` + `inlineRecordListHiddenAtXl={true}` so the inline picker shows below xl and hides at xl+. Both `RecordListPane` instances stay in the DOM at every viewport (CSS `display` toggle, not unmount) — so tests selecting the picker by `aria-label` / `data-testid` must scope to `:visible`; the `cases-workspace-three-pane` browser e2e was updated accordingly. Standalone `/cases/[id]` keeps `inlineRecordListHiddenAtXl=false` so its picker shows at every viewport. | **RESOLVED** — inline picker reachable below xl + arch lock + e2e `:visible` scoping (PR #168, 2026-05-15) |
| D32 | `/cases` queue scroll position lost on row select (PR #169) | Clicking a case in the queue (or a record in the picker) jumped the viewport to the top of the document. Root cause: Next.js App Router scrolls to the top on every `router.replace` / `router.push` by default. The `/cases` workspace is an in-place state machine — selection is a URL write (`?case=` / `?record=`), not a page navigation — so the viewport must stay put. On a long, SLA-sorted queue the scroll-to-top makes the operator lose the row they just clicked. Fix: pass `{ scroll: false }` to both `router.replace` calls (`handleSelectCase`, `handleSelectRecord`). Source-grep regression lock added to `cases_workspace_render_guard.test.ts` — asserts every `router.replace(` in `page.tsx` carries `scroll: false`; verified it fails on the parent commit. | **RESOLVED** — `scroll: false` on selection URL writes + regression lock (PR #169, 2026-05-15) |
| D34 | A REJECTED child held its case open instead of closing it — case-status projection fix | `caseFromMockException` projects a record's `lifecycle_state` onto the parent `OrderCase.status`. Its switch sent `REJECTED` through the `default` branch → `OPEN_AWAITING_HUMAN`, so a case whose children were all rejected never rolled up to a terminal status — it lingered in the operator queue with `closed_at` unstamped. That contradicts the record itself: a `NO_ACTION` disposition (`sub_type` REJECT in asoe2) stamps `resolved_by` and is audited as `EXCEPTION_RESOLVED` — a *completed* human decision, not a child still owing one. The asoe2 backend port (`api/case_resolver.py::_case_status_from_lifecycle`) carried the identical default-branch bug. Fix: `REJECTED` now projects to `RESOLVED` in **both** repos, alongside `RESOLVED` / `CLOSED`. Regression locks: asoe-ui `tests/architectural/case_status_projection.test.ts` (the mock-data-layer lock) and asoe2 `tests/test_case_status_aggregation.py` + `test_e2e_multi_issue_case.py::test_rejected_child_closes_the_case` — all verified to fail on the parent commit. Surfaced by a design-review question on what happens to a rejected exception. | **RESOLVED** — `REJECTED → RESOLVED` projection + regression locks in both repos (2026-05-18) |
| D33 | Pipeline timeline reported a hardcoded classifier confidence + order_id, disagreeing with the AgentReasoningCard (PR #165) | Extends D20. The mock trace dispatcher's verdict-template helpers (`_yellowHitlTrace` / `_greenAutoResolvedTrace` / `_redBlockedTrace` in `src/lib/api.ts`) hardcoded example values for the classify-node `confidence` (0.86 / 0.91 / 0.94), `order_id`, `intent`, and `skill_name`. Any record routed through the default dispatcher inherited those samples — so the Diagnostics pipeline timeline showed e.g. `confidence 0.86` while the `AgentReasoningCard` rendered `analysis.confidence` (e.g. 90%) for the same record on the same detail page. Two disagreeing confidence values for one agent decision on a SOX-relevant surface is the partial-truth state Verdict 2026-04-22 holds veto over. Fix: the template helpers take a `_TraceOverrides` arg; `_defaultExecutedNodes` derives it from the `ExceptionSummary` + `MOCK_ORDER_ANALYSES[id].confidence / 100`; hand-crafted `MOCK_TRACE_ENRICHMENT` call sites pass it via `_overridesFromId`. Architectural locks in `mock_verdict_coverage.test.ts` assert the trace classify confidence + ingest order_id match the record for every mock; verified they fail on the parent commit. Mock-layer correctness fix — the real backend already persists per-record confidence (D20). | **RESOLVED** — trace template values sourced per-record + arch locks (PR #165, 2026-05-15) |
| D35 | Customer-Inbox evidence sections built out (ADR-042 port, Phases 2–7) | The detail panel's data-presence list gained seven Customer-Inbox sections, each a dumb projector mounted on its own `analysis.*` field (no per-intent dispatch): `EntitiesSection` / `SapDataSection` (P2), `OrderEntrySection` (P3), `Edi850Section` (P5), `ChangeAnalysisSection` (P6), `KnowledgeGraphSection` + `DraftReplySection` (P7). All payloads are backend-authoritative — the EDI 850 document and Change Analysis are built deterministically server-side (`asoe2/gateways/edi850.py`, `recipes/ChangeAnalysisRecipe.py`) and projected by the composer; the UI never assembles them (Guardrail #6). The Knowledge Graph renders a deterministic radial SVG paired with an accessible relationships list (WCAG 1.4.1). DoR #11 automation-bias telemetry was added: `CollapsibleSection` reports its first expand via `Layer2OpenContext`, and `ExceptionDetailPanel` posts dwell + Layer-2-open once per decision (`exceptionsApi.reportReviewerActivity`). The prototype's standalone **Constraint Graph** SVG was deliberately NOT built — ADR-042 §2.1/§5b direct reuse of the existing pipeline topology + `/exceptions/{id}/trace` and judge it duplicative of the Change Analysis section. | **RESOLVED** — seven inbox sections + telemetry shipped; Constraint Graph deferred by ADR (asoe-ui #185 / asoe2 #166, merged 2026-05-24) |
| D36 | PARITY-3a dual-provider auth scaffold — `seed` (dev/CI) vs `entra` (preprod/GA) NextAuth providers always mounted; runtime env decides which is meaningfully usable | The pre-PARITY UI had a single `CredentialsProvider` (seed users, any-password against asoe2). Azure preprod needs Entra ID; GA needs multi-tenant Entra. NextAuth freezes the provider list at process startup, so a runtime toggle on `authOptions.providers` produces a silent callback mismatch on `/api/auth/callback/{id}`. Fix: both `CredentialsProvider` (id=`credentials`) and `AzureADProvider` (id=`azure-ad`) are unconditionally mounted in `src/lib/auth.ts::authOptions.providers`; the `azure-ad` jwt() branch stashes `id_token` as `accessToken` so the api client's `Authorization: Bearer …` contract is unchanged. `ASOE_AUTH_MODE` (server) + `NEXT_PUBLIC_ASOE_AUTH_MODE` (client mirror) decide whether the entra provider is reachable + whether `PreprodIdentityBanner` renders. `src/middleware.ts` distinguishes three failure modes (token-missing → /login, token-invalid → /login?reason=session_expired, no-role → /403). Playwright entra fixture (`tests/browser/_entra-fixture.ts`) mints the session cookie directly rather than driving the OAuth flow — NextAuth's token + userinfo fetches run server-side inside Next.js so `page.route` can't stub them; the cookie-injection path covers UI state given an entra session (NextAuth's own tests cover the OAuth code flow). `NEXTAUTH_SECRET` pinned to the same constant on both sides via `PLAYWRIGHT_NEXTAUTH_SECRET` + `tests/architectural/entra_fixture_shape.test.ts` lock. | **RESOLVED** — PARITY-3a + entra fixture shipped (asoe-ui #196 / #197, merged 2026-05-26 + 2026-05-27) |
| D37 | Tenant-facing erasure-certificate download surface | The asoe2 backend's `GET /api/v1/attachments/{id}/erasure-certificate` (PARITY-0.5) returns a PII-free tombstone + hash-chain proof an auditor or regulator can independently verify. The UI had no surface for it — every certificate fetch required a curl + manual file packaging. `src/components/ui/ErasureCertificateButton.tsx` wraps `attachmentsApi.getErasureCertificate(id)`, packages the JSON as a downloadable Blob with a regulator-correlable filename (`erasure-certificate-{id}-{erasedAt}.json`), and surfaces errors via `role="alert"`. Backend invariants preserved: manager+admin only, tenant-scoped — neither re-implemented client-side. Mock mode synthesises a deterministic certificate (no `content`, no `name` — registry contract) so the surface is exercisable in dev / Vercel previews. The button is a dumb projector per Guardrail #6 — does not blend the certificate with event fields. | **RESOLVED** — `ErasureCertificateButton` + `AttachmentErasureCertificate` type + tests (PR #197, 2026-05-27) |
| D38 | S1 — Redundancy & Density audit on `/cases` right pane | Virtual UX panel (Hagan Rivers / Vitaly Friedman / Priya / SAP Fiori) found 13 redundancies on the inline `ExceptionDetailPanel` mount: two stacked headers, Case ID surfaced three times, SLA four times, Origin + source_channel as adjacent chips, Compliance verdict in four places, Customer name in three. New `embedded` prop on `ExceptionDetailPanel` / `HeaderRibbon` / `ContextStrip` collapses the per-record chrome when mounted inside `CaseDetailPanel`; the standalone `/exceptions/[id]` view keeps full chrome. Full-header `<dl>` grid trimmed from six fields to two (Opened + Sales order). `h1` demoted from `text-display` → `text-heading`. Origin + source_channel collapse into one badge. Multi-record auto-mount deferred (single-record still auto-mounts; multi-record requires explicit pick — gives the `RecordListPane` the first beat of attention). New `SectionAnchorBar` (sticky Recommendation / Evidence / Diagnostics anchors) sits between `ContextStrip` and the sticky action ribbon. Slim-header disclosure `aria-expanded` bound to state (previously hardcoded `false`). Source-locked at `tests/architectural/s1_redundancy_audit_locks.test.ts`. | **RESOLVED** — PR #208 (2026-05-28) |
| D39 | S2 — Keyboard-first action ribbon, `?` cheatsheet, mandatory `reason_tag` on YELLOW/RED, telemetry, Combobox typeahead, next-case auto-advance, kbd hints | The action ribbon was the hot path with the LEAST keyboard support — every Approve/Reject/Override/Escalate/Reanalyze required a click. Five intertwined fixes shipped across PRs #209-#211 and updated drift entries together because they share the keyboard registry + the comment-swap state machine: **(1) Ribbon hotkeys** (S2 #3) — `A`/`R`/`O`/`E`/`Y` via new `useHotkeys` hook + single registry `src/lib/hotkeys.ts`. Gating mirrors the visible-button predicate. Input/textarea/select/contenteditable bail. **(2) `?` cheatsheet** (S2 #5) — new `HotkeyCheatsheet` mounted on `/cases`; renders every binding grouped by scope. **(3) Cmd+Enter discoverability** (S2 #4) — placeholder copy advertises `⌘↵` and Confirm button declares `aria-keyshortcuts="Meta+Enter"`. **(4) Mandatory `reason_tag` on YELLOW/RED Approve/Reject** (S2 #7) — Approve/Reject in the comment swap now require an operator-picked `reason_tag` from `useHealth().allowed_override_reason_tags_by_intent` (same vocabulary the Override dialog uses); GREEN keeps the optional-comment one-step path. Panel chose this over free-text mandatory because free-text degrades into "ok"/"approved" noise (Goodhart) while reason_tag is the structured categorical signal ASOE's calibration loop joins on. Backend disposition API already accepted `reason_tag` — no contract change. **(5) Comment-dialog aria-live** (S2 #10) — every open variant carries `aria-live="polite"` + deterministic `aria-label`. **(6) End-to-end CSA-time telemetry** (S2 #8) — new `reportTimeToActionSubmit` + `markActionSubmit` distinct from the existing `time-to-first-action`; carries `reason_tag` for calibration joins. **(7) Next-case auto-advance** (S2 #11) — `handleRecordActionComplete` flips URL to next case in queue; snapshotted before refetch so resolved-case-filter-out doesn't shift the operator's pick; last case is a no-op. **(8) Hotkey hints on ribbon buttons** (S2 #13) — each visible ribbon button carries an aria-hidden `<kbd>` suffix reinforcing the binding letter. **(9) Combobox typeahead in `OverrideChooserDialog`** (S2 #6 follow-up) — both native `<select>`s swapped for a new cmdk-backed `Combobox` primitive. Cluster grouping (ADR-033 §D) preserved via the new `groups` prop. New `cmdk@^1.1.1` dependency. **Dropped:** undo-toast debounce (S2 #12) — math was upside-down (60 cases/shift × 5s = ~5 min dead wait/shift against ~1% misclick rate). Architectural locks: `s2_hotkey_registry_lock`, `s2_tier3_audit_locks`, `s2_combobox_swap_lock`. | **RESOLVED** — PRs #209, #210, #211 (2026-05-28 → 2026-05-29) |
| D40 | S3 — Accessibility hardening | Final pass through the All Cases panel's punch list. Two of four findings turned out PASS at recon (`VerdictDot` already pairs colored dot + letter glyph + descriptive `aria-label`; `EvidenceBlock`'s "Context Not Required" placeholder already declares `role="note"` + aria-label). The remaining two are real WCAG gaps: **(1) SLA band-transition silent for screen readers (WCAG 4.1.3)** — `useSlaTicker` re-renders every 60s; sighted users saw the chip color flip but SR users heard nothing. New `SlaBandAnnouncer` mounted on the selected case in `CaseDetailPanel`. Sr-only `aria-live="polite"` region; emits ONE line when band crosses (`comfortable → at_risk → breached`, or recovery back). Silent on per-minute label ticks and on case-switch re-baselines. **(2) Focus dropped to body on custom-dialog close** — Radix's automatic focus return only applies to `<DialogTrigger>` users; `OverrideChooserDialog` uses controlled `open` state but still gets Radix's restore; `HotkeyCheatsheet` and `ActionButtonMatrix` comment swap are custom `role="dialog"` divs and were dropping focus on close. New `useFocusRestoreOnClose` hook captures `activeElement` DURING the closed→open render (must be in the render path, not useEffect — by effect time the dialog's `autoFocus` has already stolen focus) and restores via `requestAnimationFrame` on close. **Tier 2 polish landed:** `aria-live="off"` on both `Last activity` spans (per-minute ticker re-renders should not narrate); visible required asterisk on the mandatory reason_tag label (aria-hidden so the SR contract stays on `aria-required` + parenthetical). Source-locked at `tests/architectural/s3_a11y_audit_locks.test.ts`. | **RESOLVED** — PR #212 (2026-05-29) |

### TYPE CONTRACT DRIFT (needs code or backend fix)

_No active drift items. All T1-T9 items resolved during architecture alignment (2026-04-11)._

---

## 10. Proposed Backend Changes (asoe2)

> **Status: IMPLEMENTED** — All proposed changes below were implemented during architecture alignment (2026-04-11). See `asoe2` branch `claude/align-architecture-specs-YBgh9` for the code changes.

### 10.1 StatsResponse Enhancement (T1-T5)

**Current backend** (`asoe2/api/schemas.py`):
```python
class StatsResponse(BaseModel):
    total: int = 0
    open: int = 0
    auto_resolved: int = 0
    manual_review: int = 0
    blocked: int = 0
    failed: int = 0
```

**Proposed backend change:**
```python
class StatsResponse(BaseModel):
    total_exceptions: int = 0          # renamed from 'total'
    open_exceptions: int = 0           # renamed from 'open'
    auto_resolved: int = 0
    manual_review: int = 0
    blocked: int = 0
    failed: int = 0
    avg_resolution_time_seconds: Optional[float] = None  # NEW
    by_intent: Dict[str, int] = {}                       # NEW
    by_lifecycle_state: Dict[str, int] = {}              # NEW
    by_shadow_verdict: Dict[str, int] = {}               # NEW
```

**Rationale:** The UI dashboard requires breakdown dimensions per Section 11.6 KPIs. The field renames avoid Python reserved-word conflicts (`open`) and are more explicit.

**Alternative:** Keep backend field names, add an adapter layer in the UI API client that maps `total` → `total_exceptions`. This avoids backend changes but adds translation complexity.

### 10.2 TerminalStatus Enum Addition (T6)

**Current backend** (`asoe2/contracts/models.py`):
```python
class TerminalStatus(str, Enum):
    COMPLETE = "COMPLETE"
    FAIL_TO_HUMAN = "FAIL_TO_HUMAN"
    MANUAL_REVIEW_REQUIRED = "MANUAL_REVIEW_REQUIRED"
    BLOCKED = "BLOCKED"
    REJECTED = "REJECTED"
```

**Proposed addition:**
```python
    COMPLETE_WITH_CHILDREN = "COMPLETE_WITH_CHILDREN"  # parent resolved, spawned child exceptions
```

**Rationale:** `consol_arch.md` Section 1 (V1 Scope) lists `COMPLETE_WITH_CHILDREN` as a V1 terminal status. Section 11.6 references it in the resolution rate KPI formula. The UI type already includes it. The backend enum should match the spec.

### 10.3 Line-Item Endpoint (D3)

**Proposed new endpoint:**
```
GET /api/v1/exceptions/{id}/line-items    analyst+
```

**Response:**
```json
{
  "data": [
    {
      "line_id": "L1",
      "sku": "SKU-0042",
      "description": "12-pk Cola",
      "uom": "CS",
      "quantity": 240,
      "erp_price": 14.88,
      "po_price": 13.20,
      "root_cause": "PROMO_EXPIRED"
    }
  ]
}
```

**Rationale:** The UI exception queue supports expandable rows showing line-item grids. This data comes from the `OrderEvent` payload or the originating EDI document. The endpoint returns structured line-item data for display.

**Backend implementation note:** Line items may be sourced from `OrderEvent.metadata` (which can contain line-item arrays from EDI 850 parsing) or from a new `line_items` table if structured storage is needed.

### 10.4 Order Analysis Endpoint (D4)

**Proposed new endpoint:**
```
GET /api/v1/exceptions/{id}/analysis    analyst+
```

**Response:**
```json
{
  "diagnosis": "Two line items reference expired promo pricing...",
  "confidence": 92,
  "risk": "MEDIUM",
  "resolution": "AUTO_OVERRIDE",
  "lines": [
    {
      "line_id": "L1",
      "diagnosis": "TPR discount ZPROM expired 12/31...",
      "resolution": "AUTO_OVERRIDE",
      "risk": "MEDIUM",
      "waterfall": [
        { "type": "BASE", "label": "Base Price (PR00)", "record": "PR00/10", "value": 14.88, "running": 14.88, "detail": "SAP list price..." },
        { "type": "ERROR", "label": "Promo Validity Check", "record": "ZPROM/155", "value": null, "running": null, "detail": "Condition expired...", "error": "Promotional condition expired..." }
      ]
    }
  ]
}
```

**Rationale:** The pricing waterfall visualization and per-line diagnosis require structured analysis data. This data is generated during the `classify` and `load_skill` pipeline nodes and can be persisted as part of the `TraceRecord` or `ExecutionLog`.

### 10.5 Customer Inbox Endpoints (D1)

**Proposed new endpoints** (when inbox moves to production):
```
GET  /api/v1/inbox                    analyst+    # Paginated inbox items
GET  /api/v1/inbox/{id}               analyst+    # Inbox item detail
POST /api/v1/inbox/{id}/approve       analyst+    # Approve agent recommendation
POST /api/v1/inbox/{id}/escalate      analyst+    # Escalate to human
```

**Data model consideration:** Define how inbox items relate to exceptions:
- **Option A:** Inbox items are a pre-exception source — an inbound email that may create one or more exceptions after agent triage
- **Option B:** Inbox items are a parallel concept — customer communications tracked alongside but not directly creating exceptions

This needs architectural decision before backend implementation.

### 10.6 consol_arch.md Section Updates

| Section | Change |
|---|---|
| 11.2 | Add PricingWaterfall to component table. Update custom count from 12 to 14. |
| 11.5 | Add Customer Inbox to Key Pages table with layout description. |
| 6.2 | Add `GET /api/v1/exceptions/{id}/line-items` and `GET /api/v1/exceptions/{id}/analysis` endpoints. |
| 6.2 | Add inbox endpoints (when inbox moves to production). |

---

## 11. ADR References

| ADR | Decision | Relevance |
|---|---|---|
| **ADR-005** | Custom agent-first components over full Shadcn/ui | Drives the 14 custom components; Shadcn only for non-agent primitives |
| **ADR-006** | CSS custom properties as token source of truth | 149 tokens in `design-tokens.css`; framework-agnostic |
| **ADR-008** | Next.js 16 (App Router, active LTS) | React 19 support, Turbopack, improved performance |
| **ADR-009** | Per-node WebSocket events with typed envelope | Powers WaterfallStepper real-time visualization |

All ADRs documented in `consol_arch.md` Section 13.

---

## 12. Override Action Governance (Option A)

**Status:** SHIPPED (UI Phase 12 — paired with asoe2 Phase 19 backend consolidation + Phase 20 hash-chained audit). Replaces the pre-Phase-3 Override/Approve/Reject model.

### 12.1 Verdict × Permission × Button Matrix

The decision surface on an exception is assembled at render time from three orthogonal inputs: the Compliance Shadow verdict, the operator's RBAC permission flags (`canApprove` / `canOverride` / `canEscalate`), and the `actionInFlight` pessimistic UI state. No button visibility derives from `isAdmin` or role-string literals.

| Verdict / State | `canApprove` only (analyst) | `canOverride` added (manager+) | `canEscalate` only |
|---|---|---|---|
| GREEN | View Details | `[Override…]` | — |
| YELLOW | `[Approve] [Reject] [Escalate]` | `[Approve] [Reject] [Override…] [Escalate]` | `[Escalate]` |
| RED | `[Escalate]` | `[Override…] [Escalate]` | `[Escalate]` |
| FAILED / execution error | `[Escalate for Triage]` | `[Escalate for Triage]` | `[Escalate for Triage]` |
| PENDING_COSIGN | (initiator read-only banner) | `[Approve cosign] [Reject cosign]` (non-initiator) | — |

**Guarantees:**

- Analysts clear YELLOW in a single click via `Approve` / `Reject` (primary verbs).
- The `Override…` affordance is visible only to operators with `exceptions:override`. Clicking it opens the Override chooser dialog (Layer 2 expansion — see 12.3).
- The prior `Acknowledge` button was removed — it was calling Approve silently and hid the semantic choice.
- `actionInFlight` swaps the in-flight button's visible label to `Verbing…` (e.g. `Approving…`) and disables peer buttons to prevent double-submission. aria-label remains the noun-phrase form for screen-reader parity.
- `Approve` carries a hover tooltip (`title`) previewing the recipe's recommended action when the record supplies one — e.g. `Approve: Apply Contract Price`. The aria-label absorbs the same preview.

**Implementation:** `src/components/ui/AgentReasoningCard.tsx` renders the matrix; `src/app/exceptions/ExceptionDetailPanel.tsx` wires the handlers and permission props.

### 12.2 Four-Eyes Cosign Banner

When a privileged override exceeds the backend's financial-impact threshold, the backend stages it for second-reviewer sign-off (mirrors asoe2 Phase 20 policy `HIGH_VALUE_OVERRIDE_THRESHOLD_USD`). The record transitions to `lifecycle_state === "PENDING_COSIGN"` and the UI shows a cosign banner above the AgentReasoningCard.

**Banner contents:** initiator email, staged action code, reason_tag, financial_impact_usd, and initiated_at. All sourced from `detail.resolution_data.pending_override` — no UI-side business logic.

**RBAC split:**
- Non-initiator with `exceptions:override` sees `[Approve cosign] [Reject cosign]`. Submission routes through `exceptionsApi.cosign(id, { approve, notes })` with mandatory notes.
- The initiator sees the banner in read-only "Awaiting cosign" mode. SoD (segregation of duties) is enforced at the backend and mirrored in the UI; the UI never renders the cosign buttons to the initiator.

**ActionInFlight extension:** the `ActionInFlight` union gained `cosign-approve` / `cosign-reject` for pessimistic UI on the cosign banner.

**Implementation:** `ExceptionDetailPanel.tsx` `handleCosign(approve: boolean)` handler; inline banner rendering gated on `detail.lifecycle_state === "PENDING_COSIGN"`.

### 12.3 Layer 1 / Layer 2 Reconciliation

The Override chooser dialog is the **Layer 2 expansion** of the `Override…` button (which lives in Layer 1 of AgentReasoningCard). It opens only on explicit user intent — consistent with Section 1's two-layer cognition rule that Layer 2 is never shown by default.

**Chooser content:**

| Field | Source | Notes |
|---|---|---|
| Resolution action (select) | `detail.resolution_data.allowed_actions` when server-narrowed, else `health.allowed_resolution_actions` | Guardrail #2 — no string literals in `.tsx`. Backend `asoe2/constraints/specs.py::AllowedResolutionAction` is authoritative. |
| Reason category (select) | `health.allowed_override_reason_tags_by_intent[detail.intent]` → falls back to `health.allowed_override_reason_tags` | Per-intent narrowing framework already wired; real curation deferred (see Phase 5 cross-link below). |
| Notes (textarea) | Free-text, mandatory | SOX audit trail. Submission blocked when empty. |

**Free-text action input removed in Phase 3** — the chooser is a bounded-vocabulary select only.

**Submission path:** `submitOverride` calls `exceptionsApi.disposition(id, { action, notes, reason_tag })`. The backend derives `sub_type` server-side from whether the chosen action equals the recommended action; the UI never computes APPROVE vs OVERRIDE.

### 12.4 Contract-Driven Types + Idempotency

DTOs are aliased from `src/types/generated.ts` (produced by `openapi-typescript` from the committed `asoe2/openapi/asoe2.openapi.json`) via the curated surface `src/types/contracts.ts`. `DispositionRequest`, `EscalateRequest`, `CosignRequest`, `ReanalyzeRequest`, and `ChallengeRequest` are all sourced this way. `OverrideRequest` / `ApproveRequest` / `RejectRequest` were deleted in Phase 3.

`LifecycleState` dropped `EXECUTING` (no longer a persisted state) and added `PENDING_COSIGN`.

Every mutating client method accepts a `RequestOptions` second argument (`{ idempotencyKey?: string }`). When omitted, the client generates a UUID v4 via `generateIdempotencyKey()` and sends it as the `Idempotency-Key` header. The mock implementation maintains a per-endpoint replay cache that mirrors backend semantics — replay-safe by default, even in local demo mode.

### 12.5 Cross-Link: Phase 5 Deferred

Per-intent reason_tag vocabulary curation is deferred — tracked in `asoe2/tasks.md` Phase 5. The UI already consumes `health.allowed_override_reason_tags_by_intent[detail.intent]`, so when product/compliance ships curated per-intent vocabularies a single `npm run generate-types` refreshes both sides; no `.tsx` changes are required.

### 12.6 File Map

| Concern | File |
|---|---|
| Button matrix + pessimistic UI | `src/components/ui/AgentReasoningCard.tsx` |
| Handlers + cosign banner + Override chooser dialog | `src/app/exceptions/ExceptionDetailPanel.tsx` |
| API client methods + Idempotency-Key | `src/lib/api.ts` (`disposition`, `escalate`, `cosign`, `reanalyze`) |
| Permission flags | `src/lib/roles.ts` (`exceptions:approve`, `exceptions:override`, `exceptions:escalate`) |
| Request/response DTOs | `src/types/contracts.ts` (aliases from `generated.ts`) |
| Lifecycle state union | `src/types/exceptions.ts` (`LifecycleState`) |

---

## 13. Pending architectural shift — case-centric direction (asoe2 ADR-038, Proposed)

**Lineage hint for the next reader.** asoe2 has authored `ADR-038 — Case-Centric Order Intake (Five-Layer Agentic Architecture)` in *Proposed* status. When ratified, it shifts the user-facing primary surface from `/exceptions` (with `/inbox` as a peer) to `/cases` as a single CSR work surface, with `/exceptions` and `/inbox` retained as filtered case-list views.

### 13.1 What changes for the UI (Phase H.6 of the rollout)

* **`/cases` becomes the primary CSR surface.** A new top-level page with SLA-driven sort and filter chips for case `source` (Manual / Automated), tier, customer, lifecycle status.
* **`CaseDetailPanel` reshapes the existing `ExceptionDetailPanel`.** The case header (source, source_channel, SLA deadline, lifecycle status) sits at the top; child records (one or more `ExceptionRecord` rows attached to the case via `parent_case_id`) stack below as section components.
* **Existing `*Section.tsx` components mount unchanged** via the existing data-presence pattern (Guardrail #1 preserved — no per-intent dispatch). `EmailSourceSection`, `EmailOrderEntrySection`, `MOQSection`, etc., are projection-only and render the case's child analyses.
* **`/inbox` and `/exceptions` retain** as filtered case-list views for ADR-034 §6 backward compatibility. `/exceptions` filters to cases with at least one open exception child; `/inbox` filters to cases with `source == "manual_order"` and a recent inbound channel event. Both routes redirect to `/cases?filter=...` under the hood after Phase H.6 lands.

### 13.2 What stays unchanged

* **Guardrail #1 (no hardcoded enum values).** The case-source vocabulary (`manual_order` / `automated_order`) is sourced from `useHealth.allowed_case_sources` — no hardcoded literals in the page code.
* **Guardrail #6 (no frontend composition of enrichment payloads).** The case detail still consumes a backend-assembled payload; `OrderCase` + child records arrive from the API, and section components render `analysis.foo` as given.
* **Guardrail #7 (rich UI types are a product commitment).** New `OrderCase` + `CaseEvent` interfaces in `src/types/cases.ts` (NEW; mirrors asoe2's Pydantic models) follow the same don't-prune-without-Compliance discipline as existing `*AnalysisData` types.

### 13.3 What's needed before Phase H.6 starts

* **`OrderCase` Pydantic model on the asoe2 side** must ship and be exposed via the API — that's asoe2's Phase H.2 / H.3 scope.
* **Design specifications** for `/cases` list view layout, SLA visual treatment, breached-state surfacing, filter-chip semantics. Frontend Platform + UX deliverable.
* **`CaseDetailPanel` layout sketch** — case header anatomy, child-stack ordering, action button placement.
* **Migration strategy** for `/inbox` and `/exceptions` to redirect-or-filter without breaking existing user bookmarks and tests.

### 13.4 What this notice does NOT do

* **Does not commit any UI code.** Phase H.6 is weeks away on the rollout schedule; no code lands in this branch.
* **Does not change Guardrails #1–#7.** They tighten with the case-centric model, not loosen.
* **Does not deprecate `ExceptionDetailPanel`.** It evolves into `CaseDetailPanel`; existing component tests + lock tests stay green throughout.
* **Does not affect Phase G work** (the in-flight `EmailSourceSection` above `EmailOrderEntrySection` on `claude/review-order-entry-architecture-RCIUa`). Phase G's UI work is correct under the case-centric model and is what `CaseDetailPanel` will render for Manual Orders.

### 13.5 Design discussion can start now

Even though the UI code lands in Phase H.6, the asoe2 Phase H.2 / H.3 work (case primitive + lazy materialisation) gives Frontend Platform a concrete data model to design against. Recommended early activities:

1. Whiteboard `/cases` list view against the `OrderCase` Pydantic schema.
2. Sketch the case-header layout: source chip, SLA countdown component, lifecycle status badge.
3. Identify reusable patterns from existing `ExceptionDetailPanel` (saved-views menu, list pane, details pane) that translate directly.
4. Define the `/inbox` and `/exceptions` redirect / filter rules so the migration story is owned by Frontend Platform from day one.

For the current ADR-038 / ADR-039 review cycle, this section flags Frontend Platform's scope without committing schedule or code. The full Phase H.6 specification follows when asoe2's Phase H.3 ships.

### 13.6 Status update (post-merge — Phase H.6 primitive shipped)

asoe2 Phase H.2 + H.3 + H.7 primitives have **shipped on main** (`kumarabhijit/asoe2#114`); the UI's slice (Phase H.6 primitive) shipped via `kumarabhijit/asoe-ui#128`. Section §13 above is therefore mostly retrospective now; this subsection records the live state.

**Shipped on main:**

* `src/types/cases.ts` — `OrderCase`, `CaseEvent`, `CaseSource`, `CaseStatus`, `CaseTier`, `SlaSnapshot`, `SlaBand`. 1:1 mirrors of asoe2's Pydantic types.
* `src/lib/api.ts::casesApi` — `list()` and `get(case_id)` plus `MOCK_CASES` and `ALLOWED_CASE_SOURCES`.
* `src/app/cases/page.tsx` — list view with SLA-driven sort, filter chips, exported `slaSnapshot()` helper (band thresholds <2h `at_risk`, 2–24h `today`, >24h `comfortable`).
* `src/app/cases/[id]/page.tsx` + `src/app/cases/CaseDetailPanel.tsx` — thin wrapper + dumb-projector detail panel.
* `tests/architectural/cases_no_per_intent_dispatch.test.ts` — locks Guardrail #1 against per-intent dispatch on the case detail surface.
* `tests/components/CasesPage.test.tsx` — 11 component tests (sort, filter chips, SLA badge, navigation).

**Pending — still needed for Phase H.6 to be production-meaningful:**

| Item | Status | Owner |
|---|---|---|
| `/api/v1/cases/*` backend route in asoe2 | **Pending** — `casesApi` works in mock mode only | asoe2 (see `asoe2/tasks.md` Phase 27.6) |
| `/cases` listed in `NavBar` / `Sidebar` | **Pending** — direct URL only today | Frontend Platform |
| `/inbox` and `/exceptions` reframed as filtered views of `/cases` | **Pending** — they remain independent primaries | Frontend Platform (sequenced after `/api/v1/cases/*`) |
| Playwright e2e for `/cases` | **Pending** — no spec yet | Frontend Platform (sequenced after backend route) |
| Design fidelity polish (list-row anatomy, SLA-band visual treatment, case-detail evidence layout) | **Pending** — primitive ships the architectural shape, not the final visual design | Frontend Platform + UX |

**No drift register entry yet.** §13 is a *direction notice*, not a drift. The drift register at §9 will gain a "case-centric resolution" entry once `/api/v1/cases/*` lands and `/cases` becomes the primary CSR surface — that's when the existing `/inbox` + `/exceptions` framing genuinely changes shape and needs to be recorded as an evolved-pattern resolution.
