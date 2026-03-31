# ASOE Layout Templates

Page-level composition rules, grid specifications, and layout patterns for every ASOE screen type. Referenced from SKILL.md Section 7.

---

## Page Shell — The Universal Container

Every ASOE page uses this outer shell. No exceptions.

```
┌──────────────────────────────────────────────────────────────────────┐
│  GLASS NAV BAR (56px, sticky)                                        │
│  [Logo] ASOE   │   Module links   │   [● AGENT LIVE]  [JD avatar]   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Page background: var(--color-surface-page)                          │
│  Content area: max-width 1440px, centered                            │
│  Padding: 0 32px                                                     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  PAGE HEADER                                                 │    │
│  │                                                              │    │
│  │  Breadcrumb: Home › Order Management › Price Holds           │    │
│  │                                                              │    │
│  │  [Icon]  Page Title                        [Refresh] [CTA]   │    │
│  │          Subtitle / metadata line                            │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  [Page-specific content below]                                       │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  STATUS BAR (32px, glass, sticky bottom) — optional                  │
│  Connection status · Version · System info                           │
└──────────────────────────────────────────────────────────────────────┘
```

### Page Header Spec

- **Breadcrumb**: `font-size: 12px`, `color: var(--color-text-tertiary)`, current page in `var(--color-text-secondary)`, separator `›` with `margin: 0 var(--space-4)`. Breadcrumb links are gray, NOT brand blue.
- **Icon**: 40×40px rounded square, `var(--color-text-primary)` (dark) background, white Lucide icon 20px. NOT brand blue.
- **Title**: `font-size: var(--font-size-display)`, `font-weight: 700`, `color: var(--color-text-primary)`, `line-height: 1.15`
- **Subtitle**: `font-size: 12px`, `color: var(--color-text-tertiary)`, `margin-top: var(--space-4)`
- **Actions**: Right-aligned, `gap: var(--space-8)`, secondary button + primary CTA
- **Padding**: `var(--space-8) 0` for breadcrumb zone, `var(--space-12) 0` for title zone
- **Background**: `var(--color-surface-primary)` with `border-bottom: 1px solid var(--color-border-default)` and `box-shadow: var(--shadow-xs)`

---

## Layout A — Queue + Sidebar Detail (Primary Pattern)

Used for: exception queues, order hold resolution, any list→detail workflow.

### Without Sidebar (Default)

