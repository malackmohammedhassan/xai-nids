/** ScoreGauge.tsx — Horizontal score bar with colour + band label */
import React from 'react';
import { scoreColour } from '@/utils/colorSchemes';
import { qualityBand, QUALITY_BAND_LABELS } from '@/utils/thresholds';

interface ScoreGaugeProps {
  score: number;
  label: string;
  showBand?: boolean;
  className?: string;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  label,
  showBand = true,
  className = '',
}) => {
  const colour = scoreColour(score);
  const band = qualityBand(score);
  const bandLabel = QUALITY_BAND_LABELS[band];
  const pct = Math.min(Math.max(score, 0), 100);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <div className="flex items-center gap-2">
          {showBand && (
            <span className="text-[10px] font-medium" style={{ color: colour }}>
              {bandLabel}
            </span>
          )}
          <span className="text-sm font-bold text-white">{Math.round(score)}</span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: colour }}
        />
      </div>
    </div>
  );
};
