import { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldCheck, ShieldAlert } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { SHAPResult } from '@/types';

interface Props {
  shap: SHAPResult;
}

export function SHAPView({ shap }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!shap?.shap_values) {
    return <div className="space-y-4"><p className="text-gray-500 text-sm">No SHAP explanation data available</p></div>;
  }

  const isAttack = typeof shap.prediction === 'number'
    ? shap.prediction > 0.5
    : shap.prediction !== 'Normal' && shap.prediction !== '0';

  // Sort shap values for bar chart
  const shapData = Object.entries(shap.shap_values)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 15)
    .map(([feature, value]) => ({
      name: feature.length > 18 ? feature.slice(0, 16) + '…' : feature,
      fullName: feature,
      value: +value.toFixed(4),
      fill: value >= 0 ? '#f87171' : '#34d399',
    }));

  return (
    <div className="space-y-4">
      {/* Verdict card */}
      <div
        className={`rounded-xl p-5 border ${
          isAttack
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-emerald-500/10 border-emerald-500/30'
        }`}
      >
        <div className="flex items-center gap-3">
          {isAttack ? (
            <ShieldAlert size={28} className="text-red-400 shrink-0" />
          ) : (
            <ShieldCheck size={28} className="text-emerald-400 shrink-0" />
          )}
          <div>
            <p className={`text-lg font-bold ${isAttack ? 'text-red-300' : 'text-emerald-300'}`}>
              {isAttack ? 'Intrusion Detected' : 'Benign Traffic'}
            </p>
            <p className="text-gray-400 text-sm">
              SHAP base value: {shap.base_value != null ? shap.base_value.toFixed(4) : '—'} · Prediction: {String(shap.prediction)}
            </p>
          </div>
        </div>
      </div>

      {/* Waterfall chart (base64 image from backend) */}
      {shap.waterfall_chart_b64 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h5 className="text-gray-300 text-sm font-medium mb-3">SHAP Waterfall</h5>
          <img
            src={`data:image/png;base64,${shap.waterfall_chart_b64}`}
            alt="SHAP Waterfall"
            className="w-full rounded-lg"
          />
        </div>
      )}

      {/* Interactive summary bar chart */}
      <div className="bg-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-gray-300 text-sm font-medium">Top Feature Contributions</h5>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>

        <div className="flex gap-4 text-xs text-gray-400 mb-3">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded-sm inline-block" /> Pushes toward positive</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-400 rounded-sm inline-block" /> Pushes toward negative</span>
        </div>

        <ResponsiveContainer width="100%" height={expanded ? Math.max(60, shapData.length * 25) : 200}>
          <BarChart
            data={shapData}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
          >
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <YAxis dataKey="name" type="category" width={130} tick={{ fill: '#d1d5db', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
              formatter={(v: number, _n: string, p) => [v.toFixed(4), p.payload.fullName]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {shapData.map((entry) => (
                <Cell key={entry.fullName} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
