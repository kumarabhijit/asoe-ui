# Phase 8.12 — Verdict UI Sync (audit-gap surface + ADR-025 pipeline)

> Status: ✅ Shipped (2026-04-22 → 2026-04-25)
> Companion to: `asoe2` Verdict full-close engagement (T1-T5 +
> ADR-025 graph reorder + sandbox gateway stubs)

This prompt captures the asoe-ui changes that landed alongside the
asoe2 Verdict full-close engagement so a future session can replay
the work or extend it.

---

## What changed in asoe2 (context for the UI sync)

The Verdict full-close engagement on the backend retired all four
grandfather clauses, shipped four new analysis adapters, and
re-ordered the LangGraph pipeline. Concretely:

1. **All 10 enrichment sections backend-backed** —
   `price_analysis`, `duplicate_detection`, `order_comparison`,
   `backorder_analysis` are no longer mock-only. Every `*AnalysisData`
   class on `api/schemas.py::AnalysisResponse` has a corresponding
   adapter in `api/analysis_adapters.py` and a recipe-side
   `GatewayDependency` chain.

2. **V004 migration** added `enrichment_context` as a durable
   JSONB column on `exceptions`. The in-memory bridge in
   `DbExceptionStore.create()` retired; the
   `_persist_exception` `resolved_data → enrichment_context`
   fallback retired; `resolve_dependencies` writes only to
   `enrichment_context` (single bag).

3. **All 4 grandfather clauses retired** — every audit-bearing
   field persists end-to-end via real (or sandbox-stubbed) gateway
   reads:
   - `price_analysis_gateway_gap` → SAP doc / contract / promotion
   - `delivery_delay_financial_gap` → SLA contract gateway
   - `overmax_gateway_gap` → SAP contract + block-status
   - `moq_gateway_gap` → customer-master + contract + block-status

4. **ADR-025 reorder** — gateway READS now run BEFORE
   `shadow_audit` so audit-bearing evidence is captured for every
   record (including shadow-gated YELLOW/RED). The `build_analysis`
   node sits at the END of every terminal edge to enforce
   audit-bearing field coverage. New 11-node sequence:

   ```
   ingest → classify → load_skill → validate_circuit_breaker
     → select_recipe → resolve_dependencies → validate_types
     → shadow_audit
         ├─ RED    → build_analysis (BLOCKED, with full audit evidence)
         ├─ YELLOW → build_analysis (MANUAL_REVIEW_REQUIRED, with full audit evidence)
         └─ GREEN  → execute_recipe → apply_effects → build_analysis (COMPLETE)
   ```

5. **Sandbox gateway stubs** registered automatically when
   `ASOE_ENV=sandbox` (`api/sandbox_gateways.py`) so the live
   FastAPI server doesn't need real SAP integration for local /
   demo runs.

6. **Verdict Pillar 2.3** — `TraceResponse` carries
   `audit_context_missing_class` + `audit_context_missing_fields`
   so auditors get a structured gap surface instead of a regex
   on the explanation string.

---

## What this phase changed in asoe-ui

### 1. `orderAnalysis()` real-API branch (commit 9e4ad17)

`exceptionsApi.orderAnalysis()` was mock-only — every detail page
rendered Layer 1 from real backend data but the enrichment sections
showed nothing because the UI never called
`/api/v1/exceptions/{id}/analysis`. Added the `USE_REAL_API` branch
matching the same pattern the other endpoints use. 404 → null;
other errors propagate.

### 2. Pipeline mock reflects ADR-025 + `build_analysis` (commit 0fdba81)

Mock-mode deploys (e.g. asoe-ui.vercel.app, where
`NEXT_PUBLIC_USE_REAL_API` is unset) were rendering the
pre-2026-04-22 node sequence in Show Diagnostics. Updated:

- `src/types/exceptions.ts` — `PipelineNode` union: add
  `build_analysis`; reorder `select_recipe / resolve_dependencies /
  validate_types` BEFORE `shadow_audit`.
- `src/components/ui/WaterfallStepper.tsx` — `NODE_LABELS` adds
  "Build Analysis"; `dataSummary()` surfaces
  `audit_context_missing_fields` + AUDIT_CONTEXT_MISSING for
  `build_analysis`, gateway count for `resolve_dependencies`.
- `src/components/ui/AgentReasoningCard.tsx` — same `NODE_LABELS`
  refresh.
- `src/components/ui/ActivityIndicator.tsx` — `NODE_MESSAGES` adds
  "Enforcing audit-bearing field coverage…" for `build_analysis`.
- `src/app/exceptions/shared.tsx` — `PIPELINE_NODES` reordered;
  `STATE_PROGRESS` recalibrated against the 11-node sequence;
  `SHADOW_GATED_TERMINAL_STATES` set + skipped-middle logic so the
  visualisation correctly shows `execute_recipe` + `apply_effects`
  as "skipped" while `build_analysis` is "completed" on shadow
  YELLOW/RED paths.

