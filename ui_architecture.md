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
- Validated via `jest-axe` / `vitest-axe` tests (Phase 10)

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

### 5.1 Exception Queue (`/exceptions`) — V5.1.1 Master-Detail with CaseListPane

**Spec evolution:**
* V5.0 — three-pane "Outlook-style" master-detail driven by `ExceptionListPane` (exceptionsApi list, intent + lifecycle filters, search, saved views, keyboard nav).
* V5.1 (Phase 28.5) — `/exceptions` re-grounded on `casesApi.list()` (no source filter); inline source-filter-chip queue replaced the legacy list pane. ExceptionListPane stayed mounted at `/exceptions/[id]` parent for the legacy per-event detail flow.
* V5.1.1 (Phase 28.5.x Item 3) — `CaseListPane` mounts the full filter / search / saved-views / keyboard-nav surface against case-level fields. Binding decisions in `asoe2/docs/workshops/2026-05-11-case-list-pane-decisions.md`.

All filter values sourced from `useHealth()` per Guardrail #2. `STATUS_LABEL` + cluster grouping + `isAwaitingHuman` helper consolidated in `src/lib/cases.ts` — retires four duplicate maps + two hardcoded literal comparisons the §D1 lens audit flagged.

**V5.1.1 layout architecture:**
- **Top Rail (NavBar):** 56px sticky global navigation (unchanged)
- **Middle Pane (CaseListPane, ~460px):** Cluster filter chips (Live / Waiting / Terminal, sourced from `useHealth().allowed_case_statuses` + the cluster mapping in `src/lib/cases.ts`), per-status sub-chips on demand. Single-value source filter chip. Multi-select intent chips (`useHealth().allowed_intents`). URL-synced search box (`?q=`). Sort toggle (SLA urgency default / Recently opened). Saved views menu — opt-in "My queue" via "Save current as default" tile (no auto-apply, per D4 product call). Rows render `role="option"` inside `role="listbox"`, with `data-keyboard-nav-id` for `useKeyboardListNav` (ArrowUp / ArrowDown / j / k / Home / End). vitest-axe locks at `tests/accessibility/case_list_pane.test.tsx`.
- **Legacy ExceptionListPane:** Remains in `src/app/exceptions/ExceptionListPane.tsx` for `/exceptions/[id]` parent detail navigation. Not mounted on `/exceptions` after V5.1.1.
- **Keyboard navigation (Phase 8.13):** ArrowUp/Down, j/k, Home, End move selection through the sorted+filtered list and open the corresponding detail. Document-level handler in `page.tsx`; bails when active element is an input / textarea / select / Radix popover. After selection moves, DOM focus follows so the `:focus-visible` outline tracks the active card.
- **Right Pane (ExceptionDetailPanel):** Polymorphic detail view adapting per exception intent. Pane defaults follow PO request #4 — minimise everything except the Recommendation (operator scans the recommendation in 3s, drills into evidence on demand):
  - **Dynamic Header Ribbon** — breadcrumb-style: Reference ID > Customer > Location > Primary SKU / "N Lines Affected"; status row prefixed with **`Current State:`** and **`Audit Result:`** labels (Phase 8.13).
  - **Context Strip (Entity Profile + Impact Metrics)** — *collapsed by default* (Phase 8.13). Renders nothing if both `analysis.entity_profile` and `analysis.impact_metrics` are absent.
  - **Agent Recommendation** *(card heading; component is `AgentReasoningCard`, renamed from "Agent Analysis" in Phase 8.13)* — Layer 1: verdict + confidence + Approve/Reject/Override buttons. Always visible; the operator's primary action surface.
  - **Agent Analysis** *(prose pane; `AgentAnalysisSection`)* — Problem / Root Cause / Recommendation narratives. *Collapsed by default*; auto-expands when `lifecycle_state` is in `HUMAN_IN_THE_LOOP_STATES = { PENDING_REVIEW, ESCALATED, PENDING_ADMIN_REVIEW, PENDING_COSIGN, BLOCKED }`. Each prose block renders only when its field is present (Guardrail #6 structural omission).
  - **Enrichment sections** (Price Analysis, Back-Order Analysis, EDI Mismatch, …) — each wrapped in a `CollapsibleSection`, *collapsed by default* regardless of lifecycle state. Operator clicks to drill in. Lazy-mount: heavy renders defer until open.
  - **Evidence Grid** — collapsed by default; line-item table + pricing waterfall. `lineItems` background-warm after first paint; further refresh on collapse-then-reopen is a no-op.
  - **Diagnostics** — collapsed by default; `trace` is fetched lazily on first open. Pipeline Progress (timeline / DAG view), Trace Evidence tabs, Reanalysis History.

**Governance:** Human acts as **Review Authority** only — Approve, Reject, or Escalate via AgentReasoningCard. No "Execute Recipe" or manual execution triggers. Shadow Verdict displayed as read-only badge. Execution is triggered by the backend upon approval.

**Resizable panes:** `react-resizable-panels` (Group/Panel/Separator). Default 35/65 split.

**Data flow:**
```
exceptionsApi.list() + stats() → list state → render
First item auto-selected → pre-fetched detail
Card click → on-demand fetch:
  → exceptionsApi.get(id) + trace(id) + lineItems(id) + orderAnalysis(id)
  → orderAnalysis includes entity_profile + impact_metrics
```

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
| `shared` | `src/app/exceptions/shared.tsx` | CollapsibleHeader, fmtPrice helpers |

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
