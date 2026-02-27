import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { trainingApi } from '@/api';
import { useTraining } from '@/hooks/useTraining';
import { useDatasets } from '@/hooks/useDatasets';
import { ModelSelector } from '@/components/training/ModelSelector';
import { HyperparamEditor } from '@/components/training/HyperparamEditor';
import { TrainingMonitor } from '@/components/training/TrainingMonitor';
import { LogsPanel } from '@/components/training/LogsPanel';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import type { ModelConfig } from '@/types';

export default function TrainingPage() {
  const { datasets, fetchList: fetchDatasets } = useDatasets();
  const { trainingStatus, trainingLogs, wsConnected, startTraining, clearLogs } = useTraining();

  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [configsLoading, setConfigsLoading] = useState(false);

  const [selectedDataset, setSelectedDataset] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [selectedModel, setSelectedModel] = useState('random_forest');
  const [hyperparams, setHyperparams] = useState<Record<string, unknown>>({});
  const [useOptuna, setUseOptuna] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const selectedConfig = configs.find((c) => c.model_type === selectedModel);

  useEffect(() => {
    fetchDatasets();
    setConfigsLoading(true);
    trainingApi
      .modelConfigs()
      .then((cfgs) => {
        setConfigs(cfgs);
        if (cfgs.length > 0) {
          setSelectedModel(cfgs[0].model_type);
          const defaults: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(cfgs[0].hyperparameters)) {
            defaults[k] = v.default;
          }
          setHyperparams(defaults);
        }
      })
      .finally(() => setConfigsLoading(false));
  }, [fetchDatasets]);

  // When model changes, reset hp defaults
  useEffect(() => {
    if (!selectedConfig) return;
    const defaults: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(selectedConfig.hyperparameters)) {
      defaults[k] = v.default;
    }
    setHyperparams(defaults);
  }, [selectedConfig]);

  const handleHpChange = (key: string, value: unknown) => {
    setHyperparams((prev) => ({ ...prev, [key]: value }));
  };

  const handleTrain = async () => {
    if (!selectedDataset || !targetColumn) {
      toast.error('Select a dataset and specify target column');
      return;
    }
    setSubmitting(true);
    try {
      await startTraining({
        dataset_id: selectedDataset,
        target_column: targetColumn,
        model_type: selectedModel,
        hyperparameters: useOptuna ? undefined : hyperparams,
        use_optuna: useOptuna,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl font-bold text-white">Model Training</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: config form */}
        <div className="space-y-5">
          {/* Dataset selection */}
          <div className="space-y-2">
            <label className="text-gray-300 text-sm font-medium">Dataset</label>
            <select
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
            >
              <option value="">Select a dataset…</option>
              {datasets.map((d) => (
                <option key={d.dataset_id} value={d.dataset_id}>
                  {d.filename} ({d.row_count.toLocaleString()} rows)
                </option>
              ))}
            </select>
          </div>

          {/* Target column */}
          <div className="space-y-2">
            <label className="text-gray-300 text-sm font-medium">Target Column</label>
            <input
              type="text"
              value={targetColumn}
              onChange={(e) => setTargetColumn(e.target.value)}
              placeholder="e.g. label, class, attack_cat"
              className="w-full bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 placeholder-gray-600"
            />
          </div>

          {/* Model selector */}
          {configsLoading ? (
            <LoadingSkeleton lines={3} />
          ) : (
            <ModelSelector
              configs={configs}
              selected={selectedModel}
              onChange={setSelectedModel}
            />
          )}

          {/* Hyperparams */}
          {selectedConfig && (
            <HyperparamEditor
              schema={selectedConfig.hyperparameters}
              values={hyperparams}
              onChange={handleHpChange}
              useOptuna={useOptuna}
              onOptunaChange={setUseOptuna}
            />
          )}

          <button
            onClick={handleTrain}
            disabled={submitting || trainingStatus?.is_training}
            className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors w-full justify-center"
          >
            <Play size={16} />
            {submitting
              ? 'Starting…'
              : trainingStatus?.is_training
              ? 'Training in progress…'
              : 'Start Training'}
          </button>
        </div>

        {/* Right: live monitor */}
        <div className="space-y-4">
          <TrainingMonitor
            status={trainingStatus}
            wsConnected={wsConnected}
            logs={trainingLogs}
          />
          <LogsPanel logs={trainingLogs} onClear={clearLogs} />
        </div>
      </div>
    </div>
  );
}
