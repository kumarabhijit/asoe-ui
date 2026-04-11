# full_project_sequence.md — ASOE UI Phase Sequence

Master index of all implementation phases. See `tasks.md` for detailed progress tracking.

---

## Phase Order

| # | Phase | Status | Prompt File | Dependencies |
|---|---|---|---|---|
| 0 | Foundation (design tokens, config) | ✅ Complete | `prompts/asoe-ui-design-system.md` | None |
| 1 | Auth Flow (login, SSO, RBAC, middleware) | ✅ Complete | — (see `plan.md` historical) | Phase 0 |
| 2 | Base Components (Button, Card, Input, Logo) | ✅ Complete | — | Phase 0 |
| 3 | Agent-First Components (NavBar, Badge, MetricTile, Toast, Sidebar, ActivityIndicator, WaterfallStepper, AgentReasoningCard) | ✅ Complete | — | Phase 0, 2 |
| 4 | Types & API Client (exception types, API types, WebSocket types, mock API, useHealth) | ✅ Complete | — | Phase 1 (auth types) |
| 5 | Exception Queue Page (flagship view, metrics, filters, DataTable, sidebar) | ✅ Complete | — | Phase 3, 4 |
| 6 | Exception Detail (ExceptionDetailPanel, reasoning card, waterfall stepper) | ✅ Complete | — | Phase 3, 4, 5 |
| 7 | Dashboard (analytics, KPI tiles, breakdowns, platform health) | ✅ Complete | — | Phase 3, 4 |
| 8 | WebSocket Integration (useWebSocket hook, Section 8 protocol) | ✅ Complete | — | Phase 4 |
| 9 | Settings & Admin Page | Pending | `prompts/phase_9_settings.md` (create when starting) | Phase 1, 3, 4 |
| 10 | Testing (Jest, RTL, jest-axe, ESLint guardrail rule) | Pending | `prompts/phase_10_testing.md` (create when starting) | Phase 2-8 |
| 11 | Deployment (Dockerfile, CI/CD, pre-commit hooks) | Pending | `prompts/phase_11_deployment.md` (create when starting) | Phase 10 |

---

## Notes

- **Phases 0-8** were implemented before phase prompts were established. Retroactive prompts are not created — the code and `tasks.md` are the record.
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
