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

### [x] PHASE 8.12: Verdict UI Sync (audit-gap surface + ADR-025 pipeline)
**Companion to:** asoe2 Verdict full-close engagement (T1-T5 grandfather-clause retirements + ADR-025 graph reorder).
- [x] `exceptionsApi.orderAnalysis()` real-API branch (`src/lib/api.ts`) — UI now actually fetches `/api/v1/exceptions/{id}/analysis` from the backend in real-API mode; was mock-only and silently dropped every enrichment section
- [x] `PipelineNode` union (`src/types/exceptions.ts`) — adds `build_analysis`; reorders `select_recipe / resolve_dependencies / validate_types` BEFORE `shadow_audit` per ADR-025
- [x] `WaterfallStepper.NODE_LABELS` (`src/components/ui/WaterfallStepper.tsx`) — adds "Build Analysis" + dataSummary surfaces audit-gap fields
- [x] `AgentReasoningCard.NODE_LABELS` + `ActivityIndicator.NODE_MESSAGES` — same refresh
- [x] Mock pipeline factory (`src/app/exceptions/shared.tsx`) — `PIPELINE_NODES` reordered + `build_analysis` appended; `STATE_PROGRESS` recalibrated for the 11-node sequence; `SHADOW_GATED_TERMINAL_STATES` set + skipped-middle logic so YELLOW/RED paths show `execute_recipe / apply_effects` skipped while `build_analysis` is completed
- [x] `TraceResponse` UI type (`src/types/api.ts`) gains `audit_context_missing_class` + `audit_context_missing_fields` (mirrors backend Pillar 2.3)
- [x] Mock trace generator (`src/lib/api.ts::exceptionsApi.trace`) synthesises audit-gap fields when `final_status === "AUDIT_CONTEXT_MISSING"`; `gateway_calls` reflects ADR-025 (read-side calls present even on shadow-gated records)
- [x] DiagnosticsSection (`src/app/exceptions/DiagnosticsSection.tsx`) renders the structured audit-gap surface (class + ordered field list)
- [x] `tests/browser/enrichment-sections.spec.ts` (6 new specs): live-stack coverage for BackOrder, DuplicatePO + OrderComparison, DeliveryDelay, OverMax, MOQ, PriceAnalysis
- [x] Brittle Playwright specs fixed: Override locator (matches "Choose different action" aria-label); `createYellowException` helper now seeds a real YELLOW BACK_ORDER fixture; EdiMismatchSection scoped to its accessible region to avoid strict-mode multi-match
- [x] Vercel build fix: `orderAnalysis()` 404 detection uses `err instanceof Error` + regex on http() message format (was casting to APIError which has no `.status`)

✅ Outcome: D18 drift register flipped PARTIAL 6/10 → SHIPPED 10/10. Mock pipeline reflects ADR-025 (gateway READS pre-shadow + `build_analysis` terminal). Audit-gap surface visible on every record that fails coverage. 474 unit tests pass; 16/16 Playwright e2e green against the live stack. (2026-04-25)

