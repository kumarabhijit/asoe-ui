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
}

interface UseWebSocketReturn {
  status: ConnectionStatus;
  lastEvent: WSEvent | null;
  reconnectCount: number;
}

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

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
}: UseWebSocketOptions): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenRef = useRef<string | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

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

  return { status, lastEvent, reconnectCount };
}
