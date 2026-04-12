# Phase 3: Agent-First Components

**Prerequisite:** Phase 0 (design tokens), Phase 2 (base components Button, Card, Input, Logo)
**Architecture reference:** `ui_architecture.md` Section 2 (Component Strategy: Shadcn/ui Reconciliation)
**Design reference:** `skills/asoe-ui-design/SKILL.md`, `skills/asoe-ui-design/references/component-patterns.md`

---

## Context

Section 11.2 specifies 8 custom agent-first components that have no Shadcn equivalent. These implement domain-specific behavior: two-layer cognition, brand restraint, pipeline visualization, and agent activity patterns.

Shadcn is adopted only for non-agent primitives (DataTable, Dialog, Select, Tooltip). All 8 agent-first components are custom-built.

---

## Components to Build

### 1. Badge/Pill (`src/components/ui/Badge.tsx`)

Tinted background + colored text at rest. WCAG 1.4.1: never color alone — every variant includes an icon + text label.

**Variants:** `success`, `warning`, `error`, `info`, `neutral`, `brand`
**Sizes:** `sm`, `md`
**Helper functions:**
- `verdictVariant(verdict?: string)` — maps GREEN/YELLOW/RED to badge variant, defaults to `neutral`
- `lifecycleVariant(state?: string)` — maps lifecycle states to badge variant, defaults to `neutral`

**Default icons per variant (WCAG 1.4.1):**
- success → Check, warning → AlertTriangle, error → ShieldX, info → Info, neutral → Clock, brand → Zap

**Key rule:** Unknown values must fall through to `default: "neutral"` — adding a new intent or state requires zero Badge.tsx changes (Guardrail #2).

### 2. MetricTile (`src/components/ui/MetricTile.tsx`)

KPI display: 40x40 tinted icon background + label (uppercase) + monospace value + optional subtitle.

**Props:** `icon`, `label`, `value`, `subtitle?`, `tint?` (CSS color for icon bg)
**Font:** Value uses `var(--font-mono)` and `var(--font-size-heading)` for data density.

### 3. NavBar (`src/components/ui/NavBar.tsx`)

56px glass surface with agent status pulse dot. Brand purple on logo only (not on tabs).

**Structure:** Logo | Tab navigation | Agent status badge | Settings icon | User avatar
**Active tab:** Purple underline (`var(--color-brand)`) — one of exactly 3 brand-colored elements (Section 11.3).
**Glass effect:** `backdrop-filter: blur(16px)` with `rgba(255, 255, 255, 0.85)` background.
**Agent status:** Uses Badge with `brand` variant and `agent-active-dot` pulse animation.
**Position:** `sticky top: 0`, `z-index: var(--z-nav)`.

### 4. Toast (`src/components/ui/Toast.tsx`)

4.5s auto-dismiss, status-colored. **The only solid-fill element in the entire design system.**

**Variants:** `success`, `warning`, `error`, `info` — each with solid background color and white text/icon.
**Pattern:** React context provider (`ToastProvider`) + `useToast()` hook.
**Behavior:** Stacks bottom-right, slide-in animation, dismiss button.
**ARIA:** `role="status"`, `aria-live="polite"`.

### 5. Sidebar (`src/components/ui/Sidebar.tsx`)

480px intervention panel, slides right. Primary Layer 2 surface for exception detail.

**Width:** `var(--sidebar-width)` (480px from design tokens).
**Behavior:** Overlay backdrop on open, escape-to-close, focus trap on open.
**Animation:** `transform: translateX(100%) → translateX(0)` with `var(--dur-normal)`.
**ARIA:** `role="dialog"`, `aria-modal="true"`, `tabIndex={-1}` for focus management.

### 6. ActivityIndicator (`src/components/ui/ActivityIndicator.tsx`)

Dynamic text replacing static labels. Node-specific, domain-aware messages — NOT generic "Loading...".

**Messages defined in a `NODE_MESSAGES` map:**
- Simple string per node (e.g., `ingest: "Validating order event fields..."`)
- Intent-aware variants where relevant (e.g., `shadow_audit` with DUPLICATE_PO: "Auditing duplicate PO against compliance policies...")
- `_default` fallback for unknown intents

**Props:** `node: PipelineNode`, `intent?: string`
**Visual:** `agent-active-dot` pulse (6px) + italic text in `var(--color-text-tertiary)`.

### 7. WaterfallStepper (`src/components/ui/WaterfallStepper.tsx`)

Real-time pipeline progress driven by WebSocket events. Per-node execution visualization.

**Node states:** `pending` | `started` | `completed` | `failed` | `skipped`
**Visual per state:**
- Pending: empty circle, muted text
- Started: pulsing brand-colored border + `ActivityIndicator`
- Completed: solid green checkmark + data summary + duration
- Failed: solid red X + error message
- Skipped: dashed border, muted (shown after a failed node)

**Data summaries for completed nodes:** Intent + confidence on `classify`, verdict on `shadow_audit`, recipe name on `select_recipe`, final status on `apply_effects`.

**Connector lines:** 2px vertical lines between nodes, colored by completion state.

**Exported types:** `NodeState` interface with `node`, `status`, `duration_ms?`, `data?`.

### 8. AgentReasoningCard (`src/components/ui/AgentReasoningCard.tsx`)

Two-layer cognition pattern (Section 11.1). The core agent-first component.

**Layer 1 (always visible):**
- Header: Zap icon + "Agent Analysis" + verdict Badge
- Confidence bar (0-100%, colored by threshold)
- Key data: intent (humanized) + recipe name
- Explanation text
- Action buttons (verdict-specific, see below)

**Layer 2 (expandable):**
- Toggle button: "View Evidence & Reasoning" / "Hide Evidence & Reasoning"
- TraceRecord fields: trace_id, backend, skill, policy hits, gateway calls, final status

**Verdict-specific behavior (Section 11.1 table):**

| Verdict | Layer 2 Default | Action Buttons |
|---|---|---|
| GREEN | Collapsed | "View Details" (toggles Layer 2) |
| YELLOW | Auto-expanded | Approve (brand), Reject (neutral), Escalate (ghost) |
| RED | Auto-expanded | Acknowledge (neutral), Override (destructive, admin-only), Escalate (ghost) |

**RED Override safeguard:** Override button gated by `isAdmin` prop. Per Section 11.1, RED removes primary action button to prevent accidental dismissal.

---

## Verification

After building all 8 components:
1. `npm run build` passes
2. All components use design tokens — zero hardcoded hex/px values
3. Badge `verdictVariant`/`lifecycleVariant` return `"neutral"` for unknown inputs
4. Toast uses `aria-live="polite"`
5. Sidebar uses `role="dialog"` and `aria-modal="true"`
6. AgentReasoningCard auto-expands Layer 2 for YELLOW and RED
7. ActivityIndicator messages are domain-aware, not generic "Loading..."
