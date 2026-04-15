# Exception Queue: Duplicate PO — Implementation Prompt

> **Phase**: Exception Queue Enhancement (post-Phase 8)
> **Scope**: Duplicate PO intent — data-driven detail rendering + WebSocket wiring
> **Prerequisites**: Read `CLAUDE.md`, `ui_architecture.md`, `architecture_v3.md` (in asoe2)

---

## Objective

Implement **Duplicate PO-specific detail rendering** in the Exception Queue (`/exceptions`), focusing on **state transitions, message sequences, and rendering of backend Skill outputs**.

This is NOT about UI theming or color schemes. It is about making the detail panel show the right data in the right structure when the backend resolves a Duplicate PO exception.

---

## Source of Truth Hierarchy

1. **`architecture_v3.md`** (asoe2 repo) — backend architecture. Defines the 11-node pipeline, lifecycle states, Skill-Recipe-Shadow engine, API contracts, HITL protocol. **Source of truth for data flow.**
2. **`ui_architecture.md`** (asoe-ui repo) — frontend architecture. Defines component strategy, two-layer cognition, verdict-specific states, API surface. **Source of truth for UI structure.**
3. **`docs/prototype_gap_analysis.md`** (asoe-ui repo) — feature reference from the AgenticOM prototype. **Not gospel truth.**
4. **AgenticOM prototype** (`/home/user/AgenticOM/Document from Abhijit.html`) — visual reference only.

**Conflict resolution**: If the prototype's interaction or data flow conflicts with `architecture_v3.md` or `ui_architecture.md`, **stop and present the differences to me**. I will decide.

---

## Critical Architectural Constraint: Guardrail #2 Compliance

### The Rule (from CLAUDE.md)

> Intent values must **never** appear as string literals in page-level logic.
> **Test:** Adding a new intent in `asoe2` must require **zero** UI code changes.

### What This Means for This Task

**DO NOT** create intent-specific component dispatch:

```tsx
// FORBIDDEN — violates Guardrail #2
switch (detail.intent) {
  case 'DUPLICATE_PO': return <DuplicatePODetail />;
  default: return <GenericDetail />;
}
```

**DO** use data-presence-driven rendering:

```tsx
// CORRECT — renders based on what data exists, not what intent string says
{analysis.duplicate_detection && <DuplicateDetectionSection data={analysis.duplicate_detection} />}
{analysis.pricing_waterfall && <PricingWaterfallSection data={analysis.pricing_waterfall} />}
{analysis.order_comparison && <OrderComparisonSection data={analysis.order_comparison} />}
```

### Why This Matters

The current `ExceptionDetailPanel` is **polymorphic via dynamic data categories** (ui_architecture.md Section 5.2, Drift Register D9). The same 5-layer structure renders all intents. Different intents produce different data from the backend — the UI renders whatever data is present.

A new intent added in `asoe2` that includes `duplicate_detection` in its `OrderAnalysis` response automatically gets that section rendered — zero UI code changes.

### Allowed Pattern: Enrichment via Data Presence

If Duplicate PO needs sections that don't exist in the current layout, add them as **data-presence-driven optional sections** — not intent-dispatched components:

```tsx
// The backend sends these fields only for relevant intents
interface OrderAnalysis {
  // ... existing fields ...
  duplicate_detection?: DuplicateDetectionData;  // present when duplicate PO detected
  order_comparison?: OrderComparisonData;         // present when orders need comparison
  // Future intents will add their own optional fields
}
```

The UI renders sections based on whether the data exists, not based on which intent string is present.

---

## What Exists Today

### Current Architecture (read these files)
- `src/app/exceptions/page.tsx` — page orchestrator, owns list state + selection
- `src/app/exceptions/ExceptionListPane.tsx` — controlled list pane with useHealth() filters
- `src/app/exceptions/ExceptionDetailPanel.tsx` (1092 lines) — 5-layer detail panel
- `src/components/ui/AgentReasoningCard.tsx` — Layer 1/2 with verdict-specific actions
- `src/components/ui/WaterfallStepper.tsx` — 10-node pipeline visualization
- `src/hooks/useWebSocket.ts` — WebSocket with reconnection (not yet wired to detail)
- `src/lib/api.ts` — mock API client with 8 exceptions
- `src/types/exceptions.ts` — domain types
- `src/types/api.ts` — request/response types

### Current Detail Panel Layers
1. **Dynamic Header Ribbon** — breadcrumb context
2. **Context Strip** — Entity Profile + Impact Metrics (two-column)
3. **Agent Analysis** — Problem / Root Cause / Recommendation + AgentReasoningCard
4. **Evidence Grid** — expandable line items + PricingWaterfall
5. **Diagnostics** — WaterfallStepper + Trace Evidence tabs