### 3. Audit-gap surface in `TraceResponse` (commit 2eadd0d)

- `src/types/api.ts` — `TraceResponse` gains
  `audit_context_missing_class?: string` and
  `audit_context_missing_fields?: string[]` (mirrors
  `asoe2/api/schemas.py::TraceResponse`).
- `src/lib/api.ts` — mock trace generator synthesises both fields
  when an exception's `final_status === "AUDIT_CONTEXT_MISSING"`;
  `gateway_calls` reflects ADR-025 (READ-side calls present even
  on shadow-gated records, write-side gated on shadow GREEN).
- `src/app/exceptions/DiagnosticsSection.tsx` — Diagnostics drawer
  renders the structured audit-gap surface (class + ordered field
  list) when `build_analysis` flagged the record.

### 4. Playwright e2e coverage (commits 9e4ad17 + cbf7f62)

- `tests/browser/enrichment-sections.spec.ts` (new, 6 specs):
  drives Chromium against the live asoe2 :8000 + asoe-ui :3100
  stack, exercising one exception per intent (BackOrder,
  DuplicatePO + OrderComparison, DeliveryDelay, OverMax, MOQ,
  PriceAnalysis). Each spec asserts on a gateway-fetched
  audit-bearing field actually rendered on screen — proving the
  full chain from gateway StubGateway → enrichment_context →
  composer → AnalysisResponse → orderAnalysis() → section
  component.
- Locator + helper fixes for the 3 pre-existing brittle specs
  (escalate, edi-mismatch-detail, price-hold-detail). Suite is
  16/16 green against the live stack.

### 5. Vercel build fix (commit b7a6f85)

`orderAnalysis()` 404 detection was casting to `APIError` and
inspecting `.status` — but `APIError` is the response envelope
shape (no `.status`). Replaced with `err instanceof Error` guard +
regex match on `http()`'s `"<CODE>: <message>"` format. Matches
both `NOT_FOUND:` (backend ASOEError envelope) and `HTTP_404:`
(fallback unstructured 404).

---

## Cross-repo invariants enforced

| Guardrail | How this phase respects it |
|---|---|
| #1 (no hardcoded enums) | `useHealth` continues to source intents / lifecycle states / recipes. New `build_analysis` PipelineNode is in the type union, not branched on at runtime. |
| #3 (types mirror backend) | `PipelineNode` + `TraceResponse` brought into exact alignment with `asoe2/contracts/models.py` + `asoe2/api/schemas.py`. |
| #4 (agent-first) | `build_analysis` activity message + dataSummary keep the agent-actively-working narrative. |
| #6 (no frontend composition) | The Diagnostics audit-gap surface reads `trace.audit_context_missing_*` directly — no client-side derivation. |
| #7 (rich UI types are a product commitment) | Zero `*AnalysisData` field pruning; the post-T6 sections are all backend-backed via the StubGateway sandbox. |

## Local-dev e2e setup

```bash
# Backend (sandbox + SQLite + stub gateways auto-registered)
cd asoe2
DATABASE_URL=sqlite:///asoe2.db ASOE_ENV=sandbox JWT_SECRET=local-e2e-secret \
  uvicorn api.app:app --host 127.0.0.1 --port 8000

# Frontend (real-API mode pointing at the local backend)
cd ../asoe-ui
cat > .env.local <<EOF
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-e2e-nextauth-secret
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_USE_REAL_API=1
EOF
npm run dev

# Playwright (auto-starts UI on :3100; reuses existing :8000 backend)
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers ASOE2_ROOT=../asoe2 npx playwright test
```

## What's intentionally NOT done

- **Real SAP integrations** — sandbox `StubGateway` payloads suffice
  for demo / local e2e. Real SAP doc / contract / block-status
  integrations are a separate platform-team track.
- **DiagnosticsSection rendering of the new gateway result keys**
  beyond the audit-gap surface — the trace already shows
  `gateway_calls`; per-key result payload rendering is a separate
  evolution if operators want it.
- **Compliance CODEOWNERS approval** for the clause retirements —
  reflected in the registry YAML diffs but real review is OOB for
  a session.

## See also

- `asoe2/docs/adr/ADR-025-gateway-reads-before-shadow.md` —
  architectural rationale for the pipeline reorder.
- `asoe2/api/sandbox_gateways.py` — sandbox stub registration that
  mirrors `tests/conftest.py`.
- `asoe2/compliance/audit_bearing_registry.yaml` — post-engagement
  state (zero open grandfather clauses).
- `ui_architecture.md` D18 — flipped PARTIAL 6/10 → SHIPPED 10/10.
