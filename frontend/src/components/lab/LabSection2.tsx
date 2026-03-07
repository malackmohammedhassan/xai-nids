import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { LabModelProfile } from '@/types';

interface Props {
  a: LabModelProfile;
  b: LabModelProfile;
  sharedFeatures: string[];
}

const A_COLOR = '#818cf8';
const B_COLOR = '#fb923c';

/** Bin a list of float values into N histogram buckets. */
function buildHistogram(values: number[], bins = 20): Array<{ bucket: string; count: number }> {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return [{ bucket: min.toFixed(4), count: values.length }];
  const step = range / bins;
  const result = Array.from({ length: bins }, (_, i) => ({
    bucket: (min + (i + 0.5) * step).toFixed(4),
    count: 0,
  }));
  values.forEach((v) => {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1);
    result[idx].count++;
  });
  return result;
}

/** Merge two histogram arrays into an overlay dataset. */
function mergeHistograms(
  histA: Array<{ bucket: string; count: number }>,
  histB: Array<{ bucket: string; count: number }>,
) {
  const len = Math.max(histA.length, histB.length);
  return Array.from({ length: len }, (_, i) => ({
    bucket: histA[i]?.bucket ?? histB[i]?.bucket ?? i.toString(),
    count_a: histA[i]?.count ?? 0,
    count_b: histB[i]?.count ?? 0,
  }));
}

export function LabSection2({ a, b, sharedFeatures }: Props) {
  const allFeatures = useMemo(
    () => [...new Set([...Object.keys(a.feature_samples ?? {}), ...Object.keys(b.feature_samples ?? {})])].sort(),
    [a.feature_samples, b.feature_samples],
  );

  const [selectedFeature, setSelectedFeature] = useState<string>('');
  const feat = selectedFeature || allFeatures[0] || '';

  const histogramData = useMemo(() => {
    if (!feat) return [];
    const vA = a.feature_samples?.[feat] ?? [];
    const vB = b.feature_samples?.[feat] ?? [];
    if (!vA.length && !vB.length) return [];
    const hA = vA.length ? buildHistogram(vA, 20) : [];
    const hB = vB.length ? buildHistogram(vB, 20) : [];
    return mergeHistograms(
      hA.length ? hA : Array.from({ length: 20 }, (_, i) => ({ bucket: i.toFixed(4), count: 0 })),
      hB.length ? hB : Array.from({ length: 20 }, (_, i) => ({ bucket: i.toFixed(4), count: 0 })),
    );
  }, [feat, a.feature_samples, b.feature_samples]);

  const featStatA = feat ? a.feature_stats[feat] : null;
  const featStatB = feat ? b.feature_stats[feat] : null;

  // Mean comparison across all shared features (top 20)
  const meanCompData = useMemo(() => {
    const features = sharedFeatures.slice(0, 20);
    return features.map((f) => ({
      feature: f.length > 18 ? f.slice(0, 16) + '…' : f,
      fullName: f,
      mean_a: a.feature_stats[f]?.mean ?? 0,
      mean_b: b.feature_stats[f]?.mean ?? 0,
    })).filter((x) => x.mean_a !== 0 || x.mean_b !== 0);
  }, [sharedFeatures, a.feature_stats, b.feature_stats]);

  const noData = allFeatures.length === 0;

  return (
    <div className="space-y-6">
      {noData ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-amber-400 text-sm">
          Load both models to see feature distribution analysis.
        </div>
      ) : (
        <>
          {/* Feature selector + histogram overlay */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-300">Feature Distribution Overlay</h3>
              <select
                value={feat}
                onChange={(e) => setSelectedFeature(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1.5 ml-auto"
              >
                {allFeatures.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {histogramData.length > 0 ? (
              <>
                <p className="text-xs text-gray-500">
                  Histogram of <code className="text-cyan-300">{feat}</code> values from each model's training sample.
                  Overlap shows how similarly features are distributed between datasets.
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={histogramData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="bucket" tick={{ fill: '#94a3b8', fontSize: 9 }} interval={3} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                      formatter={(v, n) => [v, n === 'count_a' ? 'Model A' : 'Model B']}
                    />
                    <Legend formatter={(v) => (v === 'count_a' ? 'Model A' : 'Model B')} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="count_a" name="count_a" fill={A_COLOR} fillOpacity={0.75} maxBarSize={16} />
                    <Bar dataKey="count_b" name="count_b" fill={B_COLOR} fillOpacity={0.75} maxBarSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <p className="text-xs text-gray-600 py-4 text-center">Feature &quot;{feat}&quot; not available in both models' samples.</p>
            )}

            {/* Per-feature stats side-by-side */}
            {(featStatA || featStatB) && (
              <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-gray-700">
                {([{ stat: featStatA, color: 'text-indigo-300', label: 'Model A' }, { stat: featStatB, color: 'text-orange-300', label: 'Model B' }]).map(({ stat, color, label }) => (
                  <div key={label} className="space-y-1">
                    <p className={`font-semibold ${color}`}>{label}</p>
                    {stat ? (
                      <table className="w-full text-gray-400">
                        <tbody>
                          {[
                            ['Mean', stat.mean.toFixed(6)],
                            ['Std Dev', stat.std.toFixed(6)],
                            ['Min', stat.min.toFixed(6)],
                            ['Max', stat.max.toFixed(6)],
                            ['Q25', stat.q25.toFixed(6)],
                            ['Q75', stat.q75.toFixed(6)],
                            ['Skewness', stat.skewness.toFixed(4)],
                            ['Kurtosis', stat.kurtosis.toFixed(4)],
                          ].map(([k, v]) => (
                            <tr key={k}>
                              <td className="pr-3 text-gray-600">{k}</td>
                              <td className="font-mono text-gray-200">{v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-gray-600">Not available for this model.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mean comparison across shared features */}
          {meanCompData.length > 0 && (
            <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-300">Feature Mean Comparison — Shared Features</h3>
              <p className="text-xs text-gray-500">
                Side-by-side mean values for up to 20 shared features.
                Large differences indicate dataset or preprocessing drift between models.
              </p>
              <ResponsiveContainer width="100%" height={Math.max(meanCompData.length * 28, 160)}>
                <BarChart data={meanCompData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toFixed(2)} />
                  <YAxis type="category" dataKey="feature" width={130} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: unknown, n: unknown) => [typeof v === 'number' ? v.toFixed(6) : String(v), n === 'mean_a' ? 'Model A' : 'Model B']}
                    labelFormatter={(l, payload): string => (payload as {payload?: {fullName?: string}}[])?.[0]?.payload?.fullName ?? String(l)}
                  />
                  <Legend formatter={(v) => (v === 'mean_a' ? 'Model A (mean)' : 'Model B (mean)')} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="mean_a" name="mean_a" fill={A_COLOR} fillOpacity={0.85} radius={[0, 4, 4, 0]} maxBarSize={12} />
                  <Bar dataKey="mean_b" name="mean_b" fill={B_COLOR} fillOpacity={0.85} radius={[0, 4, 4, 0]} maxBarSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