### [x] PHASE 8.13: Post-deploy stabilisation (live-stack fixes + WS resilience)
**Companion to:** asoe2 Phase 26 (post-deploy fixes — JWT TTLs, confidence persistence, V005 migration, ADR-026/027 drafts).
- [x] `useWebSocket` (`src/hooks/useWebSocket.ts`) — REST polling fallback per `ui_architecture.md` §8.4. After `POLL_FALLBACK_THRESHOLD = 5` consecutive failed reconnect attempts, the hook switches to interval polling on `/api/v1/exceptions/{id}` and surfaces `onReconnect` / `onPollFallback` callbacks so the detail panel can re-fetch quietly. (Container Apps closes idle WS at 4 minutes; this prevents the stale-detail-panel observed during long YELLOW reviews.)
- [x] `useWebSocket` JWT auth — uses the real backend access token from session storage instead of the `'mock-ws-token'` placeholder; first message remains the Section 8 `{type: "auth", token}` envelope.
- [x] `ExceptionDetailPanel` (`src/app/exceptions/ExceptionDetailPanel.tsx`) — adds an `executionError` render branch between verdict-present and shadow-pending fallback. A `lifecycle === "FAILED"` record now shows "Pipeline failed at <node>" with the trace explanation and timestamp, instead of the misleading "Shadow has not yet completed" copy that previously rendered for every FAILED state.
- [x] AgentReasoningCard `executionError` prop wiring — the card drives the FAILED banner via `executionError !== undefined`, distinct from RED verdict (compliance decision). `canReanalyze` predicate unchanged (still permits YELLOW + cosign + escalated states).
- [x] Detail panel 401 surfacing — when the WS auth handshake or REST refresh returns 401, the panel surfaces the unauthenticated state inline rather than silently dropping the record. Auto re-fetch on WS reconnect.
- [x] List pagination — `exceptionsApi.list` uses cursor pagination (mirrors backend `next_cursor` envelope); silent refresh on `task_complete` WS events keeps the list current without flicker.
- [x] `exceptionsApi.reanalyze` (`src/lib/api.ts`) — adds the missing `if (USE_REAL_API)` branch. Was silently mock-only; against the live backend, the mock-find returned undefined and threw "Exception not found" on every Reanalyze click.
- [x] Pipeline confidence projection (`src/app/exceptions/shared.tsx::buildNodeData`) — `classify` row's `data.confidence` now comes from `analysis.confidence / 100` (the real persisted classifier value), with the key omitted entirely when analysis hasn't loaded. Per-node random `duration_ms` synthesis removed (Verdict 2026-04-22 / Guardrail #6 violation — UI no longer fabricates timings the backend doesn't emit).
- [x] Architectural lock test (`tests/architectural/exceptions_api_live_branches.test.ts`) — walks every `LIVE_METHODS` entry asserting `if (USE_REAL_API)` and the matching path fragment exist; reanalyze-specific regression assertion: `USE_REAL_API` must appear textually before `MOCK_EXCEPTIONS.find`.
- [x] Vitest: 519 passed across 38 files, no regressions.

✅ Outcome: live-stack stabilisation. Reanalyze works end-to-end. FAILED records render an honest pipeline failure banner with the node name. WS resilience matches `ui_architecture.md` §8.4. Confidence pill driven by the real backend value, not synthesis. (2026-05-01)

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
- [x] YELLOW / manager+: adds `[Override…]` to the row (opens chooser)
- [x] GREEN / manager+: `[Override…]` only (passive auto-ack on list)
- [x] RED / manager+: `[Override…] [Escalate]`
- [x] FAILED / isErrored: `[Escalate for Triage]` only
- [x] Removed old "Acknowledge" button (was silently calling Approve)
- [x] `canOverride` / `canApprove` / `canEscalate` props replace the
      legacy `isAdmin` gate
- [x] `actionInFlight` prop drives pessimistic UI — disables peer
      buttons, swaps the in-flight button's label to "Verbing…"
✅ Outcome: analyst queue-clearing is 1 click; manager+ sees the chooser
   affordance only when they have the permission.

### 12.2 Label + accessibility
- [x] Visible labels: short verbs (Approve / Reject / Override… / Escalate
      / Re-analyze)
- [x] aria-label / translation-key source strings: long-form noun
      phrases (Approve recommendation / Reject recommendation / Choose
      different action / Send for triage / Re-analyze exception)
- [x] Approve shows a hover tooltip preview of the recipe's
      recommended action when available
      ("Approve: Apply Contract Price")
- [x] Override… hover tooltip carries "Choose different action"
- [x] Visible label stayed `Override…` after a Phase 3 rename-and-revert
      cycle (briefly `Decide…`; reverted in Phase 4 because the button
      is manager+ only and SOX §404 names the act "management override").
      See ui_architecture.md drift register D12.
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
      idempotency + Approve tooltip + disposition migration)
- [x] Full matrix coverage: verdict × role × action for visible button
      presence, aria-labels, titles, in-flight pessimistic states
✅ Outcome: regression safety for every Option A eligibility row.

### 12.7 Documentation
- [x] `DESIGN.md` — new components, handlers, types, endpoints, cosign
      banner
- [x] `ui_architecture.md` — Section 12 Override Action governance
      (added); drift register D12 captures the Phase 3 rename-and-revert
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

