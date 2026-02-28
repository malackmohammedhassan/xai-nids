import { clsx } from 'clsx';

interface Props {
  matrix: number[][];
  classNames?: string[];
}

function cellColor(value: number, rowMax: number): string {
  const pct = rowMax > 0 ? value / rowMax : 0;
  if (pct > 0.8) return 'bg-cyan-500/80 text-white';
  if (pct > 0.5) return 'bg-cyan-500/40 text-cyan-200';
  if (pct > 0.2) return 'bg-cyan-500/20 text-cyan-300';
  if (value === 0) return 'bg-gray-900 text-gray-600';
  return 'bg-cyan-500/10 text-gray-400';
}

export function ConfusionMatrix({ matrix, classNames }: Props) {
  if (!matrix || matrix.length === 0) {
    return <div className="bg-gray-800 rounded-xl p-5 text-gray-500 text-sm">No confusion matrix data available</div>;
  }
  const labels = classNames ?? matrix.map((_, i) => `Class ${i}`);
  const rowMaxes = matrix.map((row) => (row.length ? Math.max(...row) : 0));

  return (
    <div className="bg-gray-800 rounded-xl p-5 overflow-x-auto">
      <h4 className="text-gray-300 text-sm font-medium mb-4">Confusion Matrix</h4>
      <div className="inline-block">
        {/* Column headers */}
        <div className="flex" style={{ marginLeft: '7rem' }}>
          {labels.map((lbl) => (
            <div
              key={lbl}
              className="w-16 text-center text-xs text-gray-400 truncate px-1"
              title={lbl}
            >
              {lbl.length > 8 ? lbl.slice(0, 7) + '…' : lbl}
            </div>
          ))}
        </div>
        {matrix.map((row, i) => (
          <div key={i} className="flex items-center mt-1">
            {/* Row label */}
            <div
              className="w-28 text-right pr-3 text-xs text-gray-400 truncate shrink-0"
              title={labels[i]}
            >
              {(labels[i] ?? '').length > 12 ? (labels[i] ?? '').slice(0, 11) + '…' : (labels[i] ?? '')}
            </div>
            {row.map((cell, j) => (
              <div
                key={`${i}-${j}`}
                className={clsx(
                  'w-16 h-10 flex items-center justify-center text-sm font-semibold rounded-md mr-0.5',
                  cellColor(cell, rowMaxes[i])
                )}
                title={`True: ${labels[i]}, Pred: ${labels[j]} → ${cell}`}
              >
                {cell}
              </div>
            ))}
          </div>
        ))}
        <p className="text-gray-500 text-xs mt-3 ml-28">Predicted →</p>
      </div>
    </div>
  );
}
