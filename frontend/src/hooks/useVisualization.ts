/**
 * useVisualization.ts — Fetch tier-1, tier-2, and tier-3 viz data on demand.
 */
import { useCallback } from 'react';
import { getTier1Viz, getTier2Viz, getTier3Viz, triggerTier3Viz } from '@/api/visualizations';
import { useVizStore } from '@/store/vizStore';
import type { Tier2VizType, Tier3VizType } from '@/store/vizStore';

export function useVisualization(datasetId: string | null) {
  const {
    datasets,
    setTier1,
    setTier1State,
    setTier2,
    setTier2State,
    setTier3,
    setTier3JobId,
  } = useVizStore();

  const slot = datasetId ? (datasets[datasetId] ?? null) : null;

  // ─── Tier 1 ─────────────────────────────────────────────────────────────
  const fetchTier1 = useCallback(async () => {
    if (!datasetId) return;
    if (slot?.tier1State === 'loaded' || slot?.tier1State === 'loading') return;
    setTier1State(datasetId, 'loading');
    try {
      const data = await getTier1Viz(datasetId);
      setTier1(datasetId, data);
    } catch {
      setTier1State(datasetId, 'error');
    }
  }, [datasetId, slot?.tier1State, setTier1, setTier1State]);

  // ─── Tier 2 ─────────────────────────────────────────────────────────────
  const fetchTier2 = useCallback(
    async (type: Tier2VizType) => {
      if (!datasetId) return;
      if (slot?.tier2States[type] === 'loaded' || slot?.tier2States[type] === 'loading') return;
      setTier2State(datasetId, type, 'loading');
      try {
        const data = await getTier2Viz(datasetId, type);
        setTier2(datasetId, type, data);
      } catch {
        setTier2State(datasetId, type, 'error');
      }
    },
    [datasetId, slot?.tier2States, setTier2, setTier2State],
  );

  // ─── Tier 3 ─────────────────────────────────────────────────────────────
  const fetchTier3 = useCallback(
    async (type: Tier3VizType) => {
      if (!datasetId) return;
      // First try fetching cached result
      try {
        const data = await getTier3Viz(datasetId, type);
        setTier3(datasetId, type, data);
      } catch {
        // Not yet computed — trigger background job
        try {
          const res = await triggerTier3Viz(datasetId, type);
          setTier3JobId(datasetId, type, res.job_id);
        } catch {
          /* silently ignore double-trigger errors */
        }
      }
    },
    [datasetId, setTier3, setTier3JobId],
  );

  return {
    tier1: slot?.tier1 ?? null,
    tier1State: slot?.tier1State ?? 'idle',
    tier2Cache: slot?.tier2Cache ?? {},
    tier2States: slot?.tier2States ?? {},
    tier3Cache: slot?.tier3Cache ?? {},
    tier3JobIds: slot?.tier3JobIds ?? {},
    fetchTier1,
    fetchTier2,
    fetchTier3,
  };
}
