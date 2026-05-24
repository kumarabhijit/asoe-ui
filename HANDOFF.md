# ASOE Customer-Inbox Port — Session Handoff (pointer)

The authoritative handoff lives in the backend repo: **`asoe2/HANDOFF.md`**
(branch `claude/gifted-darwin-NbqQo`). It covers both repos — status, pending
items, operating discipline, and document locations.

**asoe-ui quick context:** branch `claude/gifted-darwin-NbqQo`, **draft PR #185**.
Customer-Inbox sections are dumb data-presence projectors in
`src/app/exceptions/` (`EntitiesSection` / `SapDataSection` / `OrderEntrySection`),
mounted in `ExceptionDetailPanel`; the EMAIL_ENTRY lens chip is on
`src/app/cases/page.tsx`. Types in `src/types/exceptions.ts` mirror the backend
and must match `src/types/generated.ts` (regen via `npm run generate-types`).
Local: `npm install` done (Node 22); `vitest`/`tsc` run locally, Playwright
browser-e2e via CI. See `docs/test-strategy/customer-inbox-tdd-strategy.md`.
