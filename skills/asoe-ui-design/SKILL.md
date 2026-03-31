---
name: asoe-ui-design
description: >
  Enforce the ASOE visual design system whenever building any UI screen, component, page, or artifact for the ASOE
  platform. Triggers include: "build a dashboard", "create a UI", "design a screen", "new page for ASOE", "component",
  "layout", "card", "table", "metric tile", "queue view", "detail view", "sidebar", "agent card", "toast", "badge",
  "button", "pricing waterfall", "execution log", or any request to produce frontend code for ASOE. Also trigger when
  styling, theming, or fixing visual inconsistencies in existing ASOE screens. Read this skill FIRST, then read
  references/design-tokens.css for token values, references/component-patterns.md for component anatomy, and
  references/layout-templates.md for page composition. Cross-reference with application-design for agentic UX
  philosophy and frontend-design for execution quality standards.
---

# ASOE UI Design System

## 1. Overview

This skill defines the complete design system for the **ASOE (Agentic System of Engagement)** platform — the agent-first interaction paradigm, design tokens, color, typography, components, layout patterns, motion, accessibility, and quality gates. Every screen, artifact, and component built for ASOE must conform to this system.

→ Read `references/design-tokens.css` for the full CSS variable definitions.
→ Read `references/component-patterns.md` for component anatomy and specs.
→ Read `references/layout-templates.md` for page-level composition rules.
→ Read `references/anti-patterns.md` for explicit "never do this" examples.

---

## 2. Design Philosophy

### The Paradigm: Agent-First, Not Dashboard-First

ASOE is not a dashboard the user operates. It is a **living system the user guides.** The AI agents are the primary actors — they detect, diagnose, recommend, and execute. The human is the decision authority who intervenes at key moments, approves escalations, and handles edge cases. This fundamentally reshapes every screen:

| Traditional Enterprise UI | ASOE Agent-First UI |
|--------------------------|---------------------|
| User initiates every action | System active by default — agents always working |
| Static screens, final-state only | System in motion — progression, steps, transitions visible |
| AI hidden behind "Analysis" tab | AI activity central and visible without navigation |
| Linear workflows, one item at a time | Multiple concurrent threads visible simultaneously |
| Source-based organization (by module) | Intent-based organization (by task, outcome, urgency) |
| User operates | User guides, intervenes, decides |

### Agent-First Principles

- **The System Is Alive** — ASOE appears active without user input. Agents process continuously. The UI reflects this through activity indicators, progression states, and dynamic descriptions — never static labels alone. "On Hold" is a status. "Agent analyzing 3 condition records…" is activity.
- **Human as Intervener** — Users step in at decision points, not at every step. Clear intervention opportunities (approve, override, escalate) with minimal manual workflow. If the user clicks 5 times where the agent could handle it, the design has failed.
- **Inline Intervention** — Modify any step in-place. No navigating away to act. Actions are contextually embedded: sidebar, expanded rows, in-row buttons. The user never leaves the queue to see a diagnosis or take action.
- **Decision-Oriented** — Every agent surface presents: recommended action, visible alternatives, trade-offs. The user is guided toward a decision, not presented raw data to interpret.
- **Legible Reasoning** — Agent logic is traceable. Inputs, condition records, decision steps available on demand (Layer 2). But structured, never streamed — never a chat transcript.
- **Intelligent Escalation** — Based on confidence and risk. The UI communicates *why* something was escalated and *what* the agent needs from the human.
- **Parallel Visibility** — Multiple exception threads visible simultaneously. The user sees the full landscape of work, not one order at a time.
- **Traceability & Continuity** — Full audit trail. Step-by-step history. Work resumes seamlessly. Context is preserved between sessions.

### Visual Design Principles

- **Content First** — Typography and spacing create hierarchy. Borders and decoration are last resorts.
- **Calm Authority** — The interface feels like a senior analyst's briefing: precise, organized, unhurried.
- **Brand Restraint** — Brand blue (`#007AFF`) appears in exactly three places: primary CTA buttons, nav logo mark, active tab indicator. Everything else neutral. 95%+ of pixels are grays.
- **Progressive Disclosure** — Summary → Expand → Deep Dive. Default to minimum information needed to act.
- **Consistency Compounds Trust** — Design decisions are system-level constants, not per-screen choices.

