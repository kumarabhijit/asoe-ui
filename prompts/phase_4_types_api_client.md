# Phase 4: Types & API Client

**Prerequisite:** Phase 1 (auth types exist)
**Architecture reference:** `consol_arch.md` Sections 6.2 (REST Endpoints), 7.1 (Lifecycle), 8.2 (WebSocket Events)
**Backend reference (read-only):** `asoe2/contracts/models.py`, `asoe2/api/schemas.py`, `asoe2/api/events.py`, `asoe2/api/deps.py`, `asoe2/constraints/specs.py`

---

## Context

The UI types must mirror the backend Pydantic models field-for-field. This phase creates the TypeScript type system and a mock API client covering all Section 6.2 endpoints.

**Guardrail #2 compliance:** Type definitions in `src/types/` are compile-time safety (allowed). Runtime rendering of enum values must come from the health endpoint via `useHealth` hook (also created in this phase).

---

## Step 1: Exception Domain Types (`src/types/exceptions.ts`)

Create types mirroring `asoe2/contracts/models.py` and `asoe2/constraints/specs.py`:

| Type | Backend Source | Purpose |
|---|---|---|
| `Intent` | `Intent` enum | `"CONTRACTUAL_CORRECTION" \| "CREDIT_BLOCK" \| "MASS_PRICING_ERROR" \| "DUPLICATE_PO" \| "UNKNOWN"` |
| `ShadowVerdict` | `ShadowStatus` enum | `"GREEN" \| "YELLOW" \| "RED"` |
| `TerminalStatus` | `TerminalStatus` enum | `"COMPLETE" \| "COMPLETE_WITH_CHILDREN" \| "FAIL_TO_HUMAN" \| "MANUAL_REVIEW_REQUIRED" \| "BLOCKED" \| "REJECTED"` |
| `LifecycleState` | `LIFECYCLE_STATES` list | 11 states: INGESTED through CLOSED |
| `RecipeName` | `AllowedRecipeName` literal | 3 V1 recipes |
| `ResolutionAction` | `AllowedResolutionAction` literal | 6 actions (BLOCK_AND_NOTIFY, MERGE, etc.) |
| `PipelineNode` | 10 node names from orchestration/nodes.py | Used by WaterfallStepper |
| `NodeStatus` | `"started" \| "completed" \| "failed"` | WebSocket node status |
| `OrderEvent` | `OrderEvent` model | Input event structure |
| `ComplianceDecision` | `ComplianceDecision` model | Shadow audit output |
| `ExecutionLog` | `ExecutionLog` model | Recipe execution trace |
| `GatewayResponse` | `GatewayResponse` model | Gateway call result |
| `ExceptionSummary` | `ExceptionSummary` schema | List view fields |
| `ExceptionDetail` | `ExceptionDetailResponse` schema | Full detail (extends Summary) |
| `TraceRecord` | `TraceResponse` schema | Audit trail |
| `HealthResponse` | Health endpoint response | Dynamic enum source |

## Step 2: API Request/Response Types (`src/types/api.ts`)

Create types mirroring `asoe2/api/schemas.py`:

- `ResolveRequest`, `ResolveResponse`, `AsyncResolveResponse`
- `PaginatedResponse<T>` (cursor-based, Section 6.4)
- `ExceptionListResponse` = `PaginatedResponse<ExceptionSummary>`
- `OverrideRequest` (`action`, `notes`, `resolved_by`)
- `StatsResponse` (dashboard KPIs: total, open, auto_resolved, avg_time, by_intent, by_lifecycle_state, by_shadow_verdict)
- `TraceResponse`
- `WorkflowRequest`, `WorkflowResult`
- `PolicyOverrideRequest`, `PolicyOverrideResponse`
- `APIError` (standard error envelope per Section 6.3)

## Step 3: WebSocket Types (`src/types/websocket.ts`)

Create types mirroring `asoe2/api/events.py`:

