# Documentation Update Prompt

```text
Read CLAUDE.md, DESIGN.md, ui_architecture.md, tasks.md, and consol_arch.md before making any changes.

Also read each document you are about to update so you understand its current state.

Target documents (update only the ones relevant to what has changed):
- README.md                         — engineer cookbook; audience: novice engineers onboarding to the project
- DESIGN.md                         — code structure catalog (components, pages, hooks, types, API endpoints)
- CLAUDE.md                         — engineering guardrails and session instructions
- tasks.md                          — phase checklist; mark completed items with [x]
- ui_architecture.md                — authoritative UI architecture (layouts, components, data flows, drift register)
- docs/AUDITOR_GUIDE.md             — audit controls reference; audience: auditors and operators
- docs/prototype_gap_analysis.md    — prototype vs implementation gap tracker; update status column when gaps are closed
- prompts/full_project_sequence.md  — phase sequence; add new phases as needed
- prompts/phase_*.md                — phase-specific build prompts; add new phases as needed
- (any other *.md added in future)

Excluded from doc updates (do NOT update without explicit request):
- consol_arch.md            — shared platform architecture. Section 11 is a stub pointer to ui_architecture.md — do not expand it. Sections 1-10, 12-13 require explicit coordination.
- skills/asoe-ui-design/SKILL.md     — design system rules; separate maintenance cycle
- skills/asoe-ui-design/references/* — design token and component specs; updated with design system changes only
- plan.md                            — superseded; historical reference only

Rules:
1. Update only what has actually changed in the codebase since the last doc update.
   Do not rewrite sections that are still accurate.
2. Keep the existing structure and headings unless a structural change is strictly required.
3. All code examples must match the current source (src/types/, src/components/ui/, src/lib/api.ts,
   src/app/). Verify file paths with `ls` before writing.
4. Do not add speculative sections, hypothetical features, or forward-looking content.
5. Do not remove content that is still accurate and useful to the audience.
6. If the change touches code or config (not just prose), run `npm run build` to confirm
   the build still passes. For prose-only edits, skip the build.
7. Commit with a message of the form: "docs: update <filename> — <one-line reason>"
8. Match asoe2 field names. When updating src/types/, verify field names match the
   corresponding Pydantic model in asoe2. Document the mapping in DESIGN.md Section 4.
9. AUDITOR_GUIDE discipline: when adding a new role-gated action (e.g., a button visible
   only to managers), add it to AUDITOR_GUIDE Section 1 (RBAC UI Enforcement). When adding
   a new API call, verify X-Trace-ID propagation and update Section 3 if needed.
10. UI architecture is in ui_architecture.md only. When changing page layouts, component
    patterns, or governance models, update ui_architecture.md (the single authoritative
    UI architecture doc). Do NOT expand consol_arch.md Section 11 — it is a stub pointer.
    If a change evolves a previously documented pattern, add a resolved drift entry in
    ui_architecture.md Section 9 documenting the evolution.
11. Prototype gap analysis: when a gap from docs/prototype_gap_analysis.md is closed by
    new code, update the "asoe-ui Status" column in the relevant table to reflect the new state.

README.md-specific guidance (novice engineer audience):
12. Write for someone who has never seen this codebase. Assume no prior knowledge
    of the Exception Queue, data-presence-driven architecture, or the domain.
13. Every setup step must be copy-pasteable. Include the exact commands to clone,
    install, configure, run, and test. Do not assume the reader knows which
    flags, env vars, or config files are needed.
14. Define acronyms and domain terms on first use (e.g., "CPG (Consumer Packaged Goods)",
    "EDI 850 (electronic purchase order)", "OOS (Out of Stock)").
15. Use short sentences. Prefer bullet lists over dense paragraphs.
16. For each module or directory mentioned, include a one-line plain-English
    description of what it does and why it exists.
17. Include a "Common Problems" or "Troubleshooting" section for errors a new
    engineer is likely to hit on first setup (missing deps, env vars, Node version).

Change discipline:
- Minimal and incremental. One section or one document at a time if possible.
- If a rename or restructure is not strictly necessary, leave it untouched.
- If architectural intent is unclear, stop and ask for clarification.
```
