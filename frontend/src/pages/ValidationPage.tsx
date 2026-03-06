/**
 * ValidationPage
 * ==============
 * Lets users test a trained model against a NEW CSV file (unseen data —
 * NOT the same train/test split used during training).
 *
 * Flow:
 *  1. Select a trained model
 *  2. Upload a CSV file (drag-and-drop or file picker)
 *  3. Optionally specify the ground-truth label column name
 *  4. Click "Run Validation"
 *  5. View: metric cards, confusion matrix, classification report, prediction table
 *  6. Export the predictions as a CSV
 */
import { useCallback, useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  X,
  PlayCircle,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { validationApi, modelsApi } from '@/api';
import { ModelSelect } from '@/components/common/ModelSelect';
import { PageGuide } from '@/components/common/PageGuide';
import { useAppStore } from '@/store/appStore';
import type { ValidationSummary } from '@/types/pipeline';
import type { ModelMeta } from '@/types';
import { useEffect } from 'react';

// ── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  color = 'cyan',
}: {
  label: string;
  value: number | null;
  color?: 'cyan' | 'emerald' | 'violet';
}) {
  const colorMap = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  };

  return (
    <div className={clsx('rounded-xl border px-5 py-4 space-y-1', colorMap[color])}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={clsx('text-2xl font-bold', colorMap[color].split(' ')[0])}>
        {value !== null ? `${(value * 100).toFixed(1)}%` : '—'}
      </p>
    </div>
  );
}

