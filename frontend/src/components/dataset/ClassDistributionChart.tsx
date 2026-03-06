import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

interface Props {
  distribution: Record<string, number>;
  targetColumn: string;
}

const PALETTE = [
  '#22d3ee', '#a78bfa', '#34d399', '#fb923c', '#f472b6',
  '#60a5fa', '#facc15', '#f87171', '#4ade80', '#c084fc',
  '#38bdf8', '#fb7185', '#86efac', '#fcd34d', '#818cf8',
];

export function ClassDistributionChart({ distribution, targetColumn }: Props) {
  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  const barData = entries.map(([label, count], i) => ({
    label: label.length > 16 ? label.slice(0, 14) + '…' : label,
    fullLabel: label,
    count,
    pct: ((count / total) * 100).toFixed(1),
    fill: PALETTE[i % PALETTE.length],
  }));

  const pieData = entries.slice(0, 8).map(([label, count], i) => ({
    name: label.length > 18 ? label.slice(0, 16) + '…' : label,
    value: count,
    fill: PALETTE[i % PALETTE.length],
  }));

  const imbalanceRatio =
    entries.length >= 2
      ? (entries[0][1] / entries[entries.length - 1][1]).toFixed(1)
      : null;

  return (
    <div className="bg-gray-800 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-gray-200 font-medium text-sm">
          Class Distribution —{' '}
          <span className="text-cyan-400 font-mono">{targetColumn}</span>
        </h4>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{entries.length} classes</span>
          <span>{total.toLocaleString()} total samples</span>
          {imbalanceRatio && (
            <span
              className={`px-2 py-0.5 rounded-full font-medium ${
                parseFloat(imbalanceRatio) > 5
                  ? 'bg-red-500/20 text-red-400'
                  : parseFloat(imbalanceRatio) > 2
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {imbalanceRatio}× imbalance
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Bar chart */}
        <div>
          <p className="text-gray-500 text-xs mb-2">Sample count per class</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(value: number, _: string, props) => [
                  `${value.toLocaleString()} samples (${props.payload.pct}%)`,
                  props.payload.fullLabel,
                ]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div>
          <p className="text-gray-500 text-xs mb-2">Proportion breakdown</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="40%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(value: number) => [`${value.toLocaleString()} samples`, '']}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 10, color: '#9ca3af' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Class table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-1.5 pr-3 text-left text-gray-500 font-medium">Class</th>
              <th className="py-1.5 pr-3 text-right text-gray-500 font-medium">Count</th>
              <th className="py-1.5 text-right text-gray-500 font-medium">%</th>
              <th className="py-1.5 pl-3 text-gray-500 font-medium">Distribution</th>
            </tr>
          </thead>
          <tbody>
            {barData.slice(0, 10).map((row, i) => (
              <tr key={i} className="border-b border-gray-700/40">
                <td className="py-1.5 pr-3 font-mono text-gray-200" title={row.fullLabel}>
                  {row.label}
                </td>
                <td className="py-1.5 pr-3 text-right text-gray-300">{row.count.toLocaleString()}</td>
                <td className="py-1.5 text-right font-medium" style={{ color: row.fill }}>
                  {row.pct}%
                </td>
                <td className="py-1.5 pl-3">
                  <div className="w-full bg-gray-700 rounded-full h-1.5 min-w-[60px]">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${row.pct}%`,
                        backgroundColor: row.fill,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length > 10 && (
          <p className="text-gray-600 text-xs mt-2">…and {entries.length - 10} more classes</p>
        )}
      </div>
    </div>
  );
}
