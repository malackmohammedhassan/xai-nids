/**
 * useIntelligence.ts
 * Trigger + poll the dataset intelligence analysis, writing results to appStore.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getIntelligence, triggerIntelligence } from '@/api/intelligence';
import { useAppStore } from '@/store/appStore';
import { useJobStore } from '@/store/jobStore';

const POLL_INTERVAL_MS = 3_000;

export function useIntelligence(datasetId: string | null) {
  const [status, setStatus] = useState<'idle' | 'triggering' | 'polling' | 'ready' | 'error'>(
    'idle',
  );
  const [jobId, setJobId] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);

  const setReport = useAppStore((s) => s.setActiveIntelligenceReport);
  const getJob = useJobStore((s) => s.getJob);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    if (!datasetId || !mounted.current) return;
    try {
      const res = await getIntelligence(datasetId);
      if (res.status === 'ready' && res.report) {
        setReport(res.report);
        setStatus('ready');
        stopPolling();
      } else if (res.status === 'not_computed') {
        setStatus('idle');
        stopPolling();
      }
      // still 'computing' → keep polling
    } catch {
      setStatus('error');
      stopPolling();
    }
  }, [datasetId, setReport, stopPolling]);

  const trigger = useCallback(async () => {
    if (!datasetId) return;
    setStatus('triggering');
    try {
      const res = await triggerIntelligence(datasetId);
      setJobId(res.job_id);
      setStatus('polling');
      pollTimer.current = setInterval(poll, POLL_INTERVAL_MS);
    } catch {
      setStatus('error');
    }
  }, [datasetId, poll]);

  // On mount / dataset change, check if already computed
  useEffect(() => {
    mounted.current = true;
    if (!datasetId) return;
    getIntelligence(datasetId).then((res) => {
      if (!mounted.current) return;
      if (res.status === 'ready' && res.report) {
        setReport(res.report);
        setStatus('ready');
      } else if (res.status === 'computing') {
        setStatus('polling');
        pollTimer.current = setInterval(poll, POLL_INTERVAL_MS);
      }
    }).catch(() => {/* silent */});
    return () => {
      mounted.current = false;
      stopPolling();
    };
  }, [datasetId, poll, setReport, stopPolling]);

  // Also watch job store for live updates from WS
  useEffect(() => {
    if (!jobId) return;
    const job = getJob(jobId);
    if (!job) return;
    if (job.status === 'succeeded') {
      getIntelligence(datasetId!).then((res) => {
        if (res.report) {
          setReport(res.report);
          setStatus('ready');
          stopPolling();
        }
      }).catch(() => {/* silent */});
    } else if (job.status === 'failed') {
      setStatus('error');
      stopPolling();
    }
  }, [jobId, getJob, datasetId, setReport, stopPolling]);

  return { status, trigger, jobId };
}
