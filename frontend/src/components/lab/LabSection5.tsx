import { useMemo } from 'react';
import type { LabModelProfile } from '@/types';

interface Props {
  a: LabModelProfile;
  b: LabModelProfile;
}

const A_COLOR = 'text-indigo-300';
const B_COLOR = 'text-orange-300';

function PipelineCard({ label, valA, valB }: { label: string; valA: string; valB: string }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 space-y-2 min-w-0">
      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide truncate">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[10px] font-bold text-indigo-400 shrink-0">A</span>
          <span className={`text-sm font-semibold ${A_COLOR} truncate min-w-0`} title={valA || '—'}>{valA || '—'}</span>
        </div>
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[10px] font-bold text-orange-400 shrink-0">B</span>
          <span className={`text-sm font-semibold ${B_COLOR} truncate min-w-0`} title={valB || '—'}>{valB || '—'}</span>
        </div>
      </div>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(6);
  return String(v);
}

export function LabSection5({ a, b }: Props) {
  // Union of all hyperparameter keys from both models
  const hyperKeys = useMemo(() => {
    const keys = new Set([
      ...Object.keys(a.hyperparameters ?? {}),
      ...Object.keys(b.hyperparameters ?? {}),
    ]);
    return [...keys].sort();
  }, [a.hyperparameters, b.hyperparameters]);

  // Top-N feature lists from importance if available
  const topFeaturesA = useMemo(() => {
    if (!a.feature_importances) return a.feature_names.slice(0, 20);
    return Object.entries(a.feature_importances)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 20)
      .map(([k]) => k);
  }, [a.feature_importances, a.feature_names]);

  const topFeaturesB = useMemo(() => {
    if (!b.feature_importances) return b.feature_names.slice(0, 20);
    return Object.entries(b.feature_importances)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 20)
      .map(([k]) => k);
  }, [b.feature_importances, b.feature_names]);

  return (
    <div className="space-y-6">
      {/* Pipeline summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <PipelineCard
          label="Model Type"
          valA={a.model_type.replace('_', ' ')}
          valB={b.model_type.replace('_', ' ')}
        />
        <PipelineCard
          label="Feature Count"
          valA={String(a.feature_count)}
          valB={String(b.feature_count)}
        />
        <PipelineCard
          label="Classes"
          valA={a.class_names.join(', ')}
          valB={b.class_names.join(', ')}
        />
        <PipelineCard
          label="Training Samples"
          valA={a.sample_size > 0 ? String(a.sample_size) : 'Not loaded'}
          valB={b.sample_size > 0 ? String(b.sample_size) : 'Not loaded'}
        />
        <PipelineCard
          label="Dataset"
          valA={a.dataset_filename ?? a.dataset_id ?? '—'}
          valB={b.dataset_filename ?? b.dataset_id ?? '—'}
        />
        <PipelineCard
          label="Created"
          valA={a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
          valB={b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}
        />
        <PipelineCard
          label="Accuracy"
          valA={a.accuracy != null ? `${(a.accuracy * 100).toFixed(2)}%` : '—'}
          valB={b.accuracy != null ? `${(b.accuracy * 100).toFixed(2)}%` : '—'}
        />
        <PipelineCard
          label="F1 Score"
          valA={a.f1_score != null ? `${(a.f1_score * 100).toFixed(2)}%` : '—'}
          valB={b.f1_score != null ? `${(b.f1_score * 100).toFixed(2)}%` : '—'}
        />
      </div>

      {/* Hyperparameter comparison table */}
      {hyperKeys.length > 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Hyperparameter Comparison</h3>
          <p className="text-xs text-gray-500">Best hyperparameters selected by Optuna during training.</p>
          <div className="overflow-auto rounded-lg border border-gray-700/50">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="bg-gray-900/80 border-b border-gray-700">
                  <th className="px-4 py-2 text-left text-gray-500 font-medium">Parameter</th>
                  <th className="px-4 py-2 text-left text-indigo-400 font-medium">Model A</th>
                  <th className="px-4 py-2 text-left text-orange-400 font-medium">Model B</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">Changed?</th>
                </tr>
              </thead>
              <tbody>
                {hyperKeys.map((key, i) => {
                  const vA = fmt(a.hyperparameters?.[key]);
                  const vB = fmt(b.hyperparameters?.[key]);
                  const changed = vA !== vB;
                  return (
                    <tr key={key} className={`border-b border-gray-700/30 ${i % 2 ? 'bg-gray-900/20' : ''}`}>
                      <td className="px-4 py-2 font-mono text-gray-300">{key}</td>
                      <td className={`px-4 py-2 font-mono ${changed ? 'text-indigo-300 font-semibold' : 'text-gray-400'}`}>{vA}</td>
                      <td className={`px-4 py-2 font-mono ${changed ? 'text-orange-300 font-semibold' : 'text-gray-400'}`}>{vB}</td>
                      <td className="px-4 py-2">
                        {changed
                          ? <span className="text-amber-400 text-[10px] font-bold">DIFFERENT</span>
                          : <span className="text-gray-600 text-[10px]">same</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top feature lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { features: topFeaturesA, importances: a.feature_importances, label: 'Model A — Top Features', color: 'text-indigo-400' },
          { features: topFeaturesB, importances: b.feature_importances, label: 'Model B — Top Features', color: 'text-orange-400' },
        ].map(({ features, importances, label, color }) => (
          <div key={label} className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-2">
            <h3 className={`text-sm font-semibold ${color}`}>{label}</h3>
            <p className="text-[10px] text-gray-600">
              {importances ? 'Ranked by feature importance score.' : 'Ranked by selection order (importance not available).'}
            </p>
            <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
              {features.map((feat, idx) => (
                <div key={feat} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-600 w-5 text-right shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-gray-300 truncate" title={feat}>{feat}</span>
                      {importances?.[feat] != null && (
                        <span className="text-[10px] font-mono text-gray-500 shrink-0">
                          {importances[feat].toFixed(5)}
                        </span>
                      )}
                    </div>
                    {importances?.[feat] != null && (
                      <div className="h-1 bg-gray-700 rounded-full mt-0.5">
                        <div
                          className="h-1 rounded-full"
                          style={{
                            width: `${Math.min(100, (importances[feat] / Math.max(...Object.values(importances))) * 100)}%`,
                            background: color === 'text-indigo-400' ? '#818cf8' : '#fb923c',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