### The Two-Layer Cognition Model

```
┌─────────────────────────────────────────────────┐
│  LAYER 1 — Executive Summary (Always Visible)   │
│  · Agent recommendation + confidence             │
│  · 2–3 key data points · Action button           │
│  · Answerable in < 3 seconds: "What do I do?"   │
├─────────────────────────────────────────────────┤
│  LAYER 2 — Deep Dive (Expandable on Demand)     │
│  · Evidence waterfall / audit trail              │
│  · Structured reasoning (not chat)               │
│  · Precedents, pattern matches, raw signals      │
└─────────────────────────────────────────────────┘
```

Default to Layer 1. Layer 2 for the 20% of cases needing verification.

---

## 3. Design Token Architecture

CSS custom properties on `:root`. Every visual value is a token — never hardcoded.

| Category | Prefix | Count | Key Values |
|----------|--------|-------|------------|
| Color | `--color-` | ~45 | surfaces, text, borders, status, category |
| Typography | `--font-` | ~18 | size, weight, line-height per register |
| Spacing | `--space-` | 10 | 4px base: 2/4/6/8/12/16/24/32/48/64 |
| Elevation | `--shadow-` | 5 | xs→xl. Cards: `sm`. Hover: `md`. Agent card: `md`. Modals: `lg` |
| Radius | `--radius-` | 5 | sm(6) · md(10, cards/buttons) · lg(14, modals) · full(pill) |
| Motion | `--dur-` / `--ease-` | 8 | instant(100ms) · fast(200ms) · normal(300ms) · slow(500ms) |

→ Full definitions: `references/design-tokens.css`

---

## 4. Color System

Light-only. Brand blue with extreme restraint.

### Brand — Used ONLY on Primary CTAs, Nav Logo, Active Tab

| Token | Value | Usage |
|-------|-------|-------|
| `--color-brand` | `#007AFF` | Primary CTA buttons, nav logo, active tab underline ONLY |
| `--color-brand-hover` | `#0066D6` | Button hover |
| `--color-brand-subtle` | `#F0F5FF` | Reserved — NOT for selected rows |
| `--color-brand-muted` | `#B3D7FF` | Reserved — progress bars in brand context only |

### Surfaces · Text · Borders

| Role | Token | Value |
|------|-------|-------|
| Page bg | `--color-surface-page` | `#F8FAFC` |
| Cards | `--color-surface-primary` | `#FFFFFF` |
| Headers, selected rows | `--color-surface-secondary` | `#F1F5F9` |
| Glass nav | `--color-surface-glass` | `rgba(255,255,255,0.72)` |
| Headings, data, PO numbers | `--color-text-primary` | `#0F172A` |
| Body, agent summaries, neutral btn labels, confidence bars | `--color-text-secondary` | `#475569` |
| Labels, breadcrumbs, ghost btn labels | `--color-text-tertiary` | `#94A3B8` |
| Dividers | `--color-border-default` | `#E2E8F0` |
| Selected borders, active pills | `--color-border-strong` | `#CBD5E1` |

### Status (Sacred) · Category (Muted)

Status: Success `#16A34A`/`#F0FDF4` · Warning `#D97706`/`#FFFBEB` · Error `#DC2626`/`#FEF2F2`
Category: Purple `#7C3AED` · Teal `#0D9488` · Amber `#D97706` · Rose `#E11D48` · Slate `#64748B` — each with subtle bg variant.

### Color Rules

1. **Brand blue is for action only.** CTAs, nav logo, active tab. Nothing else.
2. **95%+ neutral.** Color appears only on status badges and CTA buttons.
3. **Selected states = neutral surface + shadow.** Never `--color-brand-subtle`.
4. **Agent cards = elevation, not color.** No blue stripe, icon, or confidence bar.
5. **Neutral buttons = gray text.** `--color-text-secondary`, not brand.
6. **No raw hex in components.** Tokens only.

---

## 5. Typography

```css
--font-sans: "SF Pro Display", "SF Pro Text", "Inter", ui-sans-serif, system-ui, sans-serif;
--font-mono: "SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace;
```

