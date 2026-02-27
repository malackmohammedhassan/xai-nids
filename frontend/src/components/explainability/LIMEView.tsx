import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { LIMEResult } from '@/types';

interface Props {
  lime: LIMEResult;
}

export function LIMEView({ lime }: Props) {
  // Split positive vs negative weights
  const weights = Object.entries(lime.feature_weights).map(([feature, weight]) => ({
    feature: feature.length > 20 ? feature.slice(0, 18) + '…' : feature,
    fullName: feature,
    weight: +weight.toFixed(4),
    fill: weight >= 0 ? '#f87171' : '#34d399',
  }));

  const positive = [...weights].filter((w) => w.weight > 0).sort((a, b) => b.weight - a.weight);
  const negative = [...weights].filter((w) => w.weight < 0).sort((a, b) => a.weight - b.weight);

  const maxProba = Math.max(...lime.prediction_proba);
  const predictedClass = lime.prediction_proba.indexOf(maxProba);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-xs">LIME Prediction</p>
          <p className="text-white font-semibold mt-0.5">
            Class {predictedClass} — {(maxProba * 100).toFixed(1)}% confidence
          </p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-xs">Intercept</p>
          <p className="text-gray-200 font-mono text-sm">{lime.intercept.toFixed(4)}</p>
        </div>
      </div>

      {/* Custom chart image if available */}
      {lime.explanation_chart_b64 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <img
            src={`data:image/png;base64,${lime.explanation_chart_b64}`}
            alt="LIME Explanation"
            className="w-full rounded-lg"
          />
        </div>
      )}

      {/* Two-column pro/con view */}
      <div className="grid grid-cols-2 gap-4">
        {/* Positive features — support prediction */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <h5 className="text-red-300 text-sm font-medium mb-3">Pushes Positive</h5>
          {positive.length === 0 ? (
            <p className="text-gray-500 text-xs">None</p>
          ) : (
            <div className="space-y-2">
              {positive.slice(0, 8).map((w) => (
                <div key={w.fullName} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-300 truncate flex-1" title={w.fullName}>
                    {w.feature}
                  </span>
                  <span className="text-xs text-red-400 font-mono shrink-0">
                    +{w.weight.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Negative features — oppose prediction */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <h5 className="text-emerald-300 text-sm font-medium mb-3">Pushes Negative</h5>
          {negative.length === 0 ? (
            <p className="text-gray-500 text-xs">None</p>
          ) : (
            <div className="space-y-2">
              {negative.slice(0, 8).map((w) => (
                <div key={w.fullName} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-300 truncate flex-1" title={w.fullName}>
                    {w.feature}
                  </span>
                  <span className="text-xs text-emerald-400 font-mono shrink-0">
                    {w.weight.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
