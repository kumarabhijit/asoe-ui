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
| DataTable | Shadcn (spec) | Not yet installed | PENDING |
| Dialog/Sheet | Shadcn (spec) | Not yet installed | PENDING |
| Select/Dropdown | Shadcn (spec) | Not yet installed | PENDING |
| Tooltip | Shadcn (spec) | Not yet installed | PENDING |

**Spec count:** 12 custom + 4 Shadcn = 16 total.
**Actual count:** 14 custom + 0 Shadcn = 14 total (Shadcn primitives pending Phase 9+).

### Intentional Drift: PricingWaterfall

`PricingWaterfall` is a UI enrichment component not specified in `consol_arch.md` Section 11.2. It visualizes the pricing condition chain for order line items (BASE → CONTRACT → TPR → UOM → RESULT/ERROR) — distinct from `WaterfallStepper` which visualizes the 10-node pipeline execution.

**Rationale:** The pre-merge sample screen (`samples/asoe-sample-screen.jsx`) demonstrated this visualization as core to the exception resolution experience. CPG pricing disputes require condition-level visibility. This component requires backend endpoints for line-item and waterfall data (see Section 10).

**Recommendation:** Add PricingWaterfall to `consol_arch.md` Section 11.2 component table.

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
| Styling | CSS custom properties + Tailwind CSS | CSS custom properties + Tailwind CSS | ALIGNED |
| Icons | Lucide React (16/20/24px — never emoji) | Lucide React | ALIGNED |
| Fonts | SF Pro Display / Inter, SF Mono / JetBrains Mono | Inter (Google Fonts), SF Mono (system) | ALIGNED |
| Auth | NextAuth.js → FastAPI auth endpoints | NextAuth.js with mock auth API | ALIGNED (mock) |
| Validation | Zod | Zod (installed, limited use so far) | ALIGNED |
| Testing | Not specified in tech stack | Vitest + React Testing Library | ALIGNED (128 tests passing) |

**Alignment status:** ALIGNED.

---

## 5. Pages

**Source:** `consol_arch.md` Section 11.5

### Spec vs Implementation

| Page | Spec (Section 11.5) | Route | Status |
|---|---|---|---|
| Login | Centered card, SSO + email/password | `/login` | ALIGNED |
| Exception Queue | Queue + Sidebar (Layout A) | `/exceptions` | ALIGNED (enriched) |
| Exception Detail | Sidebar expand | `/exceptions` (sidebar) | ALIGNED (enriched) |
| Dashboard | 2-column grid (Layout B) | `/dashboard` | ALIGNED (enriched) |
| Settings / Admin | Standard layout | `/settings` | PENDING (Phase 9) |
| **Customer Inbox** | **NOT IN SPEC** | `/inbox` | **DRIFT — new page** |

### 5.1 Exception Queue (`/exceptions`) — Layout A

**Spec alignment:** Implements Layout A (queue + sidebar) per Section 11.5. All filter values sourced from `useHealth()` per Guardrail #2.

**Enrichments beyond spec:**
- **Expandable card rows** (from pre-merge sample screen) — collapsed row shows order summary; expand chevron reveals line-item grid with columns: Line, SKU, Product, UOM, Qty, ERP Price, PO Price, totals, Root Cause badge
- **Breadcrumb navigation** (Home > Order Management > Exception Queue)
- **Tab bar** below metrics (Orders | Root Cause Insights | Agent Activity)
- **Line-item grid** fetched on demand via `exceptionsApi.lineItems(id)` — requires new backend endpoint (see Section 10)

**Data flow:**
```
exceptionsApi.list() + stats() → state → render
Row expand → exceptionsApi.lineItems(id) → line-item grid
Row click → Sidebar opens
  → exceptionsApi.get(id) + trace(id) + lineItems(id) + orderAnalysis(id)
```

### 5.2 Exception Detail Panel (Sidebar)

**Spec alignment:** Implements AgentReasoningCard (Layer 1/2), WaterfallStepper per Section 11.1, 11.2.

