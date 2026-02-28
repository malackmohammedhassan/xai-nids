import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { clsx } from 'clsx';

interface FeatureEntry {
  feature: string;
  importance: number;
}

interface Props {
  features: FeatureEntry[];
  maxDisplay?: number;
}

function tierColor(rank: number): string {
  if (rank < 3) return '#22d3ee'; // top 3 — cyan
  if (rank < 8) return '#a78bfa'; // top 8 — violet
  return '#6b7280';               // rest — gray
}

export function FeatureImportance({ features, maxDisplay = 20 }: Props) {
  if (!features || features.length === 0) {
    return <div className="bg-gray-800 rounded-xl p-5 text-gray-500 text-sm">No feature importance data available</div>;
  }
  const sorted = [...features]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, maxDisplay)
    .map((f, i) => ({
      name: f.feature.length > 18 ? f.feature.slice(0, 16) + '…' : f.feature,
      fullName: f.feature,
      value: +f.importance.toFixed(4),
      rank: i,
    }));

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h4 className="text-gray-300 text-sm font-medium mb-4">
        Feature Importance (top {sorted.length})
      </h4>
      <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 22)}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
        >
          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <YAxis
            dataKey="name"
            type="category"
            width={130}
            tick={{ fill: '#d1d5db', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
            formatter={(v: number, _name: string, props) => [v.toFixed(4), props.payload.fullName]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {sorted.map((entry) => (
              <Cell key={entry.fullName} fill={tierColor(entry.rank)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs text-gray-400">
        {[
          { color: 'bg-cyan-400', label: 'High (top 3)' },
          { color: 'bg-violet-400', label: 'Mid (4–8)' },
          { color: 'bg-gray-500', label: 'Low' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={clsx('w-2.5 h-2.5 rounded-sm', color)} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
