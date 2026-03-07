import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';
import type { LabModelProfile, LabTopCorrelation } from '@/types';

interface Props {
  a: LabModelProfile;
  b: LabModelProfile;
  sharedFeatures: string[];
  onlyA: string[];
  onlyB: string[];
}

const A_COLOR = '#818cf8'; // indigo-400
const B_COLOR = '#fb923c'; // orange-400

function StatCard({ label, valA, valB, unit = '' }: { label: string; valA: string | number; valB: string | number; unit?: string }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 space-y-3">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <span className="text-xs text-indigo-400 font-medium mr-1">A</span>
          <span className="text-lg font-bold text-white">{valA}{unit}</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-orange-400 font-medium mr-1">B</span>
          <span className="text-lg font-bold text-white">{valB}{unit}</span>
        </div>
      </div>
    </div>
  );
}

function buildImportanceData(
  impA: Record<string, number> | undefined,
  impB: Record<string, number> | undefined,
  topN = 15,
) {
  const sortFn = (obj: Record<string, number>) =>
    Object.entries(obj).sort((x, y) => y[1] - x[1]).slice(0, topN);
  const topA = impA ? sortFn(impA) : [];
  const topB = impB ? sortFn(impB) : [];
  const allFeats = [...new Set([...topA.map(([k]) => k), ...topB.map(([k]) => k)])];
  return allFeats
    .map((feat) => ({
      feature: feat.length > 20 ? feat.slice(0, 18) + '…' : feat,
      fullName: feat,
      imp_a: impA?.[feat] ?? 0,
      imp_b: impB?.[feat] ?? 0,
    }))
    .sort((x, y) => (y.imp_a + y.imp_b) - (x.imp_a + x.imp_b))
    .slice(0, topN);
}

