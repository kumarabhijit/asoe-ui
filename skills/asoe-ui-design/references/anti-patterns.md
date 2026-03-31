# ASOE Anti-Patterns Gallery

Explicit examples of what NOT to do when building ASOE UI. Every anti-pattern includes WHY it fails and what to do instead. Referenced from SKILL.md Section 12.

---

## 1. Overusing Brand Blue

### The Problem

```jsx
// ❌ WRONG — brand blue on everything
<span style={{ color: T.brand }}>{order.id}</span>           // PO number as blue link
<span style={{ color: T.brand }}>Home</span>                 // Breadcrumb in blue
<div style={{ borderLeft: `3px solid ${T.brand}` }}>...</div> // Agent card blue stripe
<div style={{ background: T.brand }}>                        // Blue confidence bar
<button style={{ color: T.brand }}>Detail</button>           // Neutral button in blue
<div style={{ background: T.brandSubtle }}>                  // Selected row in blue tint
```

When 26 elements on the screen are brand blue, the primary CTA buttons have zero visual priority. The screen becomes a sea of blue and the user cannot immediately see where to act. Brand color loses all meaning.

### The Fix

```jsx
// ✅ CORRECT — brand blue on exactly 3 things
// 1. Nav logo mark
<div style={{ background: T.brand }}><Logo /></div>

// 2. Active tab underline
borderBottom: `2px solid ${T.brand}`

// 3. Primary CTA buttons only
<Btn variant="brand">Audit All Holds</Btn>

// Everything else is neutral:
<span style={{ color: T.textPrimary }}>{order.id}</span>      // PO: dark text
<span style={{ color: T.textTertiary }}>Home</span>           // Breadcrumb: gray
<div style={{ boxShadow: T.shadowMd }}>...</div>              // Agent card: shadow
<div style={{ background: T.textSecondary }}>                 // Confidence: gray bar
<button style={{ color: T.textSecondary }}>Detail</button>    // Neutral btn: gray text
<div style={{ background: T.surfaceSecondary }}>              // Selected row: gray tint
```

Count blue elements on your screen. If more than 3 distinct items are blue, strip the rest to neutral.

---

## 2. Emoji as Icons

### The Problem

```jsx
// ❌ WRONG
<span>⏱</span>  Promo Expired
<span>📡</span>  EDI Mismatch
<span>⚙</span>  Master Data Error
```

Emoji render differently across OS, browsers, and zoom levels. They lack consistent sizing, alignment, and color control. In an enterprise context used 8+ hours daily, they look unprofessional and create visual inconsistency.

### The Fix

```jsx
// ✅ CORRECT
import { Clock, Radio, Settings } from 'lucide-react';
<Clock size={16} />  Promo Expired
<Radio size={16} />  EDI Mismatch
<Settings size={16} /> Master Data Error
```

Use Lucide React icons at consistent sizes (16/20/24px). They align to the pixel grid, accept color tokens, and scale cleanly.

---

## 3. Colored Left-Border Status Indicators

### The Problem

```css
/* ❌ WRONG */
.order-card {
  border-left: 4px solid #ba0517;  /* hard red bar */
}
```

Heavy colored borders on every card create a rainbow effect on the queue page. When every card screams for attention, nothing gets prioritized. The user's eye has no resting point.

### The Fix

```css
/* ✅ CORRECT: Selected state only */
.order-card--selected {
  background: var(--color-brand-subtle);
  box-shadow: var(--shadow-md);
}

/* ✅ CORRECT: Status via pill, not border */
.status-pill--error {
  background: var(--color-error-subtle);
  color: var(--color-error);
}
```

Use subtle tinted backgrounds for selected/active states. Communicate status through pills/badges within the row, not on the card container itself. Reserve accent borders for the single active/selected item only.

---

## 4. Alert Overload (>3 Simultaneous Status Colors)

### The Problem

A screen where every card has red/amber/green indicators, status badges in 5+ colors, and pulsing animations on multiple elements simultaneously. The user cannot visually triage because everything competes equally.

### The Fix

- Default state is neutral (no color) — gray text, white/surface background
- Only the MOST IMPORTANT status gets color treatment
- Maximum 2 distinct status colors visible in any 400×400px viewport area
- Use color intensity (subtle bg → solid badge → solid bg) to layer priority

