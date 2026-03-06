/**
 * PipelineStepCard
 * ================
 * A single card that represents one configurable pipeline step.
 *
 * Features:
 *  - Recommendation badge ("Recommended: RFE — because…")
 *  - Radio-button option list with disabled options shown greyed-out
 *  - Tooltip on hover of a disabled option explaining why it is unavailable
 *  - Optional extra sub-controls (e.g. sliders, checkboxes) via the `children` prop
 *  - Collapsible description
 */
import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, Sparkles, Info } from 'lucide-react';
import type { StepRecommendation } from '@/types/pipeline';

interface PipelineStepCardProps {
  /** Backend recommendation for this step */
  recommendation: StepRecommendation;
  /** Currently selected value */
  value: string;
  /** Called when user picks a new option */
  onChange: (value: string) => void;
  /** Extra controls shown below the option list (sliders etc.) */
  children?: React.ReactNode;
}

export function PipelineStepCard({
  recommendation,
  value,
  onChange,
  children,
}: PipelineStepCardProps) {
  const [open, setOpen] = useState(true);
  const [tooltipOption, setTooltipOption] = useState<string | null>(null);

  const isRecommendedSelected = value === recommendation.recommended;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden transition-shadow hover:shadow-md hover:shadow-black/30">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold text-white truncate">
            {recommendation.title}
          </span>
          {/* "Using recommended" chip */}
          {isRecommendedSelected && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] font-medium bg-emerald-500/15 text-emerald-400 rounded-full px-2 py-0.5 shrink-0">
              <Sparkles size={9} />
              Recommended
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp size={15} className="text-gray-500 shrink-0 ml-2" />
        ) : (
          <ChevronDown size={15} className="text-gray-500 shrink-0 ml-2" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {/* Step description */}
          <p className="text-xs text-gray-400 leading-relaxed">
            {recommendation.description}
          </p>

          {/* AI recommendation banner */}
          <div className="flex items-start gap-2 bg-cyan-500/8 border border-cyan-500/20 rounded-lg px-3 py-2.5">
            <Sparkles size={13} className="text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-xs text-cyan-300 leading-relaxed">
              <span className="font-semibold">Recommended: </span>
              {recommendation.options.find((o) => o.value === recommendation.recommended)?.label ??
                recommendation.recommended}{' '}
              — {recommendation.reason}
            </p>
          </div>

          {/* Option list */}
          <fieldset className="space-y-2">
            <legend className="sr-only">{recommendation.title} options</legend>
            {recommendation.options.map((opt) => {
              const isSelected = value === opt.value;
              const isDisabled = opt.disabled;

              return (
                <div key={opt.value} className="relative">
                  <label
                    className={clsx(
                      'flex items-start gap-3 rounded-lg border px-3.5 py-3 cursor-pointer transition-all',
                      isDisabled
                        ? 'opacity-40 cursor-not-allowed border-gray-700 bg-gray-800'
                        : isSelected
                          ? 'border-cyan-500/60 bg-cyan-500/10'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-700/30',
                    )}
                    onMouseEnter={() => isDisabled && setTooltipOption(opt.value)}
                    onMouseLeave={() => setTooltipOption(null)}
                  >
                    <input
                      type="radio"
                      name={`step-${recommendation.step}`}
                      value={opt.value}
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => !isDisabled && onChange(opt.value)}
                      className="mt-0.5 accent-cyan-500 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={clsx(
                            'text-sm font-medium',
                            isDisabled ? 'text-gray-500' : 'text-gray-200',
                          )}
                        >
                          {opt.label}
                        </span>
                        {opt.is_recommended && !isDisabled && (
                          <span className="text-[10px] font-medium bg-emerald-500/15 text-emerald-400 rounded-full px-1.5 py-0.5">
                            ✓ AI pick
                          </span>
                        )}
                        {isDisabled && (
                          <span className="text-[10px] font-medium bg-gray-700 text-gray-500 rounded-full px-1.5 py-0.5">
                            Unavailable
                          </span>
                        )}
                      </div>
                      <p
                        className={clsx(
                          'text-xs mt-0.5 leading-relaxed',
                          isDisabled ? 'text-gray-600' : 'text-gray-400',
                        )}
                      >
                        {opt.description}
                      </p>
                    </div>
                    {/* Disabled info icon */}
                    {isDisabled && (
                      <Info size={14} className="text-gray-600 shrink-0 mt-0.5" />
                    )}
                  </label>

                  {/* Disabled tooltip */}
                  {isDisabled && tooltipOption === opt.value && opt.disabled_reason && (
                    <div className="absolute z-20 left-4 bottom-full mb-2 max-w-xs bg-gray-900 border border-gray-600 text-gray-300 text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none">
                      <p className="font-semibold text-amber-400 mb-0.5">Why unavailable?</p>
                      <p>{opt.disabled_reason}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>

          {/* Extra sub-controls (sliders, checkboxes, etc.) */}
          {children && <div className="space-y-3 pt-1">{children}</div>}
        </div>
      )}
    </div>
  );
}
