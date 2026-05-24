# Customer Inbox — Frontend Implementation Plan (asoe-ui)

**Status:** Proposed (2026-05-23)
**Pairs with:** `asoe2` ADR-042 — *Porting the AgenticOM "Customer
Inbox" Prototype into the Case Architecture*.
**Builds on:** `docs/prototype_gap_analysis.md` §4 (Customer Inbox
Gaps) and §9 (Priority Matrix).
**Supersedes (framing only):** the "enhance `/inbox`" recommendation
in `prototype_gap_analysis.md` §9 — see §1 below.

---

## 1. Reconciliation with ADR-041

`prototype_gap_analysis.md` was written before **ADR-041**, so it
still says "Enhance `/inbox`". That is no longer correct:

* `/inbox` is a permanent server redirect to
  `/cases?source=manual_order` (`src/app/inbox/page.tsx`).
* `/cases` is the single canonical workspace; `/exceptions` is
  retired.
* The domain model already carries `case_type ∈ {EMAIL_ENTRY,
  BLOCK}` and `email_classification ∈ {NEW_ORDER, ORDER_CHANGE,
  INQUIRY, COMPLAINT, OTHER}` (`src/types/cases.ts`).

**Therefore the Customer Inbox is implemented as an `EMAIL_ENTRY`
lens on `/cases`, not as a revived route.** Every prototype detail
tab becomes a colocated `/cases` detail section. This plan is the
frontend half of ADR-042; the backend contracts it consumes are
defined there.

## 2. Guardrails this plan must honour

From `CLAUDE.md`:
* **#1** No hardcoded enum values in `.tsx` — intent / status /
  autonomy / action vocab come from `useHealth` and the mapping
  helpers already in `src/lib/cases.ts` (`actionLabel`,
  `autonomyLevelLabel`, `sourceChannelLabel`, `STATUS_LABEL`).
