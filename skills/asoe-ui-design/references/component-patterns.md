# ASOE Component Patterns

Detailed anatomy, spacing, and behavioral specs for every component in the ASOE design system. Referenced from SKILL.md Section 6.

---

## NavBar

The persistent top navigation bar. Uses glass surface for depth.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [Logo Mark] ASOE  │  [Module Nav]           │ [Agent Status] [User Avatar] │
│  32×32 icon  14px │  text links, 13px/600   │   dot + label    32×32       │
│                   │  active: brand color     │                              │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Height**: `var(--nav-height)` = 56px
- **Background**: `var(--color-surface-glass)` + `backdrop-filter: blur(var(--blur-glass))`
- **Border**: `border-bottom: 1px solid var(--color-border-subtle)`
- **Position**: `sticky`, `top: 0`, `z-index: var(--z-sticky)`
- **Padding**: `0 var(--space-24)`
- **Layout**: Flexbox, `align-items: center`, 3 zones (left/center/right)
- **Logo mark**: 32×32px rounded square with brand color background, white icon
- **Product name**: `font-size: 14px`, `font-weight: 700`, `color: var(--color-text-primary)`
- **Agent status**: Green pulse dot (`.agent-active-dot`) + "AGENT LIVE" in `font-label` style
- **User avatar**: 32×32px circle, initials, `background: var(--color-surface-secondary)`

### States
- **Scrolled**: Add `var(--shadow-sm)` when page is scrolled

---

## MetricTile

KPI display: icon → label → value → subtitle. Used in the metrics strip.

```
┌──────────────────────────────────────┐
│  ┌──────┐                            │
│  │ ICON │  OPEN HOLDS                │
│  │40×40 │  6                         │
│  └──────┘  Pending diagnosis         │
└──────────────────────────────────────┘
```

- **Container**: `background: var(--color-surface-primary)`, `border-radius: var(--radius-md)`, `box-shadow: var(--shadow-sm)`, `padding: var(--space-20)`
- **Layout**: Flexbox, `gap: var(--space-16)`, `align-items: flex-start`
- **Icon container**: 40×40px, `border-radius: var(--radius-md)`, tinted background matching category
- **Label**: `.label` class (10px, uppercase, tracked, tertiary)
- **Value**: `font-family: var(--font-mono)`, `font-size: var(--font-size-mono-metric)`, `font-weight: 700`, `color: var(--color-text-primary)`
- **Subtitle**: `font-size: var(--font-size-caption)`, `color: var(--color-text-tertiary)`

### States
- **Hover**: `box-shadow: var(--shadow-md)`, `transform: translateY(-1px)`, transition `var(--dur-instant)`

---

## Card

The primary content container. Two variants: standard and elevated.

### Standard Card

