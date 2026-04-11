# Phase 8: WebSocket Integration

**Prerequisite:** Phase 4 (WebSocket types)
**Architecture reference:** `consol_arch.md` Section 8 (Real-Time Communication Protocol)
**Backend reference (read-only):** `asoe2/api/routes/ws.py`, `asoe2/api/events.py`, `asoe2/api/pubsub.py`

---

## Context

Section 8 defines the WebSocket protocol for real-time pipeline progress updates. The `WaterfallStepper` component consumes these events to show per-node execution progress as it happens.

---

## Hook: useWebSocket (`src/hooks/useWebSocket.ts`)

### Protocol (Section 8.1)

1. **Connect:** Open WebSocket to `ws://host/api/v1/ws` (derived from `NEXT_PUBLIC_API_URL` by replacing `http` → `ws`)
2. **Authenticate:** Send auth message as first frame:
   ```json
   { "type": "auth", "token": "eyJ...", "last_seen": "2026-04-11T10:00:00Z" }
   ```
   - `token`: JWT access token
   - `last_seen`: optional ISO 8601 timestamp — server replays missed events from 60-second Redis buffer
3. **Receive:** Parse incoming messages as `WSEvent` objects
4. **Disconnect:** Clean up, prepare for reconnection

### Reconnection (Section 8.4)

Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 30s max.

On reconnect, send `last_seen` timestamp (tracked from last received event) so the server replays missed events.

**Fallback:** If WebSocket fails entirely, the UI falls back to polling `GET /api/v1/exceptions/{id}` every 3 seconds (not implemented in this phase — noted for Phase 9+).

### Hook Interface

```typescript
function useWebSocket(options: {
  url?: string;       // Override WebSocket URL
  token?: string;     // JWT for auth message
  enabled?: boolean;  // Set false to disable
  onEvent?: (event: WSEvent) => void;  // Per-event callback
}): {
  status: "connecting" | "connected" | "disconnected" | "error";
  lastEvent: WSEvent | null;
  reconnectCount: number;
}
```

### Implementation Details

- `wsRef` holds the WebSocket instance (ref, not state — avoids re-renders)
- `lastSeenRef` tracks the timestamp of the last received event (ref for reconnection)
- `onEventRef` wraps the callback in a ref to avoid dependency changes
- `connect()` wrapped in `useCallback` with `[token, enabled, url]` deps
- `onclose` handler increments `reconnectCount` and schedules reconnect via `setTimeout`
- Cleanup effect closes WebSocket and clears reconnect timer
- On cleanup, `ws.onclose = null` prevents reconnection from unmount

### Event Types (from `src/types/websocket.ts`)

| Event Type | Payload | UI Consumer |
|---|---|---|
| `pipeline_progress` | `{ node, status, duration_ms?, data? }` | WaterfallStepper |
| `exception_update` | `{ lifecycle_state, updated_fields }` | Exception Queue list refresh |
| `task_complete` | `{ task_id, final_status, explanation }` | Exception detail update |
| `error` | `{ code, message }` | Toast notification |

---

## Usage Example (future integration)

```tsx
const { status, lastEvent } = useWebSocket({
  token: session?.accessToken,
  enabled: !!session,
  onEvent: (event) => {
    if (event.type === "pipeline_progress") {
      // Update WaterfallStepper node states
      updateNodeState(event.payload as PipelineProgressPayload);
    }
    if (event.type === "exception_update") {
      // Refresh exception list
      fetchExceptions();
    }
  },
});
```

Note: In the current implementation, the hook is created but not yet wired into the Exception Queue page. The page uses API polling (fetch on mount + filter change). Real-time WebSocket integration with WaterfallStepper is a Phase 9+ concern when connected to the real backend.

---

## Verification

1. `npm run build` passes (hook compiles cleanly)
2. Hook exports `useWebSocket` with typed return value
3. Auth message format matches Section 8.1: `{ type: "auth", token, last_seen? }`
4. Reconnection uses exponential backoff: 1s base, 30s max
5. `last_seen` timestamp sent on reconnect for event replay
6. Cleanup closes WebSocket without triggering reconnection