### Governance Model
Human is **Review Authority only** — Approve, Reject, or Escalate via AgentReasoningCard. No "Execute Recipe" or "Run AI Agent" buttons. Shadow Verdict is read-only. Execution is backend-triggered on approval.

---

## What to Build

### Phase 1: Decompose ExceptionDetailPanel by Layer

The current file is 1092 lines. Before adding new sections, decompose it along the **5-layer axis** (not the intent axis). Extract reusable sub-components:

| Sub-Component | Current Lines (approx) | Purpose |
|---------------|----------------------|---------|
| `HeaderRibbon` | 303-375 | Breadcrumb context, lifecycle/verdict badges, value |
| `ContextStrip` | 377-442 | Entity Profile + Impact Metrics two-column grid |
| `AgentAnalysisSection` | 448-506 | Problem / Root Cause / Recommendation narratives |
| `EvidenceGrid` | 880-1061 | Already partially extracted; line items + waterfall |
| `DiagnosticsSection` | 557-724 | Pipeline progress, trace tabs, resolution data |

After extraction, the main `ExceptionDetailPanel` becomes a ~200-line orchestrator that composes these sub-components. Each sub-component remains **intent-agnostic** — driven by data, not intent strings.

### Phase 2: Extend Data Types for Duplicate PO Skill Output

Add optional fields to `OrderAnalysis` (or a new response type) that carry Duplicate PO-specific data. These fields are **only present** when the backend Skill produces them.

Based on `architecture_v3.md` (DuplicatePO recipe, Section 5):

```typescript
// In src/types/exceptions.ts — UI-only types (not backend contract)

/** Present when the DuplicatePO recipe has run */
interface DuplicateDetectionData {
  original_order: {
    so_number: string;
    created_date: string;
    total_value: number;
    line_count: number;
  };
  duplicate_order: {
    so_number: string;
    created_date: string;
    total_value: number;
    line_count: number;
  };
  detection_method: string;       // e.g., "Same customer + SKU + qty within 7 days"
  days_between: number;
  confidence: number;             // 0-100
  recommended_action: string;     // e.g., "Cancel duplicate SO-002"
  cancellation_target: string;    // SO number to cancel
  autonomy_applied: string;       // L1/L2/L3/L4 with rationale
}

/** Present when two orders need side-by-side comparison */
interface OrderComparisonData {
  orders: Array<{
    so_number: string;
    created_date: string;
    customer: string;
    lines: Array<{ sku: string; description: string; qty: number; unit_price: number }>;
    total_value: number;
    status: string;
  }>;
  matching_fields: string[];      // which fields matched to trigger detection
  differing_fields: string[];     // which fields differ between the orders
}
```

Add these as optional fields on `OrderAnalysis`:

```typescript
interface OrderAnalysis {
  // ... existing fields ...
  duplicate_detection?: DuplicateDetectionData;
  order_comparison?: OrderComparisonData;
}
```

### Phase 3: Add Data-Presence-Driven Sections to Detail Panel

Create new sub-components that render **only when their data is present**:

#### `DuplicateDetectionSection`
Renders when `analysis.duplicate_detection` exists. Shows:
- Original vs Duplicate order identification
- Detection method and confidence
- Days between submissions
- Recommended action with autonomy level applied
- Which order the agent recommends cancelling and why

#### `OrderComparisonSection`
Renders when `analysis.order_comparison` exists. Shows:
- Side-by-side or stacked comparison of orders
- Matching fields highlighted (what triggered the detection)
- Differing fields highlighted (what distinguishes the orders)
- Line-item comparison if available

These sections slot into the detail panel between Agent Analysis and Evidence Grid:

```tsx
// In ExceptionDetailPanel orchestrator:
<HeaderRibbon ... />
<ContextStrip ... />
<AgentAnalysisSection ... />

{/* Data-presence-driven enrichment sections */}
{analysis?.duplicate_detection && (
  <DuplicateDetectionSection data={analysis.duplicate_detection} />
)}
{analysis?.order_comparison && (
  <OrderComparisonSection data={analysis.order_comparison} />
)}

<EvidenceGrid ... />
<DiagnosticsSection ... />
```

### Phase 4: Enhance Mock Data

Update `src/lib/api.ts` to include realistic Duplicate PO mock data:

1. Ensure at least 2 Duplicate PO mock exceptions covering:
   - **GREEN verdict**: Auto-cancelled duplicate (<$1K, L1 autonomy)
   - **YELLOW verdict**: Needs approval ($5K order, L2/L3 autonomy)
   - **RED verdict** (optional): Blocked by policy (>$100K or contractual)

2. Each mock should have:
   - `OrderAnalysis` with `duplicate_detection` and `order_comparison` fields populated
   - Realistic `resolution_data` matching what the DuplicatePO recipe would produce
   - `LineItem` data showing the duplicated order lines
   - `TraceResponse` with realistic pipeline node outputs

