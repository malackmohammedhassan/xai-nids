import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { metricGrade } from '@/utils/formatters';

interface Props {
  fpr: number[];
  tpr: number[];
  auc?: number;
}

export function ROCCurve({ fpr, tpr, auc }: Props) {
  if (!fpr?.length || !tpr?.length || fpr.length !== tpr.length) {
    return <div className="bg-gray-800 rounded-xl p-5 text-gray-500 text-sm">No ROC curve data available</div>;
  }
  const data = fpr.map((x, i) => ({ fpr: +x.toFixed(3), tpr: +tpr[i].toFixed(3) }));
  const { grade, color } = auc !== undefined ? metricGrade(auc) : { grade: '?', color: 'text-gray-400' };

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-gray-300 text-sm font-medium">ROC Curve</h4>
        {auc !== undefined && (
          <div className="text-right">
            <span className="text-gray-400 text-xs">AUC </span>
            <span className={`font-bold text-sm ${color}`}>{auc.toFixed(4)}</span>
            <span className={`text-xs ml-1 ${color}`}>({grade})</span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id={`rocGradient-${auc ?? 0}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="fpr"
            type="number"
            domain={[0, 1]}
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            label={{ value: 'FPR', position: 'insideBottom', offset: -3, fill: '#6b7280', fontSize: 10 }}
          />
          <YAxis
            domain={[0, 1]}
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            label={{ value: 'TPR', angle: -90, position: 'insideLeft', offset: 15, fill: '#6b7280', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
            formatter={(v: number, name: string) => [v.toFixed(3), name.toUpperCase()]}
          />
          <ReferenceLine
            stroke="#4b5563"
            strokeDasharray="4 4"
            segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
          />
          <Area
            type="monotone"
            dataKey="tpr"
            stroke="#22d3ee"
            strokeWidth={2}
            fill={`url(#rocGradient-${auc ?? 0})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
