/** LiveROCCurve.tsx — ROC curve built from live fpr/tpr points */
import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { ROCPoint } from '@/store/appStore';

interface LiveROCCurveProps {
  points: ROCPoint[];
  className?: string;
}

export const LiveROCCurve: React.FC<LiveROCCurveProps> = ({ points, className = '' }) => {
  if (points.length < 2) {
    return (
      <div className={`flex items-center justify-center rounded-xl bg-slate-900/40 py-10 text-sm text-slate-500 ${className}`}>
        Awaiting ROC data…
      </div>
    );
  }

  // Simple AUC trapezoid estimate
  let auc = 0;
  for (let i = 1; i < points.length; i++) {
    auc +=
      Math.abs(points[i].fpr - points[i - 1].fpr) *
      ((points[i].tpr + points[i - 1].tpr) / 2);
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-400">ROC Curve</span>
        <span className="text-xs font-medium text-indigo-300">AUC ≈ {auc.toFixed(3)}</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={points} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="fpr"
            domain={[0, 1]}
            type="number"
            label={{ value: 'FPR', position: 'insideBottom', fill: '#64748b', fontSize: 10, dy: 10 }}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            dataKey="tpr"
            domain={[0, 1]}
            type="number"
            label={{ value: 'TPR', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, dx: -5 }}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v: number, name: string) => [v.toFixed(3), name]}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
            itemStyle={{ color: '#e2e8f0', fontSize: 11 }}
          />
          {/* Diagonal reference line */}
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
            stroke="#475569"
            strokeDasharray="4 4"
          />
          <Line
            type="monotone"
            dataKey="tpr"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
