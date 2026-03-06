import type { ColumnStats } from '@/types';

interface Props {
  columns: ColumnStats[];
  suggestedTarget?: string;
  onSelectTarget?: (col: string) => void;
  selectedTarget?: string;
}

const TYPE_PILL: Record<string, { label: string; cls: string }> = {
  object:   { label: 'text', cls: 'bg-amber-500/20 text-amber-300' },
  category: { label: 'cat', cls: 'bg-emerald-500/20 text-emerald-300' },
  bool:     { label: 'bool', cls: 'bg-violet-500/20 text-violet-300' },
};
const numericPill = { label: 'num', cls: 'bg-cyan-500/20 text-cyan-300' };

function getTypePill(dtype: string) {
  const base = dtype.split('[')[0].toLowerCase();
  return TYPE_PILL[base] ?? numericPill;
}

export function ColumnStatsGrid({ columns, suggestedTarget, onSelectTarget, selectedTarget }: Props) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-gray-200 font-medium text-sm">
          Column Statistics
          <span className="ml-2 text-gray-500 font-normal">({columns.length} columns)</span>
        </h4>
        {suggestedTarget && (
          <div className="flex items-center gap-1.5 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
            <span className="text-gray-400">AI recommends →</span>
            <span className="text-emerald-400 font-mono font-semibold">{suggestedTarget}</span>
            <span className="text-gray-500">as target</span>
          </div>
        )}
      </div>

      {onSelectTarget && (
        <p className="text-gray-500 text-xs">
          Click a column to set it as the target for training
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-900/70 border-b border-gray-700">
              <th className="px-3 py-2 text-left text-gray-500 font-medium">Column</th>
              <th className="px-3 py-2 text-left text-gray-500 font-medium">Type</th>
              <th className="px-3 py-2 text-right text-gray-500 font-medium">Unique</th>
              <th className="px-3 py-2 text-right text-gray-500 font-medium">Nulls</th>
              <th className="px-3 py-2 text-left text-gray-500 font-medium min-w-[120px]">
                Null %
              </th>
              <th className="px-3 py-2 text-left text-gray-500 font-medium">Sample values</th>
              {onSelectTarget && (
                <th className="px-3 py-2 text-center text-gray-500 font-medium">Target</th>
              )}
            </tr>
          </thead>
          <tbody>
            {columns.map((col, i) => {
              const pill = getTypePill(col.dtype);
              const isSelected = selectedTarget === col.name;
              const isSuggested = suggestedTarget === col.name;
              return (
                <tr
                  key={col.name}
                  className={`border-b border-gray-700/40 ${i % 2 === 1 ? 'bg-gray-900/20' : ''} ${
                    isSelected ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500' : ''
                  }`}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono font-medium truncate max-w-[140px] ${
                          isSelected ? 'text-cyan-300' : 'text-gray-200'
                        }`}
                        title={col.name}
                      >
                        {col.name}
                      </span>
                      {isSuggested && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 rounded px-1 py-0.5 font-semibold shrink-0">
                          AI ★
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${pill.cls}`}>
                      {pill.label}
                    </span>
                    <span className="ml-1 text-gray-600 font-mono text-[9px]">{col.dtype}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300 font-mono">
                    {col.unique_count.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={col.null_count > 0 ? 'text-red-400' : 'text-gray-500'}>
                      {col.null_count.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            col.null_pct > 30
                              ? 'bg-red-500'
                              : col.null_pct > 5
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(col.null_pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 w-8 text-right shrink-0">
                        {col.null_pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-500 font-mono max-w-[180px] truncate">
                    {col.sample_values?.slice(0, 3).map(String).join(', ') ?? ''}
                  </td>
                  {onSelectTarget && (
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => onSelectTarget(col.name)}
                        className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-colors ${
                          isSelected
                            ? 'bg-cyan-500 text-gray-900'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {isSelected ? '✓ Selected' : 'Select'}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
