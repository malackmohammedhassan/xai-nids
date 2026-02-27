import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ROCChart({ data }) {
  if (!data) return null;

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-soc-accent mb-4">ROC Curve</h3>
      {data ? (
        <img src={data} alt="ROC Curve" className="w-full rounded-lg" />
      ) : (
        <div className="h-64 flex items-center justify-center text-soc-muted">
          No ROC data available
        </div>
      )}
    </div>
  );
}
