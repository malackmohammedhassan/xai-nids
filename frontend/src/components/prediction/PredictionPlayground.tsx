import { useState, type ChangeEvent } from 'react';
import { Play, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { PredictionResult } from '@/types';

interface Props {
  featureNames: string[];
  onPredict: (features: Record<string, unknown>) => Promise<PredictionResult>;
  result?: PredictionResult | null;
  loading?: boolean;
}

export function PredictionPlayground({ featureNames, onPredict, result, loading = false }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(featureNames.map((f) => [f, '0']))
  );

  const handleChange = (feature: string, value: string) => {
    setValues((prev) => ({ ...prev, [feature]: value }));
  };

  const handleSubmit = async () => {
    const parsed = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, isNaN(Number(v)) ? v : Number(v)])
    );
    await onPredict(parsed);
  };

  const isAttack =
    result &&
    (result.prediction === 1 ||
      result.prediction === '1' ||
      (typeof result.prediction === 'string' &&
        result.prediction.toLowerCase() !== 'normal' &&
        result.prediction.toLowerCase() !== '0'));

  return (
    <div className="space-y-5">
      {/* Feature input grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {featureNames.map((feature) => (
          <div key={feature}>
            <label htmlFor={`feat-${feature}`} className="text-gray-400 text-xs block mb-1 truncate" title={feature}>
              {feature}
            </label>
            <input
              id={`feat-${feature}`}
              type="text"
              value={values[feature] ?? '0'}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(feature, e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
        {loading ? 'Running…' : 'Run Prediction'}
      </button>

      {result && (
        <div
          className={clsx(
            'rounded-xl p-5 border space-y-3',
            isAttack
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-emerald-500/10 border-emerald-500/30'
          )}
        >
          <div className="flex items-center gap-3">
            {isAttack ? (
              <ShieldAlert size={28} className="text-red-400 shrink-0" />
            ) : (
              <ShieldCheck size={28} className="text-emerald-400 shrink-0" />
            )}
            <div>
              <p className={`text-xl font-bold ${isAttack ? 'text-red-300' : 'text-emerald-300'}`}>
                {isAttack ? 'Intrusion Detected' : 'Benign Traffic'}
              </p>
              <p className="text-gray-400 text-sm">
                Prediction: <span className="font-mono text-white">{String(result.prediction)}</span>
                {result.confidence !== undefined && (
                  <>
                    {' · '}
                    Confidence: <span className="font-mono text-white">{(result.confidence * 100).toFixed(1)}%</span>
                  </>
                )}
                {' · '}
                <span className="text-gray-500">{result.prediction_time_ms.toFixed(1)} ms</span>
              </p>
            </div>
          </div>

          {/* Confidence meter */}
          {result.confidence !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Confidence</span>
                <span>{(result.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all',
                    isAttack ? 'bg-red-500' : 'bg-emerald-500'
                  )}
                  style={{ width: `${(result.confidence * 100).toFixed(1)}%` }}
                />
              </div>
            </div>
          )}

          {/* Class probabilities */}
          {result.probabilities && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(result.probabilities).map(([cls, prob]) => (
                <div key={cls} className="bg-gray-900/50 rounded-lg px-3 py-2 text-center">
                  <p className="text-gray-400 text-xs">{cls}</p>
                  <p className="text-white font-semibold text-sm">{(prob * 100).toFixed(1)}%</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
