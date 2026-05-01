/**
 * useWebSocket — real-time pipeline updates via WebSocket (Section 8).
 *
 * Protocol:
 * 1. Connect to ws://host/api/v1/ws
 * 2. Send auth message with JWT token
 * 3. Receive WSEvent messages (pipeline_progress, exception_update, etc.)
 *
 * Resilience (Section 8.4):
 * - Reconnects with exponential backoff (1s, 2s, 4s, 8s, max 30s)
 * - Sends last_seen_timestamp on reconnect for event replay
 * - Falls back to REST polling if WebSocket fails entirely
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { WSEvent } from "@/types/websocket";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface UseWebSocketOptions {
  /** WebSocket URL (default: derived from NEXT_PUBLIC_API_URL) */
  url?: string;
  /** JWT access token for authentication */
  token?: string;
  /** Whether to connect (set false to disable) */
  enabled?: boolean;
  /** Callback for each received event */
  onEvent?: (event: WSEvent) => void;
  /**
   * Fired once after a successful reconnect (i.e. the connection
   * dropped, the backoff fired, and the new socket reached
   * onopen+auth). Lets the consumer reconcile any state that may
   * have drifted while the socket was down — typically a list /
   * detail re-fetch. Not fired on the initial connect.
   */
  onReconnect?: () => void;
  /**
   * Section 8.4 polling fallback. Fired periodically while the
   * WebSocket has been unhealthy beyond MAX_BACKOFF for several
   * consecutive attempts (POLL_FALLBACK_THRESHOLD). Lets the
   * consumer fall back to REST so the UI doesn't go stale when the
   * WS is genuinely broken (proxy issue, sticky-session glitch,
   * Container Apps cold-start race). Auto-clears on successful
   * reconnect — the next reconnectCount=0 reset stops the interval.
   *
   * The backend remains the source of truth either way; polling
   * just trades real-time for eventual-consistency. Use the same
   * silent-refresh path the consumer uses for WS-driven updates so
   * the user doesn't see loading flicker.
   */
  onPollFallback?: () => void;
  /** Polling interval in ms while in fallback mode. Default 5000. */
  pollFallbackIntervalMs?: number;
}

interface UseWebSocketReturn {
  status: ConnectionStatus;
  lastEvent: WSEvent | null;
  reconnectCount: number;
}

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;
// After this many consecutive reconnect attempts have failed, treat
// the WebSocket as effectively down and start polling. Computed against
// the backoff schedule: 1+2+4+8+16+30 = ~61s of failed reconnects gets
// us to attempt 6, so threshold=5 means polling kicks in around the
// ~30-45s mark — short enough to keep the UI fresh, long enough to
// avoid noisy fallback during transient hiccups.
const POLL_FALLBACK_THRESHOLD = 5;
const DEFAULT_POLL_INTERVAL_MS = 5_000;

function getWsUrl(baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const wsBase = base.replace(/^http/, "ws");
  return `${wsBase}/api/v1/ws`;
}

export function useWebSocket({
  url,
  token,
  enabled = true,
  onEvent,
  onReconnect,
  onPollFallback,
  pollFallbackIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeenRef = useRef<string | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;
  const onPollFallbackRef = useRef(onPollFallback);
  onPollFallbackRef.current = onPollFallback;
  // Tracks whether we've ever opened a socket on this hook instance.
  // The first onopen is the initial connect; every subsequent one is
  // a reconnect that should fire onReconnect.
  const hasOpenedOnceRef = useRef(false);

  const connect = useCallback(() => {
    if (!token || !enabled) return;

    const wsUrl = url || getWsUrl();
    setStatus("connecting");

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send auth message per Section 8.1
        const authMsg: { type: string; token: string; last_seen?: string } = {
          type: "auth",
          token,
        };
        if (lastSeenRef.current) {
          authMsg.last_seen = lastSeenRef.current;
        }
        ws.send(JSON.stringify(authMsg));
        setStatus("connected");
        setReconnectCount(0);
        // Fire onReconnect after the second-and-later opens. Critical
        // for the "exception details disappeared" UX: Container Apps
        // closes idle WebSockets at ~4 minutes, the backoff fires, and
        // when we reattach the consumer needs to refetch any state
        // that might have changed while we were offline (otherwise the
        // detail panel keeps showing pre-disconnect data with no way
        // to know it's stale).
        if (hasOpenedOnceRef.current) {
          onReconnectRef.current?.();
        }
        hasOpenedOnceRef.current = true;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WSEvent;
          lastSeenRef.current = data.timestamp;
          setLastEvent(data);
          onEventRef.current?.(data);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = () => {
        setStatus("error");
      };

      ws.onclose = () => {
        setStatus("disconnected");
        wsRef.current = null;

        // Exponential backoff reconnection
        if (enabled) {
          setReconnectCount((prev) => {
            const next = prev + 1;
            const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, next - 1), MAX_BACKOFF_MS);
            reconnectTimerRef.current = setTimeout(connect, backoff);
            return next;
          });
        }
      };
    } catch {
      setStatus("error");
    }
  }, [token, enabled, url]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on cleanup
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Section 8.4 polling fallback. When `reconnectCount` crosses the
  // threshold while still enabled, start a periodic call to
  // onPollFallback. onopen resets reconnectCount to 0 → this effect
  // re-runs → the interval is cleared and we drop back to the WS-only
  // path. No-op when onPollFallback isn't supplied, so consumers that
  // don't want polling pay nothing for it.
  useEffect(() => {
    const inFallback =
      enabled
      && reconnectCount >= POLL_FALLBACK_THRESHOLD
      && !!onPollFallbackRef.current;

    if (inFallback && !pollIntervalRef.current) {
      // Fire once immediately so the user gets fresh data without
      // waiting a full interval after the threshold trips.
      onPollFallbackRef.current?.();
      pollIntervalRef.current = setInterval(() => {
        onPollFallbackRef.current?.();
      }, pollFallbackIntervalMs);
    } else if (!inFallback && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [reconnectCount, enabled, pollFallbackIntervalMs]);

  return { status, lastEvent, reconnectCount };
}
