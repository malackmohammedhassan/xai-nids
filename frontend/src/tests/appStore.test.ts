/**
 * Zustand store unit tests.
 * Validates all slice mutations in isolation — no network, no React.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/store/appStore';
import type { DatasetListItem, ModelMeta, TrainingStatus } from '@/types';

// Reset store state between tests
function resetStore() {
  useAppStore.setState({
    datasets: [],
    activeSummary: null,
    activeIntrospection: null,
    activeIntelligenceReport: null,
    selectedDatasetId: null,
    models: [],
    metricsCache: {},
    selectedModelId: null,
    trainingStatus: null,
    trainingLogs: [],
    liveConfusionMatrix: null,
    liveROCPoints: [],
    experiments: [],
    health: null,
    sidebarCollapsed: false,
  });
}

const MOCK_DATASET: DatasetListItem = {
  dataset_id: 'ds-001',
  filename: 'test.csv',
  row_count: 100,
  column_count: 5,
  size_bytes: 1024,
  uploaded_at: '2026-01-01T00:00:00Z',
};

const MOCK_MODEL: ModelMeta = {
  model_id: 'rf_20260101_000000_abc',
  model_type: 'random_forest',
  dataset_id: 'ds-001',
  target_column: 'label',
  feature_names: ['feat_a', 'feat_b'],
  created_at: '2026-01-01T00:00:00Z',
  plugin_name: 'xai_ids',
  hyperparameters: {},
  is_loaded: false,
};

// ─── Dataset slice ────────────────────────────────────────────────────────────

describe('AppStore — dataset slice', () => {
  beforeEach(resetStore);

  it('starts with empty datasets', () => {
    expect(useAppStore.getState().datasets).toHaveLength(0);
  });

  it('setDatasets replaces the list', () => {
    useAppStore.getState().setDatasets([MOCK_DATASET]);
    expect(useAppStore.getState().datasets).toHaveLength(1);
    expect(useAppStore.getState().datasets[0].dataset_id).toBe('ds-001');
  });

  it('setDatasets([]) clears existing datasets', () => {
    useAppStore.getState().setDatasets([MOCK_DATASET]);
    useAppStore.getState().setDatasets([]);
    expect(useAppStore.getState().datasets).toHaveLength(0);
  });

  it('removeDataset removes by id', () => {
    useAppStore.getState().setDatasets([MOCK_DATASET, { ...MOCK_DATASET, dataset_id: 'ds-002' }]);
    useAppStore.getState().removeDataset('ds-001');
    const ids = useAppStore.getState().datasets.map((d) => d.dataset_id);
    expect(ids).not.toContain('ds-001');
    expect(ids).toContain('ds-002');
  });

  it('setSelectedDatasetId updates selection', () => {
    useAppStore.getState().setSelectedDatasetId('ds-001');
    expect(useAppStore.getState().selectedDatasetId).toBe('ds-001');
  });

  it('setSelectedDatasetId(null) clears selection', () => {
    useAppStore.getState().setSelectedDatasetId('ds-001');
    useAppStore.getState().setSelectedDatasetId(null);
    expect(useAppStore.getState().selectedDatasetId).toBeNull();
  });
});

// ─── Model slice ──────────────────────────────────────────────────────────────

describe('AppStore — model slice', () => {
  beforeEach(resetStore);

  it('starts with no models', () => {
    expect(useAppStore.getState().models).toHaveLength(0);
  });

  it('setModels replaces list', () => {
    useAppStore.getState().setModels([MOCK_MODEL]);
    expect(useAppStore.getState().models).toHaveLength(1);
  });

  it('markLoaded toggles is_loaded', () => {
    useAppStore.getState().setModels([MOCK_MODEL]);
    useAppStore.getState().markLoaded(MOCK_MODEL.model_id, true);
    expect(useAppStore.getState().models[0].is_loaded).toBe(true);
    useAppStore.getState().markLoaded(MOCK_MODEL.model_id, false);
    expect(useAppStore.getState().models[0].is_loaded).toBe(false);
  });

  it('removeModel removes the correct entry', () => {
    const m2 = { ...MOCK_MODEL, model_id: 'rf_002' };
    useAppStore.getState().setModels([MOCK_MODEL, m2]);
    useAppStore.getState().removeModel(MOCK_MODEL.model_id);
    expect(useAppStore.getState().models.map((m) => m.model_id)).toEqual(['rf_002']);
  });

  it('cacheMetrics stores keyed metrics', () => {
    const metrics = {
      accuracy: 0.95,
      precision: 0.94,
      recall: 0.93,
      f1: 0.94,
      roc_auc: 0.97,
    } as any;
    useAppStore.getState().cacheMetrics('rf_001', metrics);
    expect(useAppStore.getState().metricsCache['rf_001'].accuracy).toBe(0.95);
  });
});

// ─── Training slice ───────────────────────────────────────────────────────────

describe('AppStore — training slice', () => {
  beforeEach(resetStore);

  it('appendLog accumulates log lines', () => {
    useAppStore.getState().appendLog('[INFO] step 1');
    useAppStore.getState().appendLog('[INFO] step 2');
    expect(useAppStore.getState().trainingLogs).toHaveLength(2);
    expect(useAppStore.getState().trainingLogs[1]).toBe('[INFO] step 2');
  });

  it('clearLogs empties the array', () => {
    useAppStore.getState().appendLog('x');
    useAppStore.getState().clearLogs();
    expect(useAppStore.getState().trainingLogs).toHaveLength(0);
  });

  it('setTrainingStatus sets and clears status', () => {
    const status: TrainingStatus = {
      is_training: true, current_step: 'Preprocessing',
      progress: 20, total: 100,
    };
    useAppStore.getState().setTrainingStatus(status);
    expect(useAppStore.getState().trainingStatus?.current_step).toBe('Preprocessing');
    useAppStore.getState().setTrainingStatus(null);
    expect(useAppStore.getState().trainingStatus).toBeNull();
  });

  it('appendROCPoint grows the array', () => {
    useAppStore.getState().appendROCPoint({ fpr: 0.1, tpr: 0.8 });
    useAppStore.getState().appendROCPoint({ fpr: 0.2, tpr: 0.9 });
    expect(useAppStore.getState().liveROCPoints).toHaveLength(2);
  });

  it('clearLiveCharts resets ROC and confusion', () => {
    useAppStore.getState().appendROCPoint({ fpr: 0.1, tpr: 0.8 });
    useAppStore.getState().setLiveConfusionMatrix({ labels: ['A', 'B'], matrix: [[10, 2], [1, 9]] });
    useAppStore.getState().clearLiveCharts();
    expect(useAppStore.getState().liveROCPoints).toHaveLength(0);
    expect(useAppStore.getState().liveConfusionMatrix).toBeNull();
  });
});

// ─── UI slice ─────────────────────────────────────────────────────────────────

describe('AppStore — UI slice', () => {
  beforeEach(resetStore);

  it('toggleSidebar flips the flag', () => {
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
  });

  it('setHealth stores health object', () => {
    const h = {
      status: 'healthy', version: '2.0.0', backend_ready: true,
      model_loaded: false, uptime_seconds: 10, python_version: '3.11',
      loaded_plugin: 'xai_ids', available_plugins: [], total_models: 0,
      dataset_dir_exists: true, model_dir_exists: true,
      experiment_db_exists: true, plugins_loaded: [], loaded_models: [],
      active_training: false,
    } as any;
    useAppStore.getState().setHealth(h);
    expect(useAppStore.getState().health?.status).toBe('healthy');
  });
});