```
┌──────────────────────────────────────────────────────┐
│  Card Header (optional)                    [Action]  │
│─────────────────────────────────────────────────────│
│                                                      │
│  Card Body Content                                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- **Container**: `background: var(--color-surface-primary)`, `border-radius: var(--radius-md)`, `box-shadow: var(--shadow-sm)`
- **Border**: None by default. Add `border: 1px solid var(--color-border-default)` only when cards are edge-to-edge with no gap.
- **Header**: `padding: var(--space-16) var(--space-20)`, `border-bottom: 1px solid var(--color-border-subtle)`, flexbox with title left and action right
- **Header title**: `font-size: var(--font-size-subhead)`, `font-weight: 600`
- **Header icon**: Lucide icon, `var(--icon-md)`, `color: var(--color-text-tertiary)`, `margin-right: var(--space-8)`
- **Body**: `padding: var(--space-20)`
- **No-padding variant**: Remove body padding for tables/lists that go edge-to-edge inside card

### Elevated Card (Agent Card, Sidebar panels)

Same as standard but:
- `box-shadow: var(--shadow-md)`
- On hover: `box-shadow: var(--shadow-lg)`
- Used for content that needs visual prominence

---

## Badge / Pill

Two variants: flat badge (categorical) and status pill (with dot indicator).

### Flat Badge (for root cause, category labels)

```
[ ⬤ Label Text ]
```

- **Container**: `display: inline-flex`, `align-items: center`, `gap: var(--space-4)`, `padding: 2px 8px`, `border-radius: var(--radius-sm)`, `border: 1px solid {color}20`
- **Background**: Category subtle color (e.g., `var(--color-cat-purple-subtle)`)
- **Text**: `font-size: var(--font-size-label)`, `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: 0.02em`, category solid color
- **Icon**: Lucide icon at 12px, not emoji

### Status Pill (for order/line status)

```
( ● Status Text )
```

- Same as badge but `border-radius: var(--radius-full)` (pill shape)
- Includes 6px dot: `width: 6px`, `height: 6px`, `border-radius: var(--radius-full)`, `background: {status-color}`
- **Padding**: `3px 10px`

---

## Button

Five semantic variants. Three sizes.

### Variants

| Variant       | Background                   | Text                        | Border                        |
|--------------|------------------------------|-----------------------------|-----------------------------|
| `brand`       | `var(--color-brand)`         | `var(--color-text-inverse)` | none                         |
| `neutral`     | `var(--color-surface-primary)` | `var(--color-text-secondary)` | `1px solid var(--color-border-default)` |
| `success`     | `var(--color-success)`       | `var(--color-text-inverse)` | none                         |
| `ghost`       | `transparent`                | `var(--color-text-tertiary)` | none                        |
| `destructive` | `var(--color-error)`         | `var(--color-text-inverse)` | none                         |

### Sizes

| Size | Height | Padding        | Font Size | Font Weight |
|------|--------|---------------|-----------|-------------|
| `sm` | 32px   | `6px 12px`    | 12px      | 600         |
| `md` | 36px   | `8px 16px`    | 13px      | 600         |
| `lg` | 40px   | `10px 20px`   | 14px      | 600         |

### Common Properties

- `border-radius: var(--radius-md)`
- `font-family: var(--font-sans)`
- `cursor: pointer`
- `transition: all var(--dur-instant) var(--ease-out)`
- `display: inline-flex`, `align-items: center`, `gap: var(--space-6)`

### States

- **Hover**: Darken background by one step (e.g., brand → brand-hover)
- **Active/Pressed**: Darken by two steps + `transform: scale(0.98)`
- **Disabled**: `opacity: 0.4`, `cursor: not-allowed`, `pointer-events: none`
- **Focus**: `outline: 2px solid var(--color-brand)`, `outline-offset: 2px`
- **Loading**: Replace label with 16px spinner, maintain button width

---

## DataTable

The workhorse component for order queues and line item displays.

### Structure

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER ROW                                                  │
│  label · label · label · label · label · label      actions  │
├──────────────────────────────────────────────────────────────┤
│  DATA ROW (clickable, expandable)                            │
│  value · value · value · value · value · [badge]    [button] │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  EXPANDED CHILD ROWS (line items)                        ││
│  │  sub-header row                                          ││
│  │  child row 1                                             ││
│  │  child row 2                                             ││
│  │  summary footer row                                      ││
│  └──────────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────┤
│  DATA ROW 2 (collapsed)                                      │
└──────────────────────────────────────────────────────────────┘
```

### Spacing

- **Header row**: `padding: 8px var(--space-16)`, `background: var(--color-surface-secondary)`, `border-bottom: 1px solid var(--color-border-default)`
- **Header text**: `.label` class
- **Data row**: `padding: 12px var(--space-16)`, `border-bottom: 1px solid var(--color-border-subtle)`
- **Child row**: `padding: 10px var(--space-16) 10px 48px` (indented by 48px to clear expand chevron)
- **Summary footer**: `padding: 10px var(--space-16) 10px 48px`, `background: var(--color-surface-secondary)`, `border-top: 1px solid var(--color-border-default)`

### Behavior

- **Row hover**: `background: var(--color-surface-row-hover)`
- **Row selected**: `background: var(--color-surface-row-active)`, left border `3px solid var(--color-brand)`
- **Expand chevron**: 12px, rotates 90° on expand, `transition: transform var(--dur-fast)`
- **No vertical borders.** Horizontal dividers only.
- **Numeric columns right-aligned.** Text columns left-aligned.
- **Monospace for all numeric data.**