---

## PHASE 13 — OM Coverage Expansion: PRICE_HOLD_RELEASE + EDI_MISMATCH + ERP label map

UI side of asoe2's PHASE 21 (see
`asoe2/docs/adr/ADR-024-om-coverage-expansion.md`). Two new asoe2
intents land as data-presence enrichment sections; a display-only ERP
label-map config lets the same canonical codes render in SAP / Oracle /
Salesforce / GENERIC terminology without touching backend contracts.

### 13.1 Types (additive only)
- [x] `src/types/exceptions.ts` — `PriceHoldAnalysisData`,
      `PriceHoldAction`, `EdiMismatchAnalysisData`,
      `EdiMismatchClassification` interfaces; optional
      `price_hold_analysis` / `edi_mismatch_analysis` fields on
      `OrderAnalysis`. `Intent` / `RecipeName` unions left untouched
      (already-stale dead exports per architecture review).
- [x] `npm run generate-types` regen against asoe2's OpenAPI snapshot.

### 13.2 Section components (data-presence enrichment)
- [x] `src/app/exceptions/PriceHoldSection.tsx` — PO vs SAP base price
      cards, signed `variance_pct`, hold_status / tolerance /
      hard_block thresholds, recipe action badge (AUTO_RELEASE /
      ESCALATE / HARD_BLOCK), reason. Reads only from
      `analysis.price_hold_analysis`; matches the invariant held by
      all 8 existing sections.
- [x] `src/app/exceptions/EdiMismatchSection.tsx` — sub_type rendered
      verbatim (matching `delay_category` convention),
      `expected_value` vs `received_value` cards (any shape via
      `renderUnknown` helper), classification badge, recommended
      action, autonomy level.
- [x] `ExceptionDetailPanel.tsx` — two new conditional render blocks
      added to the data-presence enrichment area.

### 13.3 ERP label-map config
- [x] `src/config/erp-label-map.ts` — `ErpVendor` union,
      `ERP_LABEL_MAPS` table for SAP / Oracle / Salesforce / GENERIC,
      `intentLabelFor()` and `subTypeLabelFor()` resolvers with two-tier
      fallback (vendor → GENERIC → title-cased code).
- [x] `src/hooks/useErpProfile.ts` — module-memoised env parse.
      `useErpProfile()`, `useIntentLabel()`, `useSubTypeLabel()`.
- [x] `next.config.mjs` — `NEXT_PUBLIC_ASOE_ERP_VENDOR` default `SAP`
      committed so production + previews render SAP-native vocabulary
      without per-environment Vercel setup.
- [x] Wired four display sites: dashboard `by_intent`, exception list
      filter dropdown, exception list row badge, AgentReasoningCard
      Intent label.

### 13.4 Mock fixtures
- [x] `tests/fixtures.ts` — `MOCK_HEALTH` updated to the 6-intent
      vocabulary; `MOCK_STATS` bumped (8 → 12) with consistent totals
      across `by_intent` / `by_lifecycle_state` / `by_shadow_verdict`;
      seven new exception fixtures (3 PHR action branches + 4 EDM
      sub_types); routing-fork fixture
      `PRICE_MISMATCH_CONTRACTUAL_EXCEPTION`; helper factories
      `makePriceHoldAnalysis()` and `makeEdiMismatchAnalysis()`.
- [x] `src/lib/api.ts` — five new mock exceptions (exc-017..021) with
      full `OrderAnalysis` payloads matching the density of the
      pre-existing entries (entity_profile, impact_metrics, lines,
      pricing waterfalls). exc-021 demonstrates the routing fork —
      `event_type=EDI_850_LINE_MISMATCH` lands as `CONTRACTUAL_CORRECTION`
      and renders `PriceAnalysisSection` (not `EdiMismatchSection`).
- [x] Atomic golden updates: `tests/architectural/type_contracts.test.ts`
      `toHaveLength(4)/3` rewritten as `toContain(...)` so future
      vocabulary expansions don't require the same sweep;
      `guardrail2.test.ts` `INTENT_LITERALS` extended.

### 13.5 Tests
- [x] Component: `tests/components/PriceHoldSection.test.tsx` (8 cases),
      `tests/components/EdiMismatchSection.test.tsx` (8 cases).
