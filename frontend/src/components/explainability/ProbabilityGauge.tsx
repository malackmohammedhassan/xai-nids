/** ProbabilityGauge.tsx — Animated arc gauge showing prediction confidence */
import React from 'react';
import { scoreColour } from '@/utils/colorSchemes';

interface ProbabilityGaugeProps {
  probability: number;   // 0-1
  label?: string;        // e.g. "Attack"
  size?: number;
}

export const ProbabilityGauge: React.FC<ProbabilityGaugeProps> = ({
  probability,
  label,
  size = 120,
}) => {
  const strokeWidth = 10;
  const r = (size - strokeWidth) / 2;
  // Semi-circle: start at 180°, sweep 180° (π rad)
  const circ = Math.PI * r;
  const offset = circ - probability * circ;
  const cx = size / 2;
  const cy = size / 2 + 10;  // push center down slightly for half-circle effect

  // Use red for high prob (attack), green for low
  const colour = probability >= 0.5
    ? `rgb(${Math.round(239 * probability * 2)},${Math.round(68 * (1 - probability))},68)`
    : `rgb(68,${Math.round(239 * (1 - probability) * 2)},68)`;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size / 2 + 20} overflow="visible">
        {/* Track */}
        <path
          d={`M ${strokeWidth / 2},${cy} A ${r},${r} 0 0,1 ${size - strokeWidth / 2},${cy}`}
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${strokeWidth / 2},${cy} A ${r},${r} 0 0,1 ${size - strokeWidth / 2},${cy}`}
          fill="none"
          stroke={colour}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.7s ease, stroke 0.4s ease' }}
        />
        {/* Value text */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-white text-sm font-bold"
          style={{ fontSize: 18, fontWeight: 700, fill: '#f1f5f9' }}
        >
          {(probability * 100).toFixed(1)}%
        </text>
      </svg>
      {label && <span className="text-xs text-slate-400">{label}</span>}
    </div>
  );
};
