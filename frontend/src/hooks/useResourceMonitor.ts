/**
 * useResourceMonitor.ts
 * Polls /api/v2/system/resources every 2s to expose live CPU & RAM usage.
 * Polling is active only when `enabled` is true (e.g. during training).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { v2get } from '@/api/v2client';

export interface ResourceStats {
  cpu_pct: number;
  ram_used_mb: number;
  ram_total_mb: number;
  active_jobs: number;
  available: boolean;
}

const POLL_INTERVAL_MS = 2_000;

export function useResourceMonitor(enabled = true) {
  const [stats, setStats] = useState<ResourceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await v2get<ResourceStats>('/system/resources');
      setStats(data);
    } catch {
      // silently ignore — non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Immediately fetch then poll
    setLoading(true);
    void fetchStats();
    timerRef.current = setInterval(() => void fetchStats(), POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, fetchStats]);

  const ram_pct =
    stats && stats.ram_total_mb > 0
      ? Math.round((stats.ram_used_mb / stats.ram_total_mb) * 100)
      : 0;

  return { stats, loading, ram_pct };
}
