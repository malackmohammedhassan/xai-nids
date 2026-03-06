/** CorrelationHeatmap.tsx — Recharts-based correlation square heatmap */
import React, { useMemo } from 'react';
import { toCorrelationCells } from '@/utils/vizDataTransformers';
import { Tooltip } from 'recharts';

interface CorrelationHeatmapProps {
  matrix: Record<string, Record<string, number>>;
  /** max columns (truncated symmetrically) */
  maxCols?: number;
}

function corrColour(v: number): string {
  const r = v > 0 ? Math.round(v * 220) : 0;
  const b = v < 0 ? Math.round(-v * 220) : 0;
  return `rgb(${r}, 30, ${b})`;
}

export const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({
  matrix,
  maxCols = 20,
}) => {
  const cols = useMemo(() => Object.keys(matrix).slice(0, maxCols), [matrix, maxCols]);
  const cells = useMemo(() => toCorrelationCells(
    Object.fromEntries(
      cols.map((r) => [r, Object.fromEntries(cols.map((c) => [c, matrix[r]?.[c] ?? 0]))]),
    ),
  ), [matrix, cols]);

  if (cols.length === 0) return null;

  const cellSize = Math.min(28, Math.floor(400 / cols.length));
  const fontSize = Math.max(8, cellSize - 14);

  return (
    <div className="overflow-x-auto">
      <div
        className="inline-grid"
        style={{ gridTemplateColumns: `repeat(${cols.length}, ${cellSize}px)` }}
      >
        {cells.map(({ row, col, value }) => (
          <div
            key={`${row}-${col}`}
            title={`${row} × ${col}: ${value.toFixed(3)}`}
            style={{
              width: cellSize,
              height: cellSize,
              backgroundColor: corrColour(value),
            }}
            className="flex items-center justify-center cursor-default"
          >
            {cellSize >= 24 && (
              <span style={{ fontSize, color: Math.abs(value) > 0.5 ? '#fff' : '#aaa' }}>
                {value.toFixed(1)}
              </span>
            )}
          </div>
        ))}
      </div>
      {/* Column labels */}
      <div
        className="mt-1 inline-grid"
        style={{ gridTemplateColumns: `repeat(${cols.length}, ${cellSize}px)` }}
      >
        {cols.map((c) => (
          <div
            key={c}
            style={{ width: cellSize, fontSize: 9 }}
            className="overflow-hidden text-slate-500 truncate text-center"
            title={c}
          >
            {c}
          </div>
        ))}
      </div>
    </div>
  );
};