```
┌──────────────────────────────────────────────────────────────┐
│  METRICS STRIP                                               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │Tile 1│ │Tile 2│ │Tile 3│ │Tile 4│ │Tile 5│ │Tile 6│    │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │
├──────────────────────────────────────────────────────────────┤
│  TAB BAR                                                     │
│  [Orders (6)]  [Root Cause Insights]  [Agent Activity Log]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  CONTENT (full width)                                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Order Card 1 (collapsed)                             │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │ Order Card 2 (expanded with line items)              │    │
│  │   ┌────────────────────────────────────────────────┐ │    │
│  │   │ Line 1 │ Line 2 │ Line 3                      │ │    │
│  │   ├────────────────────────────────────────────────┤ │    │
│  │   │ Summary Footer                                 │ │    │
│  │   └────────────────────────────────────────────────┘ │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │ Order Card 3 (collapsed)                             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### With Sidebar (After Selecting an Order)

```
┌─────────────────────────────────────────────────────────────────────┐
│  METRICS STRIP (same as above, full width)                          │
├─────────────────────────────────────────────────────────────────────┤
│  TAB BAR (same as above, full width)                                │
├──────────────────────────────────┬──────────────────────────────────┤
│                                  │                                  │
│  CONTENT (flex: 1)               │  SIDEBAR (480px fixed)           │
│                                  │                                  │
│  ┌────────────────────────┐      │  ┌────────────────────────┐     │
│  │ Order Card 1           │      │  │ Order Detail Header    │     │
│  ├────────────────────────┤      │  │ PO-88421 · Walmart     │     │
│  │ Order Card 2 ← ACTIVE  │      │  │ Metrics strip (4 KPIs) │     │
│  ├────────────────────────┤      │  │ Diagnosis summary      │     │
│  │ Order Card 3           │      │  ├────────────────────────┤     │
│  └────────────────────────┘      │  │ Line Selector Tabs     │     │
│                                  │  │ [L1] [L2] [L3]        │     │
│                                  │  ├────────────────────────┤     │
│                                  │  │ Line Detail Card       │     │
│                                  │  │ Agent Action Card      │     │
│                                  │  │ Pricing Waterfall      │     │
│                                  │  │ Corrective Actions     │     │
│                                  │  ├────────────────────────┤     │
│                                  │  │ [✓ Resolve Order]      │     │
│                                  │  └────────────────────────┘     │
│                                  │                                  │
└──────────────────────────────────┴──────────────────────────────────┘
```

### Grid Specs

- **Metrics strip**: `display: grid`, `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`, `gap: var(--space-16)`
- **Content + Sidebar**: `display: flex`, `gap: var(--space-16)`, content `flex: 1`, sidebar `width: var(--sidebar-width)` fixed
- **Sidebar**: `position: sticky`, `top: calc(var(--nav-height) + page-header-height)`, `max-height: calc(100vh - offset)`, `overflow-y: auto`
- **Tab bar**: `border-bottom: 1px solid var(--color-border-default)`, tabs are flex children with `padding: 10px 18px`
- **Active tab**: `border-bottom: 2px solid var(--color-brand)`, `color: var(--color-text-primary)`, `font-weight: 700`. Only the underline is brand blue — the text is neutral.
- **Inactive tab**: `color: var(--color-text-tertiary)`, `font-weight: 600`, hover `background: var(--color-surface-secondary)`

### Sidebar Transition

```css
.sidebar-enter {
  transform: translateX(100%);
  opacity: 0;
}
.sidebar-active {
  transform: translateX(0);
  opacity: 1;
  transition: transform var(--dur-normal) var(--ease-out),
              opacity var(--dur-fast) var(--ease-out);
}
.sidebar-exit {
  transform: translateX(100%);
  opacity: 0;
  transition: transform var(--dur-fast) var(--ease-in),
              opacity var(--dur-instant) var(--ease-in);
}
```

---

## Layout B — Dashboard Grid (Insights / Analytics)

Used for: root cause insights, customer exposure analysis, capability maps.

```
┌──────────────────────────────────────────────────────────────┐
│  METRICS STRIP (if applicable, often omitted on analytics)   │
├──────────────────────────────────────────────────────────────┤
│  TAB BAR (if multi-view page)                                │
├──────────────────────────────────┬───────────────────────────┤
│                                  │                           │
│  Card 1                          │  Card 2                   │
│  (Root Cause Distribution)       │  (Customer Exposure)      │
│                                  │                           │
├──────────────────────────────────┼───────────────────────────┤
│                                  │                           │
│  Card 3                          │  Card 4                   │
│  (Capabilities Map)              │  (Recommendations)        │
│                                  │                           │
└──────────────────────────────────┴───────────────────────────┘
```

### Grid Specs

- `display: grid`, `grid-template-columns: 1fr 1fr`, `gap: var(--space-16)`
- Cards auto-size to content height (no forced equal heights)
- On narrow viewports (<1024px): collapse to single column

---

## Layout C — Timeline / Activity Log

Used for: agent activity log, audit trail, execution history.

```
┌──────────────────────────────────────────────────────────────┐
│  Card: Agent Activity Timeline                      [badge]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ●── 14:32:05 [SYSTEM] ASOE initialized...                  │
│  │                                                           │
│  ●── 14:32:07 [WARN] 6 price holds · 15 line items...       │
│  │                                                           │
│  ●── 14:33:12 [SYSTEM] Dispatching audit for PO-88421...    │
│  │                                                           │
│  ●── 14:33:45 [SUCCESS] PO-88421 audit done · LOW Risk      │
│                                                              │
│  [max-height with overflow-y: auto scroll]                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Timeline Entry Spec

- **Container**: `display: flex`, `gap: 0`
- **Dot column**: 12px wide, dot is 8px circle, vertical 1px line connects dots
- **Content**: `padding: var(--space-8) var(--space-12)`, `background: {type-subtle-color}`, `border-radius: var(--radius-sm)`, `border: 1px solid {type-color}15`, `margin-bottom: var(--space-4)`
- **Timestamp**: `.mono-sm`, `color: var(--color-text-tertiary)`, `min-width: 60px`
- **Type badge**: Flat badge with type color
- **Message**: `font-size: 12px`, `font-family: var(--font-mono)`, `color: var(--color-text-primary)`, `line-height: 1.4`

### Dot Colors by Type

| Type    | Dot Color              | Background                     |
|---------|----------------------|-------------------------------|
| system  | `var(--color-brand)` | `var(--color-brand-subtle)`    |
| success | `var(--color-success)` | `var(--color-success-subtle)` |
| warn    | `var(--color-warning)` | `var(--color-warning-subtle)` |
| error   | `var(--color-error)` | `var(--color-error-subtle)`    |
| info    | `var(--color-text-tertiary)` | `var(--color-surface-secondary)` |

