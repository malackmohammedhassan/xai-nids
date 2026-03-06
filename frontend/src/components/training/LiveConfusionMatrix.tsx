/** LiveConfusionMatrix.tsx — Renders a confusion matrix as a colour grid */
import React from 'react';
import type { ConfusionMatrixData } from '@/store/appStore';

interface LiveConfusionMatrixProps {
  data: ConfusionMatrixData;
  className?: string;
}

function cell_bg(value: number, rowSum: number, isDiag: boolean): string {
  if (rowSum === 0) return 'bg-slate-900';
  const pct = value / rowSum;
  if (isDiag) {
    if (pct >= 0.9) return 'bg-emerald-600';
    if (pct >= 0.7) return 'bg-emerald-800';
    return 'bg-emerald-950';
  } else {
    if (pct >= 0.1) return 'bg-red-700';
    if (pct >= 0.02) return 'bg-red-900';
    return 'bg-slate-900';
  }
}

export const LiveConfusionMatrix: React.FC<LiveConfusionMatrixProps> = ({ data, className = '' }) => {
  const { labels, matrix } = data;

  return (
    <div className={`overflow-x-auto ${className}`}>
      <div
        className="inline-grid text-xs"
        style={{ gridTemplateColumns: `auto repeat(${labels.length}, 1fr)` }}
      >
        {/* Empty corner */}
        <div className="p-1" />
        {/* Column headers (predicted) */}
        {labels.map((l) => (
          <div key={`ph-${l}`} className="p-1 text-center text-slate-400 truncate max-w-[50px]" title={l}>
            {l}
          </div>
        ))}
        {/* Rows */}
        {matrix.map((row, ri) => {
          const rowSum = row.reduce((a, b) => a + b, 0);
          return (
            <React.Fragment key={`row-${ri}`}>
              {/* Row label (actual) */}
              <div className="p-1 pr-2 text-right text-slate-400 truncate max-w-[60px]" title={labels[ri]}>
                {labels[ri]}
              </div>
              {row.map((val, ci) => (
                <div
                  key={`cell-${ri}-${ci}`}
                  className={`flex items-center justify-center p-1 m-0.5 rounded text-white font-medium min-w-[28px] min-h-[28px] ${cell_bg(val, rowSum, ri === ci)}`}
                  title={`Actual: ${labels[ri]}, Predicted: ${labels[ci]}, Count: ${val}`}
                >
                  {val}
                </div>
              ))}
            </React.Fragment>
          );
        })}
      </div>
      <div className="mt-1 text-[10px] text-slate-600">Rows = Actual, Columns = Predicted</div>
    </div>
  );
};
