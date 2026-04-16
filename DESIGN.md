# DESIGN.md — Code-to-Architecture Map

Maps the UI architecture to concrete source files. Read this to understand how the codebase is organized and where to find things.

> **Authoritative UI architecture:** `ui_architecture.md` — design paradigm, component strategy, page layouts, data flows, alignment & drift register. `consol_arch.md` Section 11 is a stub pointer to `ui_architecture.md`.

---

## 1. Module Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (skip-to-main link + Providers wrapper)
│   ├── providers.tsx             # Client-side providers (SessionProvider + ToastProvider)
│   ├── page.tsx                  # Root redirect → /exceptions
│   ├── login/page.tsx            # Multi-step login (email → password → SSO redirect)
│   ├── auth/callback/page.tsx    # SSO callback handler
│   ├── exceptions/
│   │   ├── page.tsx              # Exception Queue — three-pane Outlook master-detail layout + WebSocket wiring
│   │   ├── ExceptionListPane.tsx # Middle pane: compact card list with search + filters + left border indicators
│   │   ├── ExceptionDetailPanel.tsx  # Right pane: orchestrator composing 13 layer sub-components
│   │   ├── HeaderRibbon.tsx      # Layer 1: breadcrumb context, lifecycle/verdict badges, total value
│   │   ├── ContextStrip.tsx      # Layer 2: Entity Profile + Impact Metrics (collapsible)
│   │   ├── AgentAnalysisSection.tsx  # Layer 3: Problem / Root Cause / Recommendation narratives
│   │   ├── EvidenceGrid.tsx      # Layer 4: collapsible line-item table + pricing waterfall
│   │   ├── DiagnosticsSection.tsx    # Layer 5: pipeline progress + trace evidence (behind toggle)
│   │   ├── DuplicateDetectionSection.tsx  # Data-presence enrichment: original vs duplicate order
│   │   ├── OrderComparisonSection.tsx     # Data-presence enrichment: side-by-side order comparison
│   │   ├── PriceAnalysisSection.tsx       # Data-presence enrichment: price delta bars, metric tiles, SAP context
│   │   ├── BackOrderSection.tsx           # Data-presence enrichment: gap bar, DC inventory, resolution options with scoring
│   │   ├── OverMaxSection.tsx             # Data-presence enrichment: exceedance bar, order lines, AI trim plan
│   │   ├── MOQSection.tsx                 # Data-presence enrichment: shortfall bar, SAP V4082 block, round-up plan
│   │   ├── PalletConfigSection.tsx        # Data-presence enrichment: KPI strip, pallet fill bars, suggested plan
│   │   ├── shared.tsx            # CollapsibleHeader, fmtPrice helpers
│   │   └── [id]/page.tsx         # Full-page exception detail (standalone route)
│   ├── dashboard/page.tsx        # Analytics dashboard (Layout B) + recent activity feed
│   ├── inbox/page.tsx            # Customer Inbox — AI email triage (two-pane layout)
│   ├── settings/page.tsx         # Settings page (Phase 9 stub — admin, SSO, agent config)
│   └── api/auth/[...nextauth]/route.ts  # NextAuth API route
├── components/ui/                # Reusable UI components (Section 11.2)
│   ├── ActivityIndicator.tsx     # Domain-aware loading text per pipeline node
│   ├── AgentReasoningCard.tsx    # Two-layer cognition: Layer 1 + Layer 2
│   ├── Badge.tsx                 # Tinted bg + icon + text, verdict/lifecycle/rootCause helpers
│   ├── Button.tsx                # 5 variants (brand/neutral/success/ghost/destructive)
│   ├── Card.tsx                  # Borderless shadow-elevated container
│   ├── GapBar.tsx                # Horizontal ordered-vs-available/max bar with gap highlight (shortfall/excess modes)
│   ├── GravitationalOrbs.tsx     # Canvas animated background (login page)
│   ├── Input.tsx                 # Label + input + error + right icon
│   ├── Logo.tsx                  # ASOE brand mark with optional tagline
│   ├── MetricTile.tsx            # KPI: icon + label + monospace value + subtitle
│   ├── NavBar.tsx                # 56px glass surface, tabs, agent status pulse
│   ├── PricingWaterfall.tsx      # Vertical pricing condition chain timeline
│   ├── Sidebar.tsx               # 480px slide-right intervention panel
│   ├── Toast.tsx                 # 4.5s auto-dismiss, status-colored, solid-fill
│   └── WaterfallStepper.tsx      # 10-node pipeline progress visualization
├── hooks/
│   ├── useAuth.ts                # Wraps NextAuth session with typed user
│   ├── useHealth.ts              # Fetches runtime enums from /api/v1/health
│   └── useWebSocket.ts           # Section 8 protocol with reconnection backoff
├── lib/
│   ├── api.ts                    # API client: auth + health + exceptions + line items
│   ├── auth.ts                   # NextAuth options (credentials provider, JWT callbacks)
│   ├── roles.ts                  # RBAC permissions aligned with asoe2/api/deps.py
│   └── utils.ts                  # cn() — Tailwind class merge utility (clsx + tailwind-merge)
├── types/
│   ├── auth.ts                   # AuthUser, LoginResponse, Role (← asoe2 schemas)
│   ├── exceptions.ts             # Intent, LifecycleState, ShadowVerdict, ExceptionSummary,
│   │                             # LineItem, PricingWaterfallStep, OrderAnalysis (UI display types)
│   ├── api.ts                    # ResolveRequest/Response, StatsResponse, PaginatedResponse
│   └── websocket.ts              # WSEvent, PipelineProgressPayload, WSAuthMessage
├── styles/
│   └── design-tokens.css         # CSS custom properties (light + dark mode tokens)
├── components.json               # Shadcn/ui configuration (aliases, paths, options)
└── middleware.ts                  # Route protection via NextAuth JWT check
```

---

## 2. Component Catalog

| Component | Source | Section 11.2 | Used By |
|---|---|---|---|
| `Button` | CVA + Tailwind | 5 variants (brand/neutral/success/ghost/destructive), 3 sizes, `asChild` via Radix Slot | All pages |
| `Card` | Tailwind | Borderless shadow-elevated container + compound components (CardHeader/Title/Description/Content/Footer) | Login, Dashboard, Detail |
| `Input` | Tailwind | Label + error + rightIcon, `forwardRef`, focus via Tailwind pseudo-classes | Login, Exception Queue |
| `Badge` | CVA + Tailwind | Tinted bg + icon + text, 5 variant mappers, WCAG icon+text | Exception Queue, Detail, Inbox, Dashboard |
| `Select` | Radix + Tailwind | Keyboard nav, typeahead, scroll buttons, check indicators | Exception Queue filters |
| `DropdownMenu` | Radix + Tailwind | Sub-menus, checkbox/radio items, labels, separators | NavBar user menu |
| `Dialog` | Radix + Tailwind | Overlay, focus trap, close button, header/footer composition | (Available for future use) |
| `Logo` | Tailwind | Brand mark with tagline, 3 sizes | NavBar, Login |
| `NavBar` | Tailwind | 56px glass, agent pulse, DropdownMenu user menu, tab nav | All pages (consistent tabs) |
| `MetricTile` | Tailwind | KPI: 40x40 tinted icon + monospace value | Exception Queue, Dashboard, Inbox |
| `Toast` | Tailwind | 4.5s auto-dismiss, status-colored, slide-in animation | Via ToastProvider |
| `Sidebar` | Tailwind | 480px panel, escape-to-close, focus trap | (Available, not used in Outlook layout) |
| `ActivityIndicator` | Tailwind | Node-specific domain-aware messages | WaterfallStepper |
| `WaterfallStepper` | Tailwind | 10-node pipeline with per-node states | ExceptionDetailPanel |
| `AgentReasoningCard` | Tailwind | Layer 1 only (recommendation + actions), verdict-specific behavior | ExceptionDetailPanel |
| `PricingWaterfall` | Tailwind | Pricing condition chain timeline | ExceptionDetailPanel |
| `GapBar` | Tailwind | Horizontal bar: primary vs secondary qty, shortfall/excess mode, gap indicator | BackOrderSection, OverMaxSection, MOQSection |
| `GravitationalOrbs` | Custom (canvas) | Canvas animated background | Login |

**Styling approach (Phase 8.9):** All components use Tailwind utility classes via the design token mapping in `tailwind.config.ts`. CVA (`class-variance-authority`) is used for multi-variant components (Button, Badge). `cn()` utility (`src/lib/utils.ts`) merges Tailwind classes with conflict resolution. Only 18 inline `style={{}}` objects remain across the entire codebase — all are data-driven dynamic values (avatar colors, bar widths, chart colors).

**Badge variant mappers** (`Badge.tsx`): `verdictVariant()`, `lifecycleVariant()`, `rootCauseVariant()`, `categoryVariant()`, `inboxStatusVariant()` — all follow the same pattern: map API-provided strings to CSS variants with a `default` fallback.

**PricingWaterfall vs WaterfallStepper:** WaterfallStepper visualizes the 10-node pipeline execution (WebSocket-driven). PricingWaterfall visualizes pricing condition chains for line items (API data-driven). They share a timeline visual metaphor but differ in data model and purpose.

**Shadcn components installed:** Select, DropdownMenu, Dialog (Radix primitives + Tailwind styling). **Pending:** DataTable (Tanstack Table), Tooltip.

---

## 3. Page Architecture

### Exception Queue (`/exceptions`) — Three-Pane Outlook Master-Detail

```
NavBar (sticky top, 56px)
├── Tabs: Customer Inbox | Exception Queue | Dashboard | Settings
├── Agent status badge + user avatar
┌──────────────────────────┬─┬────────────────────────────────────────┐
│ Middle Pane (List)       │↔│ Right Pane (Detail)                    │
│ ExceptionListPane        │ │ ExceptionDetailPanel                   │
│ ┌──────────────────────┐ │ │ ┌──────────────────────────────────┐   │
│ │ Title + count + ⟳    │ │ │ │ Header Ribbon (breadcrumb-style) │   │
│ │ Compact metrics      │ │ │ │ SO-1001 > Customer > Location >  │   │
│ │ Search input         │ │ │ │ Primary SKU or "N Lines"         │   │
│ │ State + Intent filter│ │ │ ├──────────────┬───────────────────┤   │
│ ├──────────────────────┤ │ │ │ Entity       │ Impact & Risk     │   │
│ │ Exception Card ●     │ │ │ │ Profile      │ Metrics           │   │
│ │ Exception Card       │ │ │ ├──────────────┴───────────────────┤   │
│ │ Exception Card       │ │ │ │ Agent Analysis                   │   │
│ │ ...                  │ │ │ │ (Problem / Root Cause / Reco)    │   │
│ └──────────────────────┘ │ │ │ AgentReasoningCard (Layer 1/2)   │   │
│                          │ │ │ ▸ Evidence Detail [collapsed]     │   │
│ 35% (resizable)          │ │ │ Pipeline Progress                 │   │
│                          │ │ │ Trace Evidence tabs               │   │
│                          │ │ └──────────────────────────────────┘   │
└──────────────────────────┴─┴────────────────────────────────────────┘
```

**Resizable panes:** `react-resizable-panels` (Group/Panel/Separator). Panel sizes persisted per session. Default 35/65 split.

**Lifted state:** `selectedExceptionId` in parent `page.tsx`. Selecting a card updates the right pane without page reload.

**Filter URL sync:** Filter state (`filterState`, `filterIntent`, `searchQuery`) synced to URL search params (`?state=X&intent=Y&q=Z`) via `useSearchParams`. Persists across page refresh and is shareable. "Filters active" indicator with "Clear all" button shown when any filter is set.

**Error handling:** Fetch errors tracked via `error` state. Distinct UI for error (retry button) vs empty (filter hint) vs loading (skeletons).

**Data flow:** `exceptionsApi.list()` + `exceptionsApi.stats()` → list state → render. Filters trigger re-fetch. First item auto-selected and pre-fetched. Subsequent selections trigger on-demand fetch: `exceptionsApi.get(id)` + `exceptionsApi.trace(id)` + `exceptionsApi.lineItems(id)` + `exceptionsApi.orderAnalysis(id)`.

**Polymorphic detail view:** The right pane (`ExceptionDetailPanel.tsx`) orchestrates 13 sub-components decomposed along the **5-layer axis** (not the intent axis). Each sub-component is intent-agnostic — driven by data presence, not intent strings:

| Layer | Sub-Component | File | Purpose |
|---|---|---|---|
| 1 | `HeaderRibbon` | `HeaderRibbon.tsx` | Breadcrumb context, lifecycle/verdict badges, total value |
| 2 | `ContextStrip` | `ContextStrip.tsx` | Entity Profile + Impact Metrics (collapsible, default expanded) |
| 3 | `AgentAnalysisSection` | `AgentAnalysisSection.tsx` | Problem / Root Cause / Recommendation narratives |
| 3+ | `DuplicateDetectionSection` | `DuplicateDetectionSection.tsx` | Data-presence enrichment: original vs duplicate order, detection method, confidence, autonomy |
| 3+ | `OrderComparisonSection` | `OrderComparisonSection.tsx` | Data-presence enrichment: side-by-side order comparison with matching/differing field badges |
| 3+ | `PriceAnalysisSection` | `PriceAnalysisSection.tsx` | Data-presence enrichment: price delta bars (ERP vs PO), metric tiles, collapsible SAP context card |
| 3+ | `BackOrderSection` | `BackOrderSection.tsx` | Data-presence enrichment: GapBar (ordered vs available), DC inventory snapshot, substitute SKUs, ranked resolution options with multi-dimensional scoring |
| 3+ | `OverMaxSection` | `OverMaxSection.tsx` | Data-presence enrichment: exceedance bar (ordered vs max), order lines table, AI trim plan (TRIM/SKIP/OK actions) |
| 3+ | `MOQSection` | `MOQSection.tsx` | Data-presence enrichment: shortfall bar (ordered vs MOQ), SAP V4082 block detail, AI round-up plan (ROUND_UP/ACCEPT_BELOW/ESCALATE), SAP execution steps |
| 3+ | `PalletConfigSection` | `PalletConfigSection.tsx` | Data-presence enrichment: KPI strip (cases/loose/labor/freight), per-line pallet fill bars with violation badges, AI suggested plan table |
| 4 | `EvidenceGrid` | `EvidenceGrid.tsx` | Collapsed by default; line-item table + pricing waterfall |
| 5 | `DiagnosticsSection` | `DiagnosticsSection.tsx` | Hidden behind "Show Diagnostics" toggle: Pipeline Progress (WaterfallStepper) + Trace Evidence tabs |

**Data-presence enrichment sections** render only when their optional data is present in `OrderAnalysis`:
```tsx
{analysis?.price_analysis && <PriceAnalysisSection data={analysis.price_analysis} />}
{analysis?.duplicate_detection && <DuplicateDetectionSection data={analysis.duplicate_detection} />}
{analysis?.order_comparison && <OrderComparisonSection data={analysis.order_comparison} />}
{analysis?.backorder_analysis && <BackOrderSection data={analysis.backorder_analysis} />}
{analysis?.overmax_analysis && <OverMaxSection data={analysis.overmax_analysis} />}
{analysis?.moq_analysis && <MOQSection data={analysis.moq_analysis} />}
{analysis?.pallet_analysis && <PalletConfigSection data={analysis.pallet_analysis} />}
```
Adding a new enrichment section requires only: (1) add the type to `OrderAnalysis`, (2) create the section component, (3) add the conditional render — zero dispatch logic.

**Shared helpers** (`shared.tsx`): `CollapsibleHeader` (used by ContextStrip, DiagnosticsSection) and `fmtPrice` (used by HeaderRibbon, ContextStrip, EvidenceGrid, enrichment sections).

**Action feedback:** Approve/Reject/Escalate actions show toast notifications (success/error) via `useToast()`. List auto-refreshes after any action via `onActionComplete` callback.

**WebSocket wiring:** The page orchestrator connects via `useWebSocket` and routes events to the detail panel via `onRefreshRef`. `pipeline_progress` events update the WaterfallStepper in real-time. `exception_update` and `task_complete` events refresh both the list and the currently viewed exception.

**List indicators:** Exception cards show left border color: blue=selected, green=auto-resolved (GREEN verdict + terminal state), transparent otherwise. Terminal lifecycle state cards with GREEN verdict show a "Resolved" badge.

**Governance:** No "Execute Recipe" button. Human acts as Review Authority (Approve/Reject/Escalate via AgentReasoningCard). Shadow Verdict displayed as read-only badge.

### Customer Inbox (`/inbox`) — Two-Pane Layout

```
NavBar (shared component, consistent tabs)
Page Header (breadcrumb + icon + title + Refresh + Process All buttons)
Metrics Strip (4x MetricTile: total inbound, need attention, auto-resolved, avg response)
Tab Bar (Inbox | AI Intake Flow)
Two-Pane Content
├── Left (380px): Inbox queue
│   ├── Search bar
│   └── Inbox items (avatar, sender, subject, preview, category badge, status badge)
└── Right (flex): Detail panel
    ├── Email header card (avatar, subject, metadata, category + status badges)
    ├── Agent Analysis card (confidence bar, summary, recommendation, action buttons)
    │   └── "View Evidence & Reasoning" Layer 2 trigger
    └── Detail tabs (Email | Entities | SAP Data | Change Analysis | Knowledge Graph)
