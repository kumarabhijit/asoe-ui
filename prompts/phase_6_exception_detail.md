# Phase 6: Exception Detail

**Prerequisite:** Phase 3 (AgentReasoningCard, WaterfallStepper), Phase 4 (types), Phase 5 (Exception Queue + Sidebar)
**Architecture reference:** `ui_architecture.md` Section 1 (Design Paradigm — Two-Layer Cognition), Section 5.2 (Exception Detail Panel)

---

## Context

The Exception Detail renders inside the Sidebar component on the Exception Queue page. It implements the two-layer cognition model using AgentReasoningCard and WaterfallStepper.

---

## Component: ExceptionDetailPanel (`src/app/exceptions/ExceptionDetailPanel.tsx`)

**Props:** `exceptionId: string`, `onClose: () => void`

### Data Fetching

On mount (and when `exceptionId` changes), parallel fetch:
1. `exceptionsApi.get(exceptionId)` → `ExceptionDetail`
2. `exceptionsApi.trace(exceptionId)` → `TraceResponse`

Loading state: 3 skeleton shimmer blocks.
Error state: "Exception not found."

### Layout

```
Header Info
├── Order ID (mono, heading size) + Lifecycle state Badge
├── 2-column grid:
│   ├── Event Type | Tenant
│   └── Created (mono) | Updated (mono)

AgentReasoningCard
├── verdict: from detail.shadow_verdict
├── intent: from detail.intent
├── confidence: (simulated 0.92 in mock — real value from classify node data)
├── recipeName: from detail.selected_recipe
├── explanation: from trace.explanation
├── policyHits: from trace.shadow_policy_hits
├── trace: full TraceRecord for Layer 2
├── Action buttons wired to console.log (real handlers in Phase 9)

Pipeline Progress
├── Heading: "Pipeline Progress"
└── WaterfallStepper
    ├── nodes: built from lifecycle state + trace data
    └── intent: for domain-aware ActivityIndicator messages

Resolution Data (if present)
├── Heading: "Resolution Data"
└── Pre-formatted JSON of detail.resolution_data
```

### Building WaterfallStepper Node States

The `buildNodeStates()` function maps lifecycle state to pipeline progress:

```typescript
const NODES: PipelineNode[] = [
  "ingest", "classify", "load_skill", "validate_circuit_breaker",
  "shadow_audit", "select_recipe", "validate_types",
  "resolve_dependencies", "execute_recipe", "apply_effects",
];

// Map lifecycle state to how many nodes completed
const stateProgress = {
  INGESTED: 0, CLASSIFYING: 1, AUDITING: 4,
  PENDING_REVIEW: 5, ESCALATED: 5,
  EXECUTING: 8, RESOLVED: 10, CLOSED: 10,
  FAILED: 8, BLOCKED: 5, REJECTED: 5,
};
```

- Nodes before the progress point → `"completed"` with simulated duration + node-specific data
- Node at progress point for in-progress states → `"started"`
- Node at progress point for failed states → `"failed"`
- Nodes after a failed node → `"skipped"`
- Nodes not yet reached → `"pending"`

### Node Data for Completed Nodes

```typescript
classify → { intent, confidence }
shadow_audit → { shadow_verdict }
select_recipe → { selected_recipe }
apply_effects → { final_status }
```

---

## Verification

1. `npm run build` passes
2. Selecting exception row → sidebar opens → detail panel renders with correct data
3. GREEN verdict: Layer 2 collapsed, "View Details" toggles it
4. YELLOW verdict: Layer 2 auto-expanded, Approve/Reject/Escalate buttons shown
5. RED verdict: Layer 2 auto-expanded, policy hits displayed, Acknowledge + Escalate shown
6. WaterfallStepper shows completed nodes up to the current lifecycle state
7. Resolution data JSON displayed for RESOLVED/CLOSED exceptions
