# tasks.md — ASOE UI Implementation Progress

Phase-based tracker for the `asoe-ui` frontend. Each phase maps to `ui_architecture.md` requirements (originally derived from `consol_arch.md` Section 11).

---

## Completed Phases

### [x] PHASE 0: Foundation
- [x] Design tokens CSS (`src/styles/design-tokens.css`) — 45+ CSS custom properties
- [x] Global styles (`src/app/globals.css`) — resets, typography defaults, animation keyframes
- [x] Tailwind config (`tailwind.config.ts`) — content paths for `.ts`/`.tsx`
- [x] PostCSS config (`postcss.config.js`) — Tailwind + Autoprefixer
- [x] TypeScript config (`tsconfig.json`) — strict mode, `@/*` path alias
- [x] Next.js config (`next.config.mjs`) — standalone output, strict mode

✅ Outcome: Design system tokens operational. Build passes. (Pre-existing)

---

### [x] PHASE 1: Auth Flow
- [x] Login page (`src/app/login/page.tsx`) — multi-step: email → password → SSO redirect
- [x] SSO callback handler (`src/app/auth/callback/page.tsx`)
- [x] NextAuth configuration (`src/lib/auth.ts`) — credentials provider, JWT callbacks
- [x] Auth API route (`src/app/api/auth/[...nextauth]/route.ts`)
- [x] Route protection middleware (`src/middleware.ts`) — JWT check on all protected routes
- [x] RBAC system (`src/lib/roles.ts`) — 5 roles, permissions aligned with `asoe2/api/deps.py`
- [x] Auth types (`src/types/auth.ts`) — AuthUser, LoginResponse, Role
- [x] Auth hook (`src/hooks/useAuth.ts`) — typed session wrapper
- [x] Mock auth API (`src/lib/api.ts` authApi section) — login, SSO, me, refresh

✅ Outcome: Full auth flow with SSO detection, RBAC, middleware protection. (Pre-existing + updated 2026-04-11)

---

### [x] PHASE 2: Base Components
- [x] Button (`src/components/ui/Button.tsx`) — 5 variants, 3 sizes, loading state
- [x] Card (`src/components/ui/Card.tsx`) — borderless shadow elevation
- [x] Input (`src/components/ui/Input.tsx`) — label, error, right icon, brand focus ring
- [x] Logo (`src/components/ui/Logo.tsx`) — 3 sizes, optional tagline
- [x] GravitationalOrbs (`src/components/ui/GravitationalOrbs.tsx`) — canvas animated background

✅ Outcome: Base component library operational. All use design tokens. (Pre-existing)

---

### [x] PHASE 3: Agent-First Components
- [x] NavBar (`src/components/ui/NavBar.tsx`) — 56px glass, tabs, agent status pulse, brand purple restraint
- [x] MetricTile (`src/components/ui/MetricTile.tsx`) — KPI: 40x40 tinted icon + monospace value
- [x] Badge (`src/components/ui/Badge.tsx`) — tinted bg + icon + text, `verdictVariant()`, `lifecycleVariant()`
- [x] Toast (`src/components/ui/Toast.tsx`) — 4.5s auto-dismiss, solid-fill, context provider
- [x] Sidebar (`src/components/ui/Sidebar.tsx`) — 480px slide-right, escape-to-close, focus trap
- [x] ActivityIndicator (`src/components/ui/ActivityIndicator.tsx`) — node-specific domain-aware messages
- [x] WaterfallStepper (`src/components/ui/WaterfallStepper.tsx`) — 10-node pipeline visualization
- [x] AgentReasoningCard (`src/components/ui/AgentReasoningCard.tsx`) — Layer 1/2, verdict-specific behavior

✅ Outcome: All 8 Section 11.2 custom components built. Two-layer cognition operational. (2026-04-11)

---

### [x] PHASE 4: Types & API Client
- [x] Exception types (`src/types/exceptions.ts`) — Intent, LifecycleState, ShadowVerdict, PipelineNode, ExceptionSummary, ExceptionDetail, TraceRecord, HealthResponse
- [x] API types (`src/types/api.ts`) — ResolveRequest/Response, PaginatedResponse, StatsResponse, TraceResponse, WorkflowResult, APIError
- [x] WebSocket types (`src/types/websocket.ts`) — WSEvent, PipelineProgressPayload, ExceptionUpdatePayload
- [x] Auth types updated (`src/types/auth.ts`) — aligned with asoe2 AuthTokenResponse, UserProfile
- [x] RBAC updated (`src/lib/roles.ts`) — permissions match asoe2/api/deps.py exactly
- [x] Full API client (`src/lib/api.ts`) — mock data for all Section 6.2 endpoints
- [x] Health hook (`src/hooks/useHealth.ts`) — runtime enum fetching per Guardrail #2

