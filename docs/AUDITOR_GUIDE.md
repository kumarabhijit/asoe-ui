# ASOE UI — Frontend Compliance & Security Controls

**Audience:** Compliance officers, SOX auditors, SOC2 assessors.
**Scope:** Frontend controls only. Backend controls are in `asoe2/docs/AUDITOR_GUIDE.md`. Together they form the complete ASOE compliance surface.
**Architecture reference:** `consol_arch.md` Sections 9.1–9.6.

---

## 1. RBAC UI Enforcement

Action buttons are gated by user role per Section 9.2. The backend enforces RBAC at the API layer; the UI complements this by rendering only the actions available to the authenticated user's role.

| Role | YELLOW Verdict Actions | RED Verdict Actions | GREEN Verdict Actions | PENDING_COSIGN |
|---|---|---|---|---|
| `analyst` | Approve, Reject, Escalate | Escalate | (no actions — auto-resolved) | (read-only awaiting-cosign banner) |
| `manager` | Approve, Reject, **Override…**, Escalate | **Override…**, Escalate | **Override…** (privileged override of auto-resolution) | Approve cosign / Reject cosign (if non-initiator) |
| `admin` | Approve, Reject, **Override…**, Escalate | **Override…**, Escalate | **Override…** | Approve cosign / Reject cosign (if non-initiator) |
| `viewer` | None (view only) | None (view only) | (no actions — view only) | None |
| `partner` | None (scoped view of own orders) | None | None | None |

**Button-to-permission mapping (Option A, Phase 3):**

| Visible Button | aria-label | Required Permission | Endpoint |
|---|---|---|---|
| `Approve` | Approve recommendation (suffixed with recipe-recommended action when supplied) | `exceptions:approve` | `PATCH /api/v1/exceptions/{id}/disposition` |
| `Reject` | Reject recommendation | `exceptions:approve` | `PATCH /api/v1/exceptions/{id}/disposition` |
| `Override…` | Choose different action | `exceptions:override` | `PATCH /api/v1/exceptions/{id}/disposition` (after chooser) |
| `Escalate` / `Escalate for Triage` | Send for triage | `exceptions:escalate` | `POST /api/v1/exceptions/{id}/escalate` |
| `Approve cosign` | Approve cosign | `exceptions:override` (non-initiator) | `POST /api/v1/exceptions/{id}/cosign` |
| `Reject cosign` | Reject cosign | `exceptions:override` (non-initiator) | `POST /api/v1/exceptions/{id}/cosign` |
| `Re-analyze` | Re-analyze exception | `exceptions:override` | `POST /api/v1/exceptions/{id}/reanalyze` |

**Label evolution (Phase 3 → Phase 4 UX panels):** The visible verb was briefly renamed to `Decide…` in Phase 3 after voice-of-user research found analysts hesitated to click "Override." The change was reverted in Phase 4: the button is only visible to manager+ with `exceptions:override`, and SOX §404 names the control itself "management override of controls" — so the button, the permission, the audit event `EXCEPTION_RESOLVED sub_type=OVERRIDE`, and the compliance narrative now share one vocabulary. The aria-label and hover tooltip retain the long-form "Choose different action" for screen-reader and mouse-over discoverability. See `ui_architecture.md` drift register D12.

**Override chooser safeguards (SOX):** Clicking `Override…` opens a bounded-vocabulary dialog. The resolution-action select is sourced from `GET /api/v1/health.allowed_resolution_actions` (or a server-narrowed subset on `resolution_data.allowed_actions`); the reason-category select is sourced from `health.allowed_override_reason_tags_by_intent[detail.intent]` (falling back to the global list). Notes are mandatory. Free-text action input was removed in Phase 3 — the reviewer can only choose from the authoritative vocabulary defined in `asoe2/constraints/specs.py`. This is the UI enforcement of Guardrail #2 for override actions. **Both pickers are typeahead Comboboxes** (S2 follow-up #6, 2026-05-29 — `src/components/ui/Combobox.tsx` built on `cmdk`); the option list is the SAME bounded vocabulary, just keyboard-filterable.

