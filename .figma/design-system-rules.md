# ASOE Design System Rules — Figma Integration

Rules for translating Figma designs into ASOE UI code via the Figma MCP.

---

## 1. Token Definitions

All visual values are defined as CSS custom properties in a single file:

- **File:** `src/styles/design-tokens.css`
- **Format:** CSS `:root` custom properties (e.g. `--color-brand: #5A4BD6`)
- **No token transformation pipeline** — tokens are consumed directly via `var(--token-name)`

### Key Token Categories

| Category | Prefix | Examples |
|---|---|---|
| Typography | `--font-size-*`, `--font-weight-*`, `--line-height-*` | `--font-size-body: 13px`, `--font-weight-heading: 700` |
| Font stacks | `--font-sans`, `--font-mono` | SF Pro / Inter, SF Mono / JetBrains Mono |
| Brand colors | `--color-brand*` | `--color-brand: #5A4BD6`, `--color-brand-ring: rgba(90,75,214,0.25)` |
| Surfaces | `--color-surface-*` | `--color-surface-page: #FAFAFA`, `--color-surface-primary: #FFFFFF` |
| Text | `--color-text-*` | `--color-text-primary: #111118`, `--color-text-secondary: #4A4A5A` |
| Borders | `--color-border-*` | `--color-border-default: #E2E2EA` |
| Status | `--color-success*`, `--color-warning*`, `--color-error*`, `--color-info*` | `--color-success: #00B860` |
| Spacing | `--space-*` | `--space-4: 4px` through `--space-64: 64px` (4px base) |
| Shadows | `--shadow-*` | `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl` |
| Radii | `--radius-*` | `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 14px` |
| Motion | `--dur-*`, `--ease-*` | `--dur-instant: 100ms`, `--ease-out: cubic-bezier(0.16,1,0.3,1)` |
| Layout | `--nav-height`, `--sidebar-width`, `--page-max-width` | `56px`, `480px`, `1440px` |

### CRITICAL RULE: No Hardcoded Values

When generating code from Figma designs, **never** use raw hex colors, pixel sizes, or font values. Always map to the closest design token:

```tsx
// WRONG
style={{ color: "#5A4BD6", padding: "16px", fontSize: "13px" }}

// CORRECT
style={{ color: "var(--color-brand)", padding: "var(--space-16)", fontSize: "var(--font-size-body)" }}
```

---

## 2. Component Library

- **Location:** `src/components/ui/`
- **Architecture:** One component per file, named exports matching filename
- **Styling:** Inline `style` objects using CSS custom properties (not Tailwind utility classes for token values)
- **Interactivity:** `"use client"` directive on all interactive components

### Available Components

| Component | File | Purpose | Key Props |
|---|---|---|---|
| `Button` | `Button.tsx` | Action trigger | `variant`: brand/neutral/success/ghost/destructive, `size`: sm/md/lg, `loading`, `fullWidth` |
| `Badge` | `Badge.tsx` | Status indicator (icon + text) | `variant`: success/warning/error/info/neutral/brand, `icon`, `size` |
| `Card` | `Card.tsx` | Content container | `elevated` (boolean) |
| `Input` | `Input.tsx` | Text input with label/error | `label`, `error`, `rightIcon` |
| `Logo` | `Logo.tsx` | Brand mark | `size`: sm/md/lg, `showTagline` |
| `NavBar` | `NavBar.tsx` | Top navigation | `tabs`, `activeTab`, `agentCount`, `userName` |
| `MetricTile` | `MetricTile.tsx` | KPI display | `icon`, `label`, `value`, `subtitle`, `tint` |
| `Toast` | `Toast.tsx` | Auto-dismiss notification | `variant`: success/warning/error/info, `message` |
| `Sidebar` | `Sidebar.tsx` | 480px slide-right panel | `open`, `onClose`, `title` |
| `AgentReasoningCard` | `AgentReasoningCard.tsx` | Two-layer cognition | `verdict`: GREEN/YELLOW/RED, `confidence`, `explanation` |
| `WaterfallStepper` | `WaterfallStepper.tsx` | Pipeline progress | `nodes[]` with status per node |
| `PricingWaterfall` | `PricingWaterfall.tsx` | Pricing condition timeline | `steps[]` with type/label/value |
| `ActivityIndicator` | `ActivityIndicator.tsx` | Domain-aware loading | `node` (pipeline node), `intent` |
| `GravitationalOrbs` | `GravitationalOrbs.tsx` | Canvas animated background | (no props — login page only) |

### Reuse Rules

When translating a Figma design to code:
1. **Always check** if an existing component matches the design element
2. **Prefer existing components** over creating new ones
3. **Use variant props** to achieve visual differences — do not fork components
4. Badge variant helpers: `verdictVariant()`, `lifecycleVariant()`, `rootCauseVariant()`, `categoryVariant()`, `inboxStatusVariant()`

---

## 3. Frameworks & Libraries

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript 5.7 |
| Styling | CSS custom properties (design tokens) + Tailwind CSS 3.4 (utility) |
| Icons | Lucide React (`lucide-react`) |
| Layout | `react-resizable-panels` for master-detail panes |
| Build | Next.js built-in (Webpack/Turbopack) |

---

## 4. Asset Management

- **Icons:** Lucide React library — imported individually (e.g. `import { Check } from "lucide-react"`)
- **Images:** No static image assets — the UI is data-driven
- **Fonts:** System font stack (SF Pro / Inter) loaded via CSS `--font-sans`

