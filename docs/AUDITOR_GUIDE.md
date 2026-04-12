# ASOE UI — Frontend Compliance & Security Controls

**Audience:** Compliance officers, SOX auditors, SOC2 assessors.
**Scope:** Frontend controls only. Backend controls are in `asoe2/docs/AUDITOR_GUIDE.md`. Together they form the complete ASOE compliance surface.
**Architecture reference:** `consol_arch.md` Sections 9.1–9.6.

---

## 1. RBAC UI Enforcement

Action buttons are gated by user role per Section 9.2. The backend enforces RBAC at the API layer; the UI complements this by rendering only the actions available to the authenticated user's role.

| Role | YELLOW Verdict Actions | RED Verdict Actions | GREEN Verdict Actions |
|---|---|---|---|
| `analyst` | Approve, Reject, Escalate | Acknowledge, Escalate | View Details |
| `manager` | Approve, Reject, Escalate | Acknowledge, Escalate | View Details |
| `admin` | Approve, Reject, Escalate | Acknowledge, **Override** (requires `resolution_notes`), Escalate | View Details |
| `viewer` | None (view only) | None (view only) | View Details |
| `partner` | None (scoped view of own orders) | None | None |

**RED Override safeguard (Section 11.1):** The Override button on RED exceptions is gated to the `admin` role via the `isAdmin` prop on `AgentReasoningCard`. Override requires a mandatory `resolution_notes` entry recorded in `policy_audit_log` for SOX compliance.

**Review Authority model (Phase 8.6):** The Exception Detail view enforces that human users act as **Review Authority** only. There are no "Execute Recipe", "Run Engine", or "Process" buttons in the UI. The human may Approve, Reject, or Escalate the agent's proposed resolution — execution is triggered by the backend upon approval, not by the UI. The Compliance Shadow verdict (GREEN/YELLOW/RED) is displayed as a **read-only badge**, not as an actionable control.

**How to verify:**
- `src/components/ui/AgentReasoningCard.tsx` — verdict-specific button rendering logic (Approve/Reject/Escalate only)
- `src/app/exceptions/ExceptionDetailPanel.tsx` — no execution trigger buttons; Shadow Verdict as read-only badge in header ribbon
- `src/lib/roles.ts` — `ROLE_PERMISSIONS` mapping aligned with `asoe2/api/deps.py`

**SOX relevance:** Prevents unauthorized financial exception resolution. Ensures separation of duty — agents propose, humans review, backend executes.

---

## 2. Session Security

| Control | Implementation | File |
|---|---|---|
| Session strategy | JWT via NextAuth.js | `src/lib/auth.ts` |
| Session expiry | 7 days | `auth.ts` → `maxAge` |
| Access token expiry | 15 minutes (backend-enforced) | `asoe2/api/deps.py` |
| Token storage | httpOnly cookies (never client JS) | NextAuth default |
| Refresh rotation | Rotated on use | `authApi.refresh()` in `api.ts` |
| Route protection | Middleware checks JWT on every navigation | `src/middleware.ts` |

**Forbidden:** Tokens in `localStorage`, `sessionStorage`, or URL parameters.

**How to verify:** Check `src/lib/auth.ts` (session config), `src/middleware.ts` (route protection).

**SOC2 relevance:** Access control, session management.

---

## 3. X-Trace-ID Propagation

Per Section 9.4, every action in ASOE is traceable via a UUID that flows end-to-end:

```
UI action → API request (X-Trace-ID header) → Backend → Worker → GraphState → TraceRecord → PostgreSQL
                                                                                    ↓
UI ← WebSocket event (WSEvent.trace_id) ← Redis pub/sub ← Worker
```

- The `trace_id` is displayed in the ExceptionDetailPanel Layer 2 (AgentReasoningCard expanded view)
- TraceRecord fields (skill_name, intent_selected, shadow_verdict, recipe_name, gateway_calls) are rendered for audit review

**How to verify:** Check `src/app/exceptions/ExceptionDetailPanel.tsx` (trace display), `src/components/ui/AgentReasoningCard.tsx` (Layer 2 trace fields).

**SOX relevance:** Every financial decision traceable from UI action to ERP effect.

---

## 4. Tenant Data Isolation

The UI never displays cross-tenant data:

| Layer | Mechanism |
|---|---|
| API requests | JWT `org` claim determines tenant scope (extracted by FastAPI dependency injection) |
| WebSocket | Subscribes to tenant-specific Redis channel `asoe:ws:{tenant_id}` |
| UI rendering | All exception data scoped to authenticated user's tenant |
| Partner scoping | `partner` role sees only their own orders (enforced by backend RLS + API) |

**How to verify:** Check `src/hooks/useWebSocket.ts` (auth message includes JWT with tenant), `src/types/auth.ts` (`AuthUser.org` field).

**SOX relevance:** Data segregation between tenants.

---

## 5. Environment Isolation

Per Section 9.6, production and sandbox environments use separate security boundaries:

| Dimension | Production | Sandbox |
|---|---|---|
| JWT signing keys | Production Key Vault | Sandbox Key Vault (non-overlapping) |
| JWT `env` claim | `production` | `sandbox` |
| Validation | FastAPI checks `env` claim matches `ASOE_ENV` env var | Same |
| Cross-env tokens | Rejected with generic 403 — no details leaked | Same |

The UI connects to the environment specified by `NEXT_PUBLIC_API_URL`. The `AuthUser.env` field reflects the current environment.

