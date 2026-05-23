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

Reuse the existing two-/three-pane `/cases` workspace
(`src/app/cases/page.tsx`, `CaseDetailPanel.tsx`, `RecordListPane.tsx`).

1. **Inbox lens:** add an "EMAIL_ENTRY / Customer Inbox" filter chip
   to the `/cases` queue, calling `casesApi.list({ case_type:
   "EMAIL_ENTRY" })` once the backend filter (ADR-042 §2.2) lands.
   No new route; `/inbox` stays a redirect.
2. **Detail tabs:** the prototype's nine tabs map onto
   `CaseDetailPanel` sections, shown by data presence (not type
   `switch`), consistent with the existing data-presence pattern.

## 4. New components (colocated under `src/app/cases/`)

| Component | Renders | Backend source (ADR-042) | Gap-analysis ref |
|---|---|---|---|
| `EntitiesSection.tsx` | extracted entities | `analysis.entities` | §4.3 |
| `SapDataSection.tsx` | SAP master/order lookup | `analysis.sap_data` | §4.3 |
| `OrderEntrySection.tsx` | extract → editable form → validate → submit-to-ERP | `OrderEntryExtraction` + `PATCH/submit` endpoints | §4.6 |
| `Edi850Section.tsx` | Decoded / Raw X12 / Segment-map (read-only) | `GET /cases/{id}/edi-850` | §4.5 |
| `ChangeAnalysisSection.tsx` | lifecycle bar, change-items, 10 constraint cards, agent timings, 3 scenarios, decision panel | `ConstraintEvaluation` + `ChangeDecision` | §4.4 |
| `ConstraintGraphSection.tsx` | dependency graph (use `dagre`, already a dep) | topology + per-case projection | §6.6 |
| `KnowledgeGraphSection.tsx` | entity-relationship graph (`dagre`) | `KnowledgeGraphPayload` | §6.5 |
| `DraftReplyPanel.tsx` | AI draft → edit → approve & send | `DraftReply` + reply endpoints, via existing disposition/cosign flow | §4.3 |
| `IntakePipelineView.tsx` | 6-step intake flow | `GET /api/v1/pipeline/topology` + WS steps (`WaterfallStepper`) | §4.7 |
| `SimulateInboundModal.tsx` | inject test scenarios (sandbox only) | `POST /sandbox/simulate-inbound` | §4.8 |

Shared primitives still owed from gap-analysis §9.1 Phase A
(`AutonomyBadge`, `FilterChip`, `ContextRow`, `ProgressBar`,
`DataTable`) are prerequisites and built first where missing.

## 5. Data & types

* `src/lib/api.ts` (single client): add typed methods for every new
  endpoint — never `fetch()` in pages/sections. Mirror the mock
  layer in `src/lib/mock-data/*` and add the matching architectural
  lock (`tests/architectural/case_pivot_mock_wiring.test.ts` style)
  for any backend `model_validator`.
* `src/types/*`: regenerate from `asoe2/openapi/asoe2.openapi.json`.
  Keep `*AnalysisData` rich (Guardrail #7).
* Real-time: extend `useWebSocket` consumption for pipeline-step and
  draft/sent events; drive `WaterfallStepper` + `ActivityIndicator`.

## 6. Phasing (mirrors ADR-042 §3)

| Phase | asoe-ui deliverable |
|---|---|
| 0 | type-gen from new OpenAPI; `case_type=EMAIL_ENTRY` filter wiring; shared primitives |
| 1 | Inbox lens (filter chip + master-detail) |
| 2 | `EntitiesSection`, `SapDataSection`, AI-analysis enrichment via `AgentReasoningCard` |
| 3 | `OrderEntrySection` (4 states: idle/extracting/done/error; correction tracking) |
| 4 | `Edi850Section` (3 sub-views) |
| 5 | `ChangeAnalysisSection` + `ConstraintGraphSection` |
| 6 | `KnowledgeGraphSection` |
| 7 | `DraftReplyPanel` + `IntakePipelineView` + `SimulateInboundModal` |
| 8 | hardening: axe, contract snapshots, docs |

## 7. Test gates (per `CLAUDE.md` Definition of Done)

* **Architectural locks** for each new pane/section — source-grep
  (Pattern A) + behavioural completeness e2e (Pattern B); reference
  `tests/architectural/cases_workspace_render_guard.test.ts`.
* **Operator-journey browser e2e** (`tests/browser/`): open
  EMAIL_ENTRY case → run extraction → edit a field → approve & send
  draft → assert status flip; reference
  `tests/browser/cases-workspace-case-switch.spec.ts`.
* **Mock-data locks** mirroring any new backend validator.
* **Accessibility:** new route/lens added to
  `e2e/contract/authenticated-routes.ts`; new top-level components
  added to `tests/accessibility/component_sweep.test.tsx`.
* **Contract snapshots:** `npm run verify:reason-tags`,
  `verify:ui-routes`, `verify-types` all green.
* **Bug-fix PRs** include a regression test that fails on the parent
  commit.

## 8. Open decisions (defer to ADR-042 §5)

* Autonomy L1–L4 semantics — adopt `contracts/policy.py` ordering;
  discard the prototype's inverted labels.
* Demo niceties (open-in-new-tab, right-click menu, copy-sender):
  proposed drop/defer.
* Out of scope here: Quota, Performance, Admin, CSR Chat
  (gap-analysis §5/§6).

---

*Paired with asoe2 ADR-042. Generated 2026-05-23 from the AgenticOM
prototype Customer Inbox analysis.*
