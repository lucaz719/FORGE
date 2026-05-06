import { useEffect, useRef, useState } from "react";
import type { ForgeEvent } from "../types/events";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "ws://localhost:8000";

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<ForgeEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryDelay = useRef(500);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let retryTimer: number | null = null;

    const connect = () => {
      if (!mountedRef.current) {
        return;
      }

      const wsUrl = BACKEND_URL.replace(/^http/, "ws") + "/ws";
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryDelay.current = 500;
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as ForgeEvent;
          setLastEvent(parsed);
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (mountedRef.current) {
          retryTimer = window.setTimeout(connect, retryDelay.current);
          retryDelay.current = Math.min(retryDelay.current * 2, 10000);
        }
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      wsRef.current?.close();
    };
  }, []);

  return { connected, lastEvent };
}
