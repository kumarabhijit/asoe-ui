# full_project_sequence.md — ASOE UI Phase Sequence

Master index of all implementation phases. See `tasks.md` for detailed progress tracking.

---

## Phase Order

| # | Phase | Status | Prompt File | Dependencies |
|---|---|---|---|---|
| 0 | Foundation (design tokens, config) | ✅ Complete | `prompts/asoe-ui-design-system.md` | None |
| 1 | Auth Flow (login, SSO, RBAC, middleware) | ✅ Complete | — (see `plan.md` historical) | Phase 0 |
| 2 | Base Components (Button, Card, Input, Logo) | ✅ Complete | — | Phase 0 |
| 3 | Agent-First Components (NavBar, Badge, MetricTile, Toast, Sidebar, ActivityIndicator, WaterfallStepper, AgentReasoningCard) | ✅ Complete | `prompts/phase_3_agent_first_components.md` | Phase 0, 2 |
| 4 | Types & API Client (exception types, API types, WebSocket types, mock API, useHealth) | ✅ Complete | `prompts/phase_4_types_api_client.md` | Phase 1 (auth types) |
| 5 | Exception Queue Page (flagship view, metrics, filters, DataTable, sidebar) | ✅ Complete | `prompts/phase_5_exception_queue.md` | Phase 3, 4 |
| 6 | Exception Detail (ExceptionDetailPanel, reasoning card, waterfall stepper) | ✅ Complete | `prompts/phase_6_exception_detail.md` | Phase 3, 4, 5 |
| 7 | Dashboard (analytics, KPI tiles, breakdowns, platform health) | ✅ Complete | `prompts/phase_7_dashboard.md` | Phase 3, 4 |
| 8 | WebSocket Integration (useWebSocket hook, Section 8 protocol) | ✅ Complete | `prompts/phase_8_websocket.md` | Phase 4 |
| 8.5 | UI Enrichment (expandable rows, PricingWaterfall, line items, inbox alignment) | ✅ Complete | — (plan in `.claude/plans/`) | Phase 3, 5, 6, 7 |
| 8.6 | Three-Pane Outlook Layout & Polymorphic Detail View | ✅ Complete | — | Phase 5, 6, 8.5 |
| 8.7 | Enterprise UX Fixes & Accessibility (27 items: SPA nav, logout, toast, diagnostics, collapsible sections, filter persistence, a11y) | ✅ Complete | — | Phase 3-8.6 |
| 8.8 | Duplicate PO Detail Rendering & Panel Decomposition (5-layer decomposition, data-presence enrichment sections, WebSocket wiring, list indicators) | ✅ Complete | `prompts/exception_queue_duplicate_po.md` | Phase 6, 8, 8.6, 8.7 |
| 8.9 | Shadcn/ui + Tailwind CSS Migration (4 sub-phases: foundation, Radix primitives, CVA rewrites, full page conversion — 492→18 inline styles) | ✅ Complete | — | Phase 0-8.8 |
| 8.12 | Verdict UI Sync (orderAnalysis real-API, build_analysis pipeline node + ADR-025 reorder, audit-gap surface in TraceResponse + Diagnostics, 6 enrichment-section Playwright specs) | ✅ Complete | `prompts/phase_8_12_verdict_ui_sync.md` | Phase 6, 8.8, 8.10, 8.11, asoe2 Verdict full-close |
| 8.13 | Post-deploy stabilisation (live-stack fixes + WS resilience): ExceptionDetailPanel `executionError` branch on FAILED, `useWebSocket` polling fallback after 5 reconnect failures (Section 8.4), real backend JWT for WS auth, `exceptionsApi.reanalyze` USE_REAL_API gate fix + architectural lock test, confidence pill driven by real classifier value, removed Math.random() duration synthesis | ✅ Complete | `prompts/phase_8_13_post_deploy_stabilisation.md` | Phase 8, 8.8, 8.12, asoe2 Phase 26 |
| 9 | Settings & Admin Page (stub created in 8.7) | Pending | `prompts/phase_9_settings.md` (create when starting) | Phase 1, 3, 4 |
| 10 | Testing (Vitest, RTL, vitest-axe, ESLint guardrail rule) | Pending | `prompts/phase_10_testing.md` (create when starting) | Phase 2-8.5 |
| 11 | Deployment (Dockerfile, CI/CD, pre-commit hooks) | Pending | `prompts/phase_11_deployment.md` (create when starting) | Phase 10 |

---

## Notes