---

## 5. Icon System

- **Library:** `lucide-react` (MIT licensed, consistent 24x24 grid)
- **Import pattern:** Named imports from `lucide-react`
- **Sizing:** Use `size` prop (default 24, commonly 12/14/16/18/20)
- **Color:** Inherits from parent via `currentColor`, or set via `color` prop

```tsx
import { Check, AlertTriangle, ShieldX } from "lucide-react";

<Check size={14} />
<AlertTriangle size={16} color="var(--color-warning)" />
```

### Icon Selection for Status

| Status | Icon | Usage |
|---|---|---|
| Success/Approved | `Check` | Badge, WaterfallStepper |
| Warning/Review | `AlertTriangle` | Badge, AgentReasoningCard |
| Error/Blocked | `ShieldX` | Badge, AgentReasoningCard |
| Info | `Info` | Badge, Toast |
| Neutral/Pending | `Clock` | Badge |
| Brand/Active | `Zap` | Badge, AgentReasoningCard |

---

## 6. Styling Approach

### Primary: CSS Custom Properties via Inline Styles

Components use inline `style` objects referencing design tokens:

```tsx
<div style={{
  background: "var(--color-surface-primary)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-sm)",
  padding: "var(--space-16)",
}}>
```

### Secondary: Tailwind CSS

Tailwind is available for layout utilities (`flex`, `grid`, `gap-*`, `w-full`) but **NOT** for design token values. Never use Tailwind color classes (`bg-purple-600`) — always use `var(--color-*)`.

### Global Styles

- `src/styles/design-tokens.css` — all tokens + utility classes (`.mono-data`, `.label`, `.glass`, `.skeleton`)
- `src/app/globals.css` — Tailwind directives + minimal resets

### Utility CSS Classes

| Class | Purpose |
|---|---|
| `.mono-data` | Monospace data display (prices, quantities) |
| `.mono-sm` | Small monospace (SAP codes, IDs) |
| `.mono-metric` | Large monospace (metric tiles) |
| `.label` | Uppercase structural labels |
| `.glass` | Frosted glass surface |
| `.skeleton` | Loading skeleton pulse |
| `.agent-active-dot` | Green pulsing status dot |

---

## 7. Project Structure

```
src/
  app/                    # Next.js App Router pages
    layout.tsx            # Root layout
    page.tsx              # Root redirect
    login/page.tsx        # Login page
    exceptions/page.tsx   # Exception Queue (main page)
    dashboard/page.tsx    # Analytics dashboard
    inbox/page.tsx        # Customer Inbox
  components/ui/          # Reusable design system components
  hooks/                  # Custom React hooks
  lib/                    # API client, auth, RBAC
  types/                  # TypeScript type definitions
  styles/                 # Design tokens CSS
```

### Page Layout Patterns

| Pattern | Pages | Structure |
|---|---|---|
| Three-pane Outlook | `/exceptions` | NavBar + resizable list pane (35%) + detail pane (65%) |
| Two-pane | `/inbox` | NavBar + list pane (380px) + detail pane (flex) |
| Dashboard grid | `/dashboard` | NavBar + metrics strip + 2-column card grid |
| Centered card | `/login` | Full-screen canvas background + centered form card |

---

## 8. Design Philosophy

### Brand Restraint

Purple brand color (`#5A4BD6` / `var(--color-brand)`) appears in **exactly 3 places**:
1. Primary action buttons (`Button variant="brand"`)
2. Logo icon background
3. Active tab underline

95%+ of pixels are neutral grays. Do not add brand color to new surfaces.

### Agent-First Paradigm

The UI renders a system that is already working. Design elements should convey:
- **Agent activity** (pulse dots, progress steppers, activity indicators)
- **System status** visible everywhere
- **Two-layer cognition** on every detail view (Layer 1: summary, Layer 2: evidence)

### Two-Layer Cognition

Every exception detail surface must use the `AgentReasoningCard` pattern:
- **Layer 1 (always visible):** Recommendation, confidence, 2-3 key data points, action button
- **Layer 2 (expandable):** Evidence waterfall, structured reasoning trace

### Accessibility (WCAG AA)

- Status never conveyed by color alone (always icon + text label)
- All interactive elements keyboard-navigable
- Focus ring: `2px solid var(--color-brand-ring)`
- `aria-live="polite"` on dynamic content
- `role="dialog"` + `aria-modal="true"` on panels/modals

---

## 9. Component Anatomy Patterns

### Cards
- Background: `var(--color-surface-primary)` (white)
- Border: **none** (borderless design — use shadow for elevation)
- Shadow: `var(--shadow-sm)` default, `var(--shadow-lg)` elevated
- Radius: `var(--radius-md)` default, `var(--radius-lg)` elevated

### Buttons
- 5 variants: brand (purple), neutral (bordered), success (green), ghost (transparent), destructive (red)
- 3 sizes: sm (32px), md (36px), lg (40px)
- Loading state replaces children with spinner
- Always `border-radius: var(--radius-md)`

### Badges
- Tinted background + colored text (not solid fill)
- Always include icon + text (WCAG: status not color-alone)
- Pill shape: `border-radius: var(--radius-full)`
- Use variant mapper functions to convert API strings to variants

### Inputs
- Height: 40px
- Border: `1px solid var(--color-border-default)`
- Focus: brand-colored border + ring glow
- Label: uppercase, `--font-size-label`, `--color-text-tertiary`
