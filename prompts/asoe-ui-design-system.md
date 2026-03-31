# ASOE UI Design System — Session Prompt

> **Purpose:** This prompt reproduces the design session that created the ASOE UI Design System skill (`asoe-ui-design`). Use it to regenerate, extend, or refine the design system from first principles.
>
> **Output:** A complete SKILL.md (≤500 lines) + 4 reference files (design-tokens.css, component-patterns.md, layout-templates.md, anti-patterns.md)

---

## Context

You are an expert UI designer building a design system for ASOE (Agentic System of Engagement) — an AI-powered B2B order management exception resolution platform for CPG enterprises. ASOE's core value proposition is autonomous exception management where AI agents and humans collaborate to take action across enterprise systems (SAP ECC 6.0 / S/4HANA).

The platform has 6 module-level agents + a cross-cutting Agentic Command Center with a conversational AI named Lily. It handles 11 exception types with a structured autonomy matrix (L1–L4 tiers) governing when agents act independently vs. escalate to humans.

**Naming rule:** The product is called ASOE. Never use PRISM as the product name anywhere.

---

## Design Requirements

### 1. Agent-First Paradigm (Not Dashboard-First)

ASOE is a living system the user guides, not a dashboard the user operates. The AI agents are primary actors — they detect, diagnose, recommend, and execute. The human is the decision authority who intervenes at key moments. Every screen must reflect this:

- **The System Is Alive** — agents process continuously; the UI shows activity, progression, dynamic descriptions (not static labels)
- **Human as Intervener** — users step in at decision points, not at every step
- **Inline Intervention** — act in-place, no navigation away; sidebar + expanded rows + in-row buttons
- **Decision-Oriented** — every agent surface shows: recommended action + alternatives + trade-offs
- **Legible Reasoning** — agent logic traceable on demand (structured, never chat)
- **Intelligent Escalation** — based on confidence/risk, with clear rationale
- **Parallel Visibility** — multiple exception threads visible simultaneously
- **Traceability & Continuity** — full audit trail, context preserved between sessions
- **Intent-Based Organization** — group by urgency/outcome, not by data source/module
- **Interruptibility** — agent processes can be paused, redirected mid-execution

### 2. Visual Design Principles

Apply these core principles (do NOT attribute them to any specific company or design system by name):

- **Clarity** — the interface disappears, leaving only content and decisions
- **Deference** — chrome recedes so data and agent recommendations lead
- **Depth** — layered elevation and translucency create natural hierarchy
- **Consistency** — identical patterns everywhere compound user trust

### 3. Color & Brand Rules

- **Light mode only.** No dark mode.
- **Brand color: `#007AFF`** (system blue) — used with EXTREME restraint:
  - Appears in exactly 3 places: primary CTA buttons, nav logo mark, active tab underline
  - Everything else is neutral grays
  - 95%+ of screen pixels are grays/neutrals
  - PO numbers, breadcrumbs, links, selected rows, confidence bars, agent card accents, badges → ALL neutral, never blue
  - Neutral buttons use `--color-text-secondary` (gray), NOT brand blue
  - Agent cards are distinguished by shadow elevation, NOT colored accent stripes
  - If more than 3 distinct blue elements are visible on screen, strip the excess to neutral

### 4. Typography

- **Sans stack:** `"SF Pro Display", "SF Pro Text", "Inter", ui-sans-serif, system-ui, sans-serif`
- **Mono stack:** `"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace`
  - SF Mono is preferred — ~10–15% narrower than JetBrains Mono, critical for dense price columns
  - SF Mono ships with macOS/iOS; JetBrains Mono loads from Google Fonts as cross-platform fallback
- **Inter** is the primary web fallback for sans — load weights 400, 500, 600, 700
- All numeric data (prices, quantities, PO numbers, SAP codes) uses monospace
- Max 3 font weights per screen (400/600/700)
- No font size below 10px
- Left-align everything (center only in metric tiles and empty states)

### 5. Component Requirements

Build a component library with these components at minimum:

