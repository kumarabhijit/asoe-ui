# ASOE UI Design System

Design system, skills, and reference implementation for the ASOE (Agentic System of Engagement) platform UI.

## Repository Structure

```
asoe-ui/
├── prompts/
│   └── asoe-ui-design-system.md      # Reproducible prompt for regenerating the design system
├── skills/
│   └── asoe-ui-design/
│       ├── SKILL.md                   # Core design system skill (310 lines)
│       └── references/
│           ├── design-tokens.css      # CSS custom properties — colors, spacing, shadows, motion
│           ├── component-patterns.md  # Component anatomy, spacing, behavior specs
│           ├── layout-templates.md    # Page layouts, grid specs, ASCII mockups
│           └── anti-patterns.md       # 13 "never do this" patterns with code examples
├── samples/
│   └── asoe-sample-screen.jsx        # Reference implementation — Exception Resolution Queue
└── README.md
```

## Design Principles

### Agent-First (Not Dashboard-First)

ASOE is a living system the user guides, not a dashboard the user operates. AI agents are the primary actors. The human is the decision authority who intervenes at key moments.

### Brand Restraint

Brand blue (`#007AFF`) appears in exactly 3 places: primary CTA buttons, the nav logo mark, and the active tab indicator. Everything else is neutral. 95%+ of screen pixels are grays.

### Two-Layer Cognition

- **Layer 1 (default):** Agent recommendation, confidence, 2–3 data points, action button. Scannable in <3 seconds.
- **Layer 2 (expandable):** Evidence waterfall, structured reasoning, precedents. On demand only.

## Usage

### As a Claude Skill

Copy `skills/asoe-ui-design/` into your Claude project's skills directory. The skill will trigger automatically when building any ASOE UI screen.

### Regenerating the Design System

Use `prompts/asoe-ui-design-system.md` as a session prompt to reproduce or extend the design system from scratch.

### Reference Implementation

`samples/asoe-sample-screen.jsx` is a working React component demonstrating the Exception Resolution Queue with all design system patterns applied.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18+ |
| Styling | CSS custom properties + Tailwind |
| Sans Font | SF Pro Display → Inter (Google Fonts fallback) |
| Mono Font | SF Mono → JetBrains Mono (Google Fonts fallback) |
| Icons | Lucide React |
| Charts | Recharts |
