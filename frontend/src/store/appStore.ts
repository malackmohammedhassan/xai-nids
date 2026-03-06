import { create } from 'zustand';
import type {
  DatasetListItem,
  DatasetSummary,
  DatasetIntrospection,
  ModelMeta,
  ModelMetrics,
  TrainingStatus,
  ExperimentRun,
  HealthStatus,
} from '@/types';

// ─── Activity Log ─────────────────────────────────────────────────────────────
export type ActivityType = 'success' | 'error' | 'warning' | 'info';

export interface ActivityEntry {
  id: string;
  time: string; // ISO datetime
  type: ActivityType;
  message: string;
  detail?: string;
}

interface ActivitySlice {
  activityLog: ActivityEntry[];
  addActivity: (entry: Omit<ActivityEntry, 'id' | 'time'>) => void;
  clearActivity: () => void;
}

// ─── Dataset Slice ────────────────────────────────────────────────────────────
interface DatasetSlice {
  datasets: DatasetListItem[];
  activeSummary: DatasetSummary | null;
  activeIntrospection: DatasetIntrospection | null;
  activeIntelligenceReport: Record<string, unknown> | null;
  selectedDatasetId: string | null;
  setDatasets: (d: DatasetListItem[]) => void;
  setActiveSummary: (s: DatasetSummary | null) => void;
  setActiveIntrospection: (i: DatasetIntrospection | null) => void;
  setActiveIntelligenceReport: (r: Record<string, unknown> | null) => void;
  setSelectedDatasetId: (id: string | null) => void;
  removeDataset: (id: string) => void;
}

// ─── Model Slice ──────────────────────────────────────────────────────────────
interface ModelSlice {
  models: ModelMeta[];
  metricsCache: Record<string, ModelMetrics>;
  selectedModelId: string | null;
  setModels: (m: ModelMeta[]) => void;
  cacheMetrics: (modelId: string, metrics: ModelMetrics) => void;
  setSelectedModelId: (id: string | null) => void;
  removeModel: (id: string) => void;
  markLoaded: (id: string, loaded: boolean) => void;
}

// ─── Training Slice ───────────────────────────────────────────────────────────
export interface ConfusionMatrixData {
  labels: string[];
  matrix: number[][];   // [actual][predicted]
}

export interface ROCPoint {
  fpr: number;
  tpr: number;
}

interface TrainingSlice {
  trainingStatus: TrainingStatus | null;
  trainingLogs: string[];
  liveConfusionMatrix: ConfusionMatrixData | null;
  liveROCPoints: ROCPoint[];
  setTrainingStatus: (s: TrainingStatus | null) => void;
  appendLog: (msg: string) => void;
  clearLogs: () => void;
  setLiveConfusionMatrix: (data: ConfusionMatrixData | null) => void;
  appendROCPoint: (point: ROCPoint) => void;
  clearLiveCharts: () => void;
}

// ─── Experiment Slice ─────────────────────────────────────────────────────────
interface ExperimentSlice {
  experiments: ExperimentRun[];
  setExperiments: (e: ExperimentRun[]) => void;
  removeExperiment: (runId: string) => void;
}

// ─── UI Slice ─────────────────────────────────────────────────────────────────
interface UISlice {
  health: HealthStatus | null;
  sidebarCollapsed: boolean;
  setHealth: (h: HealthStatus | null) => void;
  toggleSidebar: () => void;
}

type AppStore = DatasetSlice & ModelSlice & TrainingSlice & ExperimentSlice & UISlice & ActivitySlice;

export const useAppStore = create<AppStore>((set) => ({
  // Dataset
  datasets: [],
  activeSummary: null,
  activeIntrospection: null,
  activeIntelligenceReport: null,
  selectedDatasetId: null,
  setDatasets: (datasets) => set({ datasets }),
  setActiveSummary: (activeSummary) => set({ activeSummary }),
  setActiveIntrospection: (activeIntrospection) => set({ activeIntrospection }),
  setActiveIntelligenceReport: (activeIntelligenceReport) => set({ activeIntelligenceReport }),
  setSelectedDatasetId: (selectedDatasetId) => set({ selectedDatasetId }),
  removeDataset: (id) =>
    set((s) => ({ datasets: s.datasets.filter((d) => d.dataset_id !== id) })),

  // Models
  models: [],
  metricsCache: {},
  selectedModelId: null,
  setModels: (models) => set({ models }),
  cacheMetrics: (modelId, metrics) =>
    set((s) => ({ metricsCache: { ...s.metricsCache, [modelId]: metrics } })),
  setSelectedModelId: (selectedModelId) => set({ selectedModelId }),
  removeModel: (id) =>
    set((s) => ({ models: s.models.filter((m) => m.model_id !== id) })),
  markLoaded: (id, loaded) =>
    set((s) => ({
      models: s.models.map((m) =>
        m.model_id === id ? { ...m, is_loaded: loaded } : m
      ),
    })),

  // Training
  trainingStatus: null,
  trainingLogs: [],
  liveConfusionMatrix: null,
  liveROCPoints: [],
  setTrainingStatus: (trainingStatus) => set({ trainingStatus }),
  appendLog: (msg) =>
    set((s) => ({
      trainingLogs: [...s.trainingLogs.slice(-499), msg], // cap at 500
    })),
  clearLogs: () => set({ trainingLogs: [] }),
  setLiveConfusionMatrix: (liveConfusionMatrix) => set({ liveConfusionMatrix }),
  appendROCPoint: (point) =>
    set((s) => ({ liveROCPoints: [...s.liveROCPoints, point] })),
  clearLiveCharts: () => set({ liveConfusionMatrix: null, liveROCPoints: [] }),

  // Experiments
  experiments: [],
  setExperiments: (experiments) => set({ experiments }),
  removeExperiment: (runId) =>
    set((s) => ({
      experiments: s.experiments.filter((e) => e.run_id !== runId),
    })),

  // UI
  health: null,
  sidebarCollapsed: false,
  setHealth: (health) => set({ health }),
  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // Activity Log
  activityLog: [],
  addActivity: (entry) =>
    set((s) => ({
      activityLog: [
        {
          ...entry,
          id: Math.random().toString(36).slice(2, 10),
          time: new Date().toISOString(),
        },
        ...s.activityLog.slice(0, 499), // keep last 500 entries
      ],
    })),
  clearActivity: () => set({ activityLog: [] }),
}));
