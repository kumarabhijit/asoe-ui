# Phase 5: Exception Queue Page

**Prerequisite:** Phase 3 (agent-first components), Phase 4 (types + API client)
**Architecture reference:** `ui_architecture.md` Section 5.1 (Exception Queue — Three-Pane Outlook Master-Detail)
**Design reference:** `skills/asoe-ui-design/references/layout-templates.md` (Layout A)

---

## Context

The Exception Queue is the flagship view — the first screen authenticated users see. It follows Layout A (Queue + Sidebar) from Section 11.5. The root redirect (`src/app/page.tsx`) sends `/` to `/exceptions`.

---

## Page Structure (`src/app/exceptions/page.tsx`)

```
NavBar (sticky top)
├── Tabs: Exception Queue (active) | Dashboard | Settings
├── Agent status badge (N agents live)
├── User avatar (initials)

Page Content (max-width: 1280px, centered)
├── Page Header
│   ├── Title: "Exception Queue" with Inbox icon
│   ├── Subtitle: "Monitor and resolve O2C exceptions across all tenants"
│   └── Refresh button (triggers re-fetch)
│
├── Metrics Strip (4x MetricTile in responsive grid)
│   ├── Total Exceptions (Inbox icon, blue tint)
│   ├── Open (AlertTriangle icon, warning tint)
│   ├── Auto-Resolved (Zap icon, success tint)
│   └── Avg Resolution (Clock icon, teal tint, formatted as minutes)
│
├── Filters Row
│   ├── Search input (client-side filter by order ID, intent, event type)
│   ├── State filter dropdown ← values from useHealth().lifecycle_states (Guardrail #2)
│   └── Intent filter dropdown ← values from useHealth().allowed_intents (Guardrail #2)
│
├── DataTable (Card with shadow)
│   ├── Header: Order ID | Event Type | Intent | State | Verdict | Recipe | Created | (action)
│   ├── Rows: one per exception
│   │   ├── Order ID: mono font, bold
│   │   ├── Intent: Badge with brand variant
│   │   ├── State: Badge with lifecycleVariant() color
│   │   ├── Verdict: Badge with verdictVariant() color
│   │   ├── Recipe: sans-serif, tertiary color, .py stripped
│   │   ├── Created: mono font, formatted date
│   │   └── View button (ghost variant)
│   ├── Row click → opens Sidebar with ExceptionDetailPanel
│   ├── Empty state: "No exceptions match your filters"
│   └── Loading state: skeleton shimmer
│
└── Sidebar (480px, slides right)
    └── ExceptionDetailPanel (Phase 6)
```

## Data Flow

1. On mount: parallel fetch `exceptionsApi.list()` + `exceptionsApi.stats()`
2. State/intent filter change → re-fetch `exceptionsApi.list({ status, intent })`
3. Search → client-side filter on loaded data (no API call)
4. Row click → `setSelectedId(exc.id)`, `setSidebarOpen(true)`
5. Sidebar renders `ExceptionDetailPanel` which fetches `exceptionsApi.get(id)` + `exceptionsApi.trace(id)`

## Key Implementation Details

**Guardrail #2 filter dropdowns:**
```tsx
const { health } = useHealth();
// State filter
{(health?.lifecycle_states ?? []).map((s) => (
  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
))}
// Intent filter — same pattern with health.allowed_intents
```

**NavBar tabs:** Hardcoded navigation targets (`/exceptions`, `/dashboard`, `/settings`) are page routes, not enum values — this is allowed. Tab labels are UI navigation, not data-driven.

**View button:** Has explicit `onClick` with `e.stopPropagation()` to avoid double-firing with row click handler.

**Root redirect:** Update `src/app/page.tsx` to `redirect("/exceptions")` instead of `/inbox`.

---

## Verification

1. `npm run build` passes
2. Filter dropdowns populated from `useHealth()` — not hardcoded option lists
3. Clicking a row opens the Sidebar with the correct exception ID
4. Metrics strip shows data from `exceptionsApi.stats()`
5. Search filters by order_id, intent, event_type client-side
6. State and intent filter changes trigger re-fetch
