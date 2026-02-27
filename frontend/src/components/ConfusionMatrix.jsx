import React from 'react';

export default function ConfusionMatrix({ data, classNames }) {
  if (!data || !classNames) return null;

  const maxVal = Math.max(...data.flat());

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-soc-accent mb-4">Confusion Matrix</h3>
      <div className="overflow-x-auto">
        <table className="mx-auto">
          <thead>
            <tr>
              <th className="p-2 text-xs text-soc-muted"></th>
              {classNames.map((name) => (
                <th key={name} className="p-2 text-xs text-soc-muted text-center font-mono">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                <td className="p-2 text-xs text-soc-muted font-mono text-right">{classNames[i]}</td>
                {row.map((val, j) => {
                  const intensity = maxVal > 0 ? val / maxVal : 0;
                  const bg = i === j
                    ? `rgba(0, 212, 255, ${0.1 + intensity * 0.5})`
                    : `rgba(255, 71, 87, ${intensity * 0.5})`;
                  return (
                    <td
                      key={j}
                      className="p-2 text-center text-sm font-mono font-bold text-white min-w-[50px]"
                      style={{ backgroundColor: bg, borderRadius: '4px' }}
                    >
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-center gap-8 mt-4 text-xs text-soc-muted">
        <span>← Predicted →</span>
      </div>
    </div>
  );
}
