# Phase 8.13 — Post-deploy stabilisation (live-stack fixes + WS resilience)

```text
Read CLAUDE.md (esp. Guardrail #6 — UI is a dumb projector,
no fabricated values), ui_architecture.md (esp. §7 WebSocket
Protocol + §9 Drift Register), tasks.md (Phase 8.12), and
asoe-ui/DESIGN.md §7 (real-time protocol).

Implement only Phase 8.13 — the live-stack stabilisation that
landed after the deployed sandbox started serving traffic.
Companion to asoe2 Phase 26 (env-driven JWT TTLs, real classifier
confidence persistence, V005 drop intent CHECK, ADR-026/027
drafts).

This is a retroactive prompt — Phase 8.13 has already shipped on
core_ui_integration. The eight sub-tasks below are CLOSED.

Requirements:

8.13.1 — useWebSocket polling fallback (Section 8.4):
  * src/hooks/useWebSocket.ts — after POLL_FALLBACK_THRESHOLD = 5
    consecutive failed reconnects, switch to interval polling on
    /api/v1/exceptions/{id}. Emit onPollFallback callback so
    consumers can adjust their refresh strategy. Emit onReconnect
    when the WS comes back.
  * Required because Container Apps closes idle WS at 4 minutes;
    long YELLOW reviews showed stale detail panels pre-2026-05-01.
  * Drift register entry D19 — was PENDING in §7 resilience table;
    now ALIGNED.

8.13.2 — Real backend JWT for WS auth:
  * src/hooks/useWebSocket.ts — first message
    {type: "auth", token, last_seen} uses the real session
    access token from session storage. Was 'mock-ws-token'
    placeholder pre-2026-05-01; the real backend rejected the
    placeholder with a 4001 close code.

8.13.3 — ExceptionDetailPanel executionError render branch:
  * src/app/exceptions/ExceptionDetailPanel.tsx — add a third
    render branch between verdict-present and shadow-pending
    fallback. When lifecycle === "FAILED" with execution_log error
    fields, render:

      <div role="alert" ...>
        <AlertTriangle ... />
        <div>
          <div className="text-error">
            {executionError.node
              ? `Pipeline failed at ${executionError.node}`
              : "Pipeline failed"}
          </div>
          <div>{executionError.message}</div>
          {executionError.failedAt && (
            <div>{new Date(executionError.failedAt).toLocaleString()}</div>
          )}
        </div>
      </div>

  * Distinct from RED verdict (compliance decision, not a runtime
    crash) and from "Shadow has not yet completed" (which
    previously rendered for every FAILED state and was misleading
    — the failure may be at any node, not just shadow_audit).
  * AgentReasoningCard consumes `executionError !== undefined` to
    drive the FAILED banner.
  * Drift register entry D21 — RESOLVED in detail-panel render
    path; topology-side fix (WaterfallStepper showing the actual
    halt node, not always apply_effects) follows ADR-027 (Proposed)
    and is NOT in scope for this phase.

8.13.4 — exceptionsApi.reanalyze USE_REAL_API gate:
  * src/lib/api.ts::exceptionsApi.reanalyze — add the missing
    `if (USE_REAL_API)` branch:

      reanalyze: async (id, request, options) => {
        if (USE_REAL_API) {
          return http<ExceptionDetailResponse>(
            `/api/v1/exceptions/${id}/reanalyze`,
            { method: "POST", body: request },
          );
        }
        // ... existing mock fallback unchanged
      }

  * Pre-2026-05-01 the gate was missing, so against the live
    backend the mock-find returned undefined and threw
    "Exception not found" on every Reanalyze click — silently
    mock-only.

8.13.5 — Architectural lock test (regression-proof):
  * tests/architectural/exceptions_api_live_branches.test.ts —
    walk every LIVE_METHODS entry asserting that
    `if (USE_REAL_API)` and the matching path fragment exist.
    Reanalyze-specific regression: USE_REAL_API must appear
    textually before MOCK_EXCEPTIONS.find so a refactor cannot
    silently mock-ify the live path again.
  * Source-string regex check (`fn.toString().match(/...)/`) so
    the test is fast and doesn't require a network round-trip.

8.13.6 — Confidence pill projection from real classifier value:
  * src/app/exceptions/shared.tsx::buildNodeData — `classify`
    row's data.confidence comes from `analysis.confidence / 100`
    (the real persisted classifier value), with the key omitted
    entirely when analysis hasn't loaded:

      case "classify": {
        if (!exc.intent) return undefined;
        const data: Record<string, unknown> = { intent: exc.intent };
        if (typeof analysis?.confidence === "number") {
          data.confidence = analysis.confidence / 100;
        }
        return data;
      }

  * Drift register entry D20 — RESOLVED. The deployed system
    formerly showed every record at 80% because the asoe2
    read-path had `confidence = 80 if intent_selected else 0`
    hardcoded; closes the partial-truth state Compliance held
    veto over (Verdict 2026-04-22 / Guardrail #6).

8.13.7 — Remove Math.random() duration synthesis:
  * src/app/exceptions/shared.tsx::buildNodeStates — per-node
    duration_ms intentionally omitted in the NodeState
    projection. The backend doesn't currently emit per-node
    timings (orchestrator emission gap — WSEvent.pipeline_progress
    factory exists but is uncalled, deferred per ADR-026 §B.2);
    synthesising one was a Verdict 2026-04-22 / Guardrail #6
    violation. The renderer now honestly displays nothing in
    place of timings we don't have.

8.13.8 — List pagination + 401 surfacing + silent refresh:
  * src/lib/api.ts::exceptionsApi.list — cursor pagination
    mirrors the backend `next_cursor` envelope.
  * Detail panel surfaces 401 inline rather than silently
    dropping the record; auto re-fetch on WS reconnect.
  * Silent refresh on `task_complete` WS events keeps the list
    current without flicker.

Tests:
  Vitest: 519 passed across 38 files, no regressions. The
  architectural lock test (8.13.5) is a fast source-string
  regex check — adds one test but blocks an entire class of
  silent-mock-only regressions.

Output:
1. List affected files
2. Show the Section 8.4 polling fallback hook with
   POLL_FALLBACK_THRESHOLD constant
3. Show the ExceptionDetailPanel three-branch render
   (verdict-present, executionError, shadow-pending)
4. Show the architectural lock test asserting USE_REAL_API
   appears before MOCK_EXCEPTIONS.find
5. Show the buildNodeData confidence projection (real value, no
   synthesis)
6. Test summary: vitest count + the 7 new architectural lock
   assertions

Do NOT:
- Implement the WaterfallStepper trace-derived rendering — that
  is ADR-027 (Proposed); the topology-side halt-node fix is
  blocked on ADR-027 sign-off + Phase A.0 verdict-vocabulary
  registration on the asoe2 side
- Re-introduce Math.random() / fabricated mid-range defaults /
  fallback chains (`?? "—"`, `?? "N/A"`) anywhere on the
  evidence surface — Verdict 2026-04-22 / Guardrail #6 forbids
- Rewrite the WaterfallStepper itself; its replacement
  (EventsTimeline + PipelineDAG) is queued for ADR-027
  implementation
- Add UI-side composition of enrichment payloads — the backend's
  build_analysis is the sole assembler (Pillar 2)

Return:
  identified intent: live-stack stabilisation
  selected skill: n/a (not classifier work)
  selected recipe: n/a (no recipe execution touched)
  Compliance Shadow result: n/a (orchestration unaffected)
  deterministic execution log or halt reason: see test summary
```