```

**Data flow:** Mock `INBOX` data → state → render. Uses shared NavBar, Badge (via `categoryVariant()`, `inboxStatusVariant()`), MetricTile, Button components.

### Dashboard (`/dashboard`) — Layout B: 2-Column Grid

```
NavBar (shared component, consistent tabs)
Page Content (max-width 1440px)
├── Breadcrumb (Home > Dashboard)
├── Page Header (icon + title + subtitle)
├── Metrics Strip (4x MetricTile: resolution rate, avg time, HITL rate, total)
└── 2-column Grid
    ├── By Intent (bar segments)
    ├── By State (badges + bar segments)
    ├── By Verdict (colored bar segments)
    ├── Platform Health (from useHealth)
    └── Recent Activity (full-width timeline feed, 6 recent events)
```

**Data flow:** `exceptionsApi.stats()` + `healthApi.get()` → state → render.

### Login (`/login`) — Centered Card

Multi-step: email → password → SSO redirect. Uses `signIn()` from NextAuth.

---

## 4. Type System

| UI Type | Backend Model | File |
|---|---|---|
| `Intent` | `Intent` enum (contracts/models.py) | exceptions.ts |
| `ShadowVerdict` | `ShadowStatus` enum | exceptions.ts |
| `TerminalStatus` | `TerminalStatus` enum | exceptions.ts |
| `LifecycleState` | `LIFECYCLE_STATES` list | exceptions.ts |
| `PipelineNode` | 10 node names from orchestration/nodes.py | exceptions.ts |
| `OrderEvent` | `OrderEvent` model | exceptions.ts |
| `ComplianceDecision` | `ComplianceDecision` model | exceptions.ts |
| `ExceptionSummary` | `ExceptionSummary` schema | exceptions.ts |
| `ExceptionDetail` | `ExceptionDetailResponse` schema | exceptions.ts |
| `TraceRecord` | `TraceResponse` schema | exceptions.ts |
| `HealthResponse` | Health endpoint response | exceptions.ts |
| `ResolveRequest` | `ResolveRequest` schema | api.ts |
| `ResolveResponse` | `ResolveResponse` schema | api.ts |
| `StatsResponse` | Stats endpoint response | api.ts |
| `WSEvent` | `WSEvent` model (api/events.py) | websocket.ts |
| `PipelineProgressPayload` | Pipeline progress data | websocket.ts |
| `AuthUser` | `UserProfile` schema | auth.ts |
| `LoginResponse` | `AuthTokenResponse` schema | auth.ts |
| `Role` | Role strings from api/deps.py | auth.ts |

**UI display types** (not backend contract mirrors — see CLAUDE.md):

| UI Type | Purpose | File |
|---|---|---|
| `LineItem` | Order line-item grid display | exceptions.ts |
| `PricingConditionType` | Pricing condition type enum (BASE/CONTRACT/TPR/UOM/RESULT/ERROR) | exceptions.ts |
| `PricingWaterfallStep` | Single step in pricing waterfall visualization | exceptions.ts |
| `LineItemAnalysis` | Per-line agent analysis with waterfall | exceptions.ts |
| `OrderAnalysis` | Order-level agent analysis (drives detail panel). Extended with `root_cause`, `recommendation`, `entity_profile`, `impact_metrics`, `duplicate_detection?`, `order_comparison?`, `price_analysis?`, `backorder_analysis?`, `overmax_analysis?`, `moq_analysis?`, `pallet_analysis?` | exceptions.ts |
| `EntityProfile` | Master data context for exception entity (customer name, BP number, tier, VIP, credit standing, location) | exceptions.ts |
| `ImpactMetrics` | Quantitative "blast radius" (revenue at risk, delta, SLA priority, affected lines) | exceptions.ts |
| `DuplicateDetectionData` | Duplicate detection summary: original/duplicate order snapshots, detection method, confidence, recommended action, autonomy level | exceptions.ts |
| `OrderSnapshot` | Compact order snapshot for detection comparison (SO#, PO#, date, value, line count, status) | exceptions.ts |
| `OrderComparisonData` | Side-by-side order comparison: orders array, matching fields, differing fields | exceptions.ts |
| `ComparisonOrder` | Full order for comparison: SO#, PO#, date, customer, line items, total, status | exceptions.ts |
| `ComparisonLineItem` | Single line item in comparison (SKU, description, qty, unit price) | exceptions.ts |
| `PriceAnalysisData` | Price delta analysis: ERP/PO unit prices, variance, total at risk, SAP context (doc type/number, SKU, rule, root cause category, contract/promo refs) | exceptions.ts |
| `BackOrderAnalysisData` | Back-order/OOS analysis: ordered/available/gap qtys, ATP date, primary DC, alternate warehouses, substitutes, production, inbound PO, ranked resolution options | exceptions.ts |
| `WarehouseInfo` | DC inventory snapshot (plant, name, region, qty) | exceptions.ts |
| `AlternateWarehouse` | Alternate DC with shipping details (extends WarehouseInfo + eta_days, freight deltas) | exceptions.ts |
| `SubstituteSKU` | Substitute SKU option (sku, description, available qty, price delta, acceptance rate) | exceptions.ts |
| `ResolutionOption` | Ranked resolution option with composite score, 4-dimension sub-scores (service/revenue/logistics/preference), SAP steps, recommended flag | exceptions.ts |
| `OverMaxAnalysisData` | Over Max analysis: total ordered, max qty, excess, exceedance pct, contract ref, block status/reason, order lines, AI trim plan | exceptions.ts |
| `OverMaxLine` | Per-line Over Max detail (sku, qty, max, excess, even-layer flag) | exceptions.ts |
| `TrimPlanLine` | AI trim plan line (sku, ordered, trimmed_to, delta, action: TRIM/SKIP/OK) | exceptions.ts |
| `MOQAnalysisData` | MOQ analysis: ordered/moq/shortfall qtys, MOQ source, SAP V4082 block, round-up plan, SAP execution steps | exceptions.ts |
| `RoundUpPlanLine` | AI round-up plan line (sku, ordered, round_up_to, delta, action: ROUND_UP/ACCEPT_BELOW/ESCALATE) | exceptions.ts |
| `SAPStep` | SAP execution step (step number, transaction code, table, field, description) | exceptions.ts |
| `PalletAnalysisData` | Pallet analysis: total cases, loose cases, extra labor, freight waste, per-line details, AI suggested plan | exceptions.ts |
| `PalletLine` | Per-line pallet alignment detail (layer/pallet qty, complete layers, loose qty, fill pct, violation type) | exceptions.ts |
| `PalletSuggestion` | AI pallet alignment suggestion (current/suggested qty, delta, layers, full pallets, reason) | exceptions.ts |

---

## 5. API Client (`src/lib/api.ts`)

Maps to Section 6.2 REST endpoints:

| API Method | Backend Endpoint | Section |
|---|---|---|
| `authApi.login()` | `POST /api/auth/login` | 6.2 |
| `authApi.mfaVerify()` | `POST /api/auth/mfa/verify` | 6.2 |
| `authApi.ssoInit()` | `POST /api/auth/sso/init` | 6.2 |
| `authApi.me()` | `GET /api/auth/me` | 6.2 |
| `authApi.refresh()` | `POST /api/auth/refresh` | 6.2 |
| `healthApi.get()` | `GET /api/v1/health` | 6.2 |
| `exceptionsApi.list()` | `GET /api/v1/exceptions` | 6.2 |
| `exceptionsApi.get()` | `GET /api/v1/exceptions/{id}` | 6.2 |
| `exceptionsApi.resolve()` | `POST /api/v1/exceptions/resolve` | 6.2 |
| `exceptionsApi.resolveAsync()` | `POST /api/v1/exceptions/resolve/async` | 6.2 |
| `exceptionsApi.explain()` | `POST /api/v1/exceptions/resolve/explain` | 6.2 |
| `exceptionsApi.override()` | `PATCH /api/v1/exceptions/{id}/override` | 6.2 |
| `exceptionsApi.approve()` | `POST /api/v1/exceptions/{id}/approve` | 6.2 |
| `exceptionsApi.reject()` | `POST /api/v1/exceptions/{id}/reject` | 6.2 |
| `exceptionsApi.trace()` | `GET /api/v1/exceptions/{id}/trace` | 6.2 |
| `exceptionsApi.stats()` | `GET /api/v1/exceptions/stats` | 6.2 |
| `exceptionsApi.lineItems()` | Line items for an exception (UI mock) | — |
| `exceptionsApi.orderAnalysis()` | Order-level agent analysis (UI mock) | — |

**Mock strategy:** All endpoints return mock data with simulated latency. To connect to real FastAPI, replace the mock implementations with `fetch()` calls to `NEXT_PUBLIC_API_URL`. The interface (function signatures and return types) stays the same.

**Mock exceptions:** 14 exceptions (exc-001 through exc-014) covering all supported intents: CONTRACTUAL_CORRECTION, CREDIT_BLOCK, MASS_PRICING_ERROR, DUPLICATE_PO, BACK_ORDER (exc-010, exc-011), OVER_MAX (exc-012), MIN_ORDER_QTY (exc-013), PALLET_CONFIG (exc-014). Each includes intent-specific `OrderAnalysis` data with the corresponding enrichment fields populated (e.g., `backorder_analysis` for BACK_ORDER, `pallet_analysis` for PALLET_CONFIG).

**Health endpoint recipes:** `allowed_recipes` now includes 7 recipes: `PriceAdjustmentRecipe.py`, `CreditHoldReleaseRecipe.py`, `DuplicatePORecipe.py`, `BackOrderResolutionRecipe.py`, `OverMaxTrimRecipe.py`, `MOQRoundUpRecipe.py`, `PalletAlignmentRecipe.py`. `allowed_intents` includes 8 intents: the original 4 plus `BACK_ORDER`, `OVER_MAX`, `MIN_ORDER_QTY`, `PALLET_CONFIG`.

**UI-only endpoints:** `lineItems()` and `orderAnalysis()` serve mock data for the enriched line-item grids, pricing waterfall, and type-specific enrichment sections. When `asoe2` adds corresponding endpoints, these will be wired to real `fetch()` calls.

---

## 6. Auth & RBAC

**NextAuth config** (`src/lib/auth.ts`):
- Credentials provider (email/password → `authApi.login()`)
- JWT session strategy, 7-day expiry
- JWT callbacks enrich token with `roles`, `org`, `permissions`, `accessToken`
- Session callbacks expose typed user with RBAC fields

**RBAC** (`src/lib/roles.ts`): Aligned with `asoe2/api/deps.py::_ROLE_PERMISSIONS`:

| Role | Permissions |
|---|---|
| `analyst` | `exceptions:read`, `exceptions:approve`, `dashboard:read` |
| `manager` | analyst + `exceptions:override`, `rules:write` |
| `admin` | manager + `users:manage`, `policy:write`, `audit:read` |
| `viewer` | `exceptions:read`, `dashboard:read` |
| `partner` | `exceptions:read` (scoped to own orders) |

**Middleware** (`src/middleware.ts`): Protects all routes except `/login`, `/auth/callback`, `/api/auth`. Redirects unauthenticated users to `/login`.

---

## 7. Real-Time Protocol (`src/hooks/useWebSocket.ts`)

Implements Section 8:
1. Connect to `ws://host/api/v1/ws`
2. Send auth message: `{ type: "auth", token, last_seen }`
3. Receive `WSEvent` messages (`pipeline_progress`, `exception_update`, `task_complete`, `error`)
4. Reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
5. Send `last_seen_timestamp` on reconnect for event replay (60-second buffer)