// ── Confusion matrix mini-viz ────────────────────────────────────────────────
function ConfusionMatrixTable({
  matrix,
  classNames,
}: {
  matrix: number[][];
  classNames: string[];
}) {
  const maxVal = Math.max(...matrix.flat(), 1);
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="px-2 py-1 text-gray-500 font-normal text-left">Actual ↓ / Predicted →</th>
            {classNames.map((cn) => (
              <th key={cn} className="px-3 py-1 text-gray-400 font-semibold text-center max-w-[80px] truncate">
                {cn}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, ri) => (
            <tr key={ri}>
              <td className="px-2 py-1 text-gray-400 font-semibold text-right">{classNames[ri]}</td>
              {row.map((cell, ci) => {
                const isDiag = ri === ci;
                const intensity = cell / maxVal;
                return (
                  <td
                    key={ci}
                    className="px-3 py-1 text-center font-mono font-medium rounded"
                    style={{
                      backgroundColor: isDiag
                        ? `rgba(52,211,153,${0.1 + intensity * 0.4})`
                        : cell > 0
                          ? `rgba(248,113,113,${0.05 + intensity * 0.3})`
                          : 'transparent',
                      color: isDiag ? '#34d399' : cell > 0 ? '#f87171' : '#6b7280',
                    }}
                  >
                    {cell.toLocaleString()}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ValidationPage() {
  const storeModels = useAppStore((s) => s.models);
  const [allModels, setAllModels] = useState<ModelMeta[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [labelColumn, setLabelColumn] = useState('');
  const [maxRows, setMaxRows] = useState(50_000);

  const [running, setRunning] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [result, setResult] = useState<ValidationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load model list on mount
  useEffect(() => {
    modelsApi.list().then(setAllModels).catch(() => setAllModels(storeModels));
  }, [storeModels]);

  // ── File handling ───────────────────────────────────────────────────────────
  const acceptFile = useCallback((f: File) => {
    if (!f.name.endsWith('.csv') && f.type !== 'text/csv') {
      toast.error('Please upload a CSV file.');
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) acceptFile(dropped);
    },
    [acceptFile],
  );

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) acceptFile(selected);
    e.target.value = '';
  };

  // ── Run validation ──────────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!selectedModelId) { toast.error('Select a model first.'); return; }
    if (!file) { toast.error('Upload a CSV file first.'); return; }

    setRunning(true);
    setUploadPct(0);
    setError(null);
    setResult(null);

    try {
      const summary = await validationApi.validate(
        selectedModelId,
        file,
        labelColumn.trim() || undefined,
        maxRows,
        setUploadPct,
      );
      setResult(summary);
      toast.success('Validation complete!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Validation failed.';
      setError(msg);
    } finally {
      setRunning(false);
      setUploadPct(0);
    }
  };

  // ── Export CSV ──────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!result) return;
    const headers = ['row_index', 'prediction', 'confidence', 'true_label', 'correct'];
    const rows = result.predictions.map((p) =>
      [p.row_index, p.prediction, p.confidence ?? '', p.true_label ?? '', p.correct ?? ''].join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation_${selectedModelId}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const storeForGuide = useAppStore((s) => s.models);

  return (
    <PageGuide
      tagline="Upload a new, unseen CSV file and test a trained model against it to measure real-world performance."
      prerequisites={[
        {
          label: 'No trained models found — train a model before validating.',
          to: '/training',
          ctaText: 'Train a Model',
          met: storeForGuide.length > 0,
        },
      ]}
      howItWorksContent={
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-300">
          <li><strong className="text-white">Select model</strong> — pick a previously trained model.</li>
          <li><strong className="text-white">Upload CSV</strong> — drag-and-drop any NEW CSV file not used during training.</li>
          <li><strong className="text-white">Label column (optional)</strong> — if your CSV has a ground-truth column, enter its name to get accuracy metrics.</li>
          <li><strong className="text-white">Run</strong> — get per-row predictions, confidence scores, confusion matrix, and F1/accuracy/ROC-AUC.</li>
          <li><strong className="text-white">Export</strong> — download predictions as CSV for further analysis.</li>
        </ol>
      }
    >
      <div className="space-y-6 max-w-5xl">
        <h1 className="text-xl font-bold text-white">Model Validation</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── LEFT: Config panel ───────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Model selector */}
            <div className="space-y-2">
              <label className="text-gray-300 text-sm font-medium">Model</label>
              <ModelSelect
                models={allModels}
                value={selectedModelId}
                onChange={setSelectedModelId}
                placeholder="Select a trained model…"
              />
            </div>

            {/* File upload zone */}
            <div className="space-y-2">
              <label className="text-gray-300 text-sm font-medium">Test CSV File</label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !file && fileInputRef.current?.click()}
                className={clsx(
                  'border-2 border-dashed rounded-xl transition-all cursor-pointer min-h-[120px] flex flex-col items-center justify-center gap-2 px-5 py-6',
                  dragging
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : file
                      ? 'border-emerald-500/50 bg-emerald-500/5 cursor-default'
                      : 'border-gray-600 bg-gray-800/30 hover:border-gray-400 hover:bg-gray-800/60',
                )}
              >
                {file ? (
                  <>
                    <FileText size={28} className="text-emerald-400" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-emerald-300">{file.name}</p>
                      <p className="text-xs text-gray-400">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); setError(null); }}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors mt-1"
                    >
                      <X size={12} /> Remove
                    </button>
                  </>
                ) : (
                  <>
                    <UploadCloud size={28} className="text-gray-500" />
                    <div className="text-center">
                      <p className="text-sm text-gray-300">
                        Drag &amp; drop a CSV or{' '}
                        <span className="text-cyan-400 underline cursor-pointer">browse</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Supports any CSV — max {maxRows.toLocaleString()} rows processed
                      </p>
                    </div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={onFileInput}
                />
              </div>
            </div>

            {/* Label column */}
            <div className="space-y-1.5">
              <label className="text-gray-300 text-sm font-medium">
                Ground-truth Column{' '}
                <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <p className="text-xs text-gray-500">
                Enter the column name containing the true labels. Leave blank if your CSV has no labels — you will still get predictions.
              </p>
              <input
                type="text"
                value={labelColumn}
                onChange={(e) => setLabelColumn(e.target.value)}
                placeholder="e.g. label, attack_cat, class…"
                className="w-full bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Max rows slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-gray-300 text-sm font-medium">Max rows to process</label>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 rounded px-2 py-0.5">
                  {maxRows.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min={1000}
                max={200_000}
                step={1000}
                value={maxRows}
                onChange={(e) => setMaxRows(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-gray-600">
                <span>1 000</span>
                <span>200 000</span>
              </div>
            </div>

            {/* Upload progress */}
            {running && uploadPct > 0 && uploadPct < 100 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Uploading…</span>
                  <span>{uploadPct}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-cyan-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Run button */}
            <button
              type="button"
              onClick={handleRun}
              disabled={running || !selectedModelId || !file}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {running ? (
                <><Loader2 size={16} className="animate-spin" /> Running validation…</>
              ) : (
                <><PlayCircle size={16} /> Run Validation</>
              )}
            </button>
          </div>

          {/* ── RIGHT: Results panel ──────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Error state */}
            {error && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-300">Validation failed</p>
                  <p className="text-xs text-red-400 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!result && !error && !running && (
              <div className="flex flex-col items-center justify-center h-64 text-center gap-3 text-gray-500">
                <FileText size={40} className="opacity-20" />
                <p className="text-sm">Results will appear here after running validation.</p>
              </div>
            )}

            {/* Loading state */}
            {running && !result && (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
                <Loader2 size={36} className="animate-spin text-cyan-500" />
                <p className="text-sm">Validating {file?.name}…</p>
                <p className="text-xs text-gray-600">
                  Processing up to {maxRows.toLocaleString()} rows
                </p>
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-300">
                      <span className="font-semibold text-white">{result.total_rows.toLocaleString()}</span> rows validated
                      {' · '}
                      <span className="font-mono text-cyan-400">{result.model_type}</span>
                    </p>
                    {result.has_labels && result.label_column_used && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Labels from column:{' '}
                        <span className="font-mono text-gray-400">{result.label_column_used}</span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleExport}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-cyan-400 border border-gray-600 hover:border-cyan-500/50 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <Download size={12} />
                    Export CSV
                  </button>
                </div>

                {/* Metrics (only when labels present) */}
                {result.has_labels && (
                  <div className="grid grid-cols-3 gap-3">
                    <MetricCard label="Accuracy" value={result.accuracy} color="cyan" />
                    <MetricCard label="F1 Score" value={result.f1_score} color="emerald" />
                    <MetricCard label="ROC-AUC" value={result.roc_auc} color="violet" />
                  </div>
                )}

                {/* No labels notice */}
                {!result.has_labels && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
                    <AlertCircle size={14} className="text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-300">
                      No label column detected — showing predictions only (no accuracy metrics).
                      Provide a <em>Ground-truth Column</em> to enable metrics.
                    </p>
                  </div>
                )}

                {/* Confusion matrix */}
                {result.confusion_matrix && result.class_names.length > 0 && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Confusion Matrix
                    </p>
                    <ConfusionMatrixTable
                      matrix={result.confusion_matrix}
                      classNames={result.class_names}
                    />
                  </div>
                )}

                {/* Classification report */}
                {result.classification_report && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Classification Report
                    </p>
                    <pre className="text-[11px] font-mono text-gray-300 overflow-x-auto leading-relaxed">
                      {result.classification_report}
                    </pre>
                  </div>
                )}

                {/* Prediction table */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                    <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Predictions
                    </p>
                    <span className="text-xs text-gray-500">
                      Showing first {Math.min(result.predictions.length, 200)} of{' '}
                      {result.predictions.length.toLocaleString()} rows
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-850 border-b border-gray-700">
                        <tr>
                          <th className="px-4 py-2 text-left text-gray-400 font-medium">#</th>
                          <th className="px-4 py-2 text-left text-gray-400 font-medium">Prediction</th>
                          <th className="px-4 py-2 text-left text-gray-400 font-medium">Confidence</th>
                          {result.has_labels && (
                            <>
                              <th className="px-4 py-2 text-left text-gray-400 font-medium">True Label</th>
                              <th className="px-4 py-2 text-center text-gray-400 font-medium">✓/✗</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {result.predictions.slice(0, 200).map((row) => (
                          <tr
                            key={row.row_index}
                            className={clsx(
                              'transition-colors',
                              row.correct === false
                                ? 'bg-red-500/5 hover:bg-red-500/10'
                                : row.correct === true
                                  ? 'hover:bg-gray-700/30'
                                  : 'hover:bg-gray-700/30',
                            )}
                          >
                            <td className="px-4 py-2 text-gray-500 font-mono">{row.row_index}</td>
                            <td className="px-4 py-2 text-gray-200 font-mono font-medium">
                              {row.prediction}
                            </td>
                            <td className="px-4 py-2 text-gray-400 font-mono">
                              {row.confidence !== null
                                ? `${(row.confidence * 100).toFixed(1)}%`
                                : '—'}
                            </td>
                            {result.has_labels && (
                              <>
                                <td className="px-4 py-2 text-gray-400 font-mono">
                                  {row.true_label ?? '—'}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {row.correct === true ? (
                                    <CheckCircle2 size={13} className="text-emerald-400 inline" />
                                  ) : row.correct === false ? (
                                    <XCircle size={13} className="text-red-400 inline" />
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageGuide>
  );
}
