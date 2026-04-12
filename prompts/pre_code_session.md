# pre_code_session.md — Pre-Session Checklist

Run through this checklist before starting any asoe-ui coding session.

---

## 1. Check Current State

- [ ] `git status` — clean working tree?
- [ ] `npm run build` — passes?
- [ ] `tasks.md` — which phase are you working on?

## 2. Read Guardrails

- [ ] `CLAUDE.md` — review the 5 core guardrails, especially:
  - Guardrail #2: no hardcoded enum values
  - Design tokens only: no hardcoded hex/px
  - Types mirror backend contracts

## 3. Read Architecture (if relevant)

- [ ] `ui_architecture.md` — if building a page, component, or layout (authoritative UI architecture)
- [ ] `consol_arch.md` Section 6 — if adding/modifying API calls
- [ ] `consol_arch.md` Section 8 — if touching WebSocket integration
- [ ] `consol_arch.md` Section 9 — if touching auth, RBAC, or security

## 4. Read Design System (if visual)

- [ ] `skills/asoe-ui-design/SKILL.md` — component anatomy, color rules, anti-patterns
- [ ] `skills/asoe-ui-design/references/component-patterns.md` — if building a specific component
- [ ] `skills/asoe-ui-design/references/layout-templates.md` — if building a page

## 5. Check Backend Contracts (if touching types or API)

- [ ] `asoe2/contracts/models.py` — for `src/types/exceptions.ts` alignment
- [ ] `asoe2/api/schemas.py` — for `src/types/api.ts` alignment
- [ ] `asoe2/api/events.py` — for `src/types/websocket.ts` alignment
- [ ] `asoe2/api/deps.py` — for `src/lib/roles.ts` and `src/types/auth.ts` alignment

## 6. Know Your Definition of Done

From `CLAUDE.md`:
- `npm run build` passes
- Types clean (no `any`)
- No hardcoded enums in `.tsx`
- Design tokens used
- Keyboard accessible
- Status indicators use icon + text
- Layer 1/2 pattern where applicable
- Docs updated (`prompts/update_docs.md`)
