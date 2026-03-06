import type { ColumnStats } from '@/types';

interface Props {
  rows: Record<string, unknown>[];
  columns: ColumnStats[];
}

export function DataPreviewTable({ rows, columns }: Props) {
  if (!rows || rows.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-5 text-gray-500 text-sm text-center">
        No preview data available
      </div>
    );
  }

  const colNames = columns.length > 0 ? columns.map((c) => c.name) : Object.keys(rows[0] ?? {});

  const DTYPE_COLOR: Record<string, string> = {
    object: 'text-amber-400',
    int64: 'text-cyan-400',
    float64: 'text-sky-400',
    int32: 'text-cyan-400',
    float32: 'text-sky-400',
    bool: 'text-violet-400',
    category: 'text-emerald-400',
  };

  const getDtypeColor = (col: string) => {
    const stats = columns.find((c) => c.name === col);
    if (!stats) return 'text-gray-400';
    const base = stats.dtype.split('[')[0].toLowerCase();
    return DTYPE_COLOR[base] ?? 'text-gray-400';
  };

  const getDtype = (col: string) => {
    const stats = columns.find((c) => c.name === col);
    return stats ? stats.dtype : '';
  };

  const fmt = (v: unknown): string => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4);
    return String(v);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-gray-200 font-medium text-sm">Data Preview</h4>
        <span className="text-gray-500 text-xs">{rows.length} rows shown</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-xs min-w-max">
          <thead>
            <tr className="bg-gray-900/70">
              <th className="px-3 py-2 text-left text-gray-500 font-medium w-8">#</th>
              {colNames.map((col) => (
                <th key={col} className="px-3 py-2 text-left min-w-[90px]">
                  <div className="font-medium text-gray-200 truncate max-w-[120px]" title={col}>
                    {col}
                  </div>
                  <div className={`font-mono text-[10px] mt-0.5 ${getDtypeColor(col)}`}>
                    {getDtype(col)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`border-t border-gray-700/50 ${i % 2 === 0 ? '' : 'bg-gray-900/30'}`}
              >
                <td className="px-3 py-1.5 text-gray-600 font-mono">{i + 1}</td>
                {colNames.map((col) => {
                  const v = row[col];
                  const isNull = v === null || v === undefined;
                  return (
                    <td
                      key={col}
                      className={`px-3 py-1.5 font-mono max-w-[140px] truncate ${
                        isNull
                          ? 'text-red-400/60 italic'
                          : typeof v === 'number'
                          ? 'text-cyan-300'
                          : 'text-gray-300'
                      }`}
                      title={fmt(v)}
                    >
                      {fmt(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-gray-600 text-xs">
        Null cells shown in red · numeric values in cyan · dtypes shown below column names
      </p>
    </div>
  );
}
