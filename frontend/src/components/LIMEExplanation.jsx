import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function LIMEExplanation({ data }) {
  if (!data) return null;

  const weights = data.feature_weights || [];
  const probabilities = data.prediction_probabilities || {};
  const stability = data.stability_score;

  const chartData = weights.map((w) => ({
    feature: w.feature.length > 30 ? w.feature.slice(0, 30) + '...' : w.feature,
    weight: w.weight,
    fullFeature: w.feature,
  }));

  return (
    <div className="space-y-6">
      {/* Prediction Probabilities */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-soc-accent mb-4">
          Prediction Probabilities (Instance #{data.instance_idx})
        </h3>
        <div className="flex flex-wrap gap-4">
          {Object.entries(probabilities).map(([cls, prob]) => (
            <div key={cls} className="flex-1 min-w-[120px]">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-soc-muted">{cls}</span>
                <span className="text-sm font-mono font-bold text-white">{(prob * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-soc-bg rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-soc-accent to-blue-500 transition-all duration-500"
                  style={{ width: `${prob * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LIME Feature Weights Chart */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-soc-accent mb-4">LIME Feature Weights</h3>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 32)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 180 }}>
            <XAxis type="number" stroke="#8888aa" fontSize={10} />
            <YAxis type="category" dataKey="feature" stroke="#8888aa" fontSize={9} width={170} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a3e', border: '1px solid #2a2a5e', borderRadius: '8px' }}
              labelStyle={{ color: '#00d4ff' }}
              formatter={(value) => [value.toFixed(4), 'Weight']}
            />
            <Bar dataKey="weight" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.weight > 0 ? '#ff6b6b' : '#4ecdc4'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Feature Weights Table */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-soc-accent mb-4">Feature Weight Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-soc-muted border-b border-soc-border">
                <th className="py-2 px-3 text-left">Feature Rule</th>
                <th className="py-2 px-3 text-right">Weight</th>
                <th className="py-2 px-3 text-left">Direction</th>
              </tr>
            </thead>
            <tbody>
              {weights.map((w, i) => (
                <tr key={i} className="border-b border-soc-border/30">
                  <td className="py-2 px-3 font-mono text-white text-xs">{w.feature}</td>
                  <td className={`py-2 px-3 text-right font-mono font-bold ${w.weight > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {w.weight > 0 ? '+' : ''}{w.weight.toFixed(4)}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                      w.weight > 0
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {w.weight > 0 ? '↑ Attack' : '↓ Normal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stability Score */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-soc-accent mb-4">LIME Stability Analysis</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-soc-muted">Stability Score</span>
              <span className={`text-lg font-mono font-bold ${
                stability >= 0.8 ? 'text-green-400' : stability >= 0.5 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {stability?.toFixed(4) || '—'}
              </span>
            </div>
            <div className="w-full bg-soc-bg rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  stability >= 0.8 ? 'bg-green-400' : stability >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${(stability || 0) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-soc-muted mt-2">
              {stability >= 0.8 ? 'High stability — explanations are consistent across runs'
                : stability >= 0.5 ? 'Moderate stability — some variation in explanations'
                : 'Low stability — explanations vary significantly'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