**SF Mono** preferred for data — ~10–15% narrower than JetBrains Mono. Ships with macOS/iOS; JetBrains Mono is cross-platform fallback. **Inter** loads from Google Fonts (400/500/600/700).

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `--font-display` | 28px | 700 | Page title |
| `--font-title` | 20px | 700 | Card/modal heading |
| `--font-heading` | 16px | 700 | Section heading |
| `--font-subhead` | 14px | 600 | Subsection |
| `--font-body` | 13px | 400 | Content, descriptions |
| `--font-caption` | 11px | 500 | Timestamps, metadata |
| `--font-label` | 10px | 700 | Uppercase labels (tracked, tertiary) |
| `--font-mono-data` | 14px | 600 | Prices, quantities |
| `--font-mono-sm` | 11px | 500 | SAP codes, IDs |

Rules: Left-align everything. Labels are scaffolding (10px, tertiary, tracked). Mono for all numeric data. Max 3 weights per screen. No size below 10px.

---

## 6. Component Library

Fixed components. No one-off designs.

| Component | Purpose | Notes |
|-----------|---------|-------|
| NavBar | Glass surface, sticky, logo + nav + agent status + avatar | Brand blue only on logo |
| MetricTile | Icon + label + value + subtitle | Neutral icon backgrounds |
| Card | Primary container, borderless, shadow | Elevation varies by importance |
| DataTable | Expandable rows, no vertical borders, mono numerics | Selected = surface-secondary |
| Badge / Pill | Muted tint + colored text. "Audited" = slate (gray) | Never solid-fill at rest |
| Button | 5 variants. Only `brand` is blue. `neutral` = gray text | No other blue buttons |
| AgentReasoningCard | Recommendation + confidence + actions. Shadow, not color | Gray confidence bar |
| ActivityIndicator | Dynamic text: "Agent analyzing…" replaces static labels | The system feels alive |
| WaterfallStepper | Vertical timeline for pricing audit / execution log | Type-colored dots |
| Sidebar | 480px detail panel, slides right, inline intervention | Primary L2 surface |
| Toast | 4.5s auto-dismiss, status-colored | Only solid-fill element |

→ Full specs: `references/component-patterns.md`

---

## 7. Layout & Interaction

### Page Anatomy

```
┌────────────────────────────────────────────────────────────┐
│  NAV BAR (56px, glass, sticky)                             │
├────────────────────────────────────────────────────────────┤
│  PAGE HEADER (breadcrumb + title + actions)                │
├────────────────────────────────────────────────────────────┤
│  METRICS STRIP (4–6 tiles, responsive grid)                │
├────────────────────────────────────────────────────────────┤
│  TAB BAR (active = blue underline, text = textPrimary)     │
├──────────────────────────┬─────────────────────────────────┤
│  QUEUE / CONTENT         │  SIDEBAR (480px, sticky)        │
│  flex: 1                 │  Agent card + waterfall + action │
└──────────────────────────┴─────────────────────────────────┘
```

### Agent-First Interaction Rules

1. **Context over navigation.** Agent output surfaces inline, beside the data. No separate "analysis page."
2. **Inline intervention.** Approve, override, escalate — all available in sidebar/expanded row.
3. **Interruptibility.** Agent processes can be paused or redirected mid-execution.
4. **Activity over status.** Use ActivityIndicator for dynamic descriptions. Static labels are insufficient.
5. **Parallel visibility.** Full queue visible. User triages across exceptions, not one at a time.
6. **Intent-based grouping.** Sort by urgency/risk, not creation date. Group by outcome state.

### Grid: `max-width: 1440px`, `padding: 0 32px`. Sidebar pushes at ≥1440px, overlays at 1024–1439px.

→ Full mockups: `references/layout-templates.md`

---

## 8. Data Density

**Tables:** Fixed key columns, scrollable detail. Right-align numerics (SF Mono). Expandable rows for line items. Summary footer.

**Pricing Waterfall:** Vertical timeline — type dot → label → condition record → value → running total. Error: red tint + root cause. Result: green tint. Collapsible.

**Execution Log:** Timestamps, operation badges, before/after, per-step status. Result: corrected price + ref number + next steps.

---

## 9. Motion

Durations: instant(100ms) · fast(200ms) · normal(300ms) · slow(500ms). Curves: ease-out (enter) · ease-in (exit) · ease-in-out (expand) · spring (toasts).

