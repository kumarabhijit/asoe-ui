# update_docs.md — Documentation Maintenance Protocol

Run this prompt after any code change that adds, removes, or modifies pages, components, hooks, types, or API endpoints.

---

## Before You Start

Read these documents first:
1. `CLAUDE.md` — engineering guardrails (know what rules you're enforcing)
2. `DESIGN.md` — current code structure (know what's already documented)
3. `tasks.md` — phase progress (know which phase this change belongs to)
4. `ui_architecture.md` — authoritative UI architecture (layouts, components, data flows, drift register)

---

## Target Documents

Update **only** the documents affected by the change:

| Document | When to Update |
|---|---|
| `DESIGN.md` | New/removed components, pages, hooks, types, or API endpoints |
| `tasks.md` | Phase completed or new phase items discovered |
| `ui_architecture.md` | Page layout changes, new component patterns, governance model changes, drift register items. **This is the single authoritative UI architecture document.** `consol_arch.md` Section 11 is a stub pointer — do not duplicate detail there. |
| `docs/AUDITOR_GUIDE.md` | New role-gated actions, auth changes, new data display for audit trail, new compliance controls |
| `README.md` | New pages, changed quick-start steps, new dependencies |
| `prompts/full_project_sequence.md` | New phase added or phase dependencies changed |

---

## Excluded Documents (do NOT update without explicit request)

| Document | Reason |
|---|---|
| `consol_arch.md` | Shared platform architecture. Section 11 is a stub pointer to `ui_architecture.md` — do not expand it. Sections 1-10, 12-13 require explicit coordination. |
| `skills/asoe-ui-design/SKILL.md` | Design system rules — separate maintenance cycle |
| `skills/asoe-ui-design/references/*` | Design token and component specs — updated with design system changes only |
| `plan.md` | Superseded — historical reference only |

---

## Rules

1. **Only update what changed.** If you added a component, update the DESIGN.md component catalog. Don't rewrite unrelated sections.

2. **Keep existing structure.** Add rows to tables, items to lists. Don't reorganize sections unless the structure is broken.

3. **Verify file paths.** Every path in DESIGN.md must point to a real file. After updating, confirm with `ls`.

4. **No speculation.** Document what exists, not what might be built. Future work belongs in `tasks.md` pending phases.

5. **Run the build.** `npm run build` must pass. Docs are the only files changed — no source code breakage.

6. **Match asoe2 field names.** When updating `src/types/`, verify field names match the corresponding Pydantic model in `asoe2`. Document the mapping in DESIGN.md Section 4.

7. **AUDITOR_GUIDE discipline.** When adding a new role-gated action (e.g., a new button visible only to managers), add it to AUDITOR_GUIDE Section 1 (RBAC UI Enforcement). When adding a new API call, verify X-Trace-ID propagation and update Section 3 if needed.

8. **UI architecture is in `ui_architecture.md` only.** When changing page layouts, component patterns, or governance models, update `ui_architecture.md` (the single authoritative UI architecture doc). Do NOT expand `consol_arch.md` Section 11 — it is a stub pointer. If a change evolves a previously documented pattern (e.g., layout shift, governance change), add a resolved drift entry in `ui_architecture.md` Section 9 documenting the evolution.

---

## README-Specific Guidance

The README is for **new engineers who have never seen this repo**. When updating:
- Keep the Quick Start working (`npm install && npm run dev`)
- Update the repository structure tree if directories changed
- Update the tech stack table if dependencies changed
- Don't add implementation details — point to DESIGN.md instead
