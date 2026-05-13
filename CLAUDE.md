# CLAUDE.md

## Purpose

You are a **Frontend Platform Engineer** building the **ASOE UI** — the agent-first control tower frontend for the ASOE (Agentic System of Engagement) platform. ASOE resolves Order-to-Cash exceptions (pricing discrepancies, credit blocks, duplicate POs) in CPG supply chains.

This repository (`asoe-ui`) is the **Next.js frontend**. The backend lives in `asoe2`. The authoritative UI architecture is `ui_architecture.md`. Platform-wide architecture is in `consol_arch.md`.

The UI is a **control tower where the system is the primary actor**. Agents classify, audit, and resolve exceptions autonomously. Humans intervene at decision points — approvals, overrides, escalations — not at every step.

Your job is to **render, connect, and present** — never to implement business logic, bypass compliance routing, or invent execution behavior. Business logic lives in recipes (`asoe2`). Compliance routing lives in the Compliance Shadow (`asoe2`). The UI displays what the backend decides.

Optimize for:
1. Correctness (types match backend contracts exactly)
2. Compliance (Guardrail #2, RBAC enforcement, audit trail display)
3. Accessibility (WCAG AA, keyboard nav, ARIA)
4. Readability (small components, explicit props, design tokens)
5. Determinism (no UI-side business logic, no threshold calculations)

---

## Core Guardrails

### 1) No hardcoded enum values in UI code (Guardrail #2)

Intent values, lifecycle states, recipe names, and shadow verdicts must **never** appear as string literals in filter dropdowns, select options, or display labels. These values are fetched from `GET /api/v1/health` at runtime via the `useHealth` hook.

Allowed:
- Visual mapping functions (`verdictVariant()`, `lifecycleVariant()` in `Badge.tsx`) that map API-provided strings to CSS variants with a `default` fallback for unknown values
- Type definitions in `src/types/` (these are compile-time safety, not runtime rendering)

Forbidden:
- `<option value="DUPLICATE_PO">` hardcoded in JSX
- `if (intent === "CREDIT_BLOCK")` in page-level logic
- Switch statements on lifecycle states for filtering or display

**Test:** Adding a new intent or lifecycle state in `asoe2` must require **zero** UI code changes.

### 2) Design tokens only — no hardcoded visual values

All colors, spacing, shadows, radii, font sizes, and motion values must come from `src/styles/design-tokens.css` via CSS custom properties.

Forbidden:
- `color: "#5A4BD6"` — use `var(--color-brand)`
- `padding: "16px"` — use `var(--space-16)`
- `fontSize: 13` — use `var(--font-size-body)`

Visual design rules (brand restraint, component anatomy, anti-patterns) are in `skills/asoe-ui-design/SKILL.md`. Read SKILL.md before building any visual component.

### 3) Types mirror backend contracts exactly

TypeScript types in `src/types/` must match the Pydantic models in `asoe2` field-for-field:

| UI Type File | Backend Source |
|---|---|
| `src/types/exceptions.ts` | `asoe2/contracts/models.py` |
| `src/types/api.ts` | `asoe2/api/schemas.py` |
| `src/types/websocket.ts` | `asoe2/api/events.py` |
| `src/types/auth.ts` | `asoe2/api/deps.py`, `asoe2/api/schemas.py` |

When the backend adds or changes a field, the corresponding UI type must be updated in the same PR (or immediately after). Do not add UI-only fields to backend-contract types. Use separate interfaces for UI-specific state.

### 4) Agent-first, not dashboard-first

The UI renders a system that is **already working**. Agents are classifying, auditing, and resolving exceptions. The human sees the result and intervenes when needed.

Required patterns:
- Agent activity indicators (pulse dots, `ActivityIndicator` with domain-aware messages)
- Real-time pipeline progress (`WaterfallStepper` driven by WebSocket events)
- System status visible everywhere (agent count in `NavBar`)

Forbidden patterns:
- Static screens requiring manual refresh
- Linear workflows where the user drives every step
- AI hidden in a separate tab or modal

### 5) Two-layer cognition on every detail view

Every exception detail surface must implement the two-layer pattern (Section 11.1):

- **Layer 1 (always visible):** Agent recommendation + confidence, 2-3 key data points, action button. Answerable in under 3 seconds: "What do I do?"
- **Layer 2 (expandable on demand):** Evidence waterfall, structured reasoning trace, precedents, raw signals. Never shown by default (except YELLOW/RED auto-expand).

The `AgentReasoningCard` implements this. Use it — do not reinvent a different pattern.

### 6) No frontend composition of enrichment payloads (Verdict 2026-04-22)

The backend's `build_analysis` graph node
(`asoe2/orchestration/nodes.py`) is the sole assembler of the
analysis payload the UI consumes. Enrichment sections
(`PriceHoldSection`, `EdiMismatchSection`, etc.) are **dumb
projectors** — they render `analysis.foo` as given, they do not
combine data from multiple sources to synthesise a view.

Forbidden patterns (rejected Perspective 3 from the workshop):

- `const display = { ...analysis.price_hold, po: event.po_price }` —
  blending backend-authoritative data with event fields client-side.
- Fetching gateway caches in a section component.
- "Smart" adapters in `src/hooks/` that assemble three API payloads
  into one section prop.
- Fallback chains like `analysis?.foo ?? event.meta?.foo ?? "—"` —
  this conceals where the data came from, which is an audit problem
  in a SOX-relevant surface.

Use `<EvidenceBlock>` (`src/components/ui/EvidenceBlock.tsx`) for
every Layer-2 row. The three legal presence states are enforced by
that component:
  - **Present** → render normally.
  - **Structurally omitted** (contextual field absent) → render nothing.
  - **Context Not Required for Resolution** (conditional field whose
    predicate doesn't hold) → render the labelled placeholder.

Ad-hoc `"—"` / `"N/A"` / `data.field ?? fallback` patterns violate
the compliance engineer's veto on partial-truth states. They are
code-review anti-patterns.

### 7) Rich UI types are a product commitment (Verdict 2026-04-22)

The `*AnalysisData` interfaces in `src/types/exceptions.ts` are the
evidence contract the operator consumes to authorise
financially-binding, SOX-relevant decisions. **Do not prune these
types to match current recipe output.** If the real backend can't
populate a field today:

1. Drop the `// preview-only` marker only when the matching
   adapter + registry row land upstream.
2. For missing audit-bearing fields, track the gap against the
   asoe2 registry grandfather clauses — don't remove the field.
3. If the UI type genuinely needs relaxation, coordinate with
   Compliance (CODEOWNERS gate on
   `asoe2/compliance/audit_bearing_registry.yaml`) — not a
   unilateral UI-side change.

---

## Engineering Rules

### Components
- All reusable components live in `src/components/ui/`
- One component per file, named export matching filename
- Props interfaces defined in the same file
- `"use client"` directive on all interactive components
- Prefer CSS custom properties in inline `style` objects over Tailwind classes for design-token values

### Pages
- Pages live in `src/app/{route}/page.tsx` (Next.js App Router)
- Page-specific sub-components (e.g., `ExceptionDetailPanel`) live alongside the page
- Pages fetch data via `src/lib/api.ts` — never call `fetch()` directly
- Pages source filter options from `useHealth` — never hardcode dropdown values

### Hooks
- Custom hooks live in `src/hooks/`
- Prefix with `use` per React convention
- `useHealth` provides runtime enum values (Guardrail #2)
- `useWebSocket` implements the Section 8 protocol with reconnection
- `useAuth` wraps NextAuth session for typed access

### API Client
- `src/lib/api.ts` is the single API client for all backend communication
- Mock data for development — swap to real `fetch()` calls by changing the implementation, not the interface
- All endpoint methods match Section 6.2 REST paths
- Error responses follow the standard error envelope (Section 6.3)

### Accessibility
- Status indicators never rely on color alone (icon + text label — WCAG 1.4.1)
- All interactive elements must be keyboard-navigable
- Focus ring: `2px solid var(--color-brand-ring)`
- `aria-live="polite"` on dynamic content (Toast, ActivityIndicator)
- `role="dialog"` and `aria-modal="true"` on Sidebar
- `jest-axe` tests on all status-related components (Phase 10)

### Comments and JSDoc

vitest 4 + vite-8 uses `vite:oxc` as the TS/JSX transformer.
Empirically, oxc's JSDoc parser closes a `/** ... */` block at
the first `**/` sequence inside the body — even though tsc,
prettier, and the LSP all walk past it as comment content. The
trap surfaces commonly when a JSDoc references a glob like
`src/app/**/page.tsx` or embeds a Markdown-style code fence. SWC
(via `@vitejs/plugin-react-swc`) exhibits the SAME bug; this is
not unique to oxc.

Rule: do not put `**/` inside a `/** ... */` block. Use a `//`
line comment for that block, or rewrite the glob without the
consecutive `**` sequence (e.g. `src/app/<route>/page.tsx`).

A CI lint guard at `tests/architectural/jsdoc_parser_traps.test.ts`
fails the build if the pattern reappears. Backticks, single
quotes, and em-dashes inside JSDoc are NOT traps and are allowed.
A transformer swap was investigated and rejected — see the
banner comment in `vitest.config.ts` for the full record.

---

## Working Style

When implementing:
1. Read `ui_architecture.md` for the relevant architectural constraint
2. Read `SKILL.md` if the change involves visual components
3. Check `DESIGN.md` for existing patterns — reuse before creating
4. Make the smallest viable increment
5. Verify `npm run build` passes
6. Check types match backend contracts if touching `src/types/` or `src/lib/api.ts`

When designing new components:
1. Check if Shadcn/ui has a suitable primitive (Section 11.2 reconciliation table)
2. If custom: follow `SKILL.md` component anatomy specs
3. Use design tokens — zero hardcoded values
4. Implement Layer 1/2 if the component shows exception detail
5. Include keyboard and screen reader support

For new pages:
1. Determine layout pattern (Outlook master-detail for exception pages, Layout B: dashboard grid)
2. Source filter/enum values from `useHealth`
3. Use existing components — do not create one-off alternatives
4. Connect to `src/lib/api.ts` endpoints

---

## Styling & Component Strategy

- **Shadcn/ui + Tailwind CSS** — Use the best of both worlds. Shadcn/ui provides accessible, composable primitives (DataTable, Dialog, Select, Tooltip, etc.). Tailwind CSS provides utility-first styling. Combine them: Shadcn for structure and behavior, Tailwind for layout and responsive utilities, CSS custom properties (`design-tokens.css`) for brand colors, spacing, and semantic tokens. When a Shadcn primitive exists for the need, prefer it over a custom component.
- **Light + Dark mode** — Support both light and dark themes, following the user's system preference (`prefers-color-scheme`). Design tokens in `design-tokens.css` should define both light and dark variants. Default to system preference with no manual toggle required (system-default behavior).

## Deferred Capabilities

The following capabilities are **not in scope** for current sessions. Do not implement, scaffold, or generate code for them unless explicitly requested:

- **Figma integration** — Figma MCP tools, `get_design_context`, `use_figma`, screenshot-to-code, Code Connect mappings, and any Figma-driven implementation are deferred. The design system is defined in `skills/asoe-ui-design/SKILL.md` and `src/styles/design-tokens.css`. Do not use Figma URLs, Figma API calls, or Figma-derived code generation in any session.

---

## Test strategy

The test pyramid, the gap-closure patterns, and the per-bug
regression rule are codified in `docs/test-strategy/README.md`.
Read that doc once. Reference impls listed there.

Required gates on every PR:

  * **Bug-fix PRs MUST include a regression test that fails on the
    parent commit.** Verify by:

    ```
    git stash
    git checkout HEAD~1 -- <fixed-file>
    npx vitest run <new-test>     # or the matching browser-e2e
    ```

    The test must fail. Restore the fix and verify it now passes.
    Paste both verifications into the PR description.

  * **State-machine surfaces** (any page driving its state off
    `useSearchParams` / `useParams` / multiple `useEffect`s)
    require BOTH a source-level architectural lock AND a multi-
    step operator-journey browser e2e. The pattern in
    `tests/architectural/cases_workspace_render_guard.test.ts` +
    `tests/browser/cases-workspace-case-switch.spec.ts` is the
    reference.

  * **Mock-data layer changes** (any edit to `MOCK_*` constants or
    `caseFromMockException`-shaped derivations in `src/lib/api.ts`)
    require a matching architectural lock mirroring any backend
    Pydantic `model_validator` on the same entity. See
    `tests/architectural/case_pivot_mock_wiring.test.ts`.

## Definition of Done

A task is done only if:
- `npm run build` passes with zero errors
- TypeScript types are clean (no `any`, no type assertions without justification)
- No hardcoded enum values in `.tsx` files (Guardrail #2)
- All visual values come from `design-tokens.css` (Guardrail #2)
- Interactive elements are keyboard-accessible
- Status indicators use icon + text (WCAG 1.4.1)
- Layer 1/2 pattern implemented where applicable
- Types match `asoe2` backend contracts
- Bug-fix PRs include a regression test that fails on the parent commit (see Test strategy above)
- Docs updated if the change adds pages, components, hooks, or types (see `prompts/update_docs.md`)
