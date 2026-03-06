import { useEffect, useState } from 'react';
import { Play, ChevronDown, Sparkles, Sliders, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useActivityLogger } from '@/hooks/useActivityLogger';
import { trainingApi, datasetsApi } from '@/api';
import { useTraining } from '@/hooks/useTraining';
import { useDatasets } from '@/hooks/useDatasets';
import { ModelSelector } from '@/components/training/ModelSelector';
import { HyperparamEditor } from '@/components/training/HyperparamEditor';
import { TrainingMonitor } from '@/components/training/TrainingMonitor';
import { LogsPanel } from '@/components/training/LogsPanel';
import { PipelineStepsVisual } from '@/components/training/PipelineStepsVisual';
import { CustomPipelineBuilder } from '@/components/training/CustomPipelineBuilder';
import { usePipelineAdvisor } from '@/hooks/usePipelineAdvisor';
import { LiveConfusionMatrix } from '@/components/training/LiveConfusionMatrix';
import { LiveROCCurve } from '@/components/training/LiveROCCurve';
import { ResourceMonitor } from '@/components/training/ResourceMonitor';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { PageGuide } from '@/components/common/PageGuide';
import { useAppStore } from '@/store/appStore';
import { FEATURES } from '@/utils/features';
import type { ModelConfig, ColumnStats } from '@/types';