---

## AgentReasoningCard

The agent's structured recommendation surface. Always follows the two-layer cognition model. Distinguished by **elevation, not color** — no blue accent stripe.

```
┌──────────────────────────────────────────────────────────┐
│  [icon] Agent Recommendation                 [HIGH Risk] │ ← shadow-md elevation
│                                                          │
│  "Summary diagnosis text from the agent — 1-2            │ ← Layer 1
│   sentences, clear conclusion, not reasoning."           │
│                                                          │
│  Confidence: ████████░░ 92%     Resolution: Auto         │ ← gray bar, not blue
│                                                          │
│  [ ⚡ Execute Agent Action ]  [ Override ]  [ Escalate ] │ ← only the primary CTA is blue
│                                                          │
│  ▸ View Evidence & Reasoning              (expandable)   │ ← Layer 2 trigger
└──────────────────────────────────────────────────────────┘
```

- **Container**: `background: var(--color-surface-primary)`, `border-radius: var(--radius-md)`, `box-shadow: var(--shadow-md)`. NO colored left border.
- **Padding**: `var(--space-20)`
- **Icon container**: 28×28px, `border-radius: var(--radius-sm)`, `background: var(--color-surface-secondary)`, icon in `var(--color-text-secondary)` — NOT brand blue
- **Recommendation text**: `font-size: var(--font-size-body)`, `color: var(--color-text-secondary)`, `line-height: var(--line-height-body)`
- **Confidence bar**: 120px wide, 4px tall, rounded, fill = `var(--color-text-secondary)` (gray, NOT brand blue)
- **Confidence value**: `font-mono`, `color: var(--color-text-primary)` (NOT brand blue)
- **Resolution badge**: Status pill style (success/warning/slate — never brand blue)
- **Action buttons**: Primary CTA = `brand` variant (the ONLY blue on the card), secondary = `neutral` (gray text), tertiary = `ghost` (gray text)
- **Expand trigger**: Full-width clickable, `font-size: var(--font-size-caption)`, `color: var(--color-text-tertiary)`

### Layer 2 (Expanded)

Shows below the trigger:
- Evidence bullets with Lucide icons
- Precedent references
- Raw signal scores in a mini-table
- Full agent reasoning text in `var(--color-text-tertiary)`

---

## WaterfallStepper

Vertical timeline for pricing audit trails and agent execution logs.

```
    ◎──── Base Price (PR00)               $14.88    = $14.88
    │     SAP list price, material 0042
    │
    ⏱──── TPR Discount (ZPROM)           -$1.68    = $13.20
    │     Q4 promo: 11.3% off, valid 10/01–12/31
    │
    ✕──── ERROR: Promo Expired                      
    │     ┌──────────────────────────────────────┐
    │     │ ROOT CAUSE: Condition ZPROM expired  │
    │     │ on 12/31. PO received 01/05.         │
    │     └──────────────────────────────────────┘
    │
    ✓──── Result                          $14.88    = $14.88
          ERP computed price (promo not applied)
```

### Step Anatomy

- **Timeline rail**: 1px vertical line, `var(--color-border-default)`, positioned at left edge of dot column
- **Dot**: 32px circle, `border: 2px solid {step-color}`, white fill, centered icon (Lucide, 14px)
- **Content card**: `padding: 10px var(--space-12)`, `background: var(--color-surface-secondary)`, `border-radius: var(--radius-sm)`, `margin-bottom: var(--space-8)`
- **Step label**: `font-size: var(--font-size-body)`, `font-weight: 700`
- **Condition record**: `.mono-sm` class, `background: var(--color-surface-secondary)`, `padding: 1px 6px`, `border-radius: 3px`
- **Value**: `.mono-data` class, right-aligned
- **Running total**: `.mono-sm` class, `color: var(--color-text-tertiary)`
- **Detail text**: `font-size: var(--font-size-caption)`, `color: var(--color-text-tertiary)`, `line-height: 1.55`

