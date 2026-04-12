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
| 9 | Settings & Admin Page | Pending | `prompts/phase_9_settings.md` (create when starting) | Phase 1, 3, 4 |
| 10 | Testing (Vitest, RTL, vitest-axe, ESLint guardrail rule) | Pending | `prompts/phase_10_testing.md` (create when starting) | Phase 2-8.5 |
| 11 | Deployment (Dockerfile, CI/CD, pre-commit hooks) | Pending | `prompts/phase_11_deployment.md` (create when starting) | Phase 10 |

---

## Notes

- **Phases 0-2** were implemented before phase prompts were established. The code and `tasks.md` are the record.
- **Phases 3-8** have retroactive prompts written from the session that implemented them (accurate, not speculative).
- **Phase 8.5** adapted pre-merge visual designs (Inbox page + Sample Screen) into the architecture-aligned codebase. Added PricingWaterfall component, expandable order rows, line-item grids, and refactored Inbox to use shared components.
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