✅ Outcome: TypeScript types mirror asoe2 Pydantic models. API client covers all endpoints. (2026-04-11)

---

### [x] PHASE 5: Exception Queue Page
- [x] Exception Queue page (`src/app/exceptions/page.tsx`) — Layout A: queue + sidebar
- [x] Metrics strip — 4 KPI tiles (total, open, auto-resolved, avg resolution time)
- [x] Filter dropdowns — state and intent sourced from `useHealth()` (Guardrail #2)
- [x] Search — client-side filter by order ID, intent, event type
- [x] DataTable — order ID, event type, intent badge, state badge, verdict badge, recipe, created
- [x] Row click → Sidebar opens with ExceptionDetailPanel
- [x] Root redirect updated (`src/app/page.tsx`) — `/` → `/exceptions`

✅ Outcome: Flagship view operational. Filters from health endpoint. Row click opens detail. (2026-04-11)

---

### [x] PHASE 6: Exception Detail
- [x] ExceptionDetailPanel (`src/app/exceptions/ExceptionDetailPanel.tsx`) — sidebar content
- [x] Header info — order ID, event type, tenant, timestamps
- [x] AgentReasoningCard integration — verdict-specific Layer 1/2 behavior
- [x] WaterfallStepper integration — pipeline progress from lifecycle state
- [x] Resolution data — JSON display for completed exceptions
- [x] Trace data — fetched and displayed in Layer 2

✅ Outcome: Two-layer cognition operational in sidebar. GREEN "View Details" toggles Layer 2. (2026-04-11)

---

### [x] PHASE 7: Dashboard
- [x] Dashboard page (`src/app/dashboard/page.tsx`) — Layout B: 2-column grid
- [x] KPI tiles — resolution rate, avg time, HITL rate, total processed
- [x] By-intent breakdown — bar segments per intent
- [x] By-state breakdown — badges + bar segments per lifecycle state
- [x] By-verdict breakdown — colored bars (GREEN/YELLOW/RED)
- [x] Platform health — status, version, kill switch, explain mode from `useHealth()`

✅ Outcome: Analytics dashboard operational. All KPIs from Section 11.6. (2026-04-11)

---

### [x] PHASE 8: WebSocket Integration
- [x] useWebSocket hook (`src/hooks/useWebSocket.ts`) — Section 8 protocol
- [x] Auth message — `{ type: "auth", token, last_seen }`
- [x] Reconnection — exponential backoff (1s → 30s max)
- [x] Event replay — sends `last_seen_timestamp` on reconnect
- [x] Event types — pipeline_progress, exception_update, task_complete, error

✅ Outcome: WebSocket hook operational with reconnection. Ready for real backend. (2026-04-11)

---

### [x] PHASE 8.5: UI Enrichment — Pre-Merge Visual Designs
- [x] Fixed token naming bugs (`--color-category-*` → `--color-cat-*`) in exceptions + dashboard pages
- [x] UI display types (`src/types/exceptions.ts`) — LineItem, PricingWaterfallStep, LineItemAnalysis, OrderAnalysis
- [x] Mock line-item data (`src/lib/api.ts`) — 8 exceptions with 18 line items, 2 with full waterfall data
- [x] Mock API methods — `exceptionsApi.lineItems()`, `exceptionsApi.orderAnalysis()`
- [x] Badge variant mappers — `rootCauseVariant()`, `categoryVariant()`, `inboxStatusVariant()`
- [x] PricingWaterfall component (`src/components/ui/PricingWaterfall.tsx`) — pricing condition chain timeline
- [x] Exception Queue enhanced — expandable card rows with line-item grids, breadcrumb, tab bar, enriched header
- [x] ExceptionDetailPanel enhanced — order summary card, mini-metrics, line selector, PricingWaterfall, tabbed detail
- [x] Inbox page aligned — refactored to use shared NavBar, Badge, MetricTile, Button; removed inline T object
- [x] Dashboard enhanced — consistent nav tabs, breadcrumb, Recent Activity feed card
- [x] Consistent nav tabs across all pages (Customer Inbox, Exception Queue, Dashboard, Settings)

✅ Outcome: All pages use shared component library. Rich data density from pre-merge designs restored. 14 reusable components. 128 tests pass. (2026-04-11)

---

### [x] PHASE 8.6: Three-Pane Outlook Layout & Polymorphic Detail View
- [x] Three-pane "Outlook" master-detail layout (`src/app/exceptions/page.tsx`) — resizable panels via `react-resizable-panels`
- [x] ExceptionListPane (`src/app/exceptions/ExceptionListPane.tsx`) — compact card list with search + filters, compact inline metrics
- [x] Lifted `selectedExceptionId` state to parent — first item auto-selected, on-demand fetch for subsequent
- [x] Polymorphic ExceptionDetailPanel — adapts to any exception type (pricing, credit, duplicate PO)
- [x] Dynamic header ribbon — breadcrumb-style: Reference ID > Customer > Location > Primary SKU / "N Lines"
- [x] Context strip — Entity Profile (customer, tier, VIP, credit standing) + Impact Metrics (revenue at risk, delta, SLA)
- [x] Agent Analysis restructured — Problem / Root Cause / Recommendation narrative blocks
- [x] Evidence Grid — collapsed by default, expandable line-item table + pricing waterfall
- [x] Governance alignment — removed "Execute Recipe" button; human = Review Authority only (Approve/Reject/Escalate)
- [x] Shadow Verdict displayed as read-only badge (not actionable)
- [x] New types: `EntityProfile`, `ImpactMetrics`; `OrderAnalysis` extended with `root_cause`, `recommendation`, `entity_profile`, `impact_metrics`
- [x] Mock data: all 8 exceptions enriched with intent-specific entity profiles and impact metrics
- [x] Design tokens: pane layout tokens (`--list-pane-default`, `--pane-handle-width`, `--pane-handle-hover`)
- [x] Guardrail #2 test updated for ExceptionListPane (filter health endpoint sourcing)
- [x] Dependency: `react-resizable-panels` added

✅ Outcome: High-productivity Outlook-style layout. Polymorphic detail view adapts per intent. Human = Review Authority. 132 tests pass. (2026-04-12)

---

### [x] PHASE 8.7: Enterprise UX Fixes & Accessibility
- [x] Wire logout on all pages via `signOut()` from NextAuth
- [x] Create Settings page stub (`src/app/settings/page.tsx`) — Phase 9 placeholder with 4 section cards
- [x] Wire NavBar Settings gear icon with `onSettingsClick` prop
- [x] Replace `window.location.href` with `router.push()` for SPA navigation (all pages)
- [x] Source user name/initials from `useAuth()` session instead of hardcoded values
- [x] Source agent count from health endpoint (`allowed_intents.length`) instead of hardcoded `3`
- [x] Add toast notifications on approve/reject/escalate (success + error feedback)
- [x] Implement escalate action via `exceptionsApi.override()` (was `console.log` stub)
- [x] Auto-refresh exception list after approve/reject/escalate via `onActionComplete` callback
- [x] Set per-page `document.title` on all pages
- [x] Change login email input from `type="text"` to `type="email"`
- [x] Add `SessionProvider` + `ToastProvider` in root layout via `providers.tsx`
- [x] Add error state tracking + retry button for exception queue data fetching
- [x] Add distinct empty states (no results vs. error) with filter-clearing hint
- [x] Persist filter state to URL search params (`?state=X&intent=Y&q=Z`)
- [x] Add "Filters active" indicator with "Clear all" button
- [x] Convert breadcrumbs to semantic `<nav aria-label="Breadcrumb">` (dashboard, inbox, settings)
- [x] Add skip-to-main-content link in root layout
- [x] Add `aria-current="page"` on active NavBar tab
- [x] Add `id="main-content"` landmarks to all page content areas
- [x] Make Entity Profile section collapsible (default expanded)
- [x] Make Pipeline Progress section collapsible (default collapsed)
- [x] Make Trace Evidence section collapsible (default collapsed)
- [x] Restore SAP Data and Change Analysis preview tabs behind `NEXT_PUBLIC_SHOW_PREVIEW_FEATURES` feature flag
- [x] Remove duplicate Layer 2 from AgentReasoningCard — trace data moved to Trace Evidence section
- [x] Unify Pipeline Progress and Trace Evidence card styling with Evidence Detail pattern
- [x] Add pipeline status badge to Pipeline Progress header (complete/in progress/failed/pending)
- [x] Move Resolution Data into Trace Evidence collapsible section
- [x] Hide Pipeline Progress and Trace Evidence behind "Show Diagnostics" toggle
- [x] Rename filter label "All Intents" → "All Exceptions", update search placeholder
- [x] Make ASOE logo in NavBar clickable, links to Customer Inbox (/inbox)

✅ Outcome: 27 UX items completed. Clean decision surface with Diagnostics toggle for technical details. SPA navigation, logout, toast feedback, error handling, filter persistence, accessibility. 226 tests pass. (2026-04-14)

---

### [x] PHASE 8.8: Duplicate PO Detail Rendering & Panel Decomposition
- [x] Decompose `ExceptionDetailPanel` (1091 lines → 357-line orchestrator + 8 sub-components) along the 5-layer axis
- [x] Extract `HeaderRibbon`, `ContextStrip`, `AgentAnalysisSection`, `EvidenceGrid`, `DiagnosticsSection`, `shared` helpers
- [x] Add `DuplicateDetectionData` and `OrderComparisonData` types to `src/types/exceptions.ts`
- [x] Add optional `duplicate_detection` and `order_comparison` fields to `OrderAnalysis`
- [x] Create `DuplicateDetectionSection` — original vs duplicate order, detection method, confidence, recommended action, autonomy
- [x] Create `OrderComparisonSection` — side-by-side order comparison with matching/differing field badges
- [x] All new sections use data-presence pattern (`{data?.field && <Section />}`) — zero intent-string branching (Guardrail #2)
- [x] Add GREEN verdict Duplicate PO mock (exc-009: $504 auto-blocked, L1 autonomy)
- [x] Enrich YELLOW verdict mocks (exc-002, exc-006) with `duplicate_detection` and `order_comparison` data
- [x] Wire WebSocket to exception detail panel via `onRefreshRef` callback for real-time pipeline updates
- [x] Add left border color indicators to exception list cards (green=auto-resolved GREEN, blue=selected)
- [x] Add "Resolved" badge on terminal lifecycle state cards with GREEN verdict
- [x] Update `ui_architecture.md` Section 5.2 with decomposition table and new types

✅ Outcome: Duplicate PO exceptions render rich detection + comparison data. Detail panel decomposed for maintainability. WebSocket wired for real-time updates. 9 mock exceptions, 242 tests pass. (2026-04-15)

---

### [x] PHASE 8.9: Shadcn/ui + Tailwind CSS Migration
- [x] Phase 0: Map 137 CSS custom properties to `tailwind.config.ts`, install Shadcn deps (CVA, clsx, tailwind-merge, @radix-ui/react-slot), create `cn()` utility, add `components.json`
- [x] Phase 0: Install `next-themes`, wire `ThemeProvider` with `defaultTheme="system"`, define `.dark` token variants in `design-tokens.css`
- [x] Phase 1: Create Shadcn-style Select (Radix), DropdownMenu (Radix), Dialog (Radix) components
- [x] Phase 1: Replace raw `<select>` in ExceptionListPane with Shadcn Select
- [x] Phase 1: Replace NavBar user avatar + sign-out with DropdownMenu
- [x] Phase 2: Rewrite Button, Card, Input, Badge with CVA + Tailwind (same props API, zero consumer changes)
- [x] Phase 3: Convert 17 files from inline `style={{}}` to Tailwind classes (exception detail sub-components + reusable UI components)
- [x] Phase 4: Convert all page files (login, settings, dashboard, inbox, exceptions)
- [x] Phase 4: Convert Phase 3 leftovers (AgentReasoningCard, WaterfallStepper, PricingWaterfall)
- [x] Phase 4: Clean up design-tokens.css (remove duplicate utility classes, move to globals.css)
- [x] Inline style reduction: 492 → 18 (96%). Remaining 18 are all data-driven dynamic values.

✅ Outcome: Full Shadcn/ui + Tailwind CSS styling. System-default dark mode. 17 components restyled. 3 Shadcn Radix primitives added. 242 tests pass. (2026-04-15)

---

### [x] PHASE 8.10: Exception Type Enrichment Sections (Price, Back-Order, Over Max, MOQ, Pallet Config)
- [x] `PriceAnalysisSection` (`src/app/exceptions/PriceAnalysisSection.tsx`) — price delta bars (ERP vs PO), metric tiles, collapsible SAP context card
- [x] `BackOrderSection` (`src/app/exceptions/BackOrderSection.tsx`) — GapBar (ordered vs available), DC inventory snapshot, substitute SKUs, ranked resolution options with multi-dimensional scoring
- [x] `OverMaxSection` (`src/app/exceptions/OverMaxSection.tsx`) — exceedance bar, collapsible order lines table, AI trim plan with TRIM/SKIP/OK actions and totals
- [x] `MOQSection` (`src/app/exceptions/MOQSection.tsx`) — shortfall bar, SAP V4082 block detail, AI round-up plan with ROUND_UP/ACCEPT_BELOW/ESCALATE, collapsible SAP execution steps
- [x] `PalletConfigSection` (`src/app/exceptions/PalletConfigSection.tsx`) — KPI strip (cases/loose/labor/freight), per-line pallet fill bars with violation badges, AI suggested plan table
- [x] `GapBar` reusable component (`src/components/ui/GapBar.tsx`) — horizontal ordered-vs-available/max bar with shortfall/excess modes, used by BackOrderSection, OverMaxSection, MOQSection
- [x] New types in `src/types/exceptions.ts`: `PriceAnalysisData`, `BackOrderAnalysisData` + sub-types (`WarehouseInfo`, `AlternateWarehouse`, `SubstituteSKU`, `ResolutionOption`), `OverMaxAnalysisData` + sub-types (`OverMaxLine`, `TrimPlanLine`), `MOQAnalysisData` + sub-types (`RoundUpPlanLine`, `SAPStep`), `PalletAnalysisData` + sub-types (`PalletLine`, `PalletSuggestion`)
- [x] New `OrderAnalysis` optional fields: `price_analysis?`, `backorder_analysis?`, `overmax_analysis?`, `moq_analysis?`, `pallet_analysis?`
- [x] New mock exceptions: exc-010/exc-011 (BACK_ORDER), exc-012 (OVER_MAX), exc-013 (MIN_ORDER_QTY), exc-014 (PALLET_CONFIG)
- [x] Health endpoint expanded: `allowed_intents` now includes BACK_ORDER, OVER_MAX, MIN_ORDER_QTY, PALLET_CONFIG; `allowed_recipes` includes BackOrderResolutionRecipe.py, OverMaxTrimRecipe.py, MOQRoundUpRecipe.py, PalletAlignmentRecipe.py
- [x] All sections follow data-presence pattern — zero intent-string branching (Guardrail #2)
- [x] `ExceptionDetailPanel` wires all 5 new sections via conditional render on optional `OrderAnalysis` fields

✅ Outcome: 5 exception type enrichment sections with dedicated renderers. GapBar reusable component. 14 mock exceptions covering 8 intent types. 252 tests pass. (2026-04-16)

---

### [x] PHASE 8.11: Server-Side User Profiles & Account Scoping
- [x] `AuthUser` type updated (`src/types/auth.ts`) — added `title`, `avatar_initials`, `assigned_accounts`, `visible_tabs`; added `UserListResponse` type
- [x] `ExceptionSummary` type updated (`src/types/exceptions.ts`) — added `account_id`, `account_name`
- [x] 6 mock users in `src/lib/api.ts` — jane@acme.com (admin), marcus.webb@acme-corp.com (admin), sarah.chen (manager), sarah.chen.sr (analyst), james.ortiz (analyst, scoped to acct-walmart/acct-kroger), priya.nair (analyst, scoped to acct-target/acct-costco)
- [x] `computeVisibleTabs()`, `listUsers()`, `switchUser()` endpoints in `src/lib/api.ts`
- [x] NextAuth config (`src/lib/auth.ts`) passes `title`, `avatar_initials`, `assigned_accounts`, `visible_tabs` through JWT→session
- [x] `useAuth` hook (`src/hooks/useAuth.ts`) exposes `visibleTabs`, `assignedAccounts` from session
- [x] `UserSwitcher` component (`src/components/ui/UserSwitcher.tsx`) — sandbox-only user switcher with server round-trip via `signIn("credentials")` flow
- [x] Tab visibility derived from RBAC via `computeVisibleTabs()` — all 4 pages filter tabs via `visibleTabs`
- [x] Customer scope filtering via `assigned_accounts` on JWT (server-enforced)
- [x] RBAC permission gating on approve/reject/escalate actions via `hasPermission()` in `ExceptionDetailPanel.tsx`
- [x] Mock exceptions enriched with `account_id` and `account_name`
- [x] Test fixtures updated with `assigned_accounts`, `visible_tabs`
- [x] 17 new architectural tests (`tests/architectural/user_profiles.test.ts`) — 269 total tests

✅ Outcome: Server-side user profiles with RBAC-derived tab visibility, account-based scope filtering, UserSwitcher for sandbox mode, and permission gating on actions. 6 seed users. 269 tests pass. (2026-04-16)

---

## Remaining Phases

### [ ] PHASE 9: Settings & Admin Page
**Scope:** Section 11.5 — user management, SSO config, policy overrides, agent settings.
- [x] Settings page stub (`src/app/settings/page.tsx`) — created in Phase 8.7
- [ ] User management (admin-only) — list users, assign roles
- [ ] Policy overrides (admin-only) — `PUT /api/v1/policies/{tenant_id}`
- [ ] Agent settings — kill switch toggle, explain mode toggle
- [ ] RBAC enforcement — settings page gated to admin role

---

### [ ] PHASE 10: Testing
**Scope:** Expand test coverage (Vitest + React Testing Library already configured, 269 tests passing).
- [ ] Component unit tests for PricingWaterfall (new component)
- [ ] `vitest-axe` accessibility tests on status-related components (Badge, Toast, AgentReasoningCard)
- [ ] Guardrail #2 lint rule (`no-hardcoded-enums` ESLint custom rule)
- [ ] Type contract tests — verify TypeScript types compile against mock API data
- [ ] Page integration tests — Exception Queue expand, line-item grid, sidebar open
- [ ] Inbox page integration tests — shared component rendering, badge variants

---

### [ ] PHASE 11: Deployment
**Scope:** Container build, CI/CD, pre-commit hooks.
- [ ] Dockerfile (standalone Next.js build, non-root user)
- [ ] `.pre-commit-config.yaml` with `gitleaks` for secret scanning
- [ ] GitHub Actions CI: lint, type-check, test, build
- [ ] `truffleHog` CI scan for credential detection
- [ ] Docker Compose integration with `asoe2` containers

---

## PHASE 12 — Override Action UI (stakeholder "Option A"): complete

Branch: `claude/fix-override-action-agents-IkRPl`. Paired with
asoe2 Phase 19 (backend consolidation) + Phase 20 (hash-chained audit).

### 12.1 AgentReasoningCard button matrix (Option A)
- [x] YELLOW / analyst: `[Approve] [Reject] [Escalate]` (1-click)
- [x] YELLOW / manager+: adds `[Decide…]` to the row (opens chooser)
- [x] GREEN / manager+: `[Decide…]` only (passive auto-ack on list)
- [x] RED / manager+: `[Decide…] [Escalate]`
- [x] FAILED / isErrored: `[Escalate for Triage]` only
- [x] Removed old "Acknowledge" button (was silently calling Approve)
- [x] `canOverride` / `canApprove` / `canEscalate` props replace the
      legacy `isAdmin` gate
- [x] `actionInFlight` prop drives pessimistic UI — disables peer
      buttons, swaps the in-flight button's label to "Verbing…"
✅ Outcome: analyst queue-clearing is 1 click; manager+ sees the chooser
   affordance only when they have the permission.

### 12.2 Label + accessibility
- [x] Visible labels: short verbs (Approve / Reject / Decide… / Escalate
      / Re-analyze)
- [x] aria-label / translation-key source strings: long-form noun
      phrases (Approve recommendation / Reject recommendation / Choose
      different action / Send for triage / Re-analyze exception)
- [x] Approve shows a hover tooltip preview of the recipe's
      recommended action when available
      ("Approve: Apply Contract Price")
- [x] Decide… hover tooltip carries "Choose different action"
- [x] `Override…` → `Decide…` rename (voice-of-user research: the
      word "override" carried negative connotation and was avoided)
✅ Outcome: screen readers still hear the full noun phrase; visual
   users see short verbs; mouse-hover reveals the full description.

### 12.3 ExceptionDetailPanel wiring
- [x] Passes the missing `onOverride` / `canOverride` / `canApprove` /
      `canEscalate` / `actionInFlight` props that were never hooked up
      in Phase 1 (original bug)
- [x] `handleOverride` opens the chooser dialog; `submitOverride`
      validates action + reason_tag + notes before the network call
- [x] Override chooser dialog:
      - Resolution-action select sourced from
        `health.allowed_resolution_actions` (falls back to
        record-specific narrower set if server supplied one)
      - Reason-category select sourced from
        `health.allowed_override_reason_tags_by_intent[detail.intent]`,
        falling back to the global list (Guardrail #2 — zero hardcoded
        codes in .tsx)
      - Mandatory notes (SOX)
- [x] Four-eyes cosign banner when `lifecycle_state === "PENDING_COSIGN"`:
      shows initiator / action / reason / impact; non-initiator
      manager+ sees [Approve cosign] / [Reject cosign]; initiator sees
      read-only "awaiting cosign" message
- [x] `handleEscalate` now calls `exceptionsApi.escalate` (was
      piggybacking on `exceptionsApi.override({ action: "ESCALATE" })`)
- [x] `handleApprove` / `handleReject` / `submitOverride` all route
      through `exceptionsApi.disposition` after Phase 3 consolidation
      (old `approve`/`reject`/`override` client methods deleted)
✅ Outcome: Option A UI is fully wired end-to-end; no unreachable
   buttons; no semantic mismatches between visible action and network
   call.

### 12.4 Types and API client
- [x] `OverrideRequest` (Phase 2) → re-exported from `contracts.ts` →
      deleted in Phase 3 once all call sites migrated to `DispositionRequest`
- [x] `EscalateRequest` added with `reason` + optional `to_role`
- [x] `CosignRequest` added with `approve` + mandatory `notes`
- [x] `DispositionRequest` with `action`, `notes`, `reason_tag`
- [x] `HealthResponse` extended with `allowed_resolution_actions`,
      `allowed_override_reason_tags`, and
      `allowed_override_reason_tags_by_intent`
- [x] `LifecycleState` union: dropped `EXECUTING`, added `PENDING_COSIGN`
- [x] Shared generated types (`src/types/generated.ts` via
      `openapi-typescript`); curated aliases in `src/types/contracts.ts`
- [x] Drift test `tests/architectural/openapi_drift.test.ts`
- [x] npm scripts: `generate-types`, `verify-types`
- [x] `exceptionsApi.disposition()` / `.escalate()` / `.cosign()`
- [x] Client-generated Idempotency-Key (UUID v4) on every mutating call
- [x] Mock implementations mirror backend four-eyes semantics —
      `MOCK_PENDING_OVERRIDES` staging + `MOCK_FINANCIAL_IMPACT_USD`
      so `exc-001` and `exc-010` trigger the cosign flow in demo mode
✅ Outcome: types are contract-driven; mock mode behaves identically
   to real-backend mode for every new flow.

### 12.5 RBAC
- [x] `exceptions:escalate` permission added to analyst / manager /
      admin in `src/lib/roles.ts` (mirrors asoe2 `api/deps.py`)
- [x] `exceptions:override` narrows to manager + admin (unchanged)
- [x] All mutating button visibility derives from `hasPermission(...)`
      at the page level and `canX` flags at the component level —
      never `isAdmin` / `userRole === "admin"` literals
✅ Outcome: permission gating is one layer (props) that mirrors the
   backend permission surface.

### 12.6 Tests
- [x] 322 passed (+ audit-chain + drift + four-eyes + aria-label +
      idempotency + Decide… rename + Approve tooltip + disposition
      migration)
- [x] Full matrix coverage: verdict × role × action for visible button
      presence, aria-labels, titles, in-flight pessimistic states
✅ Outcome: regression safety for every Option A eligibility row.

### 12.7 Documentation
- [x] `DESIGN.md` — new components, handlers, types, endpoints, cosign
      banner, Decide… rename
- [x] `ui_architecture.md` — Section 12 Override Action governance
      (added); drift-register entry for the rename
- [x] `docs/AUDITOR_GUIDE.md` — new RBAC surface + audit event sub_type
      semantics
- [x] `README.md` — mock demo (four-eyes at `exc-001` / `exc-010`)
- [x] `tasks.md` — this checklist

---

## Phase 5 — Deferred: curated per-intent reason_tag vocabularies
**(Tracked in asoe2/tasks.md Phase 5.)** The framework ships on the UI
side as well: the Override chooser already narrows by
`health.allowed_override_reason_tags_by_intent[detail.intent]`. When
product/compliance curates per-intent categories, a single regen
(`npm run generate-types`) updates the UI — no .tsx changes required.