- `WSEventType`: `"pipeline_progress" \| "exception_update" \| "task_complete" \| "error"`
- `WSEvent`: envelope with `type`, `trace_id`, `exception_id`, `tenant_id`, `timestamp`, `payload`
- `PipelineProgressPayload`: `node`, `status`, `duration_ms?`, `data?` (intent, confidence, shadow_verdict, etc.)
- `ExceptionUpdatePayload`: `lifecycle_state`, `updated_fields`
- `TaskCompletePayload`: `task_id`, `final_status`, `explanation`
- `WSErrorPayload`: `code`, `message`
- `WSAuthMessage`: `{ type: "auth", token, last_seen? }` — first message after connect

## Step 4: Update Auth Types (`src/types/auth.ts`)

Align with `asoe2/api/schemas.py::AuthTokenResponse` and `UserProfile`:

- `LoginResponse` fields: `access_token` (not `accessToken`), `refresh_token`, `token_type`, `user?`, `mfa_required`, `mfa_token?`
- `AuthUser` fields: add `env?: "sandbox" | "production"`, `auth_method?: "password+mfa" | "sso"`, `retailer_id?`
- `SSOInitResponse`: `redirect_url` (not `redirectUrl`)
- Add `MFAVerifyRequest`: `{ mfa_token, code }`

## Step 5: Update RBAC (`src/lib/roles.ts`)

Align permissions with `asoe2/api/deps.py::_ROLE_PERMISSIONS`:

**Old (incorrect):** `ORDERS_READ`, `ORDERS_APPROVE`, `ORDERS_BULK`, `RULES_READ`, `AGENT_CONFIG`
**New (correct):** `EXCEPTIONS_READ`, `EXCEPTIONS_APPROVE`, `EXCEPTIONS_OVERRIDE`, `RULES_WRITE`, `USERS_MANAGE`, `POLICY_WRITE`, `AUDIT_READ`, `DASHBOARD_READ`

Role-permission mapping must match the backend exactly.

## Step 6: API Client (`src/lib/api.ts`)

Rebuild with mock data covering all Section 6.2 endpoints:

**Auth API (`/api/auth/*`):** `login`, `mfaVerify`, `ssoInit`, `me`, `refresh`
**Health API (`/api/v1/health`):** Returns `HealthResponse` with `allowed_intents[]`, `lifecycle_states[]`, `allowed_recipes[]`
**Exceptions API (`/api/v1/exceptions/*`):** `list` (with status/intent filters), `get`, `resolve`, `resolveAsync`, `explain`, `override`, `approve`, `reject`, `trace`, `stats`

**Mock data:** 8 exception records covering all 4 intents, multiple lifecycle states (RESOLVED, PENDING_REVIEW, BLOCKED, EXECUTING, ESCALATED, CLOSED), all 3 shadow verdicts.

## Step 7: Health Hook (`src/hooks/useHealth.ts`)

Create `useHealth()` hook that fetches `GET /api/v1/health` and returns `{ health, loading, error }`.

Used by Exception Queue page for filter dropdowns and Dashboard for platform health. This is the Guardrail #2 compliance mechanism.

## Step 8: Update Auth Integration

Update `src/lib/auth.ts` to use new `LoginResponse` field names (`access_token` instead of `accessToken`, `user` may be undefined).

---

## Verification

1. `npx tsc --noEmit` passes (or `npm run build`)
2. Every field in `src/types/exceptions.ts` has a corresponding field in `asoe2/contracts/models.py`
3. Every field in `src/types/api.ts` has a corresponding field in `asoe2/api/schemas.py`
4. `ROLE_PERMISSIONS` in `roles.ts` matches `_ROLE_PERMISSIONS` in `asoe2/api/deps.py`
5. `LoginResponse` uses `access_token` (snake_case matching backend), not `accessToken`
6. `useHealth` returns `allowed_intents[]` and `lifecycle_states[]` arrays
