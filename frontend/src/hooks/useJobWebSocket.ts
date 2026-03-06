/**
 * useJobWebSocket.ts
 * Connects to /api/v2/jobs/stream and keeps the jobStore up-to-date.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { v2wsUrl } from '@/api/v2client';
import { useJobStore } from '@/store/jobStore';
import type { Job } from '@/store/jobStore';

const MAX_RETRIES = 6;
const BASE_DELAY_MS = 1_000;

interface InitialStateMessage {
  type: 'initial_state';
  jobs: Job[];
}

interface JobUpdateMessage {
  type: 'job_update';
  job: Partial<Job> & { job_id: string };
}

interface JobLogMessage {
  type: 'job_log';
  job_id: string;
  line: string;
}

type WsMessage = InitialStateMessage | JobUpdateMessage | JobLogMessage;

export function useJobWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);
  const [connected, setConnected] = useState(false);

  const { setJobs, upsertJob, appendLog } = useJobStore();

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      if (msg.type === 'initial_state') {
        setJobs(msg.jobs);
      } else if (msg.type === 'job_update') {
        upsertJob(msg.job);
      } else if (msg.type === 'job_log') {
        appendLog(msg.job_id, msg.line);
      }
    },
    [setJobs, upsertJob, appendLog],
  );

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const url = v2wsUrl('/jobs/stream');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
      setConnected(true);
    };

    ws.onmessage = (e) => {
      try {
        const data: WsMessage = JSON.parse(e.data as string);
        handleMessage(data);
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

    ws.onerror = () => ws.close();
  }, [handleMessage]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
