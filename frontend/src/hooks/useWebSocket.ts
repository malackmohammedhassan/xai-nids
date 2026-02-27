import { useEffect, useRef, useCallback, useState } from 'react';
import type { TrainingProgressEvent } from '@/types';

const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export function useWebSocket(onMessage: (event: TrainingProgressEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const url = `${WS_BASE}/api/v1/models/train/stream`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
      setConnected(true);
    };

    ws.onmessage = (e) => {
      try {
        const data: TrainingProgressEvent = JSON.parse(e.data as string);
        onMessage(data);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (!mountedRef.current) return;
      if (retriesRef.current < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, retriesRef.current);
        retriesRef.current += 1;
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [onMessage]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected, send };
}
