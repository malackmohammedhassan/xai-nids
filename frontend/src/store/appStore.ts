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

// ─── Dataset Slice ────────────────────────────────────────────────────────────
interface DatasetSlice {
  datasets: DatasetListItem[];
  activeSummary: DatasetSummary | null;
  activeIntrospection: DatasetIntrospection | null;
  selectedDatasetId: string | null;
  setDatasets: (d: DatasetListItem[]) => void;
  setActiveSummary: (s: DatasetSummary | null) => void;
  setActiveIntrospection: (i: DatasetIntrospection | null) => void;
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
interface TrainingSlice {
  trainingStatus: TrainingStatus | null;
  trainingLogs: string[];
  setTrainingStatus: (s: TrainingStatus | null) => void;
  appendLog: (msg: string) => void;
  clearLogs: () => void;
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

type AppStore = DatasetSlice & ModelSlice & TrainingSlice & ExperimentSlice & UISlice;

export const useAppStore = create<AppStore>((set) => ({
  // Dataset
  datasets: [],
  activeSummary: null,
  activeIntrospection: null,
  selectedDatasetId: null,
  setDatasets: (datasets) => set({ datasets }),
  setActiveSummary: (activeSummary) => set({ activeSummary }),
  setActiveIntrospection: (activeIntrospection) => set({ activeIntrospection }),
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
  setTrainingStatus: (trainingStatus) => set({ trainingStatus }),
  appendLog: (msg) =>
    set((s) => ({
      trainingLogs: [...s.trainingLogs.slice(-499), msg], // cap at 500
    })),
  clearLogs: () => set({ trainingLogs: [] }),

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
}));
