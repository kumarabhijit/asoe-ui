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
│   │   ├── page.tsx              # Exception Queue — three-pane Outlook master-detail layout
│   │   ├── ExceptionListPane.tsx # Middle pane: compact card list with search + filters + URL-synced state
│   │   ├── ExceptionDetailPanel.tsx  # Right pane: polymorphic detail (collapsible sections)
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
│   └── roles.ts                  # RBAC permissions aligned with asoe2/api/deps.py
├── types/
│   ├── auth.ts                   # AuthUser, LoginResponse, Role (← asoe2 schemas)
│   ├── exceptions.ts             # Intent, LifecycleState, ShadowVerdict, ExceptionSummary,
│   │                             # LineItem, PricingWaterfallStep, OrderAnalysis (UI display types)
│   ├── api.ts                    # ResolveRequest/Response, StatsResponse, PaginatedResponse
│   └── websocket.ts              # WSEvent, PipelineProgressPayload, WSAuthMessage
├── styles/
│   └── design-tokens.css         # 45+ CSS custom properties — single source of truth
└── middleware.ts                  # Route protection via NextAuth JWT check
```

---

## 2. Component Catalog

| Component | Source | Section 11.2 | Used By |
|---|---|---|---|
| `Button` | Custom | 5 ASOE variants with brand restraint | All pages |
| `Card` | Custom | Borderless, shadow-only (Shadcn uses borders) | Login, Dashboard, Detail |
| `Input` | Custom | ASOE label typography, brand focus ring | Login, Exception Queue |
| `Logo` | Custom | Brand mark with tagline | NavBar, Login |
| `NavBar` | Custom | 56px glass, agent pulse, `onSignOut`, `onSettingsClick`, `aria-current`, logo links to `/inbox` | All pages (consistent tabs) |
| `MetricTile` | Custom | KPI: 40x40 tinted icon + monospace value | Exception Queue, Dashboard, Inbox |
| `Badge` | Custom | Tinted bg + icon + text, 6 variant mappers | Exception Queue, Detail, Inbox, Dashboard |
| `Toast` | Custom | 4.5s auto-dismiss, solid-fill (only one in system) | Via ToastProvider |
| `Sidebar` | Custom | 480px panel, escape-to-close, focus trap | (Available, not used in Outlook layout) |
| `ActivityIndicator` | Custom | Node-specific domain-aware messages | WaterfallStepper |
| `WaterfallStepper` | Custom | 10-node pipeline with per-node states | ExceptionDetailPanel |
| `AgentReasoningCard` | Custom | Layer 1 only (recommendation + actions), verdict-specific behavior | ExceptionDetailPanel |
| `PricingWaterfall` | Custom | Pricing condition chain timeline | ExceptionDetailPanel |
| `GravitationalOrbs` | Custom | Canvas animated background | Login |

**Badge variant mappers** (`Badge.tsx`): `verdictVariant()`, `lifecycleVariant()`, `rootCauseVariant()`, `categoryVariant()`, `inboxStatusVariant()` — all follow the same pattern: map API-provided strings to CSS variants with a `default` fallback.

**PricingWaterfall vs WaterfallStepper:** WaterfallStepper visualizes the 10-node pipeline execution (WebSocket-driven). PricingWaterfall visualizes pricing condition chains for line items (API data-driven). They share a timeline visual metaphor but differ in data model and purpose.

**Shadcn adopted (not yet installed):** DataTable (Tanstack Table), Dialog/Sheet, Select/Dropdown, Tooltip. Re-themed with ASOE tokens per Section 11.2.

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

**Polymorphic detail view:** The right pane adapts to any exception type (pricing, credit, duplicate PO) via dynamic data categories:
- **Header ribbon:** breadcrumb-style context from event payload
- **Context strip (collapsible, default expanded):** Entity Profile (customer, tier, credit standing) + Impact Metrics (revenue at risk, delta, SLA)
- **Agent Analysis:** Problem / Root Cause / Recommendation + `AgentReasoningCard` (Layer 1 only — actions, confidence, verdict)
- **Evidence Detail:** collapsed by default; expandable line-item table + pricing waterfall
- **Metadata:** created/updated timestamps
- **Diagnostics (hidden by default, "Show Diagnostics" toggle):**
  - **Pipeline Progress (collapsible):** 10-node WaterfallStepper with status badge (complete/in progress/failed/pending)
  - **Trace Evidence (collapsible):** trace fields, Resolution Data JSON, preview tabs (SAP Data, Change Analysis — controlled by `NEXT_PUBLIC_SHOW_PREVIEW_FEATURES`)

**Action feedback:** Approve/Reject/Escalate actions show toast notifications (success/error) via `useToast()`. List auto-refreshes after any action via `onActionComplete` callback.

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
| `OrderAnalysis` | Order-level agent analysis (drives detail panel). Extended with `root_cause`, `recommendation`, `entity_profile`, `impact_metrics` | exceptions.ts |
| `EntityProfile` | Master data context for exception entity (customer name, BP number, tier, VIP, credit standing, location) | exceptions.ts |
| `ImpactMetrics` | Quantitative "blast radius" (revenue at risk, delta, SLA priority, affected lines) | exceptions.ts |

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

**UI-only endpoints:** `lineItems()` and `orderAnalysis()` serve mock data for the enriched line-item grids and pricing waterfall. When `asoe2` adds corresponding endpoints, these will be wired to real `fetch()` calls.

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
