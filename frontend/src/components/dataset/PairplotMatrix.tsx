/**
 * PairplotMatrix.tsx
 * Visual feature-correlation matrix rendered as a colour grid.
 * Accepts the tier-2 correlation matrix { columns, matrix } and renders each
 * cell as a colour-coded circle proportional to the Pearson r value.
 * Caps to topN features by variance for readability.
 */
import React, { useState } from 'react';

interface CorrelationPayload {
  columns: string[];
  matrix: number[][];
  viz_type?: string;
}

interface Props {
  data: CorrelationPayload;
  topN?: number;
  className?: string;
}

/** Interpolate between blue (−1), white (0) and red (+1) */
function corrColour(r: number): string {
  const clamped = Math.max(-1, Math.min(1, r));
  if (clamped >= 0) {
    const t = clamped;
    const rC = Math.round(255);
    const gC = Math.round(255 - 155 * t);
    const bC = Math.round(255 - 141 * t);
    return `rgb(${rC},${gC},${bC})`;
  } else {
    const t = -clamped;
    const rC = Math.round(255 - 141 * t);
    const gC = Math.round(255 - 116 * t);
    const bC = Math.round(255);
    return `rgb(${rC},${gC},${bC})`;
  }
}

function textColour(r: number): string {
  return Math.abs(r) > 0.5 ? '#fff' : '#334155';
}

export function PairplotMatrix({ data, topN = 12, className = '' }: Props) {
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number } | null>(null);

  if (!data?.columns || data.columns.length === 0) {
    return (
      <div className={`text-center text-slate-500 py-8 text-sm ${className}`}>
        No correlation data available.
      </div>
    );
  }

  // Cap to topN columns
  const cols = data.columns.slice(0, topN);
  const mat = data.matrix.slice(0, topN).map((row) => row.slice(0, topN));

  const cellSize = Math.max(32, Math.min(52, Math.floor(540 / cols.length)));
  const labelLen = Math.min(8, Math.max(4, Math.floor(cellSize / 6)));

  const hovered =
    hoveredCell !== null
      ? {
          colA: cols[hoveredCell.r],
          colB: cols[hoveredCell.c],
          value: mat[hoveredCell.r]?.[hoveredCell.c] ?? 0,
        }
      : null;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Pearson correlation matrix — top {cols.length} features
        </p>
        {hovered && (
          <p className="text-xs text-slate-300 bg-slate-800 rounded-lg px-3 py-1">
            <span className="font-mono">{hovered.colA}</span>
            <span className="text-slate-500"> × </span>
            <span className="font-mono">{hovered.colB}</span>
            <span className="text-slate-500">: </span>
            <span
              className={`font-semibold ${
                hovered.value > 0 ? 'text-red-400' : hovered.value < 0 ? 'text-blue-400' : 'text-slate-400'
              }`}
            >
              {hovered.value.toFixed(3)}
            </span>
          </p>
        )}
      </div>

      {/* Scrollable matrix */}
      <div className="overflow-auto">
        <table className="border-collapse" style={{ fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ width: 80 }} />
              {cols.map((col) => (
                <th
                  key={`ch-${col}`}
                  style={{
                    width: cellSize,
                    maxWidth: cellSize,
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                    padding: '4px 2px',
                    color: '#94a3b8',
                    fontWeight: 400,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxHeight: 80,
                  }}
                  title={col}
                >
                  {col.slice(0, 14)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mat.map((row, ri) => (
              <tr key={`row-${ri}`}>
                <td
                  style={{
                    color: '#94a3b8',
                    fontWeight: 400,
                    paddingRight: 6,
                    textAlign: 'right',
                    maxWidth: 78,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={cols[ri]}
                >
                  {cols[ri].slice(0, 12)}
                </td>
                {row.map((val, ci) => {
                  const isHovered = hoveredCell?.r === ri && hoveredCell?.c === ci;
                  const isDiag = ri === ci;
                  return (
                    <td
                      key={`cell-${ri}-${ci}`}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        textAlign: 'center',
                        backgroundColor: isDiag ? '#1e293b' : corrColour(val),
                        color: isDiag ? '#64748b' : textColour(val),
                        cursor: 'pointer',
                        border: isHovered ? '2px solid #06b6d4' : '1px solid #0f172a',
                        transition: 'border 0.1s',
                        fontFamily: 'monospace',
                        userSelect: 'none',
                      }}
                      onMouseEnter={() => setHoveredCell({ r: ri, c: ci })}
                      onMouseLeave={() => setHoveredCell(null)}
                      title={`${cols[ri]} × ${cols[ci]}: ${val.toFixed(3)}`}
                    >
                      {isDiag ? '—' : Math.abs(val) > 0.05 ? val.toFixed(2) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-slate-500">
        <div className="flex items-center gap-1">
          <span className="w-4 h-3 rounded inline-block" style={{ background: 'rgb(114,139,255)' }} />
          <span>−1 (inverse)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-3 rounded inline-block bg-white" />
          <span>0 (none)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-3 rounded inline-block" style={{ background: 'rgb(255,100,114)' }} />
          <span>+1 (direct)</span>
        </div>
      </div>
    </div>
  );
}