export default function TrainingPage() {
  const { datasets, fetchList: fetchDatasets } = useDatasets();
  const { trainingStatus, trainingLogs, wsConnected, startTraining, clearLogs } = useTraining();
  const logger = useActivityLogger();

  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [configsLoading, setConfigsLoading] = useState(false);

  const [selectedDataset, setSelectedDataset] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [selectedModel, setSelectedModel] = useState('random_forest');
  const [hyperparams, setHyperparams] = useState<Record<string, unknown>>({});
  const [useOptuna, setUseOptuna] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // For smart target column selection
  const [datasetColumns, setDatasetColumns] = useState<ColumnStats[]>([]);
  const [suggestedTarget, setSuggestedTarget] = useState('');
  const [targetClasses, setTargetClasses] = useState<string[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // ── Training mode: quick (default) vs. custom pipeline ────────────────────
  const [trainMode, setTrainMode] = useState<'quick' | 'custom'>('quick');

  // Pipeline advisor — fetches dataset-aware recommendations when dataset/target changes
  const {
    recommendation: pipelineRec,
    config: pipelineConfig,
    setConfig: setPipelineConfig,
    resetToRecommended: resetPipeline,
    loading: recLoading,
    error: recError,
  } = usePipelineAdvisor(
    trainMode === 'custom' ? selectedDataset : '',
    targetColumn || undefined,
  );

  const selectedConfig = configs.find((c) => c.model_type === selectedModel);
  const liveConfusionMatrix = useAppStore((s) => s.liveConfusionMatrix);
  const liveROCPoints = useAppStore((s) => s.liveROCPoints);

  // When dataset changes, load its columns and suggested target
  useEffect(() => {
    if (!selectedDataset) {
      setDatasetColumns([]);
      setSuggestedTarget('');
      setTargetClasses([]);
      setTargetColumn('');
      return;
    }
    setColumnsLoading(true);
    Promise.all([
      datasetsApi.summary(selectedDataset),
      datasetsApi.introspect(selectedDataset),
    ])
      .then(([summary, introspection]) => {
        const cols = Array.isArray(summary.columns) ? summary.columns : [];
        setDatasetColumns(cols);
        const suggested = introspection.suggested_target || summary.suggested_target || '';
        setSuggestedTarget(suggested);
        setTargetClasses(introspection.target_classes ?? []);
        // Auto-fill target column with recommendation
        if (suggested) setTargetColumn(suggested);
      })
      .catch(() => { /* ignore */ })
      .finally(() => setColumnsLoading(false));
  }, [selectedDataset]);

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
          for (const [k, v] of Object.entries(cfgs[0].hyperparameters ?? {})) {
            defaults[k] = (v as { default: unknown }).default;
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
    for (const [k, v] of Object.entries(selectedConfig.hyperparameters ?? {})) {
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
    logger.trainingStarted(selectedModel, datasets.find((d) => d.dataset_id === selectedDataset)?.filename);
    try {
      await startTraining({
        dataset_id: selectedDataset,
        target_column: targetColumn,
        model_type: selectedModel,
        hyperparameters: (trainMode === 'quick' && !useOptuna) ? hyperparams : undefined,
        use_optuna: trainMode === 'quick' ? useOptuna : false,
        pipeline_config: trainMode === 'custom' ? pipelineConfig : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const storeDatasets = useAppStore((s) => s.datasets);

  return (
    <PageGuide
      tagline="Train a Random Forest or XGBoost classifier on your uploaded dataset. Optuna automatically tunes hyperparameters — just pick your dataset and hit Start."
      prerequisites={[
        {
          label: 'No datasets found — upload a dataset before training.',
          to: '/dataset',
          ctaText: 'Upload Dataset',
          met: storeDatasets.length > 0,
        },
      ]}
      howItWorksContent={
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-300">
          <li><strong className="text-white">Choose dataset</strong> — select the CSV you uploaded on the Dataset page.</li>
          <li><strong className="text-white">Pick target column</strong> — the AI suggests the right label column automatically.</li>
          <li><strong className="text-white">Select model</strong> — Random Forest (robust, fast) or XGBoost (gradient-boosted, often higher accuracy).</li>
          <li><strong className="text-white">Optuna (recommended)</strong> — runs 20 trials internally to find the best hyperparameters; no manual tuning needed.</li>
          <li><strong className="text-white">SMOTE</strong> — balances classes if your dataset has far more Normal than Attack samples.</li>
          <li><strong className="text-white">Hit Start</strong> — watch live metrics, confusion matrix, and ROC curve update as the model trains.</li>
        </ol>
      }
    >
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

          {/* Target column — smart picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-gray-300 text-sm font-medium">Target Column</label>
              {suggestedTarget && (
                <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5">
                  <Sparkles size={10} />
                  AI recommends: <span className="font-mono font-bold ml-0.5">{suggestedTarget}</span>
                </span>
              )}
            </div>

            {/* Current selection display */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => datasetColumns.length > 0 && setShowColumnPicker((v) => !v)}
              onKeyDown={(e) => e.key === 'Enter' && datasetColumns.length > 0 && setShowColumnPicker((v) => !v)}
              className={`w-full bg-gray-800 border rounded-lg px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                targetColumn
                  ? 'border-cyan-500/50 text-gray-200'
                  : 'border-gray-600 text-gray-500'
              } ${datasetColumns.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}`}
            >
              <span className="text-sm font-mono">
                {columnsLoading
                  ? 'Loading columns…'
                  : targetColumn || (datasetColumns.length > 0 ? 'Select target column…' : 'Select a dataset first')}
              </span>
              <div className="flex items-center gap-2">
                {targetColumn === suggestedTarget && suggestedTarget && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5 font-semibold">
                    AI ★
                  </span>
                )}
                <ChevronDown size={14} className={`text-gray-500 transition-transform ${showColumnPicker ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {/* Dropdown picker */}
            {showColumnPicker && datasetColumns.length > 0 && (
              <div className="bg-gray-900 border border-gray-600 rounded-xl overflow-hidden shadow-2xl max-h-64 overflow-y-auto">
                {/* Sort: suggested first, then alphabetical */}
                {[
                  ...datasetColumns.filter((c) => c.name === suggestedTarget),
                  ...datasetColumns.filter((c) => c.name !== suggestedTarget),
                ].map((col) => {
                  const isSelected = col.name === targetColumn;
                  const isSuggested = col.name === suggestedTarget;
                  const isNumeric = !['object', 'category'].includes(col.dtype.split('[')[0]);
                  return (
                    <div
                      key={col.name}
                      role="button"
                      tabIndex={0}
                      onClick={() => { setTargetColumn(col.name); setShowColumnPicker(false); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { setTargetColumn(col.name); setShowColumnPicker(false); } }}
                      className={`px-3 py-2.5 flex items-center justify-between cursor-pointer border-b border-gray-800 transition-colors ${
                        isSelected ? 'bg-cyan-500/15' : 'hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-mono text-sm truncate ${isSelected ? 'text-cyan-300' : 'text-gray-200'}`}>
                          {col.name}
                        </span>
                        {isSuggested && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5 font-bold shrink-0">
                            AI ★
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className={`text-[10px] font-mono rounded px-1.5 py-0.5 ${
                          isNumeric ? 'bg-cyan-500/15 text-cyan-400' : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {col.dtype}
                        </span>
                        <span className="text-gray-600 text-[10px]">
                          {col.unique_count} unique
                        </span>
                        {isSelected && <span className="text-cyan-400 text-xs">✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected target info */}
            {targetColumn && targetClasses.length > 0 && (
              <div className="bg-gray-900/60 rounded-lg px-3 py-2 text-xs text-gray-400">
                <span className="text-gray-500">Classes:</span>{' '}
                <span className="text-cyan-400 font-mono">
                  {targetClasses.slice(0, 6).join(', ')}
                  {targetClasses.length > 6 ? ` … +${targetClasses.length - 6} more` : ''}
                </span>
              </div>
            )}
          </div>

          {/* ── Training mode toggle ──────────────────────────────────────── */}
          <div className="space-y-1">
            <label className="text-gray-300 text-sm font-medium">Training Mode</label>
            <p className="text-xs text-gray-500 mb-2">
              Quick Train uses safe defaults. Custom lets you control every preprocessing step.
            </p>
            <div className="flex rounded-xl overflow-hidden border border-gray-700">
              <button
                type="button"
                onClick={() => setTrainMode('quick')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                  trainMode === 'quick'
                    ? 'bg-violet-600/30 text-violet-300 border-r border-gray-700'
                    : 'bg-gray-800 text-gray-400 border-r border-gray-700 hover:bg-gray-700'
                }`}
              >
                <Zap size={14} />
                Quick Train
              </button>
              <button
                type="button"
                onClick={() => setTrainMode('custom')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                  trainMode === 'custom'
                    ? 'bg-cyan-600/20 text-cyan-300'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Sliders size={14} />
                Custom Pipeline
              </button>
            </div>
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

          {/* Quick Train: show hyperparameter editor */}
          {trainMode === 'quick' && selectedConfig && (
            <HyperparamEditor
              schema={selectedConfig.hyperparameters}
              values={hyperparams}
              onChange={handleHpChange}
              useOptuna={useOptuna}
              onOptunaChange={setUseOptuna}
            />
          )}

          {/* Custom Train: show pipeline builder */}
          {trainMode === 'custom' && (
            <div className="space-y-2">
              {!selectedDataset && (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  Select a dataset above to load AI pipeline recommendations.
                </p>
              )}
              <CustomPipelineBuilder
                recommendation={pipelineRec}
                config={pipelineConfig}
                onChange={setPipelineConfig}
                onReset={resetPipeline}
                loadingRec={recLoading && !!selectedDataset}
                recError={recError}
              />
            </div>
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
          {/* Pipeline visual */}
          {FEATURES.liveConfusionMatrix && (
            <PipelineStepsVisual trainingStatus={trainingStatus} className="flex-wrap" />
          )}

          <TrainingMonitor
            status={trainingStatus}
            wsConnected={wsConnected}
            logs={trainingLogs}
          />

          {/* Live charts */}
          {FEATURES.liveConfusionMatrix && liveConfusionMatrix && (
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Live Confusion Matrix</h3>
              <LiveConfusionMatrix data={liveConfusionMatrix} />
            </div>
          )}

          {FEATURES.liveROC && liveROCPoints.length >= 2 && (
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <LiveROCCurve points={liveROCPoints} />
            </div>
          )}

          <LogsPanel logs={trainingLogs} onClear={clearLogs} />

          {/* Live resource monitor — only visible during training */}
          <ResourceMonitor enabled={trainingStatus?.is_training ?? false} />
        </div>
      </div>
    </div>
    </PageGuide>
  );
}