---

## 5. Dense Grid with Tiny Padding

### The Problem

```css
/* ❌ WRONG */
.grid { gap: 2px; }
.card { padding: 6px 8px; }
.header { padding: 4px 8px; }
```

Cramped layouts create anxiety. When cards are jammed edge-to-edge with minimal internal padding, the interface feels like a spreadsheet — which is exactly the experience ASOE should eliminate.

### The Fix

```css
/* ✅ CORRECT */
.grid { gap: var(--space-16); }       /* 16px between cards */
.card { padding: var(--space-20); }   /* 20px internal breathing room */
.header { padding: var(--space-16); } /* 16px header padding */
```

Generous spacing reduces visual fatigue over long shifts. The screen looks "emptier" but comprehension speed increases and error rates decrease.

---

## 6. Exposing Raw JSON or Chain-of-Thought

### The Problem

```
Agent Output:
{"overall_diagnosis":"The promotional discount ZPROM has expired...","confidence":85,
"overall_resolution":"AUTO_OVERRIDE","lines":[{"lineId":"L1","diagnosis":"TPR condition
record ZPROM was applied after its validity period ended on 12/31...
```

Non-technical order management analysts see raw JSON and immediately distrust the system. It signals "this is an engineering debug tool" not "this is a decision support platform."

### The Fix

- Agent output renders in structured **AgentReasoningCard** components
- Layer 1: plain-language recommendation + confidence bar + action button
- Layer 2 (expandable): structured evidence cards, NOT raw JSON
- Raw data available only behind a "Developer View" toggle for technical users, hidden by default

---

## 7. Solid-Fill Status Badges

### The Problem

```css
/* ❌ WRONG */
.badge-error {
  background: #DC2626;   /* solid red */
  color: white;
}
.badge-warning {
  background: #D97706;   /* solid amber */
  color: white;
}
```

Solid-fill status badges at rest are visually aggressive. When a queue has 20 orders each with solid red/amber badges, the page becomes a wall of alarm signals. The user habituates and stops noticing actual urgency.

### The Fix

```css
/* ✅ CORRECT */
.badge-error {
  background: var(--color-error-subtle);    /* light pink bg */
  color: var(--color-error);                /* red text */
  border: 1px solid var(--color-error-border); /* faint red border */
}
```

Tinted background + colored text for at-rest badges. Reserve solid-fill for toasts and active alerts that demand immediate attention.

---

## 8. Multiple Competing Animations

### The Problem

- Nav bar has a pulsing "LIVE" indicator
- Three order cards have loading spinners
- A toast is sliding in from the right
- The sidebar is sliding in from the left
- A progress bar is filling
- A skeleton loader is pulsing

When more than 2 elements animate simultaneously, the interface feels chaotic and uncontrolled — the opposite of the "calm authority" principle.

### The Fix

- Maximum 1 persistent animation (the agent-active pulse dot)
- Transient animations (toast, sidebar, expand) execute and complete
- Never trigger multiple transient animations at the same time — queue them with staggered delays
- Loading spinners: use skeleton loaders instead (less visually aggressive)

---

## 9. Hardcoded Hex Values in Components

### The Problem

```jsx
// ❌ WRONG
<div style={{
  background: "#f3f2f2",
  color: "#444",
  borderLeft: "3px solid #0176d3",
  boxShadow: "0 2px 2px rgba(0,0,0,0.1)"
}}>
```

