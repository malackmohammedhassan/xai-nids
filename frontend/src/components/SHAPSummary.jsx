import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function SHAPSummary({ data }) {
  if (!data) return null;

  const globalImportance = data.global?.feature_importance?.slice(0, 15) || [];
  const localContributions = data.local?.contributions?.slice(0, 15) || [];

  return (
    <div className="space-y-6">
      {/* Global Summary Plot */}
      {data.global?.summary_plot && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-soc-accent mb-4">SHAP Summary Plot (Global)</h3>
          <img src={data.global.summary_plot} alt="SHAP Summary" className="w-full max-w-2xl mx-auto rounded-lg" />
        </div>
      )}

      {/* Global Feature Importance Bar Chart */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-soc-accent mb-4">Feature Importance Ranking</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={globalImportance} layout="vertical" margin={{ left: 120, right: 20 }}>
              <XAxis type="number" stroke="#8888aa" tick={{ fill: '#8888aa', fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="feature"
                stroke="#8888aa"
                tick={{ fill: '#e0e0ff', fontSize: 11 }}
                width={110}
              />
              <Tooltip
                contentStyle={{ background: '#1a1a3e', border: '1px solid #2a2a5e', borderRadius: 8, color: '#e0e0ff' }}
              />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {globalImportance.map((entry, idx) => (
                  <Cell key={idx} fill={`hsl(${180 + idx * 8}, 70%, 55%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Local Waterfall Plot */}
      {data.local?.waterfall_plot && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-soc-accent mb-4">
            SHAP Waterfall (Instance #{data.local.instance_idx})
          </h3>
          <img src={data.local.waterfall_plot} alt="SHAP Waterfall" className="w-full max-w-2xl mx-auto rounded-lg" />
        </div>
      )}

      {/* Local Contributions Table */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-soc-accent mb-4">
          Local Feature Contributions (Instance #{data.local?.instance_idx})
        </h3>
        <p className="text-sm text-soc-muted mb-3">
          Expected value: <span className="font-mono text-white">{data.local?.expected_value?.toFixed(4)}</span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-soc-muted border-b border-soc-border">
                <th className="py-2 px-3 text-left">Feature</th>
                <th className="py-2 px-3 text-right">Value</th>
                <th className="py-2 px-3 text-right">SHAP Value</th>
                <th className="py-2 px-3 text-left">Impact</th>
              </tr>
            </thead>
            <tbody>
              {localContributions.map((c, i) => (
                <tr key={i} className="border-b border-soc-border/30">
                  <td className="py-2 px-3 font-mono text-white">{c.feature}</td>
                  <td className="py-2 px-3 text-right font-mono">{c.value?.toFixed(4)}</td>
                  <td className={`py-2 px-3 text-right font-mono font-bold ${c.shap_value > 0 ? 'text-red-400' : 'text-cyan-400'}`}>
                    {c.shap_value > 0 ? '+' : ''}{c.shap_value?.toFixed(6)}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-soc-card rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${c.shap_value > 0 ? 'bg-red-400' : 'bg-cyan-400'}`}
                          style={{
                            width: `${Math.min(100, Math.abs(c.shap_value) * 500)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