**Enrichments beyond spec:**
- **Order summary card** — icon, order ID, state badge, event type, tenant, 4-metric mini-grid (lines, ERP total, PO total, delta), agent diagnosis with left-border accent
- **Line-item selector** — pill buttons per line item with risk badge, drives pricing waterfall
- **PricingWaterfall** — selected line's pricing condition chain (BASE → CONTRACT → TPR → UOM → RESULT/ERROR)
- **Tabbed detail sections** — Evidence (populated from trace), SAP Data (placeholder), Change Analysis (placeholder)

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
| `exceptionsApi.override()` | `PATCH /api/v1/exceptions/{id}/override` | manager+ | Mock | ALIGNED |
| `exceptionsApi.approve()` | `POST /api/v1/exceptions/{id}/approve` | analyst+ | Mock | ALIGNED |
| `exceptionsApi.reject()` | `POST /api/v1/exceptions/{id}/reject` | analyst+ | Mock | ALIGNED |
| `exceptionsApi.trace()` | `GET /api/v1/exceptions/{id}/trace` | analyst+ | Mock | ALIGNED |
| `exceptionsApi.stats()` | `GET /api/v1/exceptions/stats` | analyst+ | Mock | **DRIFTED** (field mismatch) |
| `exceptionsApi.lineItems()` | **NOT IN SPEC** | — | Mock | **DRIFT — new endpoint needed** |
| `exceptionsApi.orderAnalysis()` | **NOT IN SPEC** | — | Mock | **DRIFT — new endpoint needed** |

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

| UI Type | Backend Type | Drift |
|---|---|---|
| `StatsResponse` | `StatsResponse` (schemas.py) | **DRIFTED** — see Section 10.1 |
| `TerminalStatus` | `TerminalStatus` (models.py) | **DRIFTED** — UI has `COMPLETE_WITH_CHILDREN`, backend does not |
| `OverrideRequest.notes` | Optional in backend | UI marks as required — minor |
| `ExceptionUpdatePayload.updated_fields` | `List[str]` in backend | UI has `Record<string, unknown>` — type mismatch |
| `TaskCompletePayload.explanation` | Optional in backend | UI marks as required — minor |
| `LineItem` | **No backend type** | UI-only display type (mock data) |
| `PricingWaterfallStep` | **No backend type** | UI-only display type (mock data) |
| `OrderAnalysis` | **No backend type** | UI-only display type (mock data) |

**Alignment status:** PARTIALLY ALIGNED. Core CRUD endpoints aligned. Stats, line-item, and analysis endpoints drifted.

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
| Fallback | Poll `GET /api/v1/exceptions/{id}` every 3s | Not yet implemented | PENDING |

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
| `analyst` | `exceptions:read`, `exceptions:approve`, `dashboard:read` | View queue, approve individual |
| `manager` | analyst + `exceptions:override`, `rules:write` | Override, bulk actions |
| `admin` | manager + `users:manage`, `policy:write`, `audit:read` | User mgmt, settings, override with notes |
| `viewer` | `exceptions:read`, `dashboard:read` | View only — no action buttons |
| `partner` | `exceptions:read` (scoped to own orders) | Scoped view within tenant |

**Implementation:** `src/lib/roles.ts` — `ROLE_PERMISSIONS` mapping matches `asoe2/api/deps.py::_ROLE_PERMISSIONS` exactly (verified in pre-session audit).

### Verdict-Action RBAC Matrix