**Mandatory `reason_tag` on YELLOW/RED Approve/Reject (S2 #7, 2026-05-28):** Approve and Reject on a YELLOW or RED record require an operator-picked `reason_tag` from the same bounded vocabulary the Override dialog uses (`health.allowed_override_reason_tags_by_intent[detail.intent]`). The comment-swap inside `ActionButtonMatrix` renders the tag picker above the comment textarea; `Confirm Approval` / `Confirm Rejection` stay disabled until a tag is picked, and `⌘+Enter` cannot bypass the gate. GREEN keeps the optional-comment one-step path. **Audit consequence:** every YELLOW/RED disposition (Approve, Reject, or Override) now carries a structured `reason_tag` in the `disposition` POST body — the categorical signal ASOE's recipe calibration loop joins on, and the SR/SOX evidence-of-decision the auditor can pivot reports against. Free-text comments stay optional; the structured tag is the audit-bearing field. UI-side gate is paired with the asoe2 `is_valid_reason_tag_for_write` server check so a forged client can't bypass.

**Next-case auto-advance (S2 #11, 2026-05-28):** After every successful disposition the `/cases` workspace navigates the operator to the next case in the SLA-sorted visible queue. **No audit semantics change** — the disposition is committed server-side first, the auto-advance is a client-side URL update only. The just-dispositioned case still appears in `reanalysis_history` / hash-chained audit log; auto-advance does not skip or alter any audit write. The contract is locked at `tests/architectural/s2_tier3_audit_locks.test.ts`.

**Four-eyes cosign (Phase 2 #5 / asoe2 Phase 20):** When a privileged override exceeds the backend's financial-impact threshold, the record transitions to `lifecycle_state === "PENDING_COSIGN"` and a banner renders above the "Agent Recommendation" card showing initiator, staged action, reason_tag, and impact. A non-initiator manager+ cosigns; the initiator sees a read-only "Awaiting cosign" message — SoD (segregation of duties) is backend-enforced and the UI mirrors it. All cosign decisions carry mandatory notes. **This four-eyes rule is the SOX §404 control of record and is unchanged by Phase 8.13.**

**Self-override allowance (Phase 8.13 / 2026-05-03):** The narrower SoD rule that previously blocked the same user from running a second `/disposition` on a record they themselves resolved was relaxed. Operators legitimately need to correct their own earlier overrides without escalation churn. The audit trail still records every override attempt — initiator, timestamp, reason_tag, action — via `reanalysis_history`, so SOX evidence-of-control is preserved. The Playwright spec `tests/browser/override-and-sod.spec.ts` now asserts a successful self-re-override with **no `Segregation of duties` toast** as a regression guard. The four-eyes rule above is the only remaining SoD self-block.

**Review Authority model (Phase 8.6):** The Exception Detail view enforces that human users act as **Review Authority** only. There are no "Execute Recipe", "Run Engine", or "Process" buttons in the UI. The human may Approve, Reject, or Escalate the agent's proposed resolution — execution is triggered by the backend upon approval, not by the UI. The Compliance Shadow verdict (GREEN/YELLOW/RED) is displayed as a **read-only badge**, not as an actionable control.

**How to verify:**
- `src/components/ui/AgentReasoningCard.tsx` — verdict × permission button matrix via `canApprove` / `canOverride` / `canEscalate` props; `actionInFlight` pessimistic UI
- `src/app/exceptions/ExceptionDetailPanel.tsx` — `handleApprove` / `handleReject` / `handleEscalate` / `handleOverride` / `submitOverride` / `handleCosign` handlers; cosign banner on `PENDING_COSIGN`; Override chooser dialog; no execution trigger buttons; Shadow Verdict as read-only badge
- `src/lib/roles.ts` — `ROLE_PERMISSIONS` mapping aligned with `asoe2/api/deps.py` (includes `exceptions:escalate` on analyst/manager/admin)

**SOX relevance:** Prevents unauthorized financial exception resolution. Ensures separation of duty — agents propose, humans review, backend executes.

### 1.1 Erasure-certificate download (PARITY-0.5 / PARITY-8)

`ErasureCertificateButton` (`src/components/ui/ErasureCertificateButton.tsx`)
wraps `GET /api/v1/attachments/{id}/erasure-certificate`. The
backend gates the endpoint on **manager+admin only** (analyst /
viewer / partner all return 403) and **tenant-scopes** the read —
the audit log is queried per the caller's tenant, so a tenant can
never read another tenant's certificate. Both invariants are
enforced server-side; the UI component does not re-implement them.

The certificate response carries a PII-free tombstone (`attachment_id`,
`sha256`, `case_id`, `size_bytes`, `mime_type`, `erased_at`,
`erased_by`, `reason`) plus the hash-chained audit-event proof
(`event_id`, `policy_key`, `event_hash`, `prev_hash`, `created_at`,
`changed_by`, `change_reason`) and a `chain_verified` boolean
recomputed at fetch time. The component packages this as a JSON Blob
and triggers a download with a regulator-correlable filename
(`erasure-certificate-{attachmentId}-{erasedAt}.json`).

The mock-mode path in `attachmentsApi.getErasureCertificate`
synthesises the same shape (deliberately no `content`, no `name`)
so the surface is exercisable in dev / Vercel previews without a
real erasure.

**SOX relevance:** Right-to-erasure proof. A regulator can verify
the chain-proof from the certificate independently of ASOE — the
audit chain is the tamper-evident record, not a wet signature.

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

- The `trace_id` and TraceRecord fields (skill_name, intent_selected, shadow_verdict, recipe_name, gateway_calls) are displayed in the **Trace Evidence** collapsible section within ExceptionDetailPanel — a direct sub-section of the **Diagnostics & Audit** group (open that group to reveal it; the former inner "Show Diagnostics" toggle was removed 2026-06-09)
- Resolution Data (JSON) is also nested within Trace Evidence for audit review
- **Verdict Pillar 2.3 audit-gap surface (Phase 8.12):** when the
  `build_analysis` graph node flags a record `AUDIT_CONTEXT_MISSING`,
  the Trace Evidence section additionally renders
  `audit_context_missing_class` (e.g. `PriceAnalysisData`) +
  `audit_context_missing_fields` (ordered list of audit-bearing
  fields the registry required but the gateway/recipe couldn't
  populate). Auditors read the gap directly rather than regexing
  the free-text explanation. Mirrors
  `asoe2/api/schemas.py::TraceResponse` lines 311-318.

**Idempotency-Key emission (Phase 2 #9):** Every mutating client method (`disposition`, `escalate`, `cosign`, `reanalyze`, `resolve`, `resolveAsync`) emits an `Idempotency-Key` header on the outbound request. When the caller does not supply one via `RequestOptions.idempotencyKey`, `src/lib/api.ts::generateIdempotencyKey()` produces a UUID v4 per invocation. This guards against double-click and network-retry replays: the backend honours the key by returning the prior response when a duplicate arrives, preventing accidental double-dispositions. Together with `X-Trace-ID` this gives every mutating UI action a stable client-side identity that survives retries.

**Audit event visibility:** The UI does not render the hash-chained audit log itself (asoe2 Phase 20 `audit_log` is server-side, verifiable out-of-band by auditors). The UI displays the **human-consumable projection** of that chain:
- `reanalysis_history` — prior re-analysis attempts with reasons (rendered in DiagnosticsSection)
- `pending_override` cosign metadata — initiator, action, reason_tag, financial_impact_usd, initiated_at (rendered in the cosign banner when `lifecycle_state === "PENDING_COSIGN"`)
- `cosign` metadata after sign-off — cosigned_by, cosigned_at, cosign_notes (rendered in resolution data)

For cryptographic chain verification, auditors query the backend `audit_log` directly.

**How to verify:** Check `src/app/exceptions/ExceptionDetailPanel.tsx` — Trace Evidence section (inside Diagnostics toggle) displays all trace fields and resolution data. Check `src/lib/api.ts` — `resolveIdempotencyKey()` / `generateIdempotencyKey()` for header emission logic.

**SOX relevance:** Every financial decision traceable from UI action to ERP effect; replay-safe dispositions.

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
| Intent filter options | `health.allowed_intents[]` | _Currently no surface mounts an intent filter — the ADR-041 P4 cleanup retired `CaseListPane`. When intent filtering returns on `/cases` it will source from `useHealth().allowed_intents`._ |
| Lifecycle state filter options | `health.lifecycle_states[]` | _The legacy `ExceptionListPane` was retired in P4. Status filtering on `/cases/page.tsx` sources from `useHealth().allowed_case_statuses` instead._ |
| Case status filter options | `health.allowed_case_statuses[]` | `src/app/cases/page.tsx` (workspace queue filter); cluster grouping + STATUS_LABEL in `src/lib/cases.ts` |
| Case source filter options | `health.allowed_case_sources[]` (`ALLOWED_CASE_SOURCES` re-exported from `src/lib/api.ts`) | `src/app/cases/page.tsx` (workspace filter chips) + `src/app/inbox/page.tsx` |
| Badge variant mapping | Default fallback for unknown values | `src/components/ui/Badge.tsx` |

**Test:** Adding a new intent or lifecycle state in `asoe2` requires **zero** UI code changes.

**How to verify:** Check `src/hooks/useHealth.ts`, the consolidated `src/lib/cases.ts` (the single STATUS_LABEL + cluster grouping + `isAwaitingHuman` helper that retired four duplicate maps + two hardcoded `OPEN_AWAITING_HUMAN` comparisons during Phase 28.5.x §D1), `Badge.tsx` default cases.

**CI enforcement (Phase 10):** ESLint custom rule `no-hardcoded-enums` flags string literals matching known intent or lifecycle patterns in `.tsx` files.

---

## 7. Audit Trail Display

The UI renders compliance-critical data faithfully from the backend:

| Data | Source API | UI Component |
|---|---|---|
| Shadow verdict (GREEN/YELLOW/RED) | `GET /exceptions/{id}` | "Agent Recommendation" card (Layer 1) — also shown in `HeaderRibbon` under the explicit `Audit Result:` label so the verdict is never reduced to a colour pill alone (Phase 8.13). |
| Lifecycle state (PENDING_REVIEW / RESOLVED / BLOCKED / …) | `GET /exceptions/{id}` | `HeaderRibbon` under the `Current State:` label; list-card row chip. |
| **Agent confidence (0-100)** | `GET /exceptions/{id}/analysis` → `AnalysisResponse.confidence` | "Agent Recommendation" card (Confidence pill) — sourced from the **real classifier output** persisted in `trace_data["intent_confidence"]`; never a fabricated default. See asoe2 `docs/AUDITOR_GUIDE.md` §2.1 for the source-of-truth statement. |
| Policy hits | `GET /exceptions/{id}/trace` | "Agent Recommendation" card (Layer 2 expand) |
| Gateway calls | Trace response | "Agent Recommendation" card (Layer 2 expand) |
| Backend fallback tier | Trace response | "Agent Recommendation" card (Layer 2 expand) |
| **Entity profile (customer master data)** | `GET /exceptions/{id}/analysis` → `AnalysisResponse.entity_profile` | `ContextStrip` (collapsed by default — Phase 8.13). Sourced from `api/profile_composer.compose_entity_profile`; returns `null` when no Account linkage so the UI structurally omits the column rather than rendering a partial-truth row. |
| **Impact metrics (revenue at risk, deltas, SLA priority)** | `GET /exceptions/{id}/analysis` → `AnalysisResponse.impact_metrics` | `ContextStrip` (collapsed by default — Phase 8.13). Sourced from `api/profile_composer.compose_impact_metrics`; returns `null` when no line items so the UI omits the column rather than rendering a zero-filled struct. |
| **Order-level root cause + recommendation** | `GET /exceptions/{id}/analysis` → `AnalysisResponse.root_cause` / `.recommendation` | `AgentAnalysisSection` (collapsed by default; auto-expands on HITL — `PENDING_REVIEW / ESCALATED / PENDING_ADMIN_REVIEW / PENDING_COSIGN / BLOCKED`). Sourced from `api/profile_composer.compose_narrative` (Phase 8.13). Each prose block renders only when its field is present (Guardrail #6 structural omission). |
| Resolution data | Exception detail | DiagnosticsSection JSON view |
| Pipeline progress | WebSocket events (wired to detail panel via `onRefreshRef`); REST polling fallback after 5 failed reconnects (§8.4) | WaterfallStepper (in DiagnosticsSection) |
| **Pipeline failure banner** | `lifecycle_state === "FAILED"` + execution_log error fields | "Agent Recommendation" card `executionError` branch — distinct from RED verdict (compliance decision) and from "Shadow has not yet completed" (which previously rendered for every FAILED state and was misleading); see drift register D21 |
| resolved_by / resolved_action / resolution_notes | Exception detail | DiagnosticsSection |
| Duplicate detection (original vs duplicate order, confidence, autonomy) | `GET /exceptions/{id}/analysis` | DuplicateDetectionSection (data-presence) |
| Order comparison (matching/differing fields, line-item diff) | `GET /exceptions/{id}/analysis` | OrderComparisonSection (data-presence) |

**How to verify:** Check `src/app/exceptions/ExceptionDetailPanel.tsx` (orchestrator) and sub-components: `HeaderRibbon.tsx`, `ContextStrip.tsx`, `AgentAnalysisSection.tsx`, `EvidenceGrid.tsx`, `DiagnosticsSection.tsx`, `DuplicateDetectionSection.tsx`, `OrderComparisonSection.tsx`. Also check `src/components/ui/AgentReasoningCard.tsx`.

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
| Color not sole indicator (1.4.1) | Every status Badge includes icon + text label; `VerdictDot` pairs colored dot with a single-letter glyph + descriptive `aria-label` |
| Contrast ratios (1.4.3) | Design token colors validated against WCAG AA (4.5:1 text, 3:1 UI) |
| Keyboard navigation (2.1.1) | All buttons, links, form controls focusable via Tab; ribbon hotkeys A/R/O/E/Y registered via `useHotkeys` (single registry `src/lib/hotkeys.ts`); `?` cheatsheet surfaces every binding |
| Focus visible (2.4.7) | `2px solid var(--color-brand-ring)` focus ring |
| Focus restore on close (2.4.3) | `useFocusRestoreOnClose` hook restores focus to the operator's prior position when `HotkeyCheatsheet` / `ActionButtonMatrix` comment swap closes. Radix Dialog handles `OverrideChooserDialog` automatically (S3 #C, 2026-05-29) |
| Dynamic content (4.1.3) | `aria-live="polite"` on Toast, ActivityIndicator, the `ActionButtonMatrix` comment swap (S2 #10); `SlaBandAnnouncer` emits a sr-only polite message when the selected case crosses an SLA band (`comfortable → at_risk → breached`, or recovery back). Silent on per-minute ticker re-renders — `Last activity` spans declare explicit `aria-live="off"` (S3 #B + #E, 2026-05-29) |
| Dialog semantics (4.1.2) | `role="dialog"`, `aria-modal="true"` on Sidebar; `ActionButtonMatrix` comment swap declares the same when a mandatory tag or reanalyze reason is required |

**How to verify:** Check `src/components/ui/Badge.tsx` (icon per variant), `src/components/ui/Toast.tsx` (aria-live), `src/components/ui/Sidebar.tsx` (dialog role).

**CI enforcement (PR #163 — UX/A11y test bundle):** A layered set of permanent gates locks WCAG 2.1 AA across the layers an auditor cares about — token, component, page composition, and live operator journey. Full pattern catalogue in `docs/test-strategy/UX_ACCESSIBILITY.md`.

| Layer | What it locks | Test file |
|---|---|---|
| Design tokens | WCAG contrast ratios on shipped foreground/background pairs across light + dark themes | `tests/accessibility/design_tokens_contrast.test.ts` |
| Component | `vitest-axe` sweep on every top-level interactive component (Badge, Button, Input, Sidebar, MetricTile, AgentReasoningCard, NavBar, Toast, ThemeToggle, EvidenceBlock, EventsTimeline, Dialog, DropdownMenu, Select, status-panel sections) | `tests/accessibility/component_sweep.test.tsx` + `tests/accessibility/status_components.test.tsx` |
| Source-level | Z-index ladder discipline, skip-to-main link + landmark plumbing on every authenticated page, StatusAnnouncer mount, `MAX_PRIMARY_ACTIONS=3` budget on AgentReasoningCard | `tests/architectural/ux_clutter_invariants.test.ts` |
| Focus management | Sidebar focus-on-open / ESC close / `aria-modal`; skip-link reachability via first Tab | `tests/accessibility/keyboard_focus.test.tsx` |
| Page composition | `@axe-core/playwright` sweep on every authenticated route with per-route ratchet baseline (regressions fail; existing debt tolerated and listed) | `tests/browser/a11y-route-sweep.spec.ts` |
| Viewport + motion | No horizontal overflow at 1280/1440/1920; `prefers-reduced-motion` collapses the `--dur-*` ladder to 0ms | `tests/browser/viewport-and-motion.spec.ts` |
| Operator journey | Login → /cases → record action via keyboard only with `data-testid="status-announcer"` aria-live mutation asserted at the announcement step | `tests/browser/keyboard-only-journey.spec.ts` |

Known shortfalls recorded explicitly (auditor visibility): white-on-dark-mode-brand button → 3.32:1 (above large-text floor, below small-text floor — token-darkening pass tracked); small-caption uses of `text-text-tertiary` / `text-text-quaternary` across every route held by `ROUTE_BASELINE` in the route-axe spec (regressions fail; current per-route counts ratchet down as design-system cleanup lands).

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
