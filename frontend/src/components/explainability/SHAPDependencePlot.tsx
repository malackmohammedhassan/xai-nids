/**
 * SHAPDependencePlot.tsx
 * Scatter chart: x = feature value, y = SHAP value, coloured by sign.
 * Shows how the SHAP contribution changes across different feature values.
 * Works with single-point data (shows a highlighted dot + reference lines).
 */
import React from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

export interface DependencePoint {
  feature_value: number;
  shap_value: number;
}

interface Props {
  data: DependencePoint[];
  featureName: string;
  className?: string;
}

const CustomTooltip = ({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DependencePoint }>;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400">
        Value: <span className="text-white font-mono">{d?.feature_value?.toFixed(4)}</span>
      </p>
      <p className="text-slate-400">
        SHAP: <span className={`font-mono ${(d?.shap_value ?? 0) > 0 ? 'text-red-400' : 'text-cyan-400'}`}>
          {d?.shap_value?.toFixed(5)}
        </span>
      </p>
    </div>
  );
};

export function SHAPDependencePlot({ data, featureName, className = '' }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className={`text-center text-slate-500 py-8 text-sm ${className}`}>
        No dependence data available.
      </div>
    );
  }

  const isSinglePoint = data.length === 1;

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-xs text-slate-400">
        {isSinglePoint
          ? `SHAP contribution for feature: `
          : `How SHAP value varies with feature value: `}
        <span className="font-mono text-slate-200">{featureName}</span>
        {isSinglePoint && (
          <span className="ml-2 text-slate-500">(single sample — run batch explain to see trend)</span>
        )}
      </p>

      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 8, right: 20, left: 10, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            type="number"
            dataKey="feature_value"
            name={featureName}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            label={{ value: featureName, position: 'insideBottom', offset: -8, fill: '#64748b', fontSize: 10 }}
          />
          <YAxis
            type="number"
            dataKey="shap_value"
            name="SHAP value"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            tickFormatter={(v: number) => v.toFixed(3)}
            label={{ value: 'SHAP value', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 10 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
          <Scatter data={data}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.shap_value > 0 ? '#f87171' : '#06b6d4'}
                fillOpacity={isSinglePoint ? 1 : 0.65}
                r={isSinglePoint ? 8 : 5}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {isSinglePoint && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-slate-500">Feature value</span>
              <p className="font-mono text-white text-sm mt-0.5">
                {data[0].feature_value.toFixed(4)}
              </p>
            </div>
            <div>
              <span className="text-slate-500">SHAP contribution</span>
              <p
                className={`font-mono text-sm mt-0.5 ${data[0].shap_value > 0 ? 'text-red-400' : 'text-cyan-400'}`}
              >
                {data[0].shap_value > 0 ? '+' : ''}
                {data[0].shap_value.toFixed(5)}
              </p>
            </div>
          </div>
          <p className="text-slate-600 mt-2">
            {data[0].shap_value > 0
              ? `↑ This feature value of ${data[0].feature_value.toFixed(3)} pushes the prediction toward ATTACK.`
              : `↓ This feature value of ${data[0].feature_value.toFixed(3)} pushes the prediction toward BENIGN.`}
          </p>
        </div>
      )}
    </div>
  );
}