- [x] Contract: `tests/e2e/price_hold_release_data_flow.test.tsx` and
      `tests/e2e/edi_mismatch_data_flow.test.tsx` mirror the 9-group
      structure of `duplicate_po_data_flow.test.tsx`. Includes the
      PRICE_MISMATCH non-double-render invariant — RTL assertion that
      `EdiMismatchSection` does NOT mount when only `price_analysis`
      is present.
- [x] Three-tier HITL: `tests/e2e/three_tier_hitl.test.tsx` extended
      with PHR HARD_BLOCK admin-release + EDM SKU admin-release cases.
- [x] Architectural: `tests/architectural/rbac_enforcement.test.ts`
      gains permission-gating cases for both new intents.
- [x] Accessibility: `tests/accessibility/status_components.test.tsx`
      jest-axe sweep over both new sections.
- [x] Browser: `tests/browser/price-hold-detail.spec.ts` and
      `tests/browser/edi-mismatch-detail.spec.ts` — Playwright,
      live-backend. Section-render assertions are `test.skip` pending
      asoe2 promotion of `OrderAnalysis.price_hold_analysis` /
      `edi_mismatch_analysis` to the live response.
- [x] Config resolver: `tests/config/erp-label-map.test.ts` (21
      cases) — per-vendor coverage, vendor-specific resolution,
      fallback chain, invalid-vendor coercion.

### 13.6 Documentation
- [x] `DESIGN.md` — new section components catalogued (Section 1
      module structure + Section 2 sub-component table); data-presence
      snippet extended; mock-data stats updated (14 → 21 exceptions,
      8 → 11 intents, 7 → 10 recipes); new Section 8.1 for the ERP
      label-map config + hook.
- [x] `ui_architecture.md` — Section 5.2 sub-component table extended;
      data-presence snippet extended; drift entries D15 (OM coverage
      expansion) and D16 (ERP-vendor display labels) added to Section 9.
- [x] `README.md` — `NEXT_PUBLIC_ASOE_ERP_VENDOR` added to the
      Environment Variables table.
- [x] `tasks.md` — this checklist.

✅ Outcome: PRICE_HOLD_RELEASE and EDI_MISMATCH exceptions render with
the same Layer-1 + Layer-2 treatment as the older intents. ERP-vendor
display labels swap with a single env var, no code changes.

---

## TODO — `NEXT_PUBLIC_SHOW_PREVIEW_INTENTS` contract gate (backlog)

**Status:** deferred. Asoe2 is landing backend support for the 5 intents
that are currently UI-only (BACK_ORDER, OVER_MAX, MIN_ORDER_QTY,
PALLET_CONFIG, DELIVERY_DELAY). Once that lands, the UI mock no longer
diverges from real backend for these intents and the gate is
unnecessary. Keep this entry in case a future wave of speculative UI
work outpaces backend again.

**Motivation (from cross-repo drift review):** mock `src/lib/api.ts`
ships with intents the backend doesn't classify. The moment the UI
points at a real backend, preview intents disappear from filters and
mock fixtures stop rendering. A silent drift is worse than a loud one.

**Proposed design:**
- New env var `NEXT_PUBLIC_SHOW_PREVIEW_INTENTS` (default `true` in
  dev / demo, `false` in CI + production builds). Distinct from
  `NEXT_PUBLIC_SHOW_PREVIEW_FEATURES` — that flag gates preview *tabs*
  on the detail panel, this one gates the *mock health contract shape*.
- Maintain a `PREVIEW_INTENTS` constant in `src/lib/api.ts` listing
  whichever intents are currently UI-only (empty once asoe2 has
  parity).
- When the flag is `false`:
  - `MOCK_HEALTH.allowed_intents` drops the preview entries.
  - `exceptionsApi.list()` filters out mock exceptions whose intent is
    in `PREVIEW_INTENTS`.
  - Analysis fixtures for those intents never reach the detail panel.
- Preview-only fields on `OrderAnalysis` (e.g., `backorder_analysis`
  once BACK_ORDER is backend-backed, hypothetical new additions later)
  should carry a `// preview-only` comment so real-backend code
  doesn't read them expecting data that may never arrive.
