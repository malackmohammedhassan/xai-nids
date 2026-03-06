/**
 * BoxplotGrid.tsx
 * Renders a scrollable grid of inline SVG boxplots, one per numeric column.
 * Data shape expected: { data: BoxplotRow[] } from /api/v2/datasets/:id/visualizations/tier2/boxplots
 */
import React, { useState } from 'react';
import { Search } from 'lucide-react';

export interface BoxplotRow {
  column: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  whisker_lo?: number;
  whisker_hi?: number;
  outlier_count?: number;
}

interface BoxplotData {
  data: BoxplotRow[];
  viz_type?: string;
}

interface BoxplotGridProps {
  data: BoxplotData;
  className?: string;
}

/** Map a value within [domain_min, domain_max] to [svgLeft, svgLeft+svgWidth] */
function scale(v: number, dMin: number, dMax: number, sLeft: number, sWidth: number): number {
  if (dMax === dMin) return sLeft + sWidth / 2;
  return sLeft + ((v - dMin) / (dMax - dMin)) * sWidth;
}

const SVG_H = 28;
const SVG_W = 260;
const PAD = 8;
const PLOT_W = SVG_W - 2 * PAD;

function BoxPlot({ row }: { row: BoxplotRow }) {
  const lo = row.whisker_lo ?? row.min;
  const hi = row.whisker_hi ?? row.max;
  const range = hi - lo || 1;

  const s = (v: number) => scale(v, lo, hi, PAD, PLOT_W);

  const x_q1 = s(row.q1);
  const x_med = s(row.median);
  const x_q3 = s(row.q3);
  const x_lo = PAD;
  const x_hi = PAD + PLOT_W;
  const boxH = 12;
  const cy = SVG_H / 2;

  // colour: cyan box
  return (
    <svg width={SVG_W} height={SVG_H} className="overflow-visible">
      {/* Whisker lines */}
      <line x1={x_lo} y1={cy} x2={x_q1} y2={cy} stroke="#475569" strokeWidth={1.5} />
      <line x1={x_q3} y1={cy} x2={x_hi} y2={cy} stroke="#475569" strokeWidth={1.5} />
      {/* Whisker caps */}
      <line x1={x_lo} y1={cy - 4} x2={x_lo} y2={cy + 4} stroke="#475569" strokeWidth={1.5} />
      <line x1={x_hi} y1={cy - 4} x2={x_hi} y2={cy + 4} stroke="#475569" strokeWidth={1.5} />
      {/* IQR box */}
      <rect
        x={x_q1}
        y={cy - boxH / 2}
        width={Math.max(2, x_q3 - x_q1)}
        height={boxH}
        fill="#0e7490"
        fillOpacity={0.3}
        stroke="#06b6d4"
        strokeWidth={1.5}
        rx={2}
      />
      {/* Median line */}
      <line
        x1={x_med}
        y1={cy - boxH / 2}
        x2={x_med}
        y2={cy + boxH / 2}
        stroke="#22d3ee"
        strokeWidth={2}
      />
    </svg>
  );
}

export function BoxplotGrid({ data, className = '' }: BoxplotGridProps) {
  const [query, setQuery] = useState('');

  if (!data?.data || data.data.length === 0) {
    return (
      <div className={`text-center text-slate-500 py-10 text-sm ${className}`}>
        No numeric columns to display.
      </div>
    );
  }

  const rows = query
    ? data.data.filter((r) => r.column.toLowerCase().includes(query.toLowerCase()))
    : data.data;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter columns…"
          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-600"
        />
      </div>

      {/* Grid */}
      <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
        {rows.map((row) => {
          const lo = row.whisker_lo ?? row.min;
          const hi = row.whisker_hi ?? row.max;
          return (
            <div
              key={row.column}
              className="grid items-center gap-3 bg-slate-900 rounded-lg px-3 py-1.5 hover:bg-slate-800 transition-colors"
              style={{ gridTemplateColumns: '140px 1fr 60px' }}
            >
              {/* Column name */}
              <span
                className="font-mono text-xs text-slate-300 truncate"
                title={row.column}
              >
                {row.column}
              </span>

              {/* SVG boxplot */}
              <div className="flex items-center">
                <BoxPlot row={row} />
              </div>

              {/* Stats tooltip area */}
              <div className="text-[10px] text-slate-500 text-right leading-tight">
                <div>med={row.median.toFixed(3)}</div>
                {row.outlier_count !== undefined && row.outlier_count > 0 && (
                  <div className="text-amber-500/70">{row.outlier_count} out</div>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="text-center text-slate-600 text-xs py-6">No columns match filter.</p>
        )}
      </div>

      <p className="text-[10px] text-slate-600 text-right">
        {rows.length} / {data.data.length} columns
      </p>
    </div>
  );
}
