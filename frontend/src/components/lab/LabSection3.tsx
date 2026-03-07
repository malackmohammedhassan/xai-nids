import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import type { LabModelProfile } from '@/types';

interface Props {
  a: LabModelProfile;
  b: LabModelProfile;
  deltas: Record<string, number | undefined | null>;
}

const A_COLOR = '#818cf8';
const B_COLOR = '#fb923c';
const METRICS: Array<{ key: string; label: string }> = [
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'precision', label: 'Precision' },
  { key: 'recall', label: 'Recall' },
  { key: 'f1_score', label: 'F1 Score' },
  { key: 'roc_auc', label: 'ROC-AUC' },
];

function MetricDeltaCard({
  label, valA, valB, delta,
}: {
  label: string; valA?: number; valB?: number; delta?: number | null;
}) {
  const better = delta != null ? delta > 0 : null;
  const pctA = valA != null ? `${(valA * 100).toFixed(2)}%` : '—';
  const pctB = valB != null ? `${(valB * 100).toFixed(2)}%` : '—';
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 space-y-2">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="text-center flex-1">
          <p className="text-xs text-indigo-400">Model A</p>
          <p className="text-xl font-bold text-indigo-300">{pctA}</p>
        </div>
        {delta != null && (
          <div className={`text-center px-2 py-1 rounded-lg text-sm font-bold ${better ? 'bg-emerald-500/10 text-emerald-400' : better === false ? 'bg-red-500/10 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
            {delta > 0 ? '+' : ''}{(delta * 100).toFixed(2)}%
          </div>
        )}
        <div className="text-center flex-1">
          <p className="text-xs text-orange-400">Model B</p>
          <p className="text-xl font-bold text-orange-300">{pctB}</p>
        </div>
      </div>
      {delta != null && (
        <p className="text-[10px] text-center text-gray-600">
          {better ? 'Model B is better ↑' : better === false ? 'Model A is better ↑' : 'Equal performance'}
        </p>
      )}
    </div>
  );
}

/** Downsample ROC curve, build overlay chart data. */
function buildRocData(a: LabModelProfile, b: LabModelProfile) {
  const sample = (fpr: number[], tpr: number[], n = 60) => {
    const step = Math.max(1, Math.floor(fpr.length / n));
    const pts: Array<{ fpr: number; tpr: number }> = [];
    for (let i = 0; i < fpr.length; i += step) pts.push({ fpr: fpr[i], tpr: tpr[i] });
    return pts.slice(0, n);
  };
  const pA = a.roc_curve ? sample(a.roc_curve.fpr, a.roc_curve.tpr) : [];
  const pB = b.roc_curve ? sample(b.roc_curve.fpr, b.roc_curve.tpr) : [];
  const len = Math.max(pA.length, pB.length, 2);
  return Array.from({ length: len }, (_, i) => ({
    x: +(i / (len - 1)).toFixed(3),
    tpr_a: pA[i]?.tpr != null ? +pA[i].tpr.toFixed(4) : null,
    tpr_b: pB[i]?.tpr != null ? +pB[i].tpr.toFixed(4) : null,
    random: +(i / (len - 1)).toFixed(3),
  }));
}

/** Render a confusion matrix as a 2×2 coloured grid. */
function ConfusionMatrix({ matrix, classNames, color, label }: {
  matrix?: number[][]; classNames: string[]; color: string; label: string;
}) {
  if (!matrix || matrix.length < 2 || matrix[0].length < 2) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4">
        <p className="text-xs font-semibold mb-3" style={{ color }}>{label}</p>
        <p className="text-xs text-gray-600">No confusion matrix data available.</p>
      </div>
    );
  }
  const total = matrix.flat().reduce((s, v) => s + v, 0);
  const fmt = (v: number) => `${v} (${total ? ((v / total) * 100).toFixed(1) : 0}%)`;
  const cn0 = classNames[0] ?? 'Class 0';
  const cn1 = classNames[1] ?? 'Class 1';
  // sklearn: [[TN, FP], [FN, TP]]
  const tn = matrix[0][0], fp = matrix[0][1], fn = matrix[1][0], tp = matrix[1][1];
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3">
      <p className="text-xs font-semibold" style={{ color }}>{label}</p>
      <div className="text-xs text-gray-500 mb-1">Actual → / Predicted ↓</div>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-1 text-xs">
        <div />
        <div className="text-center font-semibold text-gray-400 py-1">Pred {cn0}</div>
        <div className="text-center font-semibold text-gray-400 py-1">Pred {cn1}</div>
        <div className="font-semibold text-gray-400 flex items-center pr-2">Act {cn0}</div>
        <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/20 p-2 text-center">
          <p className="text-emerald-400 font-bold">{tn}</p>
          <p className="text-gray-600">{total ? ((tn / total) * 100).toFixed(1) : 0}%</p>
          <p className="text-[9px] text-gray-600 mt-0.5">TN</p>
        </div>
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-center">
          <p className="text-red-400 font-bold">{fp}</p>
          <p className="text-gray-600">{total ? ((fp / total) * 100).toFixed(1) : 0}%</p>
          <p className="text-[9px] text-gray-600 mt-0.5">FP</p>
        </div>
        <div className="font-semibold text-gray-400 flex items-center pr-2">Act {cn1}</div>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-center">
          <p className="text-amber-400 font-bold">{fn}</p>
          <p className="text-gray-600">{total ? ((fn / total) * 100).toFixed(1) : 0}%</p>
          <p className="text-[9px] text-gray-600 mt-0.5">FN</p>
        </div>
        <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/20 p-2 text-center">
          <p className="text-emerald-400 font-bold">{tp}</p>
          <p className="text-gray-600">{total ? ((tp / total) * 100).toFixed(1) : 0}%</p>
          <p className="text-[9px] text-gray-600 mt-0.5">TP</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-gray-700/50">
        <div><span className="text-gray-500">Precision: </span><span className="text-white font-mono">{tp + fp > 0 ? ((tp / (tp + fp)) * 100).toFixed(1) : '—'}%</span></div>
        <div><span className="text-gray-500">Recall: </span><span className="text-white font-mono">{tp + fn > 0 ? ((tp / (tp + fn)) * 100).toFixed(1) : '—'}%</span></div>
        <div><span className="text-gray-500">FP Rate: </span><span className="text-red-300 font-mono">{tn + fp > 0 ? ((fp / (tn + fp)) * 100).toFixed(1) : '—'}%</span></div>
        <div><span className="text-gray-500">Total: </span><span className="text-gray-300 font-mono">{total.toLocaleString()}</span></div>
      </div>
    </div>
  );
}

export function LabSection3({ a, b, deltas }: Props) {
  const rocData = useMemo(() => buildRocData(a, b), [a.roc_curve, b.roc_curve]);
  const hasRoc = a.roc_curve || b.roc_curve;

  return (
    <div className="space-y-6">
      {/* Metric delta cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {METRICS.map(({ key, label }) => (
          <MetricDeltaCard
            key={key}
            label={label}
            valA={(a as unknown as Record<string, number | undefined>)[key]}
            valB={(b as unknown as Record<string, number | undefined>)[key]}
            delta={deltas[key]}
          />
        ))}
      </div>

      {/* ROC curve overlay */}
      {hasRoc ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">ROC Curve Comparison</h3>
          <p className="text-xs text-gray-500">
            Higher curve = better discrimination. Dashed diagonal = random classifier (AUC 0.50).
            AUC shown: A={a.roc_auc != null ? (a.roc_auc).toFixed(4) : '—'} | B={b.roc_auc != null ? (b.roc_auc).toFixed(4) : '—'}
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={rocData} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="x"
                type="number"
                domain={[0, 1]}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v) => v.toFixed(1)}
                label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 11 }}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v) => v.toFixed(1)}
                label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number, n) =>
                  n === 'random' ? undefined : [v?.toFixed(4), n === 'tpr_a' ? 'Model A TPR' : 'Model B TPR']
                }
                labelFormatter={(l) => `FPR ≈ ${Number(l).toFixed(3)}`}
              />
              <Legend formatter={(v) => v === 'tpr_a' ? `Model A (AUC ${a.roc_auc?.toFixed(3) ?? '?'})` : v === 'tpr_b' ? `Model B (AUC ${b.roc_auc?.toFixed(3) ?? '?'})` : 'Random'} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="random" stroke="#374151" strokeDasharray="4 4" dot={false} strokeWidth={1} name="random" />
              {a.roc_curve && <Line type="monotone" dataKey="tpr_a" stroke={A_COLOR} dot={false} strokeWidth={2} name="tpr_a" connectNulls />}
              {b.roc_curve && <Line type="monotone" dataKey="tpr_b" stroke={B_COLOR} dot={false} strokeWidth={2} name="tpr_b" connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 text-sm text-gray-500">
          ROC curve data not available. Retrain models to generate ROC data.
        </div>
      )}

      {/* Confusion matrices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ConfusionMatrix matrix={a.confusion_matrix} classNames={a.class_names} color={A_COLOR} label="Model A — Confusion Matrix" />
        <ConfusionMatrix matrix={b.confusion_matrix} classNames={b.class_names} color={B_COLOR} label="Model B — Confusion Matrix" />
      </div>

      {/* Classification report */}
      {(a.classification_report || b.classification_report) && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Per-Class Metrics</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[{ report: a.classification_report, color: A_COLOR, label: 'Model A', cn: a.class_names },
              { report: b.classification_report, color: B_COLOR, label: 'Model B', cn: b.class_names },
            ].map(({ report, color, label, cn }) => (
              report && (
                <div key={label}>
                  <p className="text-xs font-semibold mb-2" style={{ color }}>{label}</p>
                  <div className="overflow-auto rounded-lg border border-gray-700/50">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-900/60 border-b border-gray-700">
                          {['Class', 'Precision', 'Recall', 'F1', 'Support'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(report)
                          .filter(([k]) => !['accuracy', 'macro avg', 'weighted avg'].includes(k))
                          .map(([cls, vals]) => (
                            <tr key={cls} className="border-b border-gray-700/30">
                              <td className="px-3 py-1.5 text-gray-200 font-medium">{cls}</td>
                              {['precision', 'recall', 'f1-score'].map((m) => (
                                <td key={m} className="px-3 py-1.5 font-mono text-gray-300">{(vals as Record<string, number>)[m]?.toFixed(3) ?? '—'}</td>
                              ))}
                              <td className="px-3 py-1.5 font-mono text-gray-400">{(vals as Record<string, number>)['support'] ?? '—'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
