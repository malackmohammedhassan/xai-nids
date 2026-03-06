/**
 * DriftComparePanel.tsx - Statistical drift comparison via /datasets/compare.
 *
 * Calls GET /api/v2/datasets/compare?a={idA}&b={idB} which returns per-column
 * PSI (Population Stability Index), KS-test, KL divergence, and null% deltas.
 *
 * PSI thresholds:  <0.1 = stable | 0.1-0.25 = moderate | >0.25 = significant
 * KS significance: p < 0.05 means statistically significant distribution shift
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { v2get } from '@/api/v2client';
import { AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';

// --- Types -------------------------------------------------------------------

interface ColumnDrift {
  psi?: number;
  psi_severity?: 'stable' | 'moderate' | 'significant';
  ks_statistic?: number;
  ks_p_value?: number;
  ks_significant?: boolean;
  mean_a?: number;
  mean_b?: number;
  mean_delta?: number;
  kl_divergence?: number;
  kl_severity?: 'stable' | 'moderate' | 'significant';
  null_pct_a: number | null;
  null_pct_b: number | null;
  null_delta_pp: number | null;
}

interface DriftCompareSummary {
  total_columns: number;
  numeric_columns: number;
  high_psi_drift_columns: string[];
  ks_significant_columns: string[];
  overall_drift_score: number;
}

interface DriftCompareResponse {
  dataset_a: string;
  dataset_b: string;
  row_count_a: number;
  row_count_b: number;
  columns: Record<string, ColumnDrift>;
  summary: DriftCompareSummary;
}

// --- Props -------------------------------------------------------------------

interface DriftComparePanelProps {
  datasetIdA: string;
  datasetIdB: string;
  labelA?: string;
  labelB?: string;
}

// --- PSI badge ---------------------------------------------------------------

const PSI_COLOURS: Record<string, string> = {
  stable: 'bg-emerald-900/40 text-emerald-300 border-emerald-700',
  moderate: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  significant: 'bg-red-900/40 text-red-300 border-red-700',
};

function PsiBadge({ severity }: { severity?: string }) {
  if (!severity) return null;
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${PSI_COLOURS[severity] ?? ''}`}>
      {severity}
    </span>
  );
}

// --- Component ---------------------------------------------------------------

export const DriftComparePanel: React.FC<DriftComparePanelProps> = ({
  datasetIdA,
  datasetIdB,
  labelA = 'Dataset A',
  labelB = 'Dataset B',
}) => {
  const [result, setResult] = useState<DriftCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetIdA || !datasetIdB) return;
    setLoading(true);
    setError(null);
    v2get<DriftCompareResponse>(
      `/datasets/compare?a=${encodeURIComponent(datasetIdA)}&b=${encodeURIComponent(datasetIdB)}`
    )
      .then(setResult)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Failed to run drift analysis')
      )
      .finally(() => setLoading(false));
  }, [datasetIdA, datasetIdB]);

  const numericRows = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.columns)
      .filter(([, v]) => v.psi != null)
      .sort(([, a], [, b]) => (b.psi ?? 0) - (a.psi ?? 0))
      .slice(0, 20);
  }, [result]);

  const nullDeltaData = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.columns)
      .filter(([, v]) => v.null_delta_pp != null)
      .sort(
        ([, a], [, b]) =>
          Math.abs(b.null_delta_pp ?? 0) - Math.abs(a.null_delta_pp ?? 0)
      )
      .slice(0, 20)
      .map(([col, v]) => ({
        column: col,
        null_pct_a: v.null_pct_a ?? 0,
        null_pct_b: v.null_pct_b ?? 0,
        delta: v.null_delta_pp ?? 0,
      }));
  }, [result]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm p-4">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Running statistical drift analysis...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm p-4">
        <AlertTriangle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  if (!result) return null;

  const { summary } = result;
  const overallHealthy =
    summary.overall_drift_score < 0.1 && summary.high_psi_drift_columns.length === 0;

  return (
    <div className="space-y-6">
      {/* Summary KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
          <p className="text-[10px] text-slate-400 uppercase mb-1">Overall Drift Score</p>
          <span
            className={`text-xl font-bold tabular-nums ${
              summary.overall_drift_score < 0.1
                ? 'text-emerald-400'
                : summary.overall_drift_score < 0.25
                ? 'text-yellow-400'
                : 'text-red-400'
            }`}
          >
            {summary.overall_drift_score.toFixed(3)}
          </span>
          <p className="text-[10px] text-slate-500 mt-0.5">mean PSI across numeric cols</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
          <p className="text-[10px] text-slate-400 uppercase mb-1">Row Counts</p>
          <p className="text-slate-200 font-semibold">{result.row_count_a.toLocaleString()}</p>
          <p className="text-slate-500 text-[10px]">
            {'->'} {result.row_count_b.toLocaleString()} ({labelB})
          </p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
          <p className="text-[10px] text-slate-400 uppercase mb-1">PSI Drift Columns</p>
          <p
            className={`text-xl font-bold ${
              summary.high_psi_drift_columns.length > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {summary.high_psi_drift_columns.length}
          </p>
          <p className="text-[10px] text-slate-500">of {summary.numeric_columns} numeric</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
          <p className="text-[10px] text-slate-400 uppercase mb-1">KS Significant</p>
          <p
            className={`text-xl font-bold ${
              summary.ks_significant_columns.length > 0 ? 'text-orange-400' : 'text-emerald-400'
            }`}
          >
            {summary.ks_significant_columns.length}
          </p>
          <p className="text-[10px] text-slate-500">p &lt; 0.05 distribution shift</p>
        </div>
      </div>

      {/* Health banner */}
      {overallHealthy ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-700/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-300">
          <CheckCircle className="h-4 w-4 shrink-0" />
          No significant drift detected between these datasets.
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-orange-700/50 bg-orange-950/30 p-3 text-xs text-orange-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{summary.high_psi_drift_columns.length} column(s)</strong> show significant
            PSI drift:{' '}
            {summary.high_psi_drift_columns.slice(0, 4).join(', ')}
            {summary.high_psi_drift_columns.length > 4
              ? ` +${summary.high_psi_drift_columns.length - 4} more`
              : ''}
            .
            {summary.ks_significant_columns.length > 0 && (
              <>
                {' '}KS test significant on{' '}
                <strong>{summary.ks_significant_columns.length}</strong> column(s).
              </>
            )}
          </span>
        </div>
      )}

      {/* PSI / KS table */}
      {numericRows.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">
            PSI / KS per Numeric Column (top {numericRows.length})
          </h3>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs text-slate-300">
              <thead className="sticky top-0 bg-slate-800 text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Column</th>
                  <th className="px-3 py-2 text-center">PSI</th>
                  <th className="px-3 py-2 text-center">Severity</th>
                  <th className="px-3 py-2 text-center">KS stat</th>
                  <th className="px-3 py-2 text-center">p-value</th>
                  <th className="px-3 py-2 text-right">Mean delta</th>
                </tr>
              </thead>
              <tbody>
                {numericRows.map(([col, v]) => (
                  <tr key={col} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="px-3 py-1.5 font-mono text-[10px] text-indigo-300">{col}</td>
                    <td className="px-3 py-1.5 text-center tabular-nums">
                      {v.psi?.toFixed(4) ?? '-'}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <PsiBadge severity={v.psi_severity} />
                    </td>
                    <td className="px-3 py-1.5 text-center tabular-nums">
                      {v.ks_statistic?.toFixed(4) ?? '-'}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-center tabular-nums ${
                        v.ks_significant ? 'text-orange-400 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {v.ks_p_value?.toFixed(4) ?? '-'}
                      {v.ks_significant && ' *'}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right tabular-nums ${
                        (v.mean_delta ?? 0) > 0 ? 'text-orange-300' : 'text-sky-300'
                      }`}
                    >
                      {v.mean_delta != null
                        ? (v.mean_delta > 0 ? '+' : '') + v.mean_delta.toFixed(3)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            * KS p &lt; 0.05 -- statistically significant distribution shift
          </p>
        </section>
      )}

      {/* Null% delta chart */}
      {nullDeltaData.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Null% delta per Column (top {nullDeltaData.length} by magnitude)
          </h3>
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={nullDeltaData}
                margin={{ top: 4, right: 8, left: 0, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="column"
                  tick={{ fill: '#94a3b8', fontSize: 8 }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 9 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    fontSize: 11,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 2" />
                <Bar dataKey="null_pct_a" name={labelA} fill="#6366f1" radius={[2, 2, 0, 0]} />
                <Bar dataKey="null_pct_b" name={labelB} fill="#f97316" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
};

export default DriftComparePanel;
