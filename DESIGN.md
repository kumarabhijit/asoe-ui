# DESIGN.md — Code-to-Architecture Map

Maps `consol_arch.md` Section 11 (UI Architecture) to concrete source files. Read this to understand how the codebase is organized and where to find things.

---

## 1. Module Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (imports design-tokens.css + globals.css)
│   ├── page.tsx                  # Root redirect → /exceptions
│   ├── login/page.tsx            # Multi-step login (email → password → SSO redirect)
│   ├── auth/callback/page.tsx    # SSO callback handler
│   ├── exceptions/
│   │   ├── page.tsx              # Exception Queue — flagship view (Layout A)
│   │   └── ExceptionDetailPanel.tsx  # Sidebar content: reasoning + waterfall + trace
│   ├── dashboard/page.tsx        # Analytics dashboard (Layout B)
│   ├── inbox/page.tsx            # Legacy email-triage view (pre-architecture)
│   └── api/auth/[...nextauth]/route.ts  # NextAuth API route
├── components/ui/                # Reusable UI components (Section 11.2)
│   ├── ActivityIndicator.tsx     # Domain-aware loading text per pipeline node
│   ├── AgentReasoningCard.tsx    # Two-layer cognition: Layer 1 + Layer 2
│   ├── Badge.tsx                 # Tinted bg + icon + text, verdict/lifecycle helpers
│   ├── Button.tsx                # 5 variants (brand/neutral/success/ghost/destructive)
│   ├── Card.tsx                  # Borderless shadow-elevated container
│   ├── GravitationalOrbs.tsx     # Canvas animated background (login page)
│   ├── Input.tsx                 # Label + input + error + right icon
│   ├── Logo.tsx                  # ASOE brand mark with optional tagline
│   ├── MetricTile.tsx            # KPI: icon + label + monospace value + subtitle
│   ├── NavBar.tsx                # 56px glass surface, tabs, agent status pulse
│   ├── Sidebar.tsx               # 480px slide-right intervention panel
│   ├── Toast.tsx                 # 4.5s auto-dismiss, status-colored, solid-fill
│   └── WaterfallStepper.tsx      # 10-node pipeline progress visualization
├── hooks/
│   ├── useAuth.ts                # Wraps NextAuth session with typed user
│   ├── useHealth.ts              # Fetches runtime enums from /api/v1/health
│   └── useWebSocket.ts           # Section 8 protocol with reconnection backoff
├── lib/
│   ├── api.ts                    # API client: auth + health + exceptions endpoints
│   ├── auth.ts                   # NextAuth options (credentials provider, JWT callbacks)
│   └── roles.ts                  # RBAC permissions aligned with asoe2/api/deps.py
├── types/
│   ├── auth.ts                   # AuthUser, LoginResponse, Role (← asoe2 schemas)
│   ├── exceptions.ts             # Intent, LifecycleState, ShadowVerdict, ExceptionSummary, etc.
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
| `Card` | Custom | Borderless, shadow-only (Shadcn uses borders) | Login, Dashboard |
| `Input` | Custom | ASOE label typography, brand focus ring | Login, Exception Queue |
| `Logo` | Custom | Brand mark with tagline | NavBar, Login |
| `NavBar` | Custom (new) | 56px glass, agent pulse, brand purple on logo only | Exception Queue, Dashboard |
| `MetricTile` | Custom (new) | KPI: 40x40 tinted icon + monospace value | Exception Queue, Dashboard |
| `Badge` | Custom (new) | Tinted bg + icon + text (not Shadcn Badge) | Exception Queue, Detail |
| `Toast` | Custom (new) | 4.5s auto-dismiss, solid-fill (only one in system) | Via ToastProvider |
| `Sidebar` | Custom (new) | 480px panel, escape-to-close, focus trap | Exception Queue |
| `ActivityIndicator` | Custom (new) | Node-specific domain-aware messages | WaterfallStepper |
| `WaterfallStepper` | Custom (new) | 10-node pipeline with per-node states | ExceptionDetailPanel |
| `AgentReasoningCard` | Custom (new) | Layer 1/2, verdict-specific behavior | ExceptionDetailPanel |
| `GravitationalOrbs` | Custom | Canvas animated background | Login |

**Shadcn adopted (not yet installed):** DataTable (Tanstack Table), Dialog/Sheet, Select/Dropdown, Tooltip. Re-themed with ASOE tokens per Section 11.2.

---

## 3. Page Architecture

### Exception Queue (`/exceptions`) — Layout A: Queue + Sidebar

```
NavBar (sticky top)
├── Tabs: Exception Queue | Dashboard | Settings
├── Agent status badge + user avatar
Page Content (max-width 1280px)
├── Page Header (title + refresh button)
├── Metrics Strip (4x MetricTile: total, open, auto-resolved, avg time)
├── Filters (search + state dropdown + intent dropdown)
│   └── Dropdowns sourced from useHealth() — Guardrail #2
├── DataTable (order ID, event type, intent, state, verdict, recipe, created)
│   └── Row click → opens Sidebar
└── Sidebar (480px right panel)
    └── ExceptionDetailPanel
        ├── Header info (order ID, event type, tenant, timestamps)
        ├── AgentReasoningCard (Layer 1/2)
        ├── WaterfallStepper (10-node pipeline)
        └── Resolution data (JSON)
```

**Data flow:** `exceptionsApi.list()` + `exceptionsApi.stats()` → state → render. Filters trigger re-fetch. Row click fetches `exceptionsApi.get(id)` + `exceptionsApi.trace(id)`.

### Dashboard (`/dashboard`) — Layout B: 2-Column Grid

```
NavBar
Page Content
├── Page Header
├── Metrics Strip (4x MetricTile: resolution rate, avg time, HITL rate, total)
└── 2-column Grid
    ├── By Intent (bar segments)
    ├── By State (badges + bar segments)
    ├── By Verdict (colored bar segments)
    └── Platform Health (from useHealth)
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

**Mock strategy:** All endpoints return mock data with simulated latency. To connect to real FastAPI, replace the mock implementations with `fetch()` calls to `NEXT_PUBLIC_API_URL`. The interface (function signatures and return types) stays the same.

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