3. Derive field names and structures from `architecture_v3.md` — do not invent fields the backend wouldn't produce.

### Phase 5: Wire WebSocket to Detail Panel

Connect `useWebSocket` to the exception detail panel:

1. When viewing an exception that is PROCESSING, `pipeline_progress` events update the WaterfallStepper in real-time
2. When an `exception_update` event arrives for the currently-viewed exception, refresh detail data
3. When a `task_complete` event arrives, transition the UI from "processing" to "resolved"

Use event types from `src/types/websocket.ts` and the protocol in `architecture_v3.md` Section 8.

### Phase 6: Exception List Enhancements (if time permits)

Add to the exception list pane (data-driven, no intent branching):
- Left border color: blue=selected, green=auto-resolved (GREEN verdict), default otherwise
- "Resolved" badge on exceptions with terminal lifecycle states
- Intent-specific metric line driven by `resolution_data` presence (not intent string checks)

---

## State Transition Map

```
Exception arrives (INGESTED)
  → Pipeline runs (11 nodes: ingest → classify → ... → apply_effects)
  → Detail panel shows pipeline progress via WaterfallStepper
  → Pipeline completes → Skill output available in resolution_data + OrderAnalysis
  → Detail panel renders data-presence sections:
      - duplicate_detection present? → show DuplicateDetectionSection
      - order_comparison present? → show OrderComparisonSection
  → Agent Analysis shows Problem / Root Cause / Recommendation
  → AgentReasoningCard shows verdict-appropriate actions:
      GREEN → auto-resolved, show what happened (no action buttons)
      YELLOW → Approve / Reject / Escalate with comment
      RED → blocked by policy, show policy hits, admin Override
  → User acts → backend processes → lifecycle transitions
  → List pane refreshes via onActionComplete callback
```

---

## Implementation Constraints

### DO
- Read `CLAUDE.md` before starting
- Read `architecture_v3.md` (asoe2) for data flow and recipe outputs
- Use existing components (AgentReasoningCard, WaterfallStepper, Badge, Card, MetricTile, etc.)
- Use design tokens for all visual values
- Source filter/enum values from `useHealth()` (Guardrail #2)
- Keep types in `src/types/` aligned with backend contracts
- Run `npm run build` after changes
- Run `npm test` to check for regressions
- Update docs per `prompts/update_docs.md` protocol

### DO NOT
- Do not branch on intent strings in component rendering (Guardrail #2)
- Do not create intent-named components dispatched by a switch/map on intent
- Do not add "Execute Recipe" or "Run AI Agent" buttons (human is Review Authority only)
- Do not hardcode enum values in JSX
- Do not invent business logic — render what the backend decides
- Do not refactor unrelated code
- Do not add visual polish beyond functional needs

### Conflict Escalation
If you encounter a situation where:
- The prototype shows an interaction that conflicts with the architecture
- The prototype data model differs from `architecture_v3.md`
- You need a backend field that doesn't exist in type contracts

**Stop and present the conflict** with:
1. What the prototype shows
2. What the architecture says
3. Your recommendation
4. The specific files/lines involved

---

## Success Criteria

When done:

1. `ExceptionDetailPanel` is decomposed into 5 layer sub-components (~200-line orchestrator)
2. Viewing a Duplicate PO exception shows:
   - Standard 5-layer detail (header, context, analysis, evidence, diagnostics)
   - **Plus** DuplicateDetectionSection showing original vs duplicate, detection method, recommended action
   - **Plus** OrderComparisonSection showing side-by-side order data
3. All 3 verdict scenarios work (GREEN auto-resolved, YELLOW needs approval, RED blocked)
4. Approve/Reject/Escalate actions work and refresh the list
5. Mock data is realistic and derived from architecture_v3.md
6. WebSocket events update the WaterfallStepper in real-time (Phase 5)
7. No Guardrail #2 violations — zero intent string branching in rendering code
8. `npm run build` passes, `npm test` passes
9. The pattern is extensible: adding a `pricing_waterfall` field to `OrderAnalysis` for a future Price Mismatch intent should require only creating the section component + mock data — zero changes to the dispatch logic

---

## Guardrail #2 Verification Checklist

Before marking complete, verify:
- [ ] No `switch` or `if` on `detail.intent` or `detail.event_type` in any `.tsx` rendering code
- [ ] No `Record<string, ComponentType>` mapping intent strings to components
- [ ] All new sections are rendered via `{data?.field && <Section data={data.field} />}` pattern
- [ ] A hypothetical new intent `SHORT_SHIP` with no specialized data renders correctly using the existing generic layout — zero code changes
- [ ] Badge variant mappers remain the only place where enum-like values map to visual treatments (with default fallback)