| Verdict | analyst | manager | admin | viewer |
|---|---|---|---|---|
| GREEN | View Details | View Details | View Details | View Details |
| YELLOW | Approve, Reject, Escalate | Approve, Reject, Escalate | Approve, Reject, Escalate | None |
| RED | Acknowledge, Escalate | Acknowledge, Escalate | Acknowledge, **Override** (+ notes), Escalate | None |

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
| 12 spec'd custom components | Section 11.2 | All 12 built and operational |
| Design tokens (149 tokens, 45+ minimum) | Section 11.3 | Exceeds spec |
| Brand restraint (purple in 3 places only) | Section 11.3 | Enforced |
| WCAG 2.1 AA (icon + text on all status) | Section 11.3 | Enforced |
| Tech stack (Next.js 16, React 19, Tailwind) | Section 11.4 | Exact match |
| Core REST endpoints (16 of 17) | Section 6.2 | All mock-implemented |
| WebSocket protocol + reconnection | Section 8 | Implemented in useWebSocket |
| RBAC roles + permissions | Section 9.2 | Exact match with asoe2 |
| Auth flows (SSO + password + MFA) | Section 9.1 | Mock-implemented |
| Multi-tenancy model | Section 9.3 | JWT org claim + scoped queries |
| trace_id propagation | Section 9.4 | X-Trace-ID header support |

### INTENTIONAL DRIFT (UI enrichment — needs spec update)

| ID | Area | Spec Says | Implementation | Rationale | Action Needed |
|---|---|---|---|---|---|
| **D1** | Customer Inbox page | Not mentioned | `/inbox` — full two-pane AI email triage | Natural extension of agent-first control tower for inbound communications | Add to consol_arch.md Section 11.5 |
| **D2** | PricingWaterfall component | Not mentioned | `src/components/ui/PricingWaterfall.tsx` | CPG pricing disputes require condition-level visibility (from sample screen) | Add to consol_arch.md Section 11.2 |
| **D3** | Line-item API | Not mentioned | `exceptionsApi.lineItems()` (mock) | Expandable rows need per-exception line items | Add endpoint to Section 6.2 |
| **D4** | Order analysis API | Not mentioned | `exceptionsApi.orderAnalysis()` (mock) | Detail panel needs agent diagnosis + waterfall data | Add endpoint to Section 6.2 |
| **D5** | Expandable order rows | Spec says "DataTable" | Card-based expandable rows with line-item grids | Richer data density for CPG pricing exceptions | Update Section 11.5 description |
| **D6** | Badge variant mappers (5 total) | Spec implies verdict + lifecycle only | Added rootCause, category, inboxStatus mappers | Visual mappings with default fallback — Guardrail #2 compliant | Document in Section 11.2 |
| **D7** | 14 components (vs spec's 12) | 12 custom | +PricingWaterfall, +GravitationalOrbs (pre-existing) | GravitationalOrbs predates spec; PricingWaterfall is D2 | Update count in Section 11.2 |

### TYPE CONTRACT DRIFT (needs code or backend fix)

| ID | Type | UI Field | Backend Field | Fix Owner |
|---|---|---|---|---|
| **T1** | `StatsResponse` | `total_exceptions` | `total` | **asoe2** — rename or UI adapts (see Section 10.1) |
| **T2** | `StatsResponse` | `open_exceptions` | `open` | **asoe2** — rename or UI adapts |
| **T3** | `StatsResponse` | `avg_resolution_time_seconds` | Missing | **asoe2** — add field |
| **T4** | `StatsResponse` | `by_intent`, `by_lifecycle_state`, `by_shadow_verdict` | Missing | **asoe2** — add aggregation fields |
| **T5** | `StatsResponse` | Missing | `manual_review`, `blocked`, `failed` | **asoe-ui** — add missing fields |
| **T6** | `TerminalStatus` | `COMPLETE_WITH_CHILDREN` | Missing from enum | **asoe2** — add to enum (it's in spec Section 1 V1 scope) |
| **T7** | `OverrideRequest.notes` | Required | `Optional[str]` | **asoe-ui** — make optional |
| **T8** | `ExceptionUpdatePayload.updated_fields` | `Record<string, unknown>` | `List[str]` | **asoe-ui** — change to `string[]` |
| **T9** | `TaskCompletePayload.explanation` | Required | `Optional[str]` | **asoe-ui** — make optional |

---

## 10. Proposed Backend Changes (asoe2)

These changes are needed to align the backend with the UI implementation and close the drift items identified in Section 9. **No changes should be made to asoe2 without explicit approval.**

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