- Lint rule or code review discipline for the comment marker.

**Proposed test:** `tests/architectural/real_backend_parity.test.ts`.
With the flag set to `false`, fetch the real backend's `/api/v1/health`
(in CI that means the asoe2 FastAPI container) and assert
`MOCK_HEALTH.allowed_intents === realHealth.allowed_intents`. Catches
the day a new intent is added to one side without the other.

**Drift register:** entry D18 in `ui_architecture.md` §9 documents
the same gap as "OrderAnalysis enrichment fields are mock-only"
(cross-repo review H5). The gate pattern proposed here would close
it once real curation lands. D17 (cross-repo review H4) covers the
companion reason_tag drift, now verified as non-divergent (both
sides seed global tags for every intent) until asoe2 Phase 5
lands real per-intent curation (review L4).

**Rationale for deferral:** the reason the gate was proposed — 5
UI-only intents diverging from the backend — is about to be eliminated
by backend parity work in asoe2. Shipping the gate now would be
defensive infrastructure for a problem the backlog is actively
closing. Keep the design notes here so the pattern is ready to revive
if the situation recurs.

**Cross-repo review traceability (H4 / H5 / L2 / L4):**
- H4 RESOLVED: mock `allowed_override_reason_tags_by_intent` matches
  backend (both seed every intent with the global list). Drift
  register D17. No code change needed; follow-up is L4.
- H5 / L2 PARTIAL: SIX of ten enrichment fields are now backend-backed
  via the `asoe2/api/analysis_adapters.py::ANALYSIS_ADAPTERS`
  registry, plus the full Verdict three-pillar architecture is in
  place (Pillar 1 `enrichment_context` persistence, Pillar 2
  `build_analysis` graph node + composer-backed read path + structured
  trace surface, Pillar 3 `EvidenceBlock` UI primitive +
  `useConditionalField` hook):
    * `price_hold_analysis` (adapt_price_hold)
    * `edi_mismatch_analysis` (adapt_edi_mismatch)
    * `delivery_delay_analysis` (adapt_delivery_delay) — first
      EvidenceBlock consumer + "Context Not Required for Resolution"
      placeholder for grandfathered at_risk
    * `overmax_analysis` (adapt_overmax) — `overmax_gateway_gap`
      grandfather covers contract_ref + block_status + block_reason +
      order_lines + trim_plan + uom
    * `moq_analysis` (adapt_moq) — `moq_gateway_gap` grandfather
      covers moq_source + channel + contract_ref + block_status
    * `pallet_analysis` (adapt_pallet) — recipe + UI shapes 1:1, no
      grandfather needed
  The six matching `// preview-only` markers dropped from
  `src/types/exceptions.ts`. Drift register D18 updated to PARTIAL
  (6/10). The remaining four (`duplicate_detection`,
  `order_comparison`, `price_analysis`, `backorder_analysis`) are
  gated on gateway-persistence work (C1-C7 in the consolidated
  backlog) — adapter-alone can't close them; they need upstream
  schema changes to persist matched_po_details / warehouse snapshots /
  contract refs onto the record.