- NavBar (glass surface, 56px sticky, brand logo only blue element)
- MetricTile (icon + label + value + subtitle, neutral icon backgrounds)
- Card (borderless, shadow creates separation)
- DataTable (expandable rows, no vertical borders, mono numerics, right-aligned numbers)
- Badge / Pill (muted tint + colored text, never solid-fill at rest; "Audited" = slate gray)
- Button (5 variants: brand/neutral/success/ghost/destructive — only `brand` is blue)
- AgentReasoningCard (recommendation + confidence + actions; shadow not color; gray confidence bar)
- ActivityIndicator (dynamic text replacing static labels — "Agent analyzing 3 condition records…")
- WaterfallStepper (vertical timeline for pricing audit / execution log)
- Sidebar (480px detail panel, slides from right, inline intervention surface)
- Toast (4.5s auto-dismiss, status-colored — only solid-fill element)
- TabBar (active = blue underline only, text = textPrimary not brand)

### 6. Two-Layer Cognition Model

Every agent-facing view:
- **Layer 1 (default):** Executive summary — recommendation, confidence, 2–3 data points, action button. Scannable in <3 seconds.
- **Layer 2 (expandable):** Deep dive — evidence waterfall, reasoning chain (structured), precedents, raw signals. On demand only.

### 7. Structure Requirements

Follow the ASOE skills template:
- YAML frontmatter with `name` (kebab-case) and `description` (≤1024 chars)
- 12–13 section body architecture
- Core SKILL.md ≤500 lines
- Heavy content extracted to `references/` subdirectory:
  - `design-tokens.css` — full CSS custom property definitions
  - `component-patterns.md` — component anatomy, spacing, behavior specs
  - `layout-templates.md` — page composition, grid specs, ASCII mockups
  - `anti-patterns.md` — explicit "never do this" gallery with code examples

---

## Prompt

Using the requirements above, create the complete ASOE UI Design System:

1. Write `SKILL.md` (≤500 lines) with these sections:
   - Overview, Design Philosophy (agent-first + visual), Token Architecture, Color System, Typography, Component Library, Layout & Interaction, Data Density Patterns, Motion, Accessibility, Implementation Guide, Anti-Patterns & Quality Gates, Glossary

2. Write `references/design-tokens.css` — every CSS custom property with exact values

3. Write `references/component-patterns.md` — full anatomy specs for every component

4. Write `references/layout-templates.md` — page layouts with ASCII mockups, grid specs, responsive rules

5. Write `references/anti-patterns.md` — 13 anti-patterns with wrong/right code examples, including "Overusing Brand Blue" as #1

After creating the skill files, build a sample screen (React JSX artifact) implementing the Exception Resolution Queue — the flagship ASOE screen — demonstrating every pattern from the design system. The screen should include: glass nav bar, metric tiles, expandable data table with line items, detail sidebar with agent reasoning card and pricing waterfall. Enforce brand restraint (blue in ≤3 element types).

---

## Verification Checklist

After generation, verify:

- [ ] SKILL.md ≤500 lines
- [ ] YAML `description` ≤1024 characters
- [ ] No "PRISM" anywhere in any file
- [ ] No "Apple" or "HIG" or "Human Interface" attribution in SKILL.md
- [ ] Brand color `#007AFF` appears in ≤3 element types in sample screen
- [ ] All 13 sections present in SKILL.md
- [ ] SF Mono first in mono font stack
- [ ] Agent-first concepts present: System Is Alive, Human as Intervener, Inline Intervention, Intelligent Escalation, Legible Reasoning, Parallel Visibility, Activity Indicator, Intent-based, Traceability, Interruptibility
- [ ] Neutral buttons use `--color-text-secondary`, not brand
- [ ] Agent card uses shadow elevation, not color accent
- [ ] No emoji as icons in production code

---

## Reference Documents

This prompt was derived from the following source materials:

1. **Agent-First UI Design Skills** — Defines the paradigm shift from dashboard-first to agent-first design, covering systems thinking, agent-centric design, interaction design, information design, intelligence visibility, visual design, and system behavior.

2. **Application Design Framework** — The ASOE agentic AI-first design framework defining the two-layer cognition model, autonomy levels, evidence-first patterns, and the "senior analyst supporting an executive" relationship model.

3. **Existing ASOE Pricing Agent (Salesforce-style)** — The pre-redesign reference implementation (`cpg-price-agent-sf.jsx`) showing what to evolve away from: emoji icons, dense Salesforce grids, heavy colored borders, blue-everywhere palette, chat-style agent interaction.