**How to verify:** Check `src/types/auth.ts` (`env` field on `AuthUser`).

**SOC2 relevance:** Environment separation.

---

## 6. Guardrail #2: No Hardcoded Enums

Intent values, lifecycle states, recipe names, and shadow verdicts are **never hardcoded** in UI filter dropdowns or display labels. They are fetched at runtime from `GET /api/v1/health`.

| What | Source | UI File |
|---|---|---|
| Intent filter options | `health.allowed_intents[]` | `src/app/exceptions/page.tsx` |
| Lifecycle state filter options | `health.lifecycle_states[]` | `src/app/exceptions/page.tsx` |
| Badge variant mapping | Default fallback for unknown values | `src/components/ui/Badge.tsx` |

**Test:** Adding a new intent or lifecycle state in `asoe2` requires **zero** UI code changes.

**How to verify:** Check `src/hooks/useHealth.ts`, filter dropdowns in `src/app/exceptions/page.tsx`, `Badge.tsx` default cases.

**CI enforcement (Phase 10):** ESLint custom rule `no-hardcoded-enums` flags string literals matching known intent or lifecycle patterns in `.tsx` files.

---

## 7. Audit Trail Display

The UI renders compliance-critical data faithfully from the backend:

| Data | Source API | UI Component |
|---|---|---|
| Shadow verdict (GREEN/YELLOW/RED) | `GET /exceptions/{id}` | AgentReasoningCard Layer 1 |
| Policy hits | `GET /exceptions/{id}/trace` | AgentReasoningCard Layer 2 |
| Gateway calls | Trace response | AgentReasoningCard Layer 2 |
| Backend fallback tier | Trace response | AgentReasoningCard Layer 2 |
| Resolution data | Exception detail | ExceptionDetailPanel JSON view |
| Pipeline progress | WebSocket events | WaterfallStepper |
| resolved_by / resolved_action / resolution_notes | Exception detail | ExceptionDetailPanel |

**How to verify:** Check `src/app/exceptions/ExceptionDetailPanel.tsx`, `src/components/ui/AgentReasoningCard.tsx`.

**SOX relevance:** Audit trail accessible to compliance reviewers through the UI.

---

## 8. No Secrets in Client Code

| Control | Enforcement |
|---|---|
| `NEXTAUTH_SECRET` | Server-side only (Next.js server component / API route). Never in client bundle. |
| `NEXT_PUBLIC_API_URL` | Only public env var. Contains no credentials. |
| `.env` files | Listed in `.gitignore`. Never committed. |
| No credentials in source | Pre-commit `gitleaks` hook (Phase 11). CI `truffleHog` scan (Phase 11). |

**How to verify:** Check `next.config.mjs` (no secret env vars exposed), `.gitignore` (`.env*` entries).

**SOC2 relevance:** Credential protection.

---

## 9. WCAG AA Accessibility

Per Section 11.3, the UI ensures inclusive access to compliance-critical functions:

| Requirement | Implementation |
|---|---|
| Color not sole indicator (1.4.1) | Every status Badge includes icon + text label |
| Contrast ratios (1.4.3) | Design token colors validated against WCAG AA (4.5:1 text, 3:1 UI) |
| Keyboard navigation (2.1.1) | All buttons, links, form controls focusable via Tab |
| Focus visible (2.4.7) | `2px solid var(--color-brand-ring)` focus ring |
| Dynamic content (4.1.3) | `aria-live="polite"` on Toast, ActivityIndicator |
| Dialog semantics (4.1.2) | `role="dialog"`, `aria-modal="true"` on Sidebar |

**How to verify:** Check `src/components/ui/Badge.tsx` (icon per variant), `src/components/ui/Toast.tsx` (aria-live), `src/components/ui/Sidebar.tsx` (dialog role).

**CI enforcement (Phase 10):** `jest-axe` accessibility tests on all status-related components.

**SOC2 relevance:** Availability — all authorized users can operate the system.

---

## 10. Error Handling — No Information Leakage

| Scenario | UI Behavior |
|---|---|
| API error response | Rendered via standard error envelope (Section 6.3): code + message only |
| Environment mismatch (403) | Generic "Access denied" — no internal state exposed |
| Network failure | WebSocket reconnects with backoff; REST falls back to polling |
| Malformed WebSocket data | Silently ignored (no error displayed to user) |

Stack traces, internal exception metadata, and database error details are **never** shown in the UI. Full error details are logged server-side with `trace_id`.

**How to verify:** Check error handling in `src/lib/api.ts`, `src/hooks/useWebSocket.ts`.

**SOC2 relevance:** Information disclosure prevention.

---

## Cross-Reference

| Control Area | Frontend (this document) | Backend (`asoe2/docs/AUDITOR_GUIDE.md`) |
|---|---|---|
| RBAC | UI button gating by role | API endpoint authorization |
| Compliance Shadow | Display verdict + policy hits | Execute shadow audit, enforce verdict |
| Audit Trail | Render TraceRecord in UI | Generate TraceRecord, persist to PostgreSQL |
| Tenant Isolation | Scoped API requests + WebSocket | RLS policies, application-layer injection |
| Secret Management | No secrets in client code | Azure Key Vault CSI, Workload Identity |
| Execution Invariants | N/A (backend concern) | 10 invariants enforced by code + tests |
| CI Guardrails | Guardrail #2 (no hardcoded enums) | 6 guardrails (Section 14) |
