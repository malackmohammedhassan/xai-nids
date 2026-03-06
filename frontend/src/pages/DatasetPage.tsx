import { useEffect, useState, type ReactNode } from 'react';
import { Database, Trash2, RefreshCw, BarChart2, Table, Eye, Info, Layers, Sparkles, GitBranch, Crosshair } from 'lucide-react';
import { useDatasets } from '@/hooks/useDatasets';
import { DatasetUpload } from '@/components/dataset/DatasetUpload';
import { DatasetSummaryCard } from '@/components/dataset/DatasetSummaryCard';
import { IntrospectionReport } from '@/components/dataset/IntrospectionReport';
import { FeatureDistribution } from '@/components/dataset/FeatureDistribution';
import { DataPreviewTable } from '@/components/dataset/DataPreviewTable';
import { ClassDistributionChart } from '@/components/dataset/ClassDistributionChart';
import { ColumnStatsGrid } from '@/components/dataset/ColumnStatsGrid';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { IntelligenceReport } from '@/components/dataset/IntelligenceReport';
import { NullPctChart } from '@/components/dataset/NullPctChart';
import { CorrelationHeatmap } from '@/components/dataset/CorrelationHeatmap';
import { MutualInfoChart } from '@/components/dataset/MutualInfoChart';
import { HistogramGrid } from '@/components/dataset/HistogramGrid';
import { BoxplotGrid } from '@/components/dataset/BoxplotGrid';
import { ViolinChart } from '@/components/dataset/ViolinChart';
import { PairplotMatrix } from '@/components/dataset/PairplotMatrix';
import { PCAScatterPlot } from '@/components/dataset/PCAScatterPlot';
import { TSNEScatterPlot } from '@/components/dataset/TSNEScatterPlot';
import { AnomalyOverlay } from '@/components/dataset/AnomalyOverlay';
import { HowItWorks } from '@/components/common/HowItWorks';
import { ExportButton } from '@/components/common/ExportButton';
import { formatBytes, formatTimestamp } from '@/utils/formatters';
import { useIntelligence } from '@/hooks/useIntelligence';
import { useVisualization } from '@/hooks/useVisualization';
import { useAppStore } from '@/store/appStore';
import { FEATURES } from '@/utils/features';

type Tab = 'overview' | 'preview' | 'columns' | 'visualizations' | 'recommendations' | 'intelligence' | 'histograms' | 'boxplots' | 'violin' | 'correlation' | 'projection';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'overview',        label: 'Overview',        icon: <Info size={13} /> },
  { id: 'preview',         label: 'Data Preview',    icon: <Eye size={13} /> },
  { id: 'columns',         label: 'Columns',         icon: <Table size={13} /> },
  { id: 'visualizations',  label: 'Visualizations',  icon: <BarChart2 size={13} /> },
  { id: 'recommendations', label: 'Recommendations', icon: <Layers size={13} /> },
  ...(FEATURES.intelligencePanel ? [{ id: 'intelligence' as Tab, label: 'Intelligence', icon: <Sparkles size={13} /> as ReactNode }] : []),
  ...(FEATURES.tier2Viz ? [
    { id: 'histograms' as Tab, label: 'Histograms', icon: <BarChart2 size={13} /> as ReactNode },
    { id: 'boxplots' as Tab, label: 'Boxplots', icon: <BarChart2 size={13} /> as ReactNode },
    { id: 'violin' as Tab, label: 'Distributions', icon: <Layers size={13} /> as ReactNode },
    { id: 'correlation' as Tab, label: 'Correlation', icon: <GitBranch size={13} /> as ReactNode },
  ] : []),
  ...(FEATURES.tier3Viz ? [{ id: 'projection' as Tab, label: 'Projection', icon: <Crosshair size={13} /> as ReactNode }] : []),
];

