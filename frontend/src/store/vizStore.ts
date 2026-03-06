/**
 * vizStore.ts — Per-dataset visualization data cache (tier 1/2/3)
 */
import { create } from 'zustand';

export type LoadingState = 'idle' | 'loading' | 'loaded' | 'error';

export interface Tier1Data {
  missing_heatmap?: unknown;
  null_pct_bar?: Record<string, number>;
  cardinality_bar?: Record<string, number>;
  skewness_bar?: Record<string, number>;
  dtype_breakdown?: Record<string, number>;
  class_distribution?: Record<string, number>;
  [key: string]: unknown;
}

export type Tier2VizType =
  | 'histograms'
  | 'boxplots'
  | 'correlation'
  | 'mutual_info'
  | 'violin';

export type Tier3VizType = 'pca' | 'tsne' | 'isolation_forest';

interface DatasetVizSlice {
  tier1: Tier1Data | null;
  tier1State: LoadingState;
  tier2Cache: Partial<Record<Tier2VizType, unknown>>;
  tier2States: Partial<Record<Tier2VizType, LoadingState>>;
  tier3Cache: Partial<Record<Tier3VizType, unknown>>;
  tier3JobIds: Partial<Record<Tier3VizType, string>>;
}

interface VizStore {
  /** keyed by dataset_id */
  datasets: Record<string, DatasetVizSlice>;

  setTier1: (datasetId: string, data: Tier1Data) => void;
  setTier1State: (datasetId: string, state: LoadingState) => void;

  setTier2: (datasetId: string, type: Tier2VizType, data: unknown) => void;
  setTier2State: (datasetId: string, type: Tier2VizType, state: LoadingState) => void;

  setTier3: (datasetId: string, type: Tier3VizType, data: unknown) => void;
  setTier3JobId: (datasetId: string, type: Tier3VizType, jobId: string) => void;

  /** Clear all cached viz data for a dataset (called after re-upload) */
  invalidate: (datasetId: string) => void;
}

function emptySlice(): DatasetVizSlice {
  return {
    tier1: null,
    tier1State: 'idle',
    tier2Cache: {},
    tier2States: {},
    tier3Cache: {},
    tier3JobIds: {},
  };
}

export const useVizStore = create<VizStore>((set) => ({
  datasets: {},

  setTier1: (datasetId, data) =>
    set((s) => ({
      datasets: {
        ...s.datasets,
        [datasetId]: {
          ...(s.datasets[datasetId] ?? emptySlice()),
          tier1: data,
          tier1State: 'loaded',
        },
      },
    })),

  setTier1State: (datasetId, state) =>
    set((s) => ({
      datasets: {
        ...s.datasets,
        [datasetId]: {
          ...(s.datasets[datasetId] ?? emptySlice()),
          tier1State: state,
        },
      },
    })),

  setTier2: (datasetId, type, data) =>
    set((s) => {
      const existing = s.datasets[datasetId] ?? emptySlice();
      return {
        datasets: {
          ...s.datasets,
          [datasetId]: {
            ...existing,
            tier2Cache: { ...existing.tier2Cache, [type]: data },
            tier2States: { ...existing.tier2States, [type]: 'loaded' },
          },
        },
      };
    }),

  setTier2State: (datasetId, type, state) =>
    set((s) => {
      const existing = s.datasets[datasetId] ?? emptySlice();
      return {
        datasets: {
          ...s.datasets,
          [datasetId]: {
            ...existing,
            tier2States: { ...existing.tier2States, [type]: state },
          },
        },
      };
    }),

  setTier3: (datasetId, type, data) =>
    set((s) => {
      const existing = s.datasets[datasetId] ?? emptySlice();
      return {
        datasets: {
          ...s.datasets,
          [datasetId]: {
            ...existing,
            tier3Cache: { ...existing.tier3Cache, [type]: data },
          },
        },
      };
    }),

  setTier3JobId: (datasetId, type, jobId) =>
    set((s) => {
      const existing = s.datasets[datasetId] ?? emptySlice();
      return {
        datasets: {
          ...s.datasets,
          [datasetId]: {
            ...existing,
            tier3JobIds: { ...existing.tier3JobIds, [type]: jobId },
          },
        },
      };
    }),

  invalidate: (datasetId) =>
    set((s) => {
      const next = { ...s.datasets };
      delete next[datasetId];
      return { datasets: next };
    }),
}));