Hardcoded values create maintenance nightmares. When the design system evolves (e.g., adjusting the page background from #F8FAFC to #F9FAFB), every hardcoded instance must be found and updated. Inconsistencies accumulate rapidly.

### The Fix

```jsx
// ✅ CORRECT
<div style={{
  background: 'var(--color-surface-secondary)',
  color: 'var(--color-text-secondary)',
  borderLeft: '3px solid var(--color-brand)',
  boxShadow: 'var(--shadow-sm)'
}}>
```

Every visual value references a CSS custom property from `design-tokens.css`. This is not optional — it is a hard requirement for all ASOE code.

---

## 10. Chat-Style Agent Interface

### The Problem

A side panel showing conversation bubbles:

```
╔══════════════════════════╗
║ 🤖 I'm analyzing your   ║
║    order PO-88421...     ║
║                          ║
║ 🤖 I found 3 pricing    ║
║    discrepancies. The    ║
║    first line item has   ║
║    a promo that expired  ║
║    on 12/31. The second  ║
║    line also has...      ║
║                          ║
║ 👤 What should I do?     ║
║                          ║
║ 🤖 I recommend auto-    ║
║    overriding the...     ║
╚══════════════════════════╝
```

Chat interfaces are the wrong metaphor for exception resolution. They are:
- Linear (can not scan non-sequentially)
- Verbose (agents explain too much)
- Stateless-feeling (conversation scrolls away)
- Slow to act on (must read before finding the action)

### The Fix

Agent output lives in structured cards embedded in the workflow:

```
┌─────────────────────────────────────────┐
│ ┃ Agent Recommendation      [HIGH Risk] │
│ ┃                                       │
│ ┃ Promo expired on 12/31.               │
│ ┃ Recommend: auto-override.             │
│ ┃                                       │
│ ┃ [⚡ Auto-Override]  [Escalate]         │
└─────────────────────────────────────────┘
```

Scannable in 3 seconds. Action button is right there. No conversation needed.

---

## 11. Uppercase Bold Headers on Tables

### The Problem

```css
/* ❌ WRONG */
th {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: #181818;  /* same weight as data */
}
```

When column headers have the same visual weight as the data below them, the user's eye bounces between header and data rows without settling. Headers should be scaffolding — visible but receding.

### The Fix

```css
/* ✅ CORRECT */
th {
  font-size: var(--font-size-label);     /* 10px */
  font-weight: var(--font-weight-label); /* 700 */
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-label); /* 0.06em */
  color: var(--color-text-tertiary);     /* light gray — NOT primary */
}
```

Small, tracked-out, light-colored headers name the columns without competing with the data. The data (in 13px, primary color) is the star.

---

## 12. Over-Decorated Empty Card Backgrounds

### The Problem

```css
/* ❌ WRONG */
.card {
  border: 1px solid #dddbda;
  border-radius: 4px;
  box-shadow: 0 2px 2px rgba(0,0,0,0.1);
  background: linear-gradient(to bottom, #ffffff, #fafafa);
}
```

Gradients, double borders, and heavy shadows on every card create visual noise. When the container demands more attention than its content, the hierarchy is inverted.

### The Fix

```css
/* ✅ CORRECT */
.card {
  background: var(--color-surface-primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  /* No border, no gradient */
}

.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
```

Elevation (shadow) alone creates separation. The card is a quiet container. Content speaks.

---

## 13. Inconsistent Border Radius

### The Problem

One screen has `border-radius: 4px` on cards, `8px` on buttons, `12px` on badges, `2px` on inputs, and `16px` on modals. Each choice was made independently per component.

### The Fix

Use the radius token scale consistently:

| Element      | Token           | Value |
|-------------|----------------|-------|
| Badges       | `--radius-sm`  | 6px   |
| Cards        | `--radius-md`  | 10px  |
| Buttons      | `--radius-md`  | 10px  |
| Inputs       | `--radius-md`  | 10px  |
| Modals       | `--radius-lg`  | 14px  |
| Pills        | `--radius-full` | 9999px |

Cards, buttons, and inputs share the same radius. This creates visual cohesion — elements feel like they belong to the same system.

---

## Summary: The Quality Gate

Every ASOE pull request with UI changes should pass this visual review:

1. Open the screen at 1920×1080 and squint. Can you identify the primary content area without reading any text? If the chrome/decoration competes with content, redesign.
2. Count the blue elements. If more than 3 distinct items are brand blue (beyond CTA buttons, nav logo, active tab), strip the rest to neutral.
3. Count the distinct colors visible. If >4 (excluding neutrals), reduce.
4. Count the animated elements. If >1 in any viewport, remove extras.
5. Search the code for raw hex values. If any exist, replace with tokens.
6. Check that all agent output is in AgentReasoningCard, not prose or JSON.
7. Verify monospace (SF Mono preferred) is used for all numeric data columns.
8. Confirm header labels are lighter than data values.
9. Verify neutral buttons use gray text, not blue.
