/**
 * DatasetRowSampler
 *
 * Lets the user pick any row from the training dataset so that feature
 * values are auto-filled in the Prediction and Explainability pages.
 *
 * - If the model has a saved `datasetId`, it's used automatically.
 * - If `datasetId` is absent (older saved models), a dropdown lets the
 *   user pick any available dataset instead.
 */
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Database, Shuffle, Download, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { datasetsApi } from '@/api';
import type { DatasetListItem } from '@/types';

interface Props {
  /** UUID of the dataset the model was trained on.
   *  When missing, a dataset dropdown is shown instead. */
  datasetId?: string | null;
  /** Model feature names — only these keys are extracted from the row. */
  featureNames: string[];
  /** Optional: name of the label/target column (rendered as a badge). */
  targetColumn?: string;
  /** Available datasets for fallback picker when datasetId is unknown. */
  datasets?: DatasetListItem[];
  /** Called once when a row is successfully loaded. */
  onLoad: (values: Record<string, string>) => void;
  className?: string;
}

export function DatasetRowSampler({
  datasetId,
  featureNames,
  targetColumn,
  datasets = [],
  onLoad,
  className,
}: Props) {
  // Active dataset — prefer prop, fall back to user selection
  const [activeDatasetId, setActiveDatasetId] = useState<string>(() => datasetId ?? '');

  // Sync if prop changes (different model selected)
  useEffect(() => {
    if (datasetId) setActiveDatasetId(datasetId);
  }, [datasetId]);

  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [rowIndex, setRowIndex] = useState<number>(0);
  const [inputValue, setInputValue] = useState<string>('0');
  const [loadedLabel, setLoadedLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justLoaded, setJustLoaded] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch total row count when activeDatasetId changes
  useEffect(() => {
    if (!activeDatasetId) { setTotalRows(null); return; }
    setTotalRows(null);
    setError(null);
    setRowIndex(0);
    setInputValue('0');
    datasetsApi
      .rows(activeDatasetId, { page: 0, per_page: 1 })
      .then((r) => setTotalRows(r.total))
      .catch(() => setTotalRows(null));
  }, [activeDatasetId]);

  const loadRow = async (idx: number) => {
    if (!activeDatasetId) return;
    setError(null);
    setLoading(true);
    setJustLoaded(false);
    try {
      const resp = await datasetsApi.rowByIndex(activeDatasetId, idx);
      const row = resp.rows[0]?.data ?? {};
      const values: Record<string, string> = {};
      for (const feat of featureNames) {
        const raw = row[feat];
        values[feat] = raw !== undefined && raw !== null ? String(raw) : '0';
      }
      if (targetColumn && row[targetColumn] !== undefined) {
        setLoadedLabel(String(row[targetColumn]));
      } else {
        setLoadedLabel(null);
      }
      onLoad(values);
      setJustLoaded(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setJustLoaded(false), 2500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err as Error)?.message ??
        'Failed to load row';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    const n = parseInt(e.target.value, 10);
    if (!isNaN(n)) setRowIndex(n);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const n = parseInt(inputValue, 10);
      if (!isNaN(n)) loadRow(n);
    }
  };

  const handleRandom = () => {
    if (totalRows === null) return;
    const idx = Math.floor(Math.random() * totalRows);
    setRowIndex(idx);
    setInputValue(String(idx));
    loadRow(idx);
  };

  const handleLoad = () => {
    const n = parseInt(inputValue, 10);
    const idx = isNaN(n) ? rowIndex : Math.max(0, Math.min(n, (totalRows ?? 1) - 1));
    setRowIndex(idx);
    setInputValue(String(idx));
    loadRow(idx);
  };

  const handleStep = (delta: number) => {
    const next = Math.max(0, Math.min(rowIndex + delta, (totalRows ?? 1) - 1));
    setRowIndex(next);
    setInputValue(String(next));
  };

  const needsPicker = !datasetId && datasets.length > 0;
  const hasDataset = !!activeDatasetId;

  return (
    <div className={`w-full rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3 space-y-2 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Database size={14} className="text-cyan-400 shrink-0" />
        <span className="text-xs font-semibold text-cyan-300">Load from dataset</span>
        {totalRows !== null && (
          <span className="text-xs text-gray-500 ml-1">({totalRows.toLocaleString()} rows)</span>
        )}
      </div>

      {/* Dataset picker — shown when model doesn't have a saved dataset_id */}
      {needsPicker && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 shrink-0">Dataset:</label>
          <select
            value={activeDatasetId}
            onChange={(e) => setActiveDatasetId(e.target.value)}
            className="flex-1 min-w-0 bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="">— pick a dataset —</option>
            {datasets.map((d) => (
              <option key={d.dataset_id} value={d.dataset_id}>
                {d.filename} ({d.row_count?.toLocaleString() ?? '?'} rows)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Row picker — shown only once a dataset is selected */}
      {hasDataset && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Stepper */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => handleStep(-1)}
              disabled={loading || rowIndex <= 0}
              className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-30 hover:bg-gray-700 transition-colors"
              title="Previous row"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs text-gray-400 mr-0.5">Row</span>
            <input
              type="number"
              min={0}
              max={totalRows !== null ? totalRows - 1 : undefined}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="w-20 bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1 font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              placeholder="0"
            />
            <button
              type="button"
              onClick={() => handleStep(1)}
              disabled={loading || (totalRows !== null && rowIndex >= totalRows - 1)}
              className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-30 hover:bg-gray-700 transition-colors"
              title="Next row"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Random */}
          <button
            type="button"
            onClick={handleRandom}
            disabled={loading || totalRows === null}
            title="Pick a random row"
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white disabled:opacity-40 transition-colors"
          >
            <Shuffle size={12} />
            Random
          </button>

          {/* Load */}
          <button
            type="button"
            onClick={handleLoad}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1 text-xs rounded bg-cyan-700 hover:bg-cyan-600 text-white font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {loading ? 'Loading…' : 'Load Row'}
          </button>

          {/* Success flash */}
          {justLoaded && (
            <span className="text-xs text-emerald-400 font-medium whitespace-nowrap">
              ✓ Values filled
              {loadedLabel !== null && (
                <span className="ml-1 text-gray-400">
                  · <span className="font-mono">{targetColumn}=<span className="text-white">{loadedLabel}</span></span>
                </span>
              )}
            </span>
          )}

          {/* Error */}
          {error && (
            <span className="text-xs text-red-400 whitespace-nowrap" title={error}>
              ✗ {error.length > 50 ? error.slice(0, 50) + '…' : error}
            </span>
          )}
        </div>
      )}

      {/* No datasets at all */}
      {!hasDataset && !needsPicker && (
        <p className="text-xs text-gray-500">No datasets available. Upload a dataset first.</p>
      )}
    </div>
  );
}