export default function DatasetPage() {
  const {
    datasets,
    activeSummary,
    activeIntrospection,
    selectedDatasetId,
    loading,
    uploadProgress,
    fetchList,
    upload,
    selectDataset,
    deleteDataset,
  } = useDatasets();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => { fetchList(); }, [fetchList]);

  // Reset to overview whenever a different dataset is selected
  useEffect(() => { setActiveTab('overview'); }, [selectedDatasetId]);

  const safeColumns = Array.isArray(activeSummary?.columns) ? activeSummary!.columns : [];

  // v2 intelligence + visualization hooks
  const { status: intelStatus, trigger: triggerIntel } = useIntelligence(selectedDatasetId);
  const activeIntelligenceReport = useAppStore((s) => s.activeIntelligenceReport);
  const { tier1, tier1State, tier2Cache, tier2States, tier3Cache, fetchTier1, fetchTier2, fetchTier3 } = useVisualization(selectedDatasetId);

  // Auto-fetch tier1 when dataset is selected
  useEffect(() => {
    if (selectedDatasetId) fetchTier1();
  }, [selectedDatasetId, fetchTier1]);

  // Auto-fetch specific tier2 when tab changes
  useEffect(() => {
    if (!selectedDatasetId) return;
    if (activeTab === 'histograms') fetchTier2('histograms');
    if (activeTab === 'boxplots') fetchTier2('boxplots');
    if (activeTab === 'violin') fetchTier2('violin');
    if (activeTab === 'correlation') { fetchTier2('correlation'); fetchTier2('mutual_info'); }
    if (activeTab === 'projection') {
      fetchTier3('pca');
      fetchTier3('tsne');
      fetchTier3('isolation_forest');
    }
  }, [activeTab, selectedDatasetId, fetchTier2, fetchTier3]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Dataset</h1>
        <button
          onClick={fetchList}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload */}
        <div className="bg-gray-800/50 rounded-xl p-5 space-y-4 border border-gray-700">
          <h2 className="text-gray-300 font-medium text-sm">Upload Dataset</h2>
          <DatasetUpload onUpload={upload} uploading={loading} uploadProgress={uploadProgress} />
        </div>

        {/* Dataset list */}
        <div className="space-y-3">
          <h2 className="text-gray-300 font-medium text-sm">Uploaded Datasets</h2>
          {datasets.length === 0 ? (
            <EmptyState
              icon={<Database size={40} />}
              title="No datasets yet"
              description="Upload a CSV or Parquet file to get started"
            />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {datasets.map((d) => (
                <div
                  key={d.dataset_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectDataset(d.dataset_id)}
                  onKeyDown={(e) => e.key === 'Enter' && selectDataset(d.dataset_id)}
                  className={`w-full cursor-pointer text-left bg-gray-800 hover:bg-gray-700/80 border rounded-xl px-4 py-3 transition-colors flex items-center justify-between group ${
                    selectedDatasetId === d.dataset_id
                      ? 'border-cyan-500/50 bg-cyan-500/5'
                      : 'border-gray-700'
                  }`}
                >
                  <div>
                    <p className="text-gray-200 font-medium text-sm truncate max-w-xs">
                      {d.filename}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {d.row_count.toLocaleString()} rows · {d.column_count} cols ·{' '}
                      {formatBytes(d.size_bytes)} · {formatTimestamp(d.uploaded_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(d.dataset_id); }}
                    className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Dataset Explorer ── */}
      {activeSummary && (
        <div>
          {/* Tab bar */}
          <div className="flex items-center gap-0.5 border-b border-gray-700 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
            {loading && (
              <span className="ml-auto text-xs text-gray-500 pr-2 self-center animate-pulse">
                Loading…
              </span>
            )}
          </div>

          <div className="pt-5 space-y-4">
            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <DatasetSummaryCard summary={activeSummary} />

                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: 'Memory usage',
                      value: activeSummary.memory_usage_mb != null
                        ? `${activeSummary.memory_usage_mb} MB`
                        : '—',
                    },
                    {
                      label: 'Numeric cols',
                      value: safeColumns.filter(
                        (c) => !['object', 'category'].includes(c.dtype.split('[')[0])
                      ).length,
                    },
                    {
                      label: 'Categorical cols',
                      value: safeColumns.filter((c) =>
                        ['object', 'category'].includes(c.dtype.split('[')[0])
                      ).length,
                    },
                    {
                      label: 'Cols with nulls',
                      value: safeColumns.filter((c) => c.null_count > 0).length,
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-800 rounded-xl px-4 py-3">
                      <p className="text-gray-500 text-xs">{label}</p>
                      <p className="text-white font-semibold mt-0.5 text-sm">{value}</p>
                    </div>
                  ))}
                </div>

                {/* AI target suggestion banner */}
                {activeIntrospection?.suggested_target && (
                  <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-4">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg shrink-0">
                      ★
                    </div>
                    <div className="flex-1">
                      <p className="text-emerald-400 font-semibold text-sm">
                        AI recommends target column:{' '}
                        <span className="font-mono">{activeIntrospection.suggested_target}</span>
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        Detected task:{' '}
                        <span className="text-gray-200">
                          {activeIntrospection.task_type.replace(/_/g, ' ')}
                        </span>
                        {activeIntrospection.target_classes.length > 0 && (
                          <>
                            {' '}· Classes:{' '}
                            <span className="text-cyan-400 font-mono">
                              {activeIntrospection.target_classes.slice(0, 6).join(', ')}
                              {activeIntrospection.target_classes.length > 6 ? ' …' : ''}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── DATA PREVIEW ── */}
            {activeTab === 'preview' && (
              <DataPreviewTable rows={activeSummary.sample_rows ?? []} columns={safeColumns} />
            )}

            {/* ── COLUMNS ── */}
            {activeTab === 'columns' && (
              <ColumnStatsGrid
                columns={safeColumns}
                suggestedTarget={
                  activeIntrospection?.suggested_target ?? activeSummary.suggested_target
                }
              />
            )}

            {/* ── VISUALIZATIONS ── */}
            {activeTab === 'visualizations' && (
              <div className="space-y-6">
                {activeSummary.class_distribution &&
                Object.keys(activeSummary.class_distribution).length > 0 ? (
                  <ClassDistributionChart
                    distribution={activeSummary.class_distribution}
                    targetColumn={
                      activeIntrospection?.suggested_target ??
                      activeSummary.suggested_target ??
                      'target'
                    }
                  />
                ) : (
                  <div className="bg-gray-800 rounded-xl p-5 text-center text-gray-500 text-sm">
                    No class distribution — target column may be continuous (regression task)
                  </div>
                )}

                <FeatureDistribution columns={safeColumns} />

                {/* Numeric stats table */}
                {safeColumns.some(
                  (c) => !['object', 'category'].includes(c.dtype.split('[')[0])
                ) && (
                  <div className="bg-gray-800 rounded-xl p-5 space-y-3">
                    <h4 className="text-gray-200 font-medium text-sm">Numeric Column Statistics</h4>
                    <div className="overflow-x-auto rounded-lg border border-gray-700">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-900/70 border-b border-gray-700">
                            {['Column', 'Mean', 'Std Dev', 'Min', 'Max', 'Unique', 'Nulls'].map(
                              (h) => (
                                <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">
                                  {h}
                                </th>
                              )
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {safeColumns
                            .filter(
                              (c) => !['object', 'category'].includes(c.dtype.split('[')[0])
                            )
                            .map((c, i) => (
                              <tr
                                key={c.name}
                                className={`border-b border-gray-700/40 ${
                                  i % 2 === 1 ? 'bg-gray-900/20' : ''
                                }`}
                              >
                                <td
                                  className="px-3 py-1.5 font-mono text-gray-200 truncate max-w-[130px]"
                                  title={c.name}
                                >
                                  {c.name}
                                </td>
                                <td className="px-3 py-1.5 text-cyan-400 font-mono">
                                  {c.mean != null ? c.mean.toFixed(4) : '—'}
                                </td>
                                <td className="px-3 py-1.5 text-sky-400 font-mono">
                                  {c.std != null ? c.std.toFixed(4) : '—'}
                                </td>
                                <td className="px-3 py-1.5 text-gray-400 font-mono">
                                  {c.min != null ? c.min.toFixed(4) : '—'}
                                </td>
                                <td className="px-3 py-1.5 text-gray-400 font-mono">
                                  {c.max != null ? c.max.toFixed(4) : '—'}
                                </td>
                                <td className="px-3 py-1.5 text-gray-300">
                                  {c.unique_count.toLocaleString()}
                                </td>
                                <td className="px-3 py-1.5">
                                  <span
                                    className={
                                      c.null_count > 0 ? 'text-red-400' : 'text-gray-600'
                                    }
                                  >
                                    {c.null_count > 0 ? c.null_count.toLocaleString() : '✓'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── RECOMMENDATIONS ── */}
            {activeTab === 'recommendations' && (
              <div className="space-y-4">
                {activeIntrospection ? (
                  <>
                    <IntrospectionReport introspection={activeIntrospection} />

                    {(activeIntrospection.recommended_preprocessing ?? []).length > 0 && (
                      <div className="bg-gray-800 rounded-xl p-5 space-y-3">
                        <h4 className="text-gray-200 font-medium text-sm">
                          Preprocessing Recommendations
                        </h4>
                        <ol className="space-y-2">
                          {(activeIntrospection.recommended_preprocessing ?? []).map((rec, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-3 text-sm text-gray-300 bg-gray-900/40 rounded-lg px-4 py-2.5"
                            >
                              <span className="text-cyan-500 font-bold text-xs mt-0.5 shrink-0">
                                {i + 1}.
                              </span>
                              {rec}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {Object.keys(activeIntrospection.outlier_counts).length > 0 && (
                      <div className="bg-gray-800 rounded-xl p-5 space-y-3">
                        <h4 className="text-gray-200 font-medium text-sm">
                          Outlier Detection (IQR method)
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(activeIntrospection.outlier_counts)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 12)
                            .map(([col, count]) => (
                              <div
                                key={col}
                                className="bg-gray-900/50 rounded-lg px-3 py-2 flex items-center justify-between"
                              >
                                <span
                                  className="text-gray-200 font-mono text-xs truncate max-w-[100px]"
                                  title={col}
                                >
                                  {col}
                                </span>
                                <span className="text-amber-400 text-xs font-medium shrink-0 ml-2">
                                  {count.toLocaleString()} outliers
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-gray-500 text-sm text-center py-8">
                    Select a dataset to load recommendations.
                  </div>
                )}
              </div>
            )}

            {/* ── INTELLIGENCE TAB ── */}
            {activeTab === 'intelligence' && FEATURES.intelligencePanel && (
              <div className="space-y-4">
                {intelStatus === 'idle' && (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <p className="text-sm text-slate-400">Run AI analysis to get quality scores, risk assessment, and preprocessing advice.</p>
                    <button
                      onClick={triggerIntel}
                      className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition"
                    >
                      <Sparkles className="h-4 w-4" /> Analyse Dataset
                    </button>
                  </div>
                )}
                {(intelStatus === 'triggering' || intelStatus === 'polling') && (
                  <div className="flex items-center gap-3 py-8 justify-center text-sm text-indigo-300">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Running analysis…
                  </div>
                )}
                {intelStatus === 'error' && (
                  <div className="py-8 text-center text-sm text-red-400">Analysis failed. Try again.</div>
                )}
                {intelStatus === 'ready' && activeIntelligenceReport && (
                  <IntelligenceReport report={activeIntelligenceReport} />
                )}
              </div>
            )}

            {/* ── HISTOGRAMS TAB ── */}
            {activeTab === 'histograms' && FEATURES.tier2Viz && (
              <div>
                {tier2States?.histograms === 'loading' && (
                  <p className="text-sm text-slate-500 py-6 text-center animate-pulse">Loading histograms…</p>
                )}
                {tier2States?.histograms === 'error' && (
                  <p className="text-sm text-red-400 py-6 text-center">Failed to load histogram data.</p>
                )}
                {tier2States?.histograms === 'loaded' && Boolean(tier2Cache?.histograms) && (
                  <HistogramGrid
                    data={
                      (tier2Cache!.histograms as unknown as { columns?: Record<string, { edges?: number[]; bins?: number[]; counts: number[] }> }).columns ?? {}
                    }
                  />
                )}
              </div>
            )}

            {/* ── BOXPLOTS TAB ── */}
            {activeTab === 'boxplots' && FEATURES.tier2Viz && (
              <div>
                {tier2States?.boxplots === 'loading' && (
                  <p className="text-sm text-slate-500 py-6 text-center animate-pulse">Computing boxplots…</p>
                )}
                {tier2States?.boxplots === 'error' && (
                  <p className="text-sm text-red-400 py-6 text-center">Failed to load boxplot data.</p>
                )}
                {tier2States?.boxplots === 'loaded' && Boolean(tier2Cache?.boxplots) && (
                  <BoxplotGrid data={(tier2Cache!.boxplots as unknown as { data: import('@/components/dataset/BoxplotGrid').BoxplotRow[] })} />
                )}
                {!tier2States?.boxplots && (
                  <p className="text-sm text-slate-500 py-6 text-center">Select a dataset to view boxplots.</p>
                )}
              </div>
            )}

            {/* ── VIOLIN (DISTRIBUTIONS) TAB ── */}
            {activeTab === 'violin' && FEATURES.tier2Viz && (
              <div>
                {tier2States?.violin === 'loading' && (
                  <p className="text-sm text-slate-500 py-6 text-center animate-pulse">Computing class distributions…</p>
                )}
                {tier2States?.violin === 'error' && (
                  <p className="text-sm text-red-400 py-6 text-center">Failed to load distribution data.</p>
                )}
                {tier2States?.violin === 'loaded' && Boolean(tier2Cache?.violin) && (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <ViolinChart data={(tier2Cache!.violin as unknown as any)} />
                )}
                {!tier2States?.violin && (
                  <p className="text-sm text-slate-500 py-6 text-center">Select a dataset to view class distributions.</p>
                )}
              </div>
            )}

            {/* ── CORRELATION TAB ── */}
            {activeTab === 'correlation' && FEATURES.tier2Viz && (
              <div className="space-y-6">
                {tier2States?.correlation === 'loaded' && Boolean(tier2Cache?.correlation) && (() => {
                  // Backend shape: { columns: string[], matrix: number[][] }
                  const raw = tier2Cache!.correlation as unknown as { columns: string[]; matrix: number[][] };
                  const cols = raw.columns ?? [];
                  // Build dict-of-dicts for CorrelationHeatmap
                  const dictMatrix: Record<string, Record<string, number>> = Object.fromEntries(
                    cols.map((row, i) => [row, Object.fromEntries(cols.map((col, j) => [col, raw.matrix?.[i]?.[j] ?? 0]))])
                  );
                  return (
                    <>
                      <div>
                        <h3 className="mb-3 text-sm font-medium text-slate-300">Correlation Matrix</h3>
                        <CorrelationHeatmap matrix={dictMatrix} />
                      </div>
                      <div>
                        <h3 className="mb-3 text-sm font-medium text-slate-300">Feature Correlation Grid</h3>
                        <PairplotMatrix data={raw} topN={12} />
                      </div>
                    </>
                  );
                })()}
                {tier2States?.mutual_info === 'loaded' && Boolean(tier2Cache?.mutual_info) && (
                  <div>
                    <h3 className="mb-3 text-sm font-medium text-slate-300">Mutual Information with Target</h3>
                    <MutualInfoChart
                      data={Object.fromEntries(
                        ((tier2Cache!.mutual_info as unknown as { data?: { feature: string; mi_score: number }[] }).data ?? []).map(
                          (r) => [r.feature, r.mi_score]
                        )
                      )}
                    />
                  </div>
                )}
                {(tier2States?.correlation === 'loading' || tier2States?.mutual_info === 'loading') && (
                  <p className="text-sm text-slate-500 py-6 text-center animate-pulse">Computing correlation data…</p>
                )}
              </div>
            )}

            {/* ── PROJECTION TAB ── */}
            {activeTab === 'projection' && FEATURES.tier3Viz && (
              <div className="space-y-8">
                {/* Action bar */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => fetchTier3('pca')}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition"
                  >
                    {tier3Cache?.pca ? '↺ Recompute PCA' : 'Compute PCA'}
                  </button>
                  <button
                    onClick={() => fetchTier3('tsne')}
                    className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600 transition"
                  >
                    {tier3Cache?.tsne ? '↺ Recompute t-SNE' : 'Compute t-SNE (≤5K rows)'}
                  </button>
                  <button
                    onClick={() => fetchTier3('isolation_forest')}
                    className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600 transition"
                  >
                    {tier3Cache?.isolation_forest ? '↺ Recompute Anomaly' : 'Detect Anomalies (Isolation Forest)'}
                  </button>
                </div>

                {!tier3Cache?.pca && !tier3Cache?.tsne && !tier3Cache?.isolation_forest && (
                  <p className="text-sm text-slate-500 py-4 text-center">
                    Click a button above to compute projections. Results are cached and reuse on reload.
                  </p>
                )}

                {/* ── PCA ── */}
                {Boolean(tier3Cache?.pca) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-200">PCA Projection</h3>
                      <ExportButton
                        data={tier3Cache!.pca}
                        filename="pca_projection"
                        label="Export"
                      />
                    </div>
                    <HowItWorks
                      title="How does PCA work?"
                      learnMoreUrl="https://en.wikipedia.org/wiki/Principal_component_analysis"
                    >
                      <p>
                        Principal Component Analysis (PCA) finds the directions of greatest variance in your
                        high-dimensional data and projects every sample onto the top-2 directions (PC1, PC2).
                        Points that cluster together tend to have similar feature patterns.
                      </p>
                      <p>Each axis shows what percentage of total variance it explains.</p>
                    </HowItWorks>
                    <PCAScatterPlot
                      data={tier3Cache!.pca as unknown as Parameters<typeof PCAScatterPlot>[0]['data']}
                    />
                  </div>
                )}

                {/* ── t-SNE ── */}
                {Boolean(tier3Cache?.tsne) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-200">t-SNE Projection</h3>
                      <ExportButton
                        data={tier3Cache!.tsne}
                        filename="tsne_projection"
                        label="Export"
                      />
                    </div>
                    <HowItWorks
                      title="How does t-SNE work?"
                      learnMoreUrl="https://en.wikipedia.org/wiki/T-distributed_stochastic_neighbor_embedding"
                    >
                      <p>
                        t-SNE (t-distributed Stochastic Neighbor Embedding) is a non-linear technique that
                        preserves local neighbourhood structure. Clusters in t-SNE are more meaningful than
                        in PCA for complex, non-linear data.
                      </p>
                      <p>
                        Note: distances <em>between</em> clusters are not meaningful — only cluster shape and
                        density matter.
                      </p>
                    </HowItWorks>
                    <TSNEScatterPlot
                      data={tier3Cache!.tsne as unknown as Parameters<typeof TSNEScatterPlot>[0]['data']}
                    />
                  </div>
                )}

                {/* ── Isolation Forest ── */}
                {Boolean(tier3Cache?.isolation_forest) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-200">Anomaly Detection</h3>
                      <ExportButton
                        data={tier3Cache!.isolation_forest}
                        filename="anomaly_detection"
                        label="Export"
                      />
                    </div>
                    <HowItWorks
                      title="How does Isolation Forest work?"
                      learnMoreUrl="https://en.wikipedia.org/wiki/Isolation_forest"
                    >
                      <p>
                        Isolation Forest detects anomalies by randomly partitioning features.
                        Anomalous points are isolated in fewer splits than normal points.
                        The method uses 5% contamination by default.
                      </p>
                      <p>Red points = anomalies · Cyan points = normal.</p>
                    </HowItWorks>
                    <AnomalyOverlay
                      data={tier3Cache!.isolation_forest as unknown as Parameters<typeof AnomalyOverlay>[0]['data']}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete dataset?"
        description="This permanently removes the dataset file. Models trained on it remain."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) deleteDataset(deleteTarget); }}
      />
    </div>
  );
}