export function LabSection1({ a, b, sharedFeatures, onlyA, onlyB }: Props) {
  const [sortKey, setSortKey] = useState<'feature' | 'mean_a' | 'std_a' | 'skewness_a'>('mean_a');

  const importanceData = useMemo(
    () => buildImportanceData(a.feature_importances, b.feature_importances),
    [a.feature_importances, b.feature_importances],
  );

  const classDist = useMemo(() => {
    const allClasses = [...new Set([
      ...Object.keys(a.class_distribution ?? {}),
      ...Object.keys(b.class_distribution ?? {}),
    ])];
    return allClasses.map((cls) => ({
      cls,
      count_a: a.class_distribution?.[cls] ?? 0,
      count_b: b.class_distribution?.[cls] ?? 0,
    }));
  }, [a.class_distribution, b.class_distribution]);

  const corrDataA = (a.top_correlations ?? []).slice(0, 12);
  const corrDataB = (b.top_correlations ?? []).slice(0, 12);

  const statsTableData = useMemo(() => {
    const allFeats = [...new Set([...Object.keys(a.feature_stats), ...Object.keys(b.feature_stats)])];
    const rows = allFeats.map((feat) => ({
      feature: feat,
      mean_a: a.feature_stats[feat]?.mean,
      std_a: a.feature_stats[feat]?.std,
      skewness_a: a.feature_stats[feat]?.skewness,
      mean_b: b.feature_stats[feat]?.mean,
      std_b: b.feature_stats[feat]?.std,
      skewness_b: b.feature_stats[feat]?.skewness,
      delta_mean:
        a.feature_stats[feat]?.mean != null && b.feature_stats[feat]?.mean != null
          ? b.feature_stats[feat].mean - a.feature_stats[feat].mean
          : undefined,
    }));
    return rows.sort((x, y) => {
      if (sortKey === 'feature') return x.feature.localeCompare(y.feature);
      const av = x[sortKey] ?? 0;
      const bv = y[sortKey] ?? 0;
      return Math.abs(bv as number) - Math.abs(av as number);
    });
  }, [a.feature_stats, b.feature_stats, sortKey]);

  const noStats = a.sample_size === 0 && b.sample_size === 0;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Training Samples" valA={a.sample_size > 0 ? a.sample_size : '—'} valB={b.sample_size > 0 ? b.sample_size : '—'} />
        <StatCard label="Features" valA={a.feature_count} valB={b.feature_count} />
        <StatCard label="Classes" valA={a.class_names.length} valB={b.class_names.length} />
        <StatCard label="Shared Features" valA={sharedFeatures.length} valB={sharedFeatures.length} />
        <StatCard label="Unique to A" valA={onlyA.length} valB="—" />
        <StatCard label="Unique to B" valA="—" valB={onlyB.length} />
      </div>

      {/* Dataset labels */}
      <div className="grid grid-cols-2 gap-3">
        {[a, b].map((m, i) => (
          <div key={m.model_id} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${i === 0 ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-orange-500/30 bg-orange-500/5'}`}>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${i === 0 ? 'bg-indigo-500/20 text-indigo-300' : 'bg-orange-500/20 text-orange-300'}`}>Model {i === 0 ? 'A' : 'B'}</span>
            <div>
              <p className="text-white text-sm font-semibold capitalize">{m.model_type.replace('_', ' ')}</p>
              <p className="text-gray-500 text-xs truncate max-w-[240px]">{m.dataset_filename ?? m.dataset_id ?? 'Unknown dataset'}</p>
            </div>
          </div>
        ))}
      </div>

      {noStats && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-amber-400 text-sm">
          Load both models (Training → Load Model) to unlock dataset distribution analysis, feature statistics, and correlation charts.
        </div>
      )}

      {/* Class distribution */}
      {classDist.length > 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Class Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={classDist} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="cls" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend formatter={(v) => (v === 'count_a' ? 'Model A' : 'Model B')} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="count_a" name="Model A" fill={A_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="count_b" name="Model B" fill={B_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Feature importance comparison */}
      {importanceData.length > 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Feature Importance Comparison (top 15)</h3>
          <p className="text-xs text-gray-500">Sorted by combined importance. Longer bar = stronger influence on prediction.</p>
          <ResponsiveContainer width="100%" height={Math.max(importanceData.length * 28, 180)}>
            <BarChart data={importanceData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="feature" width={130} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                formatter={(v: unknown, n: unknown) => [typeof v === 'number' ? v.toFixed(5) : String(v), n === 'imp_a' ? 'Model A' : 'Model B']}
                labelFormatter={(l, payload): string => (payload as {payload?: {fullName?: string}}[])?.[0]?.payload?.fullName ?? String(l)}
              />
              <Legend formatter={(v) => (v === 'imp_a' ? 'Model A' : 'Model B')} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="imp_a" name="imp_a" fill={A_COLOR} radius={[0, 4, 4, 0]} maxBarSize={12} />
              <Bar dataKey="imp_b" name="imp_b" fill={B_COLOR} radius={[0, 4, 4, 0]} maxBarSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top correlations */}
      {(corrDataA.length > 0 || corrDataB.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {([{ data: corrDataA, label: 'A', color: A_COLOR }, { data: corrDataB, label: 'B', color: B_COLOR }] as const).map(({ data, label, color }) => (
            data.length > 0 && (
              <div key={label} className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-300">Top Feature Correlations — Model {label}</h3>
                <ResponsiveContainer width="100%" height={data.length * 28 + 20}>
                  <BarChart
                    data={data.map((d: LabTopCorrelation) => ({
                      pair: `${d.feature_a.slice(0, 10)}·${d.feature_b.slice(0, 10)}`,
                      fullPair: `${d.feature_a} ↔ ${d.feature_b}`,
                      correlation: d.correlation,
                    }))}
                    layout="vertical"
                    margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" domain={[0, 1]} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toFixed(1)} />
                    <YAxis type="category" dataKey="pair" width={120} tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number, _n, p) => [v.toFixed(4), p.payload.fullPair]}
                    />
                    <Bar dataKey="correlation" fill={color} radius={[0, 4, 4, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          ))}
        </div>
      )}

      {/* Feature stats table */}
      {statsTableData.length > 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-gray-300">Feature Statistics Comparison</h3>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
              className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1"
            >
              <option value="feature">Sort: Feature Name</option>
              <option value="mean_a">Sort: Mean (A)</option>
              <option value="std_a">Sort: Std Dev (A)</option>
              <option value="skewness_a">Sort: |Skewness| (A)</option>
            </select>
          </div>
          <div className="overflow-auto max-h-72 rounded-lg border border-gray-700/50">
            <table className="w-full text-xs min-w-[700px]">
              <thead className="sticky top-0 bg-gray-900/90 backdrop-blur border-b border-gray-700">
                <tr>
                  {['Feature', 'Mean A', 'Mean B', 'Δ Mean', 'Std A', 'Std B', 'Skew A', 'Skew B'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statsTableData.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-gray-700/30 ${i % 2 ? 'bg-gray-900/20' : ''}`}>
                    <td className="px-3 py-1.5 font-mono text-gray-200 truncate max-w-[140px]" title={row.feature}>{row.feature}</td>
                    <td className="px-3 py-1.5 font-mono text-indigo-300">{row.mean_a?.toFixed(4) ?? '—'}</td>
                    <td className="px-3 py-1.5 font-mono text-orange-300">{row.mean_b?.toFixed(4) ?? '—'}</td>
                    <td className={`px-3 py-1.5 font-mono ${row.delta_mean == null ? 'text-gray-600' : row.delta_mean > 0 ? 'text-emerald-400' : row.delta_mean < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {row.delta_mean == null ? '—' : `${row.delta_mean > 0 ? '+' : ''}${row.delta_mean.toFixed(4)}`}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-300">{row.std_a?.toFixed(4) ?? '—'}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-300">{row.std_b?.toFixed(4) ?? '—'}</td>
                    <td className={`px-3 py-1.5 font-mono ${Math.abs(row.skewness_a ?? 0) > 1 ? 'text-amber-400' : 'text-gray-400'}`}>{row.skewness_a?.toFixed(3) ?? '—'}</td>
                    <td className={`px-3 py-1.5 font-mono ${Math.abs(row.skewness_b ?? 0) > 1 ? 'text-amber-400' : 'text-gray-400'}`}>{row.skewness_b?.toFixed(3) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Feature overlap */}
      {(onlyA.length > 0 || onlyB.length > 0) && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Feature Overlap</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-gray-500 mb-1.5">Shared ({sharedFeatures.length})</p>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {sharedFeatures.map((f) => <span key={f} className="px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 font-mono">{f}</span>)}
              </div>
            </div>
            <div>
              <p className="text-indigo-400 mb-1.5">Only in A ({onlyA.length})</p>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {onlyA.map((f) => <span key={f} className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono">{f}</span>)}
                {onlyA.length === 0 && <span className="text-gray-600">None</span>}
              </div>
            </div>
            <div>
              <p className="text-orange-400 mb-1.5">Only in B ({onlyB.length})</p>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {onlyB.map((f) => <span key={f} className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300 font-mono">{f}</span>)}
                {onlyB.length === 0 && <span className="text-gray-600">None</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