### Step Types & Colors

| Type     | Dot Color                | Card Background              |
|----------|-------------------------|------------------------------|
| BASE     | `var(--color-brand)`    | `var(--color-surface-secondary)` |
| CONTRACT | `var(--color-cat-purple)` | `var(--color-surface-secondary)` |
| TPR      | `var(--color-cat-amber)` | `var(--color-surface-secondary)` |
| UOM      | `var(--color-cat-teal)` | `var(--color-surface-secondary)` |
| RESULT   | `var(--color-success)`  | `var(--color-success-subtle)` |
| ERROR    | `var(--color-error)`    | `var(--color-error-subtle)`   |

### Error Step Callout

- `background: var(--color-error-subtle)`, `border: 1px solid var(--color-error-border)`, `border-radius: var(--radius-sm)`, `padding: var(--space-8) var(--space-12)`
- "ROOT CAUSE" label: `font-weight: 800`, `color: var(--color-error)`

---

## Toast

Transient notification. Appears top-right, auto-dismisses after 4.5 seconds.

```
┌──────────────────────────────────────────┐
│  ✓  Audit Complete                   [×] │
│     PO-88421: Auto-Override · LOW Risk   │
└──────────────────────────────────────────┘
```

- **Position**: `fixed`, `top: var(--space-16)`, `right: var(--space-16)`, `z-index: var(--z-toast)`
- **Container**: `width: 360px`, `border-radius: var(--radius-md)`, `box-shadow: var(--shadow-lg)`, `padding: var(--space-12) var(--space-16)`
- **Background**: Status color (success/warning/error/info)
- **Text**: `var(--color-text-inverse)`
- **Title**: `font-weight: 700`, `font-size: var(--font-size-body)`
- **Message**: `font-size: 12px`, `opacity: 0.9`
- **Close button**: 24×24px target area, `opacity: 0.7`, hover `opacity: 1`
- **Enter**: `transform: translateX(100%) → translateX(0)`, `var(--dur-normal)`, `var(--ease-spring)`
- **Exit**: `opacity: 1 → 0`, `var(--dur-fast)`, `var(--ease-in)`

---

## ProgressBar

Horizontal determinate fill bar.

- **Track**: `height: 4px`, `background: var(--color-surface-secondary)`, `border-radius: var(--radius-full)`, `overflow: hidden`
- **Fill**: `height: 100%`, `background: var(--color-brand)`, `border-radius: var(--radius-full)`, `transition: width var(--dur-slow) var(--ease-out)`
- Color variants: pass status color for contextual progress (success for resolution %, warning for at-risk %)

---

## EmptyState

Centered content when no data exists.

```
         ┌─────────┐
         │  ICON   │   48px Lucide icon, tertiary color
         └─────────┘
      No orders on hold
    All exceptions have been      Body text, secondary color
    resolved. Check back later.

       [ Refresh Queue ]          Neutral button
```

- **Container**: `text-align: center`, `padding: var(--space-64) var(--space-32)`
- **Icon**: Lucide, 48px, `color: var(--color-text-tertiary)`
- **Heading**: `font-size: var(--font-size-heading)`, `font-weight: 700`, `margin-top: var(--space-16)`
- **Body**: `font-size: var(--font-size-body)`, `color: var(--color-text-secondary)`, `max-width: 320px`, `margin: var(--space-8) auto var(--space-24)`
- **Action**: `neutral` button variant

---

## SkeletonLoader

Pulsing placeholder shown while data fetches.

- Shape: Match the component being loaded (rectangle for text, circle for avatars, full-width for table rows)
- **Background**: `var(--color-surface-secondary)`
- **Border radius**: `var(--radius-sm)` for text blocks, `var(--radius-full)` for dots/avatars
- **Animation**: `.skeleton` class — `asoe-skeleton-pulse` keyframe, 1.5s loop
- **Height**: Match expected content height (13px for body text lines, 24px for headings, 40px for metric values)
- **Width**: 60–80% of expected content width (never full width — creates a more natural appearance)
