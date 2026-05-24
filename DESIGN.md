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
│   ├── page.tsx                  # Root redirect → /home (issue #133 PO #5/#6 operational landing)
│   ├── login/page.tsx            # Multi-step login (email → password → SSO redirect)
│   ├── auth/callback/page.tsx    # SSO callback handler
│   ├── home/page.tsx             # Operational landing surface (post-#133)
│   ├── cases/
│   │   ├── page.tsx              # ADR-041 P3 — canonical case workspace. Three-pane at xl (≥1280px): queue (left, 320px) + record-list (middle, 280px) + case detail (right, flex); two-pane at lg, single column below. URL-driven via ?case=<caseId>&record=<recordId> — both writes use router.replace with `scroll: false` so row selection keeps the queue scroll position. SLA-sorted queue with filter chips, keyboard nav (j/k arrows, Home/End), pin-selection guard, WS-driven silent refresh via useCases().
│   │   ├── CaseDetailPanel.tsx   # Right-pane content — slim context strip (when record mounted) or full case header (otherwise) + inline attached-records picker + inline ExceptionDetailPanel. `inlineRecordListHiddenAtXl` prop: when true the inline picker is xl:hidden so it acts as the below-xl fallback for the middle column (P3e).
│   │   ├── RecordListPane.tsx    # Middle-pane attached-records picker (role="radiogroup"). Rendered as the dedicated xl column by page.tsx and as the below-xl inline fallback by CaseDetailPanel.
│   │   └── [id]/page.tsx         # Focused single-case view (deep-link target — no queue chrome). Mounts the same CaseDetailPanel.
│   ├── exceptions/               # ADR-041 P4 — queue route retired. next.config.mjs redirects /exceptions and /exceptions/:path* → /cases (permanent: true). The directory survives only because the per-record enrichment sections + ExceptionDetailPanel live here; no `page.tsx` / `error.tsx` / `loading.tsx` route files remain.
│   │   ├── ExceptionDetailPanel.tsx  # Orchestrator composing 13 layer sub-components; mounted inline by CaseDetailPanel
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
│   │   ├── DeliveryDelaySection.tsx       # Data-presence enrichment: planned vs projected ETA, days-late, ranked alternate options
│   │   ├── PriceHoldSection.tsx           # Data-presence enrichment: PO vs SAP price, signed variance, tolerance/hard-block strip, recipe action
│   │   ├── EdiMismatchSection.tsx         # Data-presence enrichment: sub_type badge, expected vs received cards, classification, autonomy
│   │   ├── EmailSourceSection.tsx         # Data-presence enrichment: source email substrate (ADR-034 Phase G.2)
│   │   ├── EmailOrderEntrySection.tsx     # Data-presence enrichment: classified email order intake
│   │   ├── OverrideChooserDialog.tsx      # Modal: pick action / reason / notes for an Override decision
│   │   └── shared.tsx            # CollapsibleHeader, fmtPrice helpers
│   ├── dashboard/page.tsx        # Analytics dashboard (Layout B) + recent activity feed
│   ├── inbox/page.tsx            # Customer Inbox — AI email triage (redirects to /cases?source=manual_order per #133 PO #9)
│   ├── settings/page.tsx         # Settings page (Phase 9 stub — admin, SSO, agent config)
│   └── api/auth/[...nextauth]/route.ts  # NextAuth API route
├── components/ui/                # Reusable UI components (Section 11.2)
│   ├── ActivityIndicator.tsx     # Domain-aware loading text per pipeline node
│   ├── AgentReasoningCard.tsx    # Two-layer cognition: Layer 1 + Layer 2
│   ├── Badge.tsx                 # Tinted bg + icon + text, verdict/lifecycle/rootCause helpers
│   ├── Button.tsx                # 5 variants (brand/neutral/success/ghost/destructive)
│   ├── Card.tsx                  # Borderless shadow-elevated container
│   ├── CaseViewBanner.tsx        # Banner identifying /inbox or /exceptions as filtered views of /cases (legacy — /exceptions retired in P4)
│   ├── ChromeBoundary.tsx        # Authenticated-route NavBar + sign-out wrapper
│   ├── EvidenceBlock.tsx         # Audit-bearing field renderer enforcing the three presence states
│   ├── GapBar.tsx                # Horizontal ordered-vs-available/max bar with gap highlight (shortfall/excess modes)
│   ├── GravitationalOrbs.tsx     # Canvas animated background (login page)
│   ├── Input.tsx                 # Label + input + error + right icon
│   ├── Logo.tsx                  # ASOE brand mark with optional tagline
│   ├── MetricTile.tsx            # KPI: icon + label + monospace value + subtitle
│   ├── NavBar.tsx                # 56px glass surface, tabs, agent status pulse
│   ├── PolicyHitBadge.tsx        # L1 rule names render plain; L2 LLM-derived concerns carry the AI badge
│   ├── PricingWaterfall.tsx      # Vertical pricing condition chain timeline
│   ├── Sidebar.tsx               # 480px slide-right intervention panel
│   ├── Toast.tsx                 # 4.5s auto-dismiss, status-colored, solid-fill
│   ├── UserSwitcher.tsx          # Sandbox-only user switcher (signIn credentials flow, server round-trip)
│   └── WaterfallStepper.tsx      # 11-node pipeline progress visualization (post-ADR-025)
├── hooks/
│   ├── useAuth.ts                # Wraps NextAuth session with typed user + visibleTabs, assignedAccounts
│   ├── useErpProfile.ts          # ERP-vendor-aware label resolver (useIntentLabel, useSubTypeLabel)
│   ├── useExceptionActions.ts    # HITL handlers (approve / reject / escalate / override / cosign / reanalyze)
│   ├── useHealth.ts              # Fetches runtime enums from /api/v1/health
│   ├── useKeyboardListNav.ts     # ArrowUp/Down + j/k + Home/End on a sorted single-select listbox. Consumed by /cases workspace queue (ADR-041 P3c).
│   ├── useManualOrderCases.ts    # `useCases` + `useManualOrderCases` — fetch /api/v1/cases with WS-driven invalidation; exposes refetch() and isCaseInvalidationEvent helper
│   ├── useSavedViews.ts          # v2 storage shape with `surface` discriminator (legacy CaseListPane consumer; retained for the inbox-filtered case-list view)
│   ├── useSignOut.ts             # NextAuth signOut + redirect to /login
│   ├── useSlaTicker.ts           # 1-minute interval for live SLA-band recalculation without re-fetch
│   └── useWebSocket.ts           # Section 8 protocol with reconnection backoff + Section 8.4 polling fallback
├── config/
│   ├── erp-label-map.ts          # Per-vendor (SAP / Oracle / Salesforce / GENERIC) display-label maps for intents + EDI sub_types
│   └── nav-tabs.ts               # Single source of truth for NavBar tabs (ADR-041 P2 dropped "Exception Queue"; Home / Cases / Performance / Settings remain)
├── lib/
│   ├── api.ts                    # API client — handler surface for auth + health + exceptions + line items + cases + pipeline + workflow + policy. Bulk mock fixtures live in mock-data/ (ADR-041 P5; api.ts shrunk 3894 → 2146 lines).
│   ├── auth.ts                   # NextAuth options (credentials provider, JWT callbacks)
│   ├── cases.ts                  # STATUS_LABEL + CASE_STATUS_CLUSTERS + isAwaitingHuman / clusterFor / sourceChannelLabel / lastActivityLabel helpers
│   ├── mock-data/                # ADR-041 P5 — bulk mock fixtures extracted from api.ts
│   │   ├── order-analyses.ts     # MOCK_ORDER_ANALYSES (~1750 lines) — keyed by ExceptionSummary.id
│   │   ├── exceptions.ts         # MOCK_EXCEPTIONS + the S15a parent_case_id forEach wiring in module scope. Includes 3 multi-issue clusters (7 records sharing a parent_case_id) for the records-picker workflow.
│   │   ├── cases.ts              # caseFromMockException + MOCK_CASES (grouped by parent_case_id; aggregateCaseStatus rolls per-record status up to the case by dominance order)
│   │   └── line-items.ts         # MOCK_LINE_ITEMS
│   ├── roles.ts                  # RBAC permissions aligned with asoe2/api/deps.py
│   └── utils.ts                  # cn() — Tailwind class merge utility (clsx + tailwind-merge)
├── types/
│   ├── auth.ts                   # AuthUser, LoginResponse, Role (← asoe2 schemas)
│   ├── cases.ts                  # OrderCase, CaseSource, CaseType (EMAIL_ENTRY | BLOCK — ADR-041 P1), EmailClassification, CaseStatus, SlaSnapshot
│   ├── exceptions.ts             # Intent, LifecycleState, ShadowVerdict, ExceptionSummary (with sap_block_code? — ADR-041 P1),
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
| `WaterfallStepper` | Tailwind | 11-node pipeline with per-node states (post-ADR-025) | ExceptionDetailPanel |
| `AgentReasoningCard` | Tailwind | Layer 1 only (recommendation + actions). Header reads **"Agent Recommendation"** (Phase 8.13 rename — disambiguates from the prose `AgentAnalysisSection` pane); verdict × permission button matrix (Option A): `canApprove` / `canOverride` / `canEscalate` / `actionInFlight` / `recommendedAction` props. `Override…` + Approve-tooltip preview. The `explanation` prop is sourced from `trace.explanation` only — no fallback to `analysis.diagnosis` (that prose lives in `AgentAnalysisSection` exclusively). Exports `MAX_PRIMARY_ACTIONS = 3` (PR #163) — the design-system cap on primary CTAs per verdict branch, source-grep-locked by `tests/architectural/ux_clutter_invariants.test.ts`. | ExceptionDetailPanel |
| `PricingWaterfall` | Tailwind | Pricing condition chain timeline | ExceptionDetailPanel |
| `GapBar` | Tailwind | Horizontal bar: primary vs secondary qty, shortfall/excess mode, gap indicator | BackOrderSection, OverMaxSection, MOQSection |
| `GravitationalOrbs` | Custom (canvas) | Canvas animated background | Login |
| `UserSwitcher` | Tailwind | Sandbox-only user switcher dropdown, server round-trip via `signIn("credentials")` | NavBar (all pages) |

**Styling approach (Phase 8.9):** All components use Tailwind utility classes via the design token mapping in `tailwind.config.ts`. CVA (`class-variance-authority`) is used for multi-variant components (Button, Badge). `cn()` utility (`src/lib/utils.ts`) merges Tailwind classes with conflict resolution. Only 18 inline `style={{}}` objects remain across the entire codebase — all are data-driven dynamic values (avatar colors, bar widths, chart colors).

**Badge variant mappers** (`Badge.tsx`): `verdictVariant()`, `lifecycleVariant()`, `rootCauseVariant()`, `categoryVariant()`, `inboxStatusVariant()` — all follow the same pattern: map API-provided strings to CSS variants with a `default` fallback.

**PricingWaterfall vs WaterfallStepper:** WaterfallStepper visualizes the 11-node pipeline execution (WebSocket-driven). PricingWaterfall visualizes pricing condition chains for line items (API data-driven). They share a timeline visual metaphor but differ in data model and purpose.

**Shadcn components installed:** Select, DropdownMenu, Dialog (Radix primitives + Tailwind styling). **Pending:** DataTable (Tanstack Table), Tooltip.

---

## 3. Page Architecture

### Inline Exception Detail (`ExceptionDetailPanel`)

`ExceptionDetailPanel` is the per-record HITL surface — `HeaderRibbon`
→ `ContextStrip` → `AgentReasoningCard` (Layer 1/2) → enrichment
sections → `EvidenceGrid` → `DiagnosticsSection`. Pre-S15a it had its
own route (`/exceptions/[id]`); post-S15a it mounts **inline** inside
`CaseDetailPanel` on the `/cases` workspace (see the `/cases` section
below for the workspace layout). The `/exceptions` queue route was
retired in ADR-041 P4; `next.config.mjs` redirects bookmarks.

```
ExceptionDetailPanel (mounted inline inside CaseDetailPanel's right pane)
┌──────────────────────────────────┐
│ Header Ribbon (breadcrumb-style) │
│ SO-1001 > Customer > Location >  │
│ Primary SKU or "N Lines"         │
├──────────────┬───────────────────┤
│ Entity       │ Impact & Risk     │
│ Profile      │ Metrics           │
├──────────────┴───────────────────┤
│ Agent Analysis                   │
│ (Problem / Root Cause / Reco)    │
│ AgentReasoningCard (Layer 1/2)   │
│ ▸ Evidence Detail [collapsed]    │
│ Pipeline Progress                │
│ Trace Evidence tabs              │
└──────────────────────────────────┘
```

**Mount surfaces:**
- `/cases?case=<id>&record=<rid>` — workspace; `CaseDetailPanel` selects the record and mounts this panel.
- `/cases/<id>?record=<rid>` — focused single-case view (deep-link target with no queue chrome).

**Data flow:** `exceptionsApi.get(id)` + `exceptionsApi.orderAnalysis(id)` is the critical path (Phase 8.13). `lineItems` background-warms after first paint; `trace` is lazy-loaded the first time the operator opens the Diagnostics pane (`onFirstOpen` callback on `DiagnosticsSection`). Re-collapsing doesn't re-fetch.

**Queue ↔ detail flow:** The queue is the `/cases` workspace left pane (see Cases section below). Keyboard navigation (`ArrowDown` / `j` / `ArrowUp` / `k` / `Home` / `End`) is wired via `useKeyboardListNav` on the queue listbox; clicking or keyboard-selecting a row sets `?case=` (and auto-mounts `?record=`), which drives the inline panel. The hook bails when the active element is an input / textarea / select / contenteditable / Radix popover.

**Detail-pane header labels:** `HeaderRibbon` prefixes the lifecycle and shadow-verdict badges with explicit labels — `Current State: <lifecycle>` and `Audit Result: <verdict>` — so reviewers don't have to learn which colored pill maps to which thing.

**Polymorphic detail view:** `ExceptionDetailPanel.tsx` orchestrates 13 sub-components decomposed along the **5-layer axis** (not the intent axis). Each sub-component is intent-agnostic — driven by data presence, not intent strings:

| Layer | Sub-Component | File | Purpose |
|---|---|---|---|
| 1 | `HeaderRibbon` | `HeaderRibbon.tsx` | Breadcrumb context, lifecycle/verdict badges, total value |
| 2 | `ContextStrip` | `ContextStrip.tsx` | Entity Profile + Impact Metrics (collapsible, **default collapsed** — Phase 8.13). Renders nothing if both `analysis.entity_profile` and `analysis.impact_metrics` are absent. |
| 3 | `AgentAnalysisSection` | `AgentAnalysisSection.tsx` | Problem / Root Cause / Recommendation narratives — **collapsible**, collapsed by default; auto-expands when `detail.lifecycle_state` is in `HUMAN_IN_THE_LOOP_STATES` (PENDING_REVIEW / ESCALATED / PENDING_ADMIN_REVIEW / PENDING_COSIGN / BLOCKED). Each prose block (Problem / Root Cause / Recommendation) renders only when the matching `OrderAnalysis` field is present (Guardrail #6 structural omission). |
| 3+ | `DuplicateDetectionSection` | `DuplicateDetectionSection.tsx` | Data-presence enrichment: original vs duplicate order, detection method, confidence, autonomy |
| 3+ | `OrderComparisonSection` | `OrderComparisonSection.tsx` | Data-presence enrichment: side-by-side order comparison with matching/differing field badges |
| 3+ | `PriceAnalysisSection` | `PriceAnalysisSection.tsx` | Data-presence enrichment: price delta bars (ERP vs PO), metric tiles, collapsible SAP context card |
| 3+ | `BackOrderSection` | `BackOrderSection.tsx` | Data-presence enrichment: GapBar (ordered vs available), DC inventory snapshot, substitute SKUs, ranked resolution options with multi-dimensional scoring |
| 3+ | `OverMaxSection` | `OverMaxSection.tsx` | Data-presence enrichment: exceedance bar (ordered vs max), order lines table, AI trim plan (TRIM/SKIP/OK actions) |
| 3+ | `MOQSection` | `MOQSection.tsx` | Data-presence enrichment: shortfall bar (ordered vs MOQ), SAP V4082 block detail, AI round-up plan (ROUND_UP/ACCEPT_BELOW/ESCALATE), SAP execution steps |
| 3+ | `PalletConfigSection` | `PalletConfigSection.tsx` | Data-presence enrichment: KPI strip (cases/loose/labor/freight), per-line pallet fill bars with violation badges, AI suggested plan table |
| 3+ | `DeliveryDelaySection` | `DeliveryDelaySection.tsx` | Data-presence enrichment for `DELIVERY_DELAY`: planned vs projected ETA, days-late badge, delay category, ranked alternate options (EXPEDITE / SPLIT_SHIP / RESCHEDULE) with extra-cost / new-ETA metrics |
| 3+ | `PriceHoldSection` | `PriceHoldSection.tsx` | Data-presence enrichment for `PRICE_HOLD_RELEASE`: PO vs SAP base price cards, signed `variance_pct`, hold_status / tolerance / hard_block thresholds, recipe `action` badge (AUTO_RELEASE / ESCALATE / HARD_BLOCK), reason text |
| 3+ | `EdiMismatchSection` | `EdiMismatchSection.tsx` | Data-presence enrichment for `EDI_MISMATCH`: `sub_type` rendered verbatim, `expected_value` vs `received_value` (any shape — string / number / object), `classification` badge (HARD_REJECT / REVIEW / ESCALATE), `recommended_action`, `autonomy_level`. PRICE_MISMATCH is routed to `CONTRACTUAL_CORRECTION` at backend classifier time and never mounts this section. |
| 4 | `EvidenceGrid` | `EvidenceGrid.tsx` | Collapsed by default; line-item table + pricing waterfall |
| 5 | `DiagnosticsSection` | `DiagnosticsSection.tsx` | Hidden behind "Show Diagnostics" toggle: Pipeline Progress (WaterfallStepper) + Trace Evidence tabs |

**Data-presence enrichment sections** render only when their optional data is present in `OrderAnalysis`. Each is wrapped in a `CollapsibleSection` (collapsed by default — Phase 8.13 PO ruling: "operator scans the Recommendation card first and only drills into evidence panes when they need detail"):
```tsx
{analysis?.price_analysis && (
  <CollapsibleSection title="Price Analysis">
    <PriceAnalysisSection data={analysis.price_analysis} />
  </CollapsibleSection>
)}
{analysis?.duplicate_detection && (
  <CollapsibleSection title="Duplicate Detection">
    <DuplicateDetectionSection data={analysis.duplicate_detection} />
  </CollapsibleSection>
)}
// …Order Comparison, Back-Order Analysis, Over-Max Analysis,
// MOQ Analysis, Pallet Configuration, Delivery Delay, Price Hold,
// EDI Mismatch — same wrapper.
```
The wrapper mounts its child only when open, so heavy renders (waterfalls, gateway tables) stay deferred until the operator expands the section.

Adding a new enrichment section requires only: (1) add the type to `OrderAnalysis`, (2) create the section component, (3) add the wrapped conditional render — zero dispatch logic.

**Shared helpers** (`shared.tsx`):
- `CollapsibleHeader` — used by ContextStrip, DiagnosticsSection
- `CollapsibleSection` — generic wrapper used for every enrichment section in `ExceptionDetailPanel` (Phase 8.13). Accepts `title` and `defaultOpen` props; renders a card-styled header with chevron, lazy-mounts children on open.
- `fmtPrice` — used by HeaderRibbon, ContextStrip, EvidenceGrid, enrichment sections
- `COSIGN_LIFECYCLE_STATE` — the one business-rule lifecycle literal used in the panel (cosign-banner gate)

**HITL auto-expand** (Phase 8.13): `ExceptionDetailPanel` exports an `isHumanInTheLoopState(state)` predicate keyed on `HUMAN_IN_THE_LOOP_STATES = { PENDING_REVIEW, ESCALATED, PENDING_ADMIN_REVIEW, PENDING_COSIGN, BLOCKED }`. The result drives `AgentAnalysisSection.defaultOpen`. Enrichment sections stay collapsed regardless — their content is data the operator opens on demand, not narrative the system prompts them to read.

**RBAC permission gating:** Approve/Reject/Override…/Escalate action buttons are gated via `hasPermission()` — only users with the required `{resource}:{action}` RBAC permission see the buttons. Gates resolve to component props: `canApprove` (`exceptions:approve`), `canOverride` (`exceptions:override`), `canEscalate` (`exceptions:escalate`).

**Override chooser dialog (Phase 3):** The `Override…` button on `AgentReasoningCard` opens an override chooser dialog rendered inline in `ExceptionDetailPanel.tsx`. The dialog sources its resolution-action options from `health.allowed_resolution_actions` (preferring a record-specific narrower list from `resolution_data.allowed_actions` when the server supplies one), and its reason-category options from `health.allowed_override_reason_tags_by_intent[detail.intent]` (falling back to the global `health.allowed_override_reason_tags`). Notes are mandatory (SOX). Submission calls `exceptionsApi.disposition()` with `{ action, notes, reason_tag }`. No free-text action input — Guardrail #2.

**Four-eyes cosign banner:** When `detail.lifecycle_state === "PENDING_COSIGN"`, `ExceptionDetailPanel` renders a cosign banner above the AgentReasoningCard showing initiator, staged action, reason_tag, and financial impact (from `resolution_data.pending_override`). Non-initiator manager+ users see `[Approve cosign] [Reject cosign]` buttons wired to `handleCosign(approve: boolean)` → `exceptionsApi.cosign()`. The initiator sees a read-only "awaiting cosign" message (SoD enforcement mirrored from backend). `ActionInFlight` extends with `cosign-approve` / `cosign-reject` for pessimistic UI.

**Disposition handlers:** `handleApprove`, `handleReject`, and `submitOverride` all route through `exceptionsApi.disposition()` after Phase 3 consolidation — the server derives sub_type from whether the chosen action equals the recommended action. `handleEscalate` calls `exceptionsApi.escalate()` directly (no longer piggybacking on override with `action: "ESCALATE"`).

**Execution-error rendering:** When `lifecycle_state === "FAILED"`, the panel renders an `executionError` branch ("Pipeline failed at <node>") with the trace explanation and timestamp. This is distinct from a RED shadow verdict (which is a compliance decision, not a runtime crash) and from the "Shadow has not yet completed" fallback (which previously rendered for every FAILED state and was misleading — the failure may be at any node, not just shadow). `AgentReasoningCard` consumes `executionError !== undefined` to drive the FAILED banner. (See `ui_architecture.md` §9 drift register entry on `executionError` rendering.)

**Action feedback:** All mutations show toast notifications (success/error) via `useToast()`. The workspace auto-refreshes after any action via `onActionComplete` callback (parent re-fetches the case + records).

**WebSocket wiring:** Page-level WS subscription lives on `/cases/page.tsx` post-ADR-041 (the deleted `/exceptions/page.tsx` previously owned it). `case_*` events trigger silent `useCases.refetch()`; `exception_update` + `task_complete` refresh the currently viewed exception via `onRefreshRef`. `pipeline_progress` updates the `WaterfallStepper` inside `DiagnosticsSection`.

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

### Cases (`/cases`) — Three-Pane Workspace (ADR-041 P3 / P3d-remaining / P3e, canonical queue + records + detail)

```
NavBar (shared; "Cases" tab is the canonical queue surface — ADR-041 P2 dropped "Exception Queue")
Page Content (max-width 1800px) — CSS grid:
  xl ≥1280px  xl:grid-cols-[320px_280px_minmax(0,1fr)]  (queue | record-list | detail)
  lg 1024-1279px  lg:grid-cols-[360px_minmax(0,1fr)]    (queue | detail; record-list collapses)
  <1024px  single column
├── Middle Pane (280px, xl only): RecordListPane — attached-records picker.
│   Below xl the picker re-emerges inline inside CaseDetailPanel (P3e — see below).
├── Left Pane (320-360px): Case Queue
│   ├── Header (title + count + filter chips per source)
│   ├── Filter chips iterating ALLOWED_CASE_SOURCES
│   │   (manual_order, automated_order)
│   ├── Status filter (client-side, applied on top of the cursor-walked list)
│   ├── role="listbox" / role="option" rows with
│   │   data-keyboard-nav-id for useKeyboardListNav drive
│   ├── SLA-driven sort (nearest sla_deadline first; useSlaTicker
│   │   re-evaluates every 60s without a refetch)
│   └── Pin-selection guard (ADR-041 P3d) — if `selectedCaseId` is
│       set and falls out of the filter (e.g., status flipped to
│       RESOLVED via WS-driven refetch), the row stays visible at
│       the top with a "Pinned" badge so the operator's cursor
│       isn't yanked.
└── Right Pane (flex, min-h 60vh): Case Workspace
    ├── Empty state: "Select a case from the queue to open its workspace."
    ├── Loading state: detailLoading guard
    └── Mounted (orderCase.case_id === selectedCaseId — render guard):
        CaseDetailPanel
        ├── Slim case-context strip (when a record is mounted — PR #154)
        │   OR full case header card (when no record selected)
        ├── Compliance hits section (policy hits aggregated by getRecords)
        ├── Attached records picker (role="radiogroup")
        └── Inline ExceptionDetailPanel for the selected record
            (HeaderRibbon → ContextStrip → AgentReasoningCard +
             enrichment sections → EvidenceGrid → DiagnosticsSection)
```

**URL state:** `?case=<caseId>&record=<recordId>` drives selection. Click handlers use `router.replace` with `{ scroll: false }` — selection is an in-place workspace update, not a page navigation; without the flag Next.js App Router scrolls the viewport to the top of the document on every URL write and the operator loses their place in a long, SLA-sorted queue. Back/forward + reload preserve cursor position. Switching cases drops the prior `?record=` so the auto-mount picks the new case's first record.

**Records picker (P3e):** `RecordListPane` renders both as the dedicated xl middle column (page.tsx, `hidden xl:block`) and as the below-xl inline fallback inside `CaseDetailPanel` (`xl:hidden` when `inlineRecordListHiddenAtXl` is set). Both instances stay in the DOM at every viewport — only one is `display`-visible per breakpoint — so tests selecting the picker by `aria-label` / `data-testid` must scope to `:visible`.

**Data flow:**
- Queue — `useCases(filters.source)` (cursor-walking hook with silent-refetch contract).
- WS silent refresh — `useWebSocket({ onEvent: isCaseInvalidationEvent → refetch, onReconnect: refetch, onPollFallback: refetch })`. Restores the silent live refresh that lived on the deleted `/exceptions/page.tsx`.
- Right pane — `Promise.all([casesApi.get(caseId), casesApi.getRecords(caseId)])`. State is cleared eagerly when `selectedCaseId` changes to prevent the case-switch race (`setOrderCase(null); setRecords([])` before the new fetch — ADR-041 P3c).

**Case-switch race fix:** Two layers of defense, both source-locked:
1. **State clear in the parent useEffect** — `setOrderCase(null) / setRecords([]) / setPolicyHits([])` at the top of the `[selectedCaseId]` effect, before `setDetailLoading(true)` + fetch.
2. **JSX render guard** — `CaseDetailPanel` only mounts when `orderCase.case_id === selectedCaseId`. So even if a render slips through with stale state, the panel can't auto-mount with mismatched data and write the wrong `?record=` back into the URL.

**Keyboard nav:** `useKeyboardListNav` mounted with the sorted row list + `selectedCaseId` + `handleSelectCase`. ArrowUp / ArrowDown / j / k / Home / End drive selection; selected row scrolls into view + receives DOM focus.

**A11y:** `role="listbox"` on the queue, `role="option"` on each row with `aria-selected`. `tabIndex={0}` on the listbox so `:focus-visible` tracks the keyboard cursor. The slim context strip uses `aria-label="Case context"`; the full header uses `aria-label="Case header"`.

**Architectural locks:**
* `tests/architectural/cases_workspace_render_guard.test.ts` — source-grep invariants: (1) the fetch useEffect clears `orderCase`/`records` BEFORE `casesApi.get`; (2) `CaseDetailPanel` only renders when `orderCase.case_id === selectedCaseId`; (3) the `cases` useMemo lists `selectedCaseId` in deps AND produces an `isPinned: true` row when the filter excludes the selection; (4) the two-pane workspace structure (queue + case-workspace + a two-column `lg` grid with NO dedicated 3rd column); (5) the records picker is mounted inline on the detail pane by `CaseDetailPanel`; (6) every `router.replace` carries `scroll: false`.
* `tests/architectural/case_pivot_mock_wiring.test.ts` — every mock case has `case_type ∈ {EMAIL_ENTRY, BLOCK}` + EMAIL_ENTRY carries `email_classification` (ADR-041 P1); every exception resolves to a case; at least one multi-record case exists and every sibling record is independently fetchable.
* `tests/architectural/mock_verdict_coverage.test.ts` — every conditional-gate verdict is exercised by a mock trace; the pipeline-timeline classify confidence + ingest order_id match the record's `OrderAnalysis.confidence` / `order_id` (no partial-truth drift between the timeline and the AgentReasoningCard).
* `tests/architectural/cases_no_per_intent_dispatch.test.ts` — `CaseDetailPanel` is a dumb projector (Guardrail #1 / Guardrail #6); sections mount via data-presence.
* `tests/browser/cases-workspace-case-switch.spec.ts` — operator-journey browser e2e: drives two queue clicks in sequence, asserts URL `?record=` always belongs to URL `?case=`.

**`/cases/[id]` (focused single-case view):** Survives for notification deep-links + bookmark contexts that prefer a clean case viewport without the queue chrome. Mounts the same `CaseDetailPanel`. Two surfaces, two intents: `/cases?case=<id>` is the workspace; `/cases/<id>` is focus.

**`slaSnapshot()`** band thresholds (<2h `at_risk`, 2–24h `today`, >24h `comfortable`) are exported from `src/app/cases/page.tsx` as a pure helper so other surfaces (home page, chrome banner) consume them.

### `/exceptions` — RETIRED (ADR-041 P4)

`next.config.mjs::redirects()` permanently redirects `/exceptions` and `/exceptions/:path*` → `/cases`. The route files (`page.tsx`, `error.tsx`, `loading.tsx`, `ExceptionListPane.tsx`, `CaseListPane.tsx`, `SavedViewsMenu.tsx`, `searchParser.ts`) were deleted. The directory survives only because the per-record enrichment sections + `ExceptionDetailPanel` live there; they're mounted inline by `CaseDetailPanel`. A future P5/P6 follow-on may move them under `src/app/cases/_components/`.

---

## 4. Type System

| UI Type | Backend Model | File |
|---|---|---|
| `Intent` | `Intent` enum (contracts/models.py) | exceptions.ts |
| `ShadowVerdict` | `ShadowStatus` enum | exceptions.ts |
| `TerminalStatus` | `TerminalStatus` enum — 7 values; `AUDIT_CONTEXT_MISSING` is the registry-enforced audit-gap status emitted by `api/analysis_composer.py` | exceptions.ts |
| `CaseSource` / `CaseStatus` / `CaseTier` | Mirrors of `OrderCase` Literals (asoe2 `contracts/models.py`) — case-level vocabulary (`manual_order` / `automated_order`, T1/T2/T3) | cases.ts |
| `OrderCase` | `OrderCase` Pydantic model (asoe2 `contracts/models.py`) — case_id, source, source_channel, **case_type (EMAIL_ENTRY \| BLOCK — ADR-041 P1)**, **email_classification? (NEW_ORDER \| ORDER_CHANGE \| INQUIRY \| COMPLAINT \| OTHER — required when EMAIL_ENTRY, null when BLOCK)**, sla_deadline, tier, bundle_version_at_open, status, customer_po_number, sales_order_id, edi_transaction_id, source_email_id | cases.ts |
| `CaseType` | `Literal["EMAIL_ENTRY", "BLOCK"]` — orthogonal to `CaseSource` per the ADR-041 modeller's pushback. `source` answers "how did the order originate?"; `case_type` answers "why did ASOE materialise this case?". | cases.ts |
| `EmailClassification` | `Literal["NEW_ORDER", "ORDER_CHANGE", "INQUIRY", "COMPLAINT", "OTHER"]` — per-intake classification for EMAIL_ENTRY cases (1:1 with the email). | cases.ts |
| `CaseEvent` | Per-case event log entry (timestamp, event_type, actor, payload) | cases.ts |
| `SlaSnapshot` / `SlaBand` | UI-only SLA computation (band thresholds <2h `at_risk`, 2–24h `today`, >24h `comfortable`) — derived from `OrderCase.sla_deadline` via `slaSnapshot()` exported from `src/app/cases/page.tsx` | cases.ts |
| `LifecycleState` | `LIFECYCLE_STATES` list — `EXECUTING` removed, `PENDING_COSIGN` added (Phase 2 #5 four-eyes staging state) | exceptions.ts |
| `PipelineNode` | 11 node names from orchestration/nodes.py (incl. build_analysis) | exceptions.ts |
| `OrderEvent` | `OrderEvent` model | exceptions.ts |
| `ComplianceDecision` | `ComplianceDecision` model | exceptions.ts |
| `ExceptionSummary` | `ExceptionSummary` schema (+ `account_id`, `account_name`, `parent_case_id?`, **`sap_block_code?` — raw SAP block reason code on BLOCK-parented records, ADR-041 P1**) | exceptions.ts |
| `ExceptionDetail` | `ExceptionDetailResponse` schema | exceptions.ts |
| `TraceRecord` | `TraceResponse` schema | exceptions.ts |
| `HealthResponse` | Health endpoint response — extended with `allowed_resolution_actions`, `allowed_override_reason_tags`, and `allowed_override_reason_tags_by_intent` | exceptions.ts |
| `DispositionRequest` | `DispositionRequest` (schemas.py) — `{ action, notes, reason_tag }`; single unified disposition DTO (replaces OverrideRequest / ApproveRequest / RejectRequest, all deleted in Phase 3) | contracts.ts (re-exported via api.ts) |
| `EscalateRequest` | `EscalateRequest` (schemas.py) — `{ reason, to_role? }` | contracts.ts |
| `CosignRequest` | `CosignRequest` (schemas.py) — `{ approve, notes }`; notes mandatory (SOX) | contracts.ts |
| `ReanalyzeRequest` | `ReanalyzeRequest` (schemas.py) — `{ reason }` (mandatory) | contracts.ts |
| `ChallengeRequest` | `ChallengeRequest` (schemas.py) | contracts.ts |
| `RequestOptions` | Per-call options for mutating requests — `{ idempotencyKey? }`. When omitted the client generates a UUID v4 per call. | api.ts |
| `ResolveRequest` | `ResolveRequest` schema | api.ts |
| `ResolveResponse` | `ResolveResponse` schema | api.ts |
| `StatsResponse` | Stats endpoint response | api.ts |
| `WSEvent` | `WSEvent` model (api/events.py) | websocket.ts |
| `PipelineProgressPayload` | Pipeline progress data | websocket.ts |
| `AuthUser` | `UserProfile` schema (+ `title`, `avatar_initials`, `assigned_accounts`, `visible_tabs`) | auth.ts |
| `LoginResponse` | `AuthTokenResponse` schema | auth.ts |
| `Role` | Role strings from api/deps.py | auth.ts |
| `UserListResponse` | List of available users for sandbox switching | auth.ts |

**UI display types** (not backend contract mirrors — see CLAUDE.md):

| UI Type | Purpose | File |
|---|---|---|
| `LineItem` | Order line-item grid display | exceptions.ts |
| `PricingConditionType` | Pricing condition type enum (BASE/CONTRACT/TPR/UOM/RESULT/ERROR) | exceptions.ts |
| `PricingWaterfallStep` | Single step in pricing waterfall visualization | exceptions.ts |
| `LineItemAnalysis` | Per-line agent analysis with waterfall | exceptions.ts |
| `OrderAnalysis` | Order-level agent analysis (drives detail panel). `root_cause?`, `recommendation?`, `entity_profile?`, `impact_metrics?` are **optional** as of Phase 8.13 — backend `api/profile_composer.py` returns `None` when the backing data is absent so the UI can structurally omit the surface (Verdict 2026-04-22 partial-truth guard). Plus `duplicate_detection?`, `order_comparison?`, `price_analysis?`, `backorder_analysis?`, `overmax_analysis?`, `moq_analysis?`, `pallet_analysis?`, `delivery_delay_analysis?`, `price_hold_analysis?`, `edi_mismatch_analysis?` enrichment fields. | exceptions.ts |
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

Maps to Section 6.2 REST endpoints. ADR-041 P5 extracted bulk mock fixtures into `src/lib/mock-data/` (`order-analyses.ts`, `exceptions.ts`, `cases.ts`, `line-items.ts`); `api.ts` shrunk from 3894 to 2146 lines and now contains only the handler surface + mutable session state (`MOCK_PENDING_OVERRIDES`, `MOCK_REANALYSIS_HISTORY`, `MOCK_IDEMPOTENCY`, etc.) that handlers mutate.

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
| `exceptionsApi.disposition()` | `PATCH /api/v1/exceptions/{id}/disposition` | 6.2 (Phase 3 consolidation — replaces override/approve/reject) |
| `exceptionsApi.escalate()` | `POST /api/v1/exceptions/{id}/escalate` | 6.2 |
| `exceptionsApi.cosign()` | `POST /api/v1/exceptions/{id}/cosign` | 6.2 (four-eyes second-reviewer) |
| `exceptionsApi.reanalyze()` | `POST /api/v1/exceptions/{id}/reanalyze` | 6.2 (live `if (USE_REAL_API)` branch — was silently mock-only pre-2026-05-01; architectural lock test in `tests/architectural/exceptions_api_live_branches.test.ts` walks every `LIVE_METHODS` entry and asserts the gate exists) |
| `exceptionsApi.trace()` | `GET /api/v1/exceptions/{id}/trace` | 6.2 |
| `exceptionsApi.stats()` | `GET /api/v1/exceptions/stats` | 6.2 |
| `exceptionsApi.lineItems()` | Line items for an exception (UI mock) | — |
| `exceptionsApi.orderAnalysis()` | Order-level agent analysis (UI mock) | — |
| `casesApi.list()` | `GET /api/v1/cases` — case-centric list view (ADR-038 Phase H.6) | — (mock-mode only — backend route pending; see asoe2 tasks.md Phase 27.6) |
| `casesApi.get()` | `GET /api/v1/cases/{case_id}` — case detail (ADR-038 Phase H.6) | — (mock-mode only — backend route pending) |

**User management endpoints:** `usersApi.list()` returns 6 seed users for sandbox switching. `usersApi.switch(email)` triggers a `signIn("credentials")` round-trip to re-derive JWT with the target user's RBAC, `visible_tabs`, and `assigned_accounts`. `computeVisibleTabs()` derives tab visibility from the user's RBAC permissions.

**Mock strategy:** All endpoints return mock data with simulated latency. To connect to real FastAPI, replace the mock implementations with `fetch()` calls to `NEXT_PUBLIC_API_URL`. The interface (function signatures and return types) stays the same.

**Idempotency-Key handling:** Every mutating client method (`disposition`, `escalate`, `cosign`, `reanalyze`, `resolve`, `resolveAsync`) accepts an optional `RequestOptions` second argument with `idempotencyKey?: string`. When omitted, the client generates a UUID v4 per invocation via `generateIdempotencyKey()` and sends it as the `Idempotency-Key` header. The mock implementation maintains a per-endpoint cache keyed by `(endpoint, key)` so replayed calls return the cached response and key-with-different-body raises a conflict — mirroring backend behavior.

**Contract-driven DTOs (Phase 2 #9):** `DispositionRequest`, `EscalateRequest`, `CosignRequest`, `ReanalyzeRequest`, and `ChallengeRequest` are aliased from `src/types/generated.ts`, which is produced by `npm run generate-types` from the committed `asoe2/openapi/asoe2.openapi.json`. Hand-editing these shapes is not permitted — change the Pydantic model in `asoe2/api/schemas.py`, re-export OpenAPI, regenerate. `tests/architectural/openapi_drift.test.ts` fails CI on drift.

**Four-eyes mock:** `MOCK_FINANCIAL_IMPACT_USD` seeds `exc-001` ($25K) and `exc-010` ($42.5K) above the cosign threshold so the mock `disposition` call stages a `MOCK_PENDING_OVERRIDES` entry, transitions the record to `PENDING_COSIGN`, and lets `exceptionsApi.cosign()` exercise the full four-eyes roundtrip in local demo mode. Matches backend semantics exactly.

**Mock users:** 6 seed users — jane@acme.com (admin), marcus.webb@acme-corp.com (admin), sarah.chen (manager), sarah.chen.sr (analyst), james.ortiz (analyst, scoped to acct-walmart/acct-kroger), priya.nair (analyst, scoped to acct-target/acct-costco). Each user has `title`, `avatar_initials`, `assigned_accounts`, and RBAC-derived `visible_tabs`.

**Mock exceptions:** 21 exceptions (exc-001 through exc-021) with `account_id` and `account_name` fields, covering all supported intents: CONTRACTUAL_CORRECTION, CREDIT_BLOCK, MASS_PRICING_ERROR, DUPLICATE_PO, BACK_ORDER (exc-010, exc-011), OVER_MAX (exc-012), MIN_ORDER_QTY (exc-013), PALLET_CONFIG (exc-014), DELIVERY_DELAY (exc-016), PRICE_HOLD_RELEASE (exc-017 GREEN auto-release, exc-018 YELLOW escalate), EDI_MISMATCH (exc-019 RED SKU hard-reject, exc-020 YELLOW QTY review), and the PRICE_MISMATCH routing-fork demonstrator (exc-021 — `event_type=EDI_850_LINE_MISMATCH` + `metadata.mismatch_sub_type=PRICE_MISMATCH` lands as `CONTRACTUAL_CORRECTION` and renders `PriceAnalysisSection`, NOT `EdiMismatchSection`). Each includes intent-specific `OrderAnalysis` data with the corresponding enrichment fields populated (e.g., `backorder_analysis` for BACK_ORDER, `pallet_analysis` for PALLET_CONFIG, `price_hold_analysis` for PRICE_HOLD_RELEASE, `edi_mismatch_analysis` for EDI_MISMATCH, `price_analysis` for the PRICE_MISMATCH routing-fork case).

**Health endpoint recipes:** `allowed_recipes` includes 10 recipes: `PriceAdjustmentRecipe.py`, `CreditHoldReleaseRecipe.py`, `DuplicatePORecipe.py`, `BackOrderResolutionRecipe.py`, `OverMaxTrimRecipe.py`, `MOQRoundUpRecipe.py`, `PalletAlignmentRecipe.py`, `DeliveryDelayResolutionRecipe.py`, `PriceHoldReleaseRecipe.py`, `EdiMismatchRecipe.py`. `allowed_intents` includes 11 intents: the original 4 plus `BACK_ORDER`, `OVER_MAX`, `MIN_ORDER_QTY`, `PALLET_CONFIG`, `DELIVERY_DELAY`, `PRICE_HOLD_RELEASE`, `EDI_MISMATCH`.

**UI-only endpoints:** `lineItems()` and `orderAnalysis()` serve mock data for the enriched line-item grids, pricing waterfall, and type-specific enrichment sections. When `asoe2` adds corresponding endpoints, these will be wired to real `fetch()` calls.

---

## 6. Auth & RBAC

**NextAuth config** (`src/lib/auth.ts`):
- Credentials provider (email/password → `authApi.login()`)
- JWT session strategy, 7-day expiry
- JWT callbacks enrich token with `roles`, `org`, `permissions`, `accessToken`, `title`, `avatar_initials`, `assigned_accounts`, `visible_tabs`
- Session callbacks expose typed user with RBAC fields + `visibleTabs`, `assignedAccounts`

**RBAC** (`src/lib/roles.ts`): Aligned with `asoe2/api/deps.py::_ROLE_PERMISSIONS`:

| Role | Permissions |
|---|---|
| `analyst` | `exceptions:read`, `exceptions:approve`, `exceptions:escalate`, `dashboard:read` |
| `manager` | analyst + `exceptions:override`, `rules:write` |
| `admin` | manager + `users:manage`, `policy:write`, `audit:read` |
| `viewer` | `exceptions:read`, `dashboard:read` |
| `partner` | `exceptions:read` (scoped to own orders) |

**Permission-to-button mapping (Option A):**

| Permission | Button | Visible on |
|---|---|---|
| `exceptions:approve` | Approve / Reject | YELLOW only |
| `exceptions:override` | Override… (opens chooser) / cosign Approve/Reject | GREEN / YELLOW / RED; cosign banner on PENDING_COSIGN |
| `exceptions:escalate` | Escalate / Escalate for Triage | YELLOW / RED / FAILED |

**Middleware** (`src/middleware.ts`): Protects all routes except `/login`, `/auth/callback`, `/api/auth`. Redirects unauthenticated users to `/login`.

---

## 7. Real-Time Protocol (`src/hooks/useWebSocket.ts`)

Implements Section 8:
1. Connect to `ws://host/api/v1/ws`
2. Send auth message: `{ type: "auth", token, last_seen }` — uses the real backend access token from session storage (was `'mock-ws-token'` placeholder pre-2026-05-01)
3. Receive `WSEvent` messages (`pipeline_progress`, `exception_update`, `task_complete`, `error`)
4. Reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
5. Send `last_seen_timestamp` on reconnect for event replay (60-second buffer)
6. **Polling fallback (§8.4):** after `POLL_FALLBACK_THRESHOLD = 5` consecutive failed reconnect attempts, the hook switches to interval polling on `/api/v1/exceptions/{id}` and emits the `onPollFallback` callback so consumers can switch their refresh strategy. `onReconnect` fires when the WS comes back. Container Apps closes idle WS at 4 minutes; this prevents stale detail panels during long YELLOW reviews.

**Exception Queue wiring:** The page orchestrator (`/exceptions/page.tsx`) subscribes to WebSocket events and routes them to the detail panel via `onRefreshRef`. `pipeline_progress` events for the currently viewed exception update the WaterfallStepper in real-time. `exception_update` and `task_complete` events refresh both the exception list and the detail panel. On reconnect or polling fallback, the panel issues a silent refresh (no flicker).

---

## 8. Health-Driven Enums (`src/hooks/useHealth.ts`)

Per Guardrail #2, the `useHealth` hook fetches `GET /api/v1/health` which returns:
- `allowed_intents[]` — drives intent filter dropdown
- `lifecycle_states[]` — drives state filter dropdown
- `allowed_recipes[]` — available for display
- `kill_switch`, `explain_mode` — platform status

Used in: Exception Queue filters, Dashboard platform health card.

---

## 8.1 ERP-vendor display labels (`src/config/erp-label-map.ts` + `src/hooks/useErpProfile.ts`)

Backend intent codes (`CONTRACTUAL_CORRECTION`, `PRICE_HOLD_RELEASE`, etc.)
are ASOE-internal canonical names — they remain the single source of truth
for control flow (Guardrail #1). Different ERPs describe the same operational
exception with different terminology, though: SAP says "Pricing Block
Release", Oracle says "Price Hold Release", Salesforce says "Order Hold
Release". This config layer maps canonical codes to vendor-specific
display strings without forking the backend vocabulary.

**`src/config/erp-label-map.ts`** — pure data + two resolvers:
- `ErpVendor` type union: `SAP | ORACLE | SALESFORCE | GENERIC`.
- `ERP_LABEL_MAPS` — per-vendor `{ intents, sub_types }` table. Every
  vendor map has an entry for every canonical intent + EDI sub_type;
  GENERIC is the always-populated fallback.
- `intentLabelFor(intent, vendor)` and `subTypeLabelFor(subType, vendor)`
  — two-tier fallback (vendor → GENERIC → title-cased code) so the UI
  never renders a raw machine string.

**`src/hooks/useErpProfile.ts`** — module-memoised parse of
`process.env.NEXT_PUBLIC_ASOE_ERP_VENDOR`. Exposes `useErpProfile()`,
`useIntentLabel(intent)`, `useSubTypeLabel(subType)`.

**Default vendor:** committed to `next.config.mjs` as `SAP` so production
deployments and previews render SAP-native vocabulary out of the box.
Override per environment via Vercel Project Settings → Environment
Variables, or via `.env.local` for local dev.

**Wired display sites (4):**
- `src/app/dashboard/page.tsx` — `by_intent` stats list label.
- `src/app/exceptions/ExceptionListPane.tsx` — intent filter dropdown
  options + intent badge on each exception row.
- `src/components/ui/AgentReasoningCard.tsx` — Intent key-data label on
  the Layer-1 reasoning card.

This config is **display-only**. No control flow branches on the active
vendor; intent codes still flow through `useHealth().allowed_intents`
unchanged, and audit trails / trace logs never see the labels.

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
