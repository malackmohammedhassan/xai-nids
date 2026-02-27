import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ColumnStats } from '@/types';

interface Props {
  columns: ColumnStats[];
  maxBars?: number;
}

const COLORS = [
  '#22d3ee', '#a78bfa', '#34d399', '#fb923c', '#f472b6',
  '#60a5fa', '#facc15', '#f87171', '#4ade80', '#c084fc',
];

export function FeatureDistribution({ columns, maxBars = 15 }: Props) {
  // Show top columns by null_pct descending for a "data quality" view
  const data = [...columns]
    .sort((a, b) => b.null_pct - a.null_pct)
    .slice(0, maxBars)
    .map((c, i) => ({
      name: c.name.length > 14 ? c.name.slice(0, 12) + '…' : c.name,
      fullName: c.name,
      null_pct: +(c.null_pct * 100).toFixed(2),
      unique: c.unique_count,
      fill: COLORS[i % COLORS.length],
    }));

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h4 className="text-gray-300 text-sm font-medium mb-4">
        Null % by Column (top {data.length})
      </h4>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-45}
            textAnchor="end"
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} unit="%" />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(value: number, _name: string, props) => [
              `${value}% null`,
              props.payload.fullName,
            ]}
          />
          <Bar dataKey="null_pct" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