**Exception Queue wiring:** The page orchestrator (`/exceptions/page.tsx`) subscribes to WebSocket events and routes them to the detail panel via `onRefreshRef`. `pipeline_progress` events for the currently viewed exception update the WaterfallStepper in real-time. `exception_update` and `task_complete` events refresh both the exception list and the detail panel.

---

## 8. Health-Driven Enums (`src/hooks/useHealth.ts`)

Per Guardrail #2, the `useHealth` hook fetches `GET /api/v1/health` which returns:
- `allowed_intents[]` — drives intent filter dropdown
- `lifecycle_states[]` — drives state filter dropdown
- `allowed_recipes[]` — available for display
- `kill_switch`, `explain_mode` — platform status

Used in: Exception Queue filters, Dashboard platform health card.

---

## 9. Relationship to asoe2

| Concern | Owned By | asoe-ui Role |
|---|---|---|
| Business logic (recipes) | asoe2 | Display results only |
| Compliance (shadow audit) | asoe2 | Display verdict + policy hits |
| Intent classification | asoe2 | Display intent + confidence |
| Pipeline orchestration | asoe2 | Visualize via WaterfallStepper |
| Enum definitions | asoe2 (health endpoint) | Fetch at runtime, never hardcode |
| Type contracts | asoe2 (Pydantic models) | Mirror in TypeScript exactly |
| RBAC enforcement | asoe2 (API layer) | Complement with UI button gating |
| Audit trail | asoe2 (TraceRecord) | Display faithfully in Layer 2 |

**ADRs relevant to UI:** ADR-005 (Shadcn reconciliation), ADR-006 (CSS tokens), ADR-008 (Next.js 16), ADR-009 (WebSocket events). All documented in `consol_arch.md` Section 13.