---

## Layout D — Agent Action Execution Panel

Used inside the sidebar when an agent action is executing or has completed.

```
┌──────────────────────────────────────────────────────────────┐
│  ┌──────┐                                                    │
│  │ ICON │  Agent Action: Load Promo Condition    [FIXED]     │
│  │36×36 │  SAP VK11                                          │
│  └──────┘                                                    │
├──────────────────────────────────────────────────────────────┤
│  ✓ Promotional condition ZPROM created for Q1 period.        │
├──────────────────────────────────────────────────────────────┤
│  EXECUTION LOG                                               │
│                                                              │
│  ┃ 14:33:01 · READ_IDOC · EDI Layer                         │
│  ┃ Read E1EDP01 segment for pricing data                     │
│  ┃ [SUCCESS]                                                 │
│  ┃                                                           │
│  ┃ 14:33:03 · CREATE_CONDITION · SAP VK11                    │
│  ┃ Created ZPROM: $13.20 valid 01/01–03/31                   │
│  ┃ Before: (none) → After: $13.20                            │
│  ┃ [SUCCESS]                                                 │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  ✓ Fix Applied Successfully                                  │
│  Was: $14.88 → Now: $13.20                                   │
│  Ref: CR-2026-00142                                          │
│                                                              │
│  Next Steps:                                                 │
│  1. Verify condition in VK13                                 │
│  2. Reprocess sales order VA02                               │
└──────────────────────────────────────────────────────────────┘
```

### Execution Panel Spec

- **Container**: `border: 1px solid {action-color}25`, `border-radius: var(--radius-md)`, `box-shadow: 0 4px 16px {action-color}10`, `overflow: hidden`
- **Header**: `background: {action-subtle-color}`, `padding: var(--space-12) var(--space-16)`, `border-bottom: 1px solid {action-color}20`
- **Icon**: 36×36px, `border-radius: var(--radius-sm)`, solid action color background, white icon, `box-shadow: 0 2px 8px {action-color}40`
- **Summary banner**: `background: var(--color-success-subtle)`, `padding: var(--space-8) var(--space-16)`, `border-bottom: 1px solid var(--color-border-subtle)`
- **Execution log**: `padding: var(--space-12) var(--space-16)`, `max-height: 340px`, `overflow-y: auto`
- **Log entry**: `padding: var(--space-10) var(--space-12)`, `background: var(--color-surface-secondary)`, `border-radius: var(--radius-sm)`, `border: 1px solid var(--color-border-default)`, `border-left: 3px solid {step-status-color}`
- **Result panel**: `border-top: 1px solid var(--color-border-default)`, `padding: var(--space-12) var(--space-16)`, `background: {result-status-subtle}`

---

## Responsive Behavior

ASOE is primarily a desktop application (1280px–1920px), but must degrade gracefully.

| Breakpoint   | Width       | Behavior                                    |
|-------------|-------------|---------------------------------------------|
| Desktop XL  | ≥ 1440px    | Full layout, sidebar visible, all columns    |
| Desktop     | 1024–1439px | Sidebar overlays instead of pushing content  |
| Tablet      | 768–1023px  | Metrics strip wraps to 2 rows, no sidebar   |
| Mobile      | < 768px     | Single column, stacked cards, no table view  |

### Sidebar Responsive Rules

- **≥ 1440px**: Sidebar pushes content (Layout A standard)
- **1024–1439px**: Sidebar overlays with scrim (`background: rgba(0,0,0,0.2)`, `z-index: var(--z-sidebar)`)
- **< 1024px**: Detail opens as full-page navigation (back button to return)

### Table Responsive Rules

- **≥ 1280px**: All columns visible
- **1024–1279px**: Hide lowest-priority columns (e.g., region, UOM), show on row expand
- **< 1024px**: Switch to card-based list view (one card per order/line)

---

## Spacing Reference Summary

| Context                    | Token              | Value  |
|----------------------------|--------------------|--------|
| Page padding (horizontal)  | `--page-padding`   | 32px   |
| Content padding (in cards) | `--content-padding` | 24px  |
| Grid gap (cards/tiles)     | `--space-16`       | 16px   |
| Section separation         | `--space-32`       | 32px   |
| Major section breaks       | `--space-48`       | 48px   |
| Card internal padding      | `--space-20`       | 20px   |
| Compact card padding       | `--space-12`       | 12px   |
| Label to value             | `--space-8`        | 8px    |
| Icon to text               | `--space-8`        | 8px    |
| Badge internal padding     | `2px 8px`          | —      |
| Button icon to label       | `--space-6`        | 6px    |
