/** visualizations.ts — v2 visualization endpoints */
import { v2get, v2post } from './v2client';
import type { Tier2VizType, Tier3VizType } from '@/store/vizStore';

// ─── Tier 1 ──────────────────────────────────────────────────────────────────
export async function getTier1Viz(datasetId: string): Promise<Record<string, unknown>> {
  return v2get(`/datasets/${datasetId}/visualizations/tier1`);
}

// ─── Tier 2 ──────────────────────────────────────────────────────────────────
export async function getTier2Viz(
  datasetId: string,
  type: Tier2VizType,
): Promise<Record<string, unknown>> {
  return v2get(`/datasets/${datasetId}/visualizations/tier2/${type}`);
}

// ─── Tier 3 ──────────────────────────────────────────────────────────────────
export interface Tier3TriggerResponse {
  job_id: string;
  status: string;
  message: string;
}

export async function triggerTier3Viz(
  datasetId: string,
  type: Tier3VizType,
): Promise<Tier3TriggerResponse> {
  return v2post(`/datasets/${datasetId}/visualizations/tier3/${type}`);
}

export async function getTier3Viz(
  datasetId: string,
  type: Tier3VizType,
): Promise<Record<string, unknown>> {
  // 404 here is expected (not yet computed) — suppress the toast entirely
  return v2get(`/datasets/${datasetId}/visualizations/tier3/${type}`, { _silent: true });
}
