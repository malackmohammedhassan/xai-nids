import { useEffect, useState } from 'react';
import { RefreshCw, ChevronRight, Calendar, Database, Target, Layers } from 'lucide-react';
import { useModels } from '@/hooks/useModels';
import { PageGuide } from '@/components/common/PageGuide';
import { useAppStore } from '@/store/appStore';
import { MetricsCards } from '@/components/evaluation/MetricsCards';
import { ConfusionMatrix } from '@/components/evaluation/ConfusionMatrix';
import { ROCCurve } from '@/components/evaluation/ROCCurve';
import { FeatureImportance } from '@/components/evaluation/FeatureImportance';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorPanel } from '@/components/common/ErrorPanel';
import { ExportButton } from '@/components/common/ExportButton';
import { HowItWorks } from '@/components/common/HowItWorks';
import { isAppError } from '@/api/client';
import type { ModelMeta, ModelMetrics } from '@/types';

type EvalTab = 'metrics' | 'charts' | 'importance';

/** Format ISO datetime as "Today 14:32", "Yesterday 09:15", or "Mar 1 11:04" */
function fmtTrainedAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yestStart  = new Date(todayStart.getTime() - 86_400_000);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d >= todayStart) return `Today ${time}`;
  if (d >= yestStart)  return `Yesterday ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` ${time}`;
}

/** Accent colour palette — cycles through so models look distinct */
const ACCENT = [
  'border-l-cyan-500',
  'border-l-violet-500',
  'border-l-emerald-500',
  'border-l-amber-500',
  'border-l-rose-500',
  'border-l-sky-500',
];

function ModelCard({
  model,
  selected,
  index,
  onClick,
}: {
  model: ModelMeta;
  selected: boolean;
  index: number;
  onClick: () => void;
}) {
  const accent = ACCENT[index % ACCENT.length];
  const shortId = model.model_id.slice(-8).toUpperCase();
  const displayType = model.model_type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const datasetShort = model.dataset_id
    ? model.dataset_id.slice(0, 12) + (model.dataset_id.length > 12 ? '…' : '')
    : '—';

  return (
    <button
      onClick={onClick}
      className={`text-left bg-gray-800 border-l-4 rounded-xl px-4 py-3 transition-all hover:bg-gray-750 group w-full ${accent} ${
        selected ? 'border border-cyan-500/60 bg-cyan-500/5' : 'border border-gray-700'
      }`}
    >
      {/* Row 1: Type + chevron */}
      <div className="flex items-center justify-between">
        <p className="text-gray-100 font-semibold text-sm truncate">{displayType}</p>
        <ChevronRight
          size={14}
          className="text-gray-600 group-hover:text-gray-400 transition-colors shrink-0 ml-1"
        />
      </div>

      {/* Row 2: Short ID */}
      <p className="text-gray-500 text-[10px] font-mono mt-0.5">ID #{shortId}</p>

      {/* Row 3: Metadata grid */}
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
        {model.created_at && (
          <div className="flex items-center gap-1 col-span-2">
            <Calendar size={10} className="text-gray-600 shrink-0" />
            <span className="text-gray-400 text-[11px]">{fmtTrainedAt(model.created_at)}</span>
          </div>
        )}
        {model.dataset_id && (
          <div className="flex items-center gap-1">
            <Database size={10} className="text-gray-600 shrink-0" />
            <span className="text-gray-500 text-[11px] font-mono truncate" title={model.dataset_id}>
              {datasetShort}
            </span>
          </div>
        )}
        {model.target_column && (
          <div className="flex items-center gap-1">
            <Target size={10} className="text-gray-600 shrink-0" />
            <span className="text-gray-500 text-[11px] truncate" title={model.target_column}>
              {model.target_column}
            </span>
          </div>
        )}
        {model.feature_names?.length > 0 && (
          <div className="flex items-center gap-1">
            <Layers size={10} className="text-gray-600 shrink-0" />
            <span className="text-gray-500 text-[11px]">{model.feature_names.length} features</span>
          </div>
        )}
      </div>

      {/* Row 4: Status badge */}
      <div className="mt-2">
        <StatusBadge
          status={model.is_loaded ? 'success' : 'neutral'}
          label={model.is_loaded ? 'Loaded' : 'Not loaded'}
        />
      </div>
    </button>
  );
}

export default function EvaluationPage() {
  const storeModels = useAppStore((s) => s.models);
  const { models, selectedModelId, setSelectedModelId, fetchList, fetchMetrics, loading } =
    useModels();
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EvalTab>('metrics');

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSelectModel = async (id: string) => {
    setSelectedModelId(id);
    setMetrics(null);
    setError(null);
    setMetricsLoading(true);
    try {
      const m = await fetchMetrics(id);
      setMetrics(m);
    } catch (err) {
      setError(
        isAppError(err) ? err.message : 'Failed to load evaluation metrics.'
      );
    } finally {
      setMetricsLoading(false);
    }
  };

  const TABS: { id: EvalTab; label: string; disabled?: boolean }[] = [
    { id: 'metrics',    label: 'Metrics' },
    { id: 'charts',     label: 'Charts',             disabled: !metrics },
    { id: 'importance', label: 'Feature Importance',  disabled: !metrics?.feature_importances?.length },
  ];

  return (
    <PageGuide
      tagline="Inspect your trained model's accuracy, confusion matrix, ROC curve, and feature importances — all in one view."
      prerequisites={[
        {
          label: 'No trained models yet — train a model first.',
          to: '/training',
          ctaText: 'Go to Training',
          met: storeModels.length > 0,
        },
      ]}
      howItWorksContent={
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-300">
          <li><strong className="text-white">Select a model</strong> from the grid below.</li>
          <li><strong className="text-white">Metrics tab</strong> — Accuracy, Precision, Recall, F1, ROC-AUC at a glance.</li>
          <li><strong className="text-white">Charts tab</strong> — Confusion matrix (true vs predicted labels) and ROC curve (AUC closer to 1 = better).</li>
          <li><strong className="text-white">Feature Importance tab</strong> — which columns the model relies on most for its decisions.</li>
          <li>Use <strong className="text-white">Export</strong> buttons to save results for your report.</li>
        </ol>
      }
    >
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Model Evaluation</h1>
        <div className="flex items-center gap-3">
          {metrics && (
            <ExportButton
              data={metrics}
              filename={`metrics_${selectedModelId?.slice(0, 8) ?? 'model'}`}
              label="Export metrics"
            />
          )}
          <button
            onClick={fetchList}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Model picker */}
      <div className="space-y-2">
        <label className="text-gray-300 text-sm font-medium">Select Model</label>
        {models.length === 0 ? (
          <EmptyState title="No models yet" description="Train a model first" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {models.map((m, i) => (
              <ModelCard
                key={m.model_id}
                model={m}
                selected={selectedModelId === m.model_id}
                index={i}
                onClick={() => handleSelectModel(m.model_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <ErrorPanel
          message={error}
          onRetry={() => { setError(null); if (selectedModelId) handleSelectModel(selectedModelId); }}
        />
      )}

      {/* Loading */}
      {metricsLoading && <LoadingSkeleton lines={5} />}

      {/* Metrics display */}
      {metrics && !metricsLoading && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex items-center gap-0.5 border-b border-gray-700">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'border-cyan-500 text-cyan-400'
                    : tab.disabled
                    ? 'border-transparent text-gray-600 cursor-not-allowed'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── METRICS tab ── */}
          {activeTab === 'metrics' && (
            <div className="space-y-4">
              <MetricsCards metrics={metrics} />
              <HowItWorks title="Understanding classification metrics">
                <p>
                  <strong className="text-slate-300">Accuracy</strong> — fraction of all predictions correct.
                  Can mislead on imbalanced datasets.
                </p>
                <p>
                  <strong className="text-slate-300">Precision</strong> — of all samples predicted as Attack,
                  how many actually are? High precision = fewer false alarms.
                </p>
                <p>
                  <strong className="text-slate-300">Recall</strong> — of all actual Attacks, how many did the
                  model catch? High recall = fewer missed intrusions.
                </p>
                <p>
                  <strong className="text-slate-300">F1 Score</strong> — harmonic mean of Precision and Recall.
                  Best single metric for imbalanced network traffic data.
                </p>
              </HowItWorks>
            </div>
          )}

          {/* ── CHARTS tab ── */}
          {activeTab === 'charts' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {metrics.confusion_matrix && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-300">Confusion Matrix</h3>
                    <ExportButton
                      data={metrics.confusion_matrix}
                      filename="confusion_matrix"
                      format="json"
                      label="Export"
                    />
                  </div>
                  <ConfusionMatrix
                    matrix={metrics.confusion_matrix}
                    classNames={metrics.class_names}
                  />
                  <HowItWorks title="Reading the confusion matrix">
                    <p>
                      Rows = true labels · Columns = predicted labels. The diagonal shows correct
                      predictions; off-diagonal cells show misclassifications.
                    </p>
                  </HowItWorks>
                </div>
              )}
              {metrics.roc_curve && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-300">ROC Curve</h3>
                    <ExportButton
                      data={{ fpr: metrics.roc_curve.fpr, tpr: metrics.roc_curve.tpr }}
                      filename="roc_curve"
                      format="json"
                      label="Export"
                    />
                  </div>
                  <ROCCurve
                    fpr={metrics.roc_curve.fpr}
                    tpr={metrics.roc_curve.tpr}
                    auc={metrics.roc_auc}
                  />
                  <HowItWorks title="Reading the ROC curve">
                    <p>
                      Plots True Positive Rate vs False Positive Rate at every decision threshold.
                      AUC of 1.0 = perfect; 0.5 = random guess.
                    </p>
                  </HowItWorks>
                </div>
              )}
            </div>
          )}

          {/* ── FEATURE IMPORTANCE tab ── */}
          {activeTab === 'importance' && metrics.feature_importances && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-300">Feature Importances</h3>
                <ExportButton
                  data={metrics.feature_importances}
                  filename="feature_importances"
                  format="csv"
                  label="Export CSV"
                />
              </div>
              <FeatureImportance features={metrics.feature_importances} />
              <HowItWorks
                title="How are feature importances calculated?"
                learnMoreUrl="https://scikit-learn.org/stable/modules/ensemble.html#feature-importance-evaluation"
              >
                <p>
                  For tree-based models (Random Forest, XGBoost), importance is the mean impurity
                  reduction across all trees. Higher = the feature is split on more often.
                  Use the <strong className="text-slate-300">Explainability</strong> page for
                  per-prediction (local) SHAP or LIME explanations.
                </p>
              </HowItWorks>
            </div>
          )}
        </div>
      )}
    </div>
    </PageGuide>
  );
}