---

## Notes for future sessions

This phase is the UI-side companion to asoe2 Phase 26. Together
they bridge architecture_v3 (Apr 26) and architecture_v4 (May 1).

A reader picking up Phase 9 (Settings & Admin) or a future
ADR-027 implementation phase should:
1. Confirm the polling fallback is still ALIGNED — the
   `useWebSocket` hook's POLL_FALLBACK_THRESHOLD constant should
   still be 5 unless an explicit tuning change has shipped.
2. Confirm the architectural lock test is still green — if
   `tests/architectural/exceptions_api_live_branches.test.ts`
   fails, a refactor has silently dropped a `if (USE_REAL_API)`
   branch and that endpoint is back to mock-only.
3. When implementing ADR-027 (pipeline visualization hybrid),
   the `WaterfallStepper` retirement is structural — read
   ADR-027 rev. 3 in full and follow the phase ladder
   (A.0 verdict vocabulary → A topology endpoint → B trace
   extension + WS batching → C EventsTimeline → D PipelineDAG →
   E role-based default).
4. The hardcoded `STATE_PROGRESS["FAILED"] = 9` in
   `src/app/exceptions/shared.tsx` is a known limitation — it
   conflates "halted at apply_effects" with "halted anywhere
   else." The topology-side fix is part of ADR-027 Phase C; do
   not patch in isolation.
