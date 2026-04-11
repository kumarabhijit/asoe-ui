# Phase 7: Dashboard

**Prerequisite:** Phase 3 (MetricTile, Badge, Card), Phase 4 (types + API client + useHealth)
**Architecture reference:** `consol_arch.md` Section 11.5 (Dashboard — Layout B: 2-column grid), Section 11.6 (Analytics Data Isolation)

---

## Context

The Dashboard shows resolution analytics and agent performance metrics. It follows Layout B (2-column grid) from Section 11.5 and displays the KPIs defined in Section 11.6.

---

## Page Structure (`src/app/dashboard/page.tsx`)

```
NavBar (sticky top)
├── Tabs: Exception Queue | Dashboard (active) | Settings

Page Content (max-width: 1280px)
├── Page Header
│   ├── Title: "Dashboard" with BarChart3 icon
│   └── Subtitle: "Resolution analytics and agent performance metrics"
│
├── KPI Tiles Strip (4x MetricTile in responsive grid)
│   ├── Resolution Rate (TrendingUp icon, success tint) — auto_resolved / total as %
│   ├── Avg Resolution (Clock icon, teal tint) — seconds → minutes formatted
│   ├── HITL Rate (Users icon, warning tint) — (total - auto_resolved) / total as %
│   └── Total Processed (Zap icon, blue tint) — raw count
│
└── 2-column Grid (4 cards)
    ├── Exceptions by Intent
    │   └── Bar segments per intent with count
    ├── Exceptions by State
    │   └── Badges + bar segments per lifecycle state
    ├── Shadow Verdict Distribution
    │   └── Color-coded bars (GREEN/YELLOW/RED) with counts
    └── Platform Health
        └── Status, version, kill switch, explain mode from useHealth()
```

## Data Flow

1. On mount: fetch `exceptionsApi.stats()` + `healthApi.get()` (via `useHealth`)
2. Stats provides: `total_exceptions`, `open_exceptions`, `auto_resolved`, `avg_resolution_time_seconds`, `by_intent`, `by_lifecycle_state`, `by_shadow_verdict`
3. Health provides: `status`, `version`, `kill_switch`, `explain_mode`, `allowed_intents`, `allowed_recipes`

## Key Implementation Details

**Bar segments:** A `BarSegment` component renders a proportional bar within a `var(--color-surface-tertiary)` track. Width = `(value / max) * 100%`. Default color: `var(--color-brand)`. Verdict bars use explicit status colors.

**Badge integration in state breakdown:** Each lifecycle state row shows a Badge (via `lifecycleVariant()`) + bar + count.

**Platform Health card:** Shows dynamic values from `useHealth()`:
- Kill Switch: "ACTIVE" (red) or "Off" (green)
- Explain Mode: "ACTIVE" (warning) or "Off" (neutral)
- Active Intents count, Active Recipes count

**KPI calculations:**
- Resolution rate = `auto_resolved / total_exceptions * 100`
- HITL rate = `(total - auto_resolved) / total * 100`
- Avg resolution = `avg_resolution_time_seconds / 60` → formatted as minutes

---

## Section 11.6 KPI Coverage

| KPI (from consol_arch.md) | Dashboard Implementation |
|---|---|
| Resolution rate | MetricTile: "Resolution Rate" as percentage |
| Avg time-to-resolution | MetricTile: "Avg Resolution" in minutes |
| Auto-resolved % | MetricTile: "Resolution Rate" (same metric) |
| HITL intervention rate | MetricTile: "HITL Rate" as percentage |
| Dollar value recovered | Not yet implemented (requires `resolution_data.credit_amount` aggregation) |
| FAIL_TO_HUMAN rate | Visible in by-state breakdown (FAILED row) |

---

## Verification

1. `npm run build` passes
2. KPI tiles display correct computed values from stats
3. By-intent breakdown shows all intents from mock data
4. By-state breakdown uses `lifecycleVariant()` Badges
5. Verdict distribution uses correct status colors (green/amber/red)
6. Platform health card shows kill_switch and explain_mode from `useHealth()`