- **Phases 0-2** were implemented before phase prompts were established. The code and `tasks.md` are the record.
- **Phases 3-8** have retroactive prompts written from the session that implemented them (accurate, not speculative).
- **Phase 8.5** adapted pre-merge visual designs (Inbox page + Sample Screen) into the architecture-aligned codebase. Added PricingWaterfall component, expandable order rows, line-item grids, and refactored Inbox to use shared components.
- **Phase 8.6** refactored Exception Queue to three-pane Outlook master-detail with polymorphic detail view, entity profiles, impact metrics, and governance alignment.
- **Phase 8.7** resolved 27 enterprise UX issues: SPA navigation, logout, toast feedback, error states, filter URL persistence, collapsible sections, diagnostics toggle, accessibility (skip link, aria-current, semantic breadcrumbs), and feature flag for preview tabs.
- **Phase 8.8** decomposed the 1091-line ExceptionDetailPanel into a 357-line orchestrator + 8 sub-components along the 5-layer axis. Added data-presence-driven DuplicateDetection and OrderComparison sections (Guardrail #2 compliant — zero intent-string branching). Wired WebSocket to detail panel. Added left border color indicators and "Resolved" badges to list cards. 9 mock exceptions, 242 tests pass.
- **Phase 8.9** migrated the entire codebase from inline `style={{}}` objects to Shadcn/ui + Tailwind CSS in 4 sub-phases: (0) Foundation — Tailwind theme mapping, Shadcn deps, next-themes dark mode; (1) Radix primitives — Select, DropdownMenu, Dialog; (2) CVA rewrites — Button, Card, Input, Badge; (3-4) Full conversion — all 17 components + all page files. Inline style count 492→18 (96% reduction). System-default dark mode enabled. 242 tests pass.
- **Phase 8.12** synced the UI to the asoe2 Verdict full-close engagement (T1-T5 + ADR-025): flipped `orderAnalysis()` to real-API mode, added the new `build_analysis` LangGraph node + reordered `select_recipe / resolve_dependencies / validate_types` ahead of `shadow_audit` per ADR-025 in the mock pipeline, surfaced `audit_context_missing_class` / `audit_context_missing_fields` on `TraceResponse` + Diagnostics drawer, and shipped 6 new Playwright specs covering the 4 sections that were mock-only pre-engagement (BackOrder, DuplicatePO + OrderComparison, PriceAnalysis) plus the 3 already-shipped sections that gained gateway-fetched audit-bearing fields after clause retirement (DeliveryDelay, OverMax, MOQ). Suite 16/16 green against the live backend; D18 drift register flipped PARTIAL 6/10 → SHIPPED 10/10.
- **Phase 8.13** stabilised the deployed sandbox after live-stack issues surfaced: added the `executionError` render branch on `ExceptionDetailPanel` so FAILED records show "Pipeline failed at <node>" instead of conflating with shadow-pending; implemented Section 8.4 polling fallback in `useWebSocket` (5 failed reconnects → interval poll on `/api/v1/exceptions/{id}` because Container Apps closes idle WS at 4 minutes); switched WS auth from the `'mock-ws-token'` placeholder to the real backend access token; fixed the silently-mock-only `exceptionsApi.reanalyze` by adding the `if (USE_REAL_API)` branch + locked the regression with `tests/architectural/exceptions_api_live_branches.test.ts`; flipped the pipeline classify-row confidence projection from synthetic to `analysis.confidence / 100`; removed the `Math.random()` duration synthesis (Verdict 2026-04-22 / Guardrail #6 violation). Drift register entries D19 (polling fallback ALIGNED), D20 (confidence sentinel retired), D21 (FAILED-state render) all marked RESOLVED. Vitest 519 passed across 38 files, no regressions. (2026-05-01)
- **Phase prompts for 9-11** should be created when each phase begins, following the `asoe2/prompts/phase_*.md` pattern.
- **`prompts/asoe-ui-design-system.md`** is the original Phase 0 prompt — still valid for regenerating the design system from scratch.
- **`plan.md`** is the historical Phase 1 prompt (login screen). Superseded by `tasks.md` but preserved for reference.

## Cross-Repository Dependencies

| UI Phase | Requires from asoe2 |
|---|---|
| Phase 4 (Types) | `contracts/models.py`, `api/schemas.py`, `api/events.py`, `api/deps.py` |
| Phase 8 (WebSocket) | `api/routes/ws.py` protocol, `api/events.py` types |
| Phase 9 (Settings) | `api/routes/policies.py` endpoints |
| Phase 11 (Deployment) | `docker-compose.yml` service definitions |