- L4 OPEN: tracked in asoe2 Phase 5 ("Deferred — curated per-intent
  reason_tag vocabularies"). Closes D17 when it lands.

### L2d (follow-up) — adapters for the remaining 8 enrichment fields

**Why these didn't land alongside PHR + EDI:** PHR and EDI mapped
cleanly because their UI types were co-designed with the recipe
output shape — every UI field corresponded to something the recipe
computed. The remaining 8 enrichment types were designed earlier for
mock-layer fidelity and expect fields the current recipes do NOT
produce: warehouse snapshots, contract refs, SAP block messages,
primary/alternate DC data, order snapshots, `OrderSnapshot` pairs,
`SAPStep[]` etc. An adapter alone cannot close the gap — the work
per section is:

1. **Backend adapter** (like `adapt_price_hold`) — projects the
   recipe output into the subset of UI fields it can populate.
2. **UI type relaxation** (`src/types/exceptions.ts`) — mark
   recipe-unavailable fields optional so the adapter's partial
   projection compiles.
3. **UI component update** — each `*Section.tsx` currently
   dereferences `data.field` directly; fields that become optional
   need `—` / "Not available" / hidden-row fallbacks.
4. **Backend schema + OpenAPI regen** — same pattern as L2a/L2b.
5. **TestAnalysis cases** — one per branch; regression on
   `openapi/asoe2.openapi.json` stays enforced by the existing
   fitness test.

Order of adoption (suggested, by complexity):

- `delivery_delay_analysis` — DeliveryDelayResolutionRecipe. Recipe
  output covers days_late / classification / delay_category /
  alternate_options. Event supplies planned_date / projected_eta /
  affected_lines. Missing: rule_id (policy-injected), delay_reason
  (free text), at_risk (revenue calc), sla_deadline (contract). UI
  type needs ~4 fields optional + fallback rendering.
- `overmax_analysis` — OverMaxTrimRecipe. Recipe covers excess_qty /
  exceedance_pct / trim_plan. Missing: contract_ref, block_status,
  block_reason, per-line description. UI type needs ~5 fields
  optional.
- `moq_analysis` — MOQRoundUpRecipe. Recipe covers
  shortfall_qty / shortfall_pct / uplift_* / round_up_plan. Missing:
  moq_source, channel, block_message, contract_ref, unit_cost,
  sap_steps. UI type needs ~6 fields optional.
- `pallet_analysis` — PalletAlignmentRecipe. Recipe covers
  classification / lines / suggested_plan. Missing: pallet specs
  (tie, height, layer_cases), carrier, freight_delta, customer
  preferences. UI type needs substantial relaxation.
- `backorder_analysis` — BackOrderResolutionRecipe. Recipe covers
  gap_qty / gap_pct / resolution_options. Missing: warehouse
  snapshots (primary_dc, alternate_warehouses), substitute SKUs,
  inbound PO/production — these are gateway-fetched today but not
  persisted on the record. Requires persisting gateway payload in
  resolution_data OR expanding recipe params → heaviest lift of
  the set.
- `price_analysis` — PriceAdjustmentRecipe. Recipe is minimal
  (applied_condition / new_net_price only). The UI's ~15-field
  PriceAnalysisData is almost entirely ERP metadata (sku,
  material_desc, doc_type, doc_number, rule_id, root_cause_category,
  contract_ref, promotion_ref). Recipe would need to carry ERP
  context through to the output, OR UI type would need severe
  relaxation. Likely the largest investment.
- `duplicate_detection` — DuplicatePORecipe. Recipe computes
  composite_score + classification only. UI wants full `OrderSnapshot`
  pair + days_between + detection_method. Requires persisting
  matched_po_details gateway payload on the record. Same
  gateway-persistence pattern as backorder_analysis.
- `order_comparison` — synthesised from `duplicate_detection`
  payload (no dedicated recipe); lands last; blocked on
  duplicate_detection.

**Per-adapter checklist:**
1. Relax the UI type in `src/types/exceptions.ts` — move
   recipe-unavailable fields to `?:`.
2. Update the matching `*Section.tsx` to render fallbacks for
   now-optional fields (`data.foo ?? "—"` or conditional rows).
3. Add a Pydantic model on `asoe2/api/schemas.py` mirroring the
   relaxed UI type.
4. Add `adapt_<field>()` to `asoe2/api/analysis_adapters.py` with
   recipe-output path + synthetic fallback (if the recipe is called
   via a shadow-gate-able intent) + `None` on degenerate inputs.
5. Register in `ANALYSIS_ADAPTERS` and, if shadow-gated path exists,
   `INTENT_TO_RECIPE_NAME`.
6. Add an optional field on `AnalysisResponse` in `api/schemas.py`.
7. Add `TestAnalysis` cases in `asoe2/tests/test_api.py` covering
   each branch.
8. `python scripts/export_openapi.py` to regenerate
   `openapi/asoe2.openapi.json`.
9. `npm run generate-types` on the UI side.
10. Drop the `// preview-only` marker from the UI type.
11. Update this list + D18 in `ui_architecture.md`.

Each takes ~2–4 hours including tests; the gateway-persistence
ones (backorder, duplicate_detection) need an upstream schema change
to persist gateway-fetched data on the record.

---

## Review-finding follow-ups (open backlog after the 2026-04-25 review)

The 2026-04-25 review surfaced 8 findings. Six landed in
fix-commits (N1 badge fallbacks, N2 partial-truth `?? "—"` removal,
N3 ASOE_ENV default flip, N6 dead `case "EXECUTING"`, N7 composer
docstring; N8 gstack version note logged). Two are intentionally
left open as tracked backlog items because they're broader cleanups
better handled as their own focused PRs than spliced into the fix
batch.

### Open: N4 — `useConditionalField` is a primitive without consumers
**File:** `src/hooks/useConditionalField.ts` (+ test
`tests/hooks/useConditionalField.test.ts`).
**Status:** Implemented + tested + zero importers.
**Why deferred:** the hook was shipped ahead of the per-section
EvidenceBlock refactor (N5 below). Closing the gap means: each
section that owns a conditional field
(`alternate_warehouses`, `substitutes`, `production`, `inbound_po`
on BackOrder; the depends_on predicates listed in
asoe2/compliance/audit_bearing_registry.yaml) wires the hook into
its EvidenceBlock instance so the composer-side
`depends_on resolved_action == X` logic has a UI counterpart.
**Action when picked up:** adopt in `BackOrderSection` first
(richest set of conditional fields), then the others. Each
adoption is a focused commit; the hook's existing tests already
pin its semantics.

### Closed: N5 — EvidenceBlock adoption complete across all *AnalysisData sections
**Already adopted:** `DeliveryDelaySection`, `MOQSection`,
`OverMaxSection`, `PalletConfigSection`.
**Newly adopted (2026-04-26):**
- [x] BackOrderSection (landed 2026-04-25 — 6c7d193). Also closed
  N4 for `alternate_warehouses` / `substitutes` / `production` /
  `inbound_po` via EvidenceBlock + `predicateHolds` from
  `useConditionalField`. ExceptionDetailPanel passes
  `detail.resolved_action`. 6 vitest cases pin pre- and
  post-disposition rendering (resolved_action ∈ {null, ALT_DC,
  SUBSTITUTE, RESCHEDULE, SPLIT_SHIPMENT}).
- [x] DuplicateDetectionSection (audit-bearing
  recommended_action / cancellation_target / autonomy_applied;
  contextual detection_method).
- [x] EdiMismatchSection (audit-bearing expected_value /
  received_value via EvidenceBlock + stringifyUnknown coercion;
  contextual notification_template).
- [x] OrderComparisonSection (audit-bearing orders /
  matching_fields / differing_fields — empty arrays now dev-warn
  rather than silently hiding).
- [x] PriceAnalysisSection (contextual contract_ref /
  promotion_ref / material_desc / order_date wrapped; SapRow
  ad-hoc `&&` guards retired).
- [x] PriceHoldSection (contextual `reason` wrapped; remaining
  fields are audit-bearing and composer-guaranteed).

**Out of scope:** `AgentAnalysisSection` renders `OrderAnalysis`
narrative blocks (`diagnosis` / `root_cause` / `recommendation`)
which are top-level wrapper fields, not classified in
`compliance/audit_bearing_registry.yaml` (the registry covers
`*AnalysisData` Pydantic classes only). All three are non-optional
in `OrderAnalysis` — no absence semantics to gate. EvidenceBlock
adoption does not apply.

**EvidenceBlock primitive change (same engagement):** the
audit-bearing dev-warn gate loosened from
`process.env.NODE_ENV === "development"` to `!== "production"` so
the warning surfaces in vitest runs (NODE_ENV=test) too. Closes a
gap where EdiMismatchSection's existing
`audit-bearing absence (Guardrail #6)` test fixture stopped
asserting the warn after migration.

**Open follow-up:** the `?? "—"` / `data.field ?? fallback`
pattern is now ungrep-able outside of `EvidenceBlock` itself across
the 10 *AnalysisData sections. N5 closed.

### Logged: N8 — gstack 1.5.1.0 → 1.12.2.0
External repo, out of scope here. Logged so the next dependency
review has the ticket.