Rules: CSS-first only. **Functional motion** — animation indicates processing, state change, or spatial relationship. Never decorative. Agent pulse dot is the only looping animation. The system feels alive through *content change* (ActivityIndicator text updates), not gratuitous effects. Respect `prefers-reduced-motion`.

---

## 10. Accessibility

Contrast: WCAG 2.1 AA (4.5:1 body, 3:1 large). Glass → solid fallback. Keyboard: Tab-navigable, `2px solid var(--color-brand)` focus ring, Escape closes overlays. Screen readers: `aria-label` on tiles, `role="status"` on badges, `aria-live="polite"` on agent cards. Reduced transparency: glass → solid surface.

---

## 11. Implementation

| Layer | Stack |
|-------|-------|
| Framework | React 18+ (hooks) |
| Styling | CSS custom properties + Tailwind |
| Font | Inter (Google Fonts), SF Mono (system) |
| Icons | Lucide React (24px) |
| Charts | Recharts |
| Motion | CSS transitions + @keyframes |

Build: Tokens → Reset → Primitives → Cards → DataTable → AgentCard + ActivityIndicator → Waterfall → Shell → Nav → Toast → Pages → Motion pass. Naming: CSS `--category-name`, components PascalCase, classes BEM `asoe-*`. No inline styles in production.

---

## 12. Anti-Patterns & Quality Gates

| Anti-Pattern | Correct Pattern |
|---|---|
| Brand blue on data, links, badges, borders, confidence bars | Neutrals everywhere except CTA, logo, active tab |
| Static dashboard for a dynamic system | Activity indicators, progression, dynamic descriptions |
| AI behind "Analysis" tab | Agent output central by default |
| Linear workflow for parallel exceptions | Full queue with parallel threads |
| Black-box "Auto-Override recommended" | Structured evidence on demand (L2) |
| Chat-style agent interface | AgentReasoningCard with conclusion + actions |
| Emoji as icons | Lucide icons |
| Solid-fill status badges at rest | Tinted bg + colored text |
| Hardcoded hex values | CSS tokens only |
| Source-based organization (by module) | Intent-based (by urgency, outcome) |

### Quality Gate

- [ ] **Alive:** System visibly active without input (pulse dot, activity indicator, progression)
- [ ] **Intervene:** User can act at any step inline — no navigation away
- [ ] **Traceable:** Agent reasoning available on demand (Layer 2), structured not chat
- [ ] **Decided:** Recommended action + alternatives + trade-offs on every agent surface
- [ ] **Parallel:** Multiple exceptions visible simultaneously
- [ ] **Blue ≤3:** Brand color only on CTA buttons, nav logo, active tab
- [ ] **Neutral:** Buttons, badges, confidence bars, selected states — all gray/neutral
- [ ] **Tokens:** Zero hardcoded hex. All CSS custom properties
- [ ] **Accessible:** 4.5:1 contrast, motion-safe, keyboard-navigable, focus visible
- [ ] **Type:** Max 3 weights, ≥10px, mono for numerics (SF Mono preferred)
- [ ] **Cards:** Shadow not borders. Agent card = shadow, not color stripe

---

## 13. Glossary

| Term | Definition |
|------|-----------|
| Agent-First Design | Paradigm where AI is primary actor, human guides and intervenes |
| System in Motion | UI reflecting ongoing agent activity, not static end-states |
| Inline Intervention | Acting directly in context without navigating to a separate surface |
| Activity Indicator | Dynamic text describing agent work in progress, replacing static labels |
| Two-Layer Cognition | L1 (executive summary) + L2 (deep dive) for agent-facing views |
| Brand Restraint | Limiting brand accent to ≤3 element types per screen |
| Intelligent Escalation | Agent involves humans based on confidence/risk with clear rationale |
| Legible Reasoning | Structured, traceable agent logic — never raw chain-of-thought |
| Intent-Based Organization | Grouping by task/outcome/urgency, not by data source |
| Parallel Visibility | Showing multiple concurrent agent threads simultaneously |
| Progressive Disclosure | Summary first, detail on demand — user controls depth |
| Semantic Color | Color assigned by meaning (success/warning/error), not visual name |
| Design Token | Named CSS custom property storing a single design decision |
| Elevation | Visual depth via box-shadow, distinguishing surface layers |
| Mono Register | Fixed-width typography (SF Mono) for precise data values |