* **#2** Design tokens only (`src/styles/design-tokens.css`); light + dark.
* **#3** Types mirror backend; regenerate via `npm run
  generate-types`; `verify-types` gates CI. Never hand-edit
  `src/types/generated.ts`.
* **#6** Sections are **dumb projectors** — render `analysis.*` via
  `<EvidenceBlock>` (Present / Structurally-omitted / Context-not-
  required). No `?? "—"` fallbacks, no client-side blending of
  recipe + event + gateway data.
* **#7** Keep `*AnalysisData` types rich; never prune to current
  recipe output.
* **Two-layer cognition (#5):** every section leads with
  `AgentReasoningCard` (Layer 1 recommendation + confidence),
  evidence in Layer 2.

## 3. Surface design

Reuse the existing **two-pane** `/cases` workspace
(`src/app/cases/page.tsx`, `CaseDetailPanel.tsx`). After `662c9d2`
the layout is queue + detail (`lg:grid-cols-[360px_minmax(0,1fr)]`,
single column below); the dedicated `RecordListPane` 3rd column was
removed and the record picker (`RecordListPane`, still used) is now
rendered **inline at the top of the detail pane** by
`CaseDetailPanel`. F6 cycles queue ↔ detail; the record list is
reached by Tab within the detail region.

1. **Inbox lens:** add an "EMAIL_ENTRY / Customer Inbox" filter chip
   to the `/cases` queue, calling `casesApi.list({ case_type:
   "EMAIL_ENTRY" })` once the backend filter (ADR-042 §2.2) lands.
   No new route; `/inbox` stays a redirect.
2. **Mount point (panel correction):** the new sections attach
   **inside `ExceptionDetailPanel`'s data-presence section list**
   (alongside `PriceHoldSection` / `EdiMismatchSection` /
   `DiagnosticsSection`) for the selected record — NOT on the
   `CaseDetailPanel` header (`CaseDetailPanel` only *mounts*
   `ExceptionDetailPanel` per record). Sections are shown by data
   presence (not a type `switch`) and are **lazy-loaded** (each is a
   heavy chunk; follow the `PipelineDAG` ~12KB lazy ceiling).

## 4. New components (colocated under `src/app/cases/`)

| Component | Renders | Backend source (ADR-042) | Gap-analysis ref |
|---|---|---|---|
| `EntitiesSection.tsx` | extracted entities | `analysis.entities` (composer field) | §4.3 |
| `SapDataSection.tsx` | SAP master/order lookup | `analysis.sap_data` (composer field) | §4.3 |
| `OrderEntrySection.tsx` | extract → editable form → validate → submit-to-ERP. 4-state machine (idle/extracting/done/error) owned by a new **`useOrderExtraction`** hook (mirror `useExceptionActions`). **Submit + corrections go through the existing `/exceptions/{id}/disposition` (+ cosign) action surface — NOT a new `/cases` write verb** (fidelity correction; cases is read-only by design). **Do not** recompute pallet/validation client-side (Guardrail #6) — backend supplies validated values. | `analysis.order_entry` + `useExceptionActions` disposition | §4.6 |
| `Edi850Section.tsx` | Decoded / Raw X12 / Segment-map (read-only); fine as one component | `analysis.edi_850` composer field (dedicated `GET` only on an ADR-031 trigger) | §4.5 |
| `ChangeAnalysis*` (**split**, panel correction) | one section is a section-of-sections — split into `LifecycleBar`, `ChangeItemsGrid`, `ConstraintList` (**variable N**, not fixed 10), `ScenarioList` (**variable M**, not fixed 3), `ChangeDecisionPanel`. Drop agent timings (cosmetic, not audit-bearing). | `analysis.change_analysis` composer field | §4.4 |
| `ConstraintGraphSection.tsx` | layered DAG (REQUEST→ITEMS→CONSTRAINTS→SOURCES→DECISION) — reuse the existing `PipelineDAG` dagre→SVG scaffold | reuse `/exceptions/{id}/trace` + topology (no new surface) | §6.6 |
| `KnowledgeGraphSection.tsx` | entity-relationship web (Sender/Email/SO/SKU/BP) — **NOT dagre** (layered layout is wrong for a cyclic entity graph); use force/radial or hand-positioned **SVG** (matching the prototype), design tokens, never canvas. **Deferrable** (no backend source exists — `knowledge/` is the skill/policy KB, not a graph producer; needs a net-new derived projection). | net-new derived projection (deferred) | §6.5 |
| `DraftReplyPanel.tsx` | AI draft → edit → approve & send. **Send is a disposition action** (`/exceptions/{id}/disposition` + cosign), not a new reply endpoint. | `analysis.draft_reply` + `useExceptionActions` disposition | §4.3 |
| `IntakePipelineView.tsx` | 6-step intake flow | `GET /api/v1/pipeline/topology` + WS steps (`WaterfallStepper`) | §4.7 |
| `SimulateInboundModal.tsx` | inject test scenarios (sandbox only) | `POST /sandbox/simulate-inbound` | §4.8 |

Shared primitives still owed from gap-analysis §9.1 Phase A
(`AutonomyBadge`, `FilterChip`, `ContextRow`, `ProgressBar`,
`DataTable`) are prerequisites and built first where missing.

## 5. Data & types

* `src/lib/api.ts` (single client): **reads** come from the unified
  `OrderAnalysis` composer payload by default (a dedicated
  per-section `GET` is added only when an ADR-031 trigger fires);
  **writes** (order-entry submit, corrections, reply send) go
  through the existing `casesApi` / `useExceptionActions`
  **disposition + cosign** methods — do NOT add bespoke `/cases`
  write-verb clients (fidelity correction). Never `fetch()` in
  pages/sections. Mirror the mock layer in `src/lib/mock-data/*` and
  add the matching architectural lock
  (`tests/architectural/case_pivot_mock_wiring.test.ts` style) for
  any backend `model_validator`.
* `src/types/*`: regenerate from `asoe2/openapi/asoe2.openapi.json`.
  Keep `*AnalysisData` rich (Guardrail #7). **Phase 0 fix:** reconcile
  the hand-written `src/types/exceptions.ts` autonomy union
  (`"L1"|"L2"|"L3"`) against `src/types/generated.ts` (`"L1"…"L4"`) —
  the new L4 surfaces will trip this drift.
* Real-time (panel correction): new pipeline-step and draft/sent
  event types must be added to the existing
  `isCaseInvalidationEvent` predicate so they flow through the
  `refetch()` / `refreshCaseDetail` seam in
  `src/app/cases/page.tsx` — do **not** invent local optimistic
  state for submit / draft-send; reuse the overwrite-in-place
  `refreshCaseDetail` path. Drive `WaterfallStepper` +
  `ActivityIndicator` from those events.

## 6. Phasing (mirrors ADR-042 §3)

**MLS = Phases 0–3.** Draft Reply pulled ahead of the graphs.

| Phase | asoe-ui deliverable |
|---|---|
| 0 | type-gen from new OpenAPI; reconcile L3-vs-L4 type drift; `health.allowed_autonomy_levels` wiring; `case_type=EMAIL_ENTRY` filter; shared primitives |
| 1 | Inbox lens (filter chip + master-detail) |
| 2 | `EntitiesSection`, `SapDataSection`, AI-analysis enrichment via `AgentReasoningCard` |
| 3 | `OrderEntrySection` + `useOrderExtraction` (4 states; correction tracking) — **MLS completes** |
| 4 | `DraftReplyPanel` + `IntakePipelineView` + `SimulateInboundModal` |
| 5 | `Edi850Section` (3 sub-views) |
| 6 | split `ChangeAnalysis*` (variable cardinality) |
| 7 | `ConstraintGraphSection` (dagre) + `KnowledgeGraphSection` (radial/SVG) — deferrable |
| 8 | hardening: axe, contract snapshots, docs |

## 7. Test gates (per `CLAUDE.md` Definition of Done)

* **Architectural locks** for each new pane/section — source-grep
  (Pattern A) + behavioural completeness e2e (Pattern B); reference
  `tests/architectural/cases_workspace_render_guard.test.ts`.
* **Operator-journey browser e2e** (`tests/browser/`): open
  EMAIL_ENTRY case → run extraction → edit a field → approve & send
  draft → assert status flip; reference
  `tests/browser/cases-workspace-case-switch.spec.ts`.
* **Mock-data locks** mirroring **each** backend `model_validator`
  — every new endpoint adds a `MOCK_*` fixture in
  `src/lib/mock-data/*`, so each needs the matching lock.
* **Accessibility:** the EMAIL_ENTRY lens is filter state, **not a
  new route** — it gets browser-e2e coverage rather than a
  `e2e/contract/authenticated-routes.ts` entry. New top-level
  components under `src/components/ui/` go in
  `tests/accessibility/component_sweep.test.tsx`.
* **Contract snapshots:** `verify-types` is the load-bearing one
  (regenerate from OpenAPI); `verify:reason-tags` only matters if
  reason-tag vocab changes; `verify:ui-routes` for any route change.
* **Bug-fix PRs** include a regression test that **fails on the
  parent commit** — run the `git stash` / `git checkout HEAD~1`
  verification ritual (CLAUDE.md) and paste both results into the PR.

## 8. Autonomy L1–L4 ordering (Product directive)

Product has decided to **adopt the prototype's L1–L4 ordering**
(L1 = most autonomous → L4 = human). Today
`src/lib/cases.ts::AUTONOMY_LEVEL_DESCRIPTIONS` hardcodes the
*opposite* (L1 "Block automatically" … L4 "Fully automated"), which
matches the backend's current `contracts/policy.py`.

**This is a backend/policy decision, not a UI override** (CLAUDE.md:
"the UI displays what the backend decides"). The frontend must NOT
flip the ordering with a hardcoded map — that would entrench a
Guardrail #1 violation. Instead:

1. The backend serves an ordered, self-describing list in the health
   payload: `allowed_autonomy_levels: { level, label, rank }[]`
   (added in ADR-042 Phase 0, under `autonomy_vocab_version` v2).
2. `useHealth()` (already consumed in `src/app/cases/page.tsx`)
   exposes it. `autonomyLevelLabel(level, health)` becomes a lookup
   (mirroring `pickQuickActionReasonTag(intent, health)` in
   `cases.ts`, which already takes `health` and returns `null` when
   absent). `AUTONOMY_LEVEL_DESCRIPTIONS` shrinks to a transition
   fallback, like `STATUS_LABEL`.
3. Any UI that **orders** autonomy (matrix, sort, stepper) sorts by
   `rank` — never by parsing the `Ln` string.

Net: Product's preferred ordering is implemented once, server-side,
and every surface follows automatically. See ADR-042 §5 for the
audit-safety controls (versioned vocab, no historical mutation,
compliance sign-off).

## 9. Other open decisions

* `invoice_query` has no `email_classification` target (ADR-042 §5b)
  — backend decision; UI just renders whatever `useHealth` lists.
* Constraint Graph + Knowledge Graph are evidence-richness and
  partly duplicate the existing pipeline trace/topology — deferrable
  (ADR-042 §3 re-prioritisation).
* Demo niceties (open-in-new-tab, right-click menu, copy-sender):
  proposed drop/defer.
* Out of scope here: Quota, Performance, Admin, CSR Chat
  (gap-analysis §5/§6).

## 10. Panel review (2026-05-23)

Folded in from the four-lens review (Architect / Compliance /
Frontend / Domain):
* Sections mount inside `ExceptionDetailPanel` (lazy), not the case
  header (§3).
* `ChangeAnalysis*` split; render variable-cardinality constraints /
  scenarios; agent timings dropped (§4).
* Knowledge graph uses radial/SVG, not dagre; constraint graph
  reuses the `PipelineDAG` dagre scaffold (§4).
* `useOrderExtraction` hook for the 4-state machine; no client-side
  pallet recompute (Guardrail #6); reuse the `refreshCaseDetail` /
  `isCaseInvalidationEvent` seam for WS + writes (§4, §5).
* Autonomy ordering resolved server-side via
  `health.allowed_autonomy_levels` (rank) — Product's prototype
  ordering honoured without a hardcoded UI map (§8).
* Phase 0 resolves the L3-vs-L4 type drift; MLS = Phases 0–3; Draft
  Reply pulled ahead of graphs (§6).

## 11. Architecture-fidelity audit (2026-05-23)

Caught the plan drifting from current architecture; corrected above:
* **Two-pane:** `662c9d2` collapsed the 3-column layout to two panes
  (record picker inline in the detail pane). §3 updated;
  `RecordListPane` is the inline picker, not a 3rd column.
* **Writes via disposition:** order-entry submit, corrections, and
  reply send route through the existing `/exceptions/{id}/disposition`
  (+ cosign) action surface, not bespoke `/cases` write verbs
  (cases is read-only by design). §4, §5.
* **Reads composer-first:** sections render `analysis.*` composer
  fields; a per-section `GET` is added only on an ADR-031 trigger.
  §4, §5.
* **Knowledge Graph has no backend source** (`knowledge/` is the
  skill/policy KB, not a graph producer) → net-new derived
  projection, deferred. §4, §9.

---

*Paired with asoe2 ADR-042. Generated 2026-05-23 from the AgenticOM
prototype Customer Inbox analysis; revised after the 2026-05-23
expert panel review.*
