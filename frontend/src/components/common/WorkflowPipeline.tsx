/**
 * WorkflowPipeline — Horizontal pipeline visualisation showing the 5 XAI-NIDS
 * steps with live completion state derived from the global store.
 */
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';

export interface PipelineStep {
  step: number;
  label: string;
  description: string;
  to: string;
  ctaText: string;
  completed: boolean;
  /** Whether the previous step is done (lets user know they can proceed) */
  accessible: boolean;
}

interface Props {
  steps: PipelineStep[];
}

export function WorkflowPipeline({ steps }: Props) {
  // Find the first incomplete step — that's the "current" focus
  const currentIdx = steps.findIndex((s) => !s.completed);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
      <h2 className="text-gray-200 font-semibold text-sm">Your Progress</h2>

      {/* Desktop: horizontal timeline */}
      <div className="hidden lg:flex items-start gap-0">
        {steps.map((step, i) => {
          const isCurrent = i === currentIdx;
          const isDone = step.completed;
          return (
            <div key={step.step} className="flex items-start flex-1">
              <div className="flex flex-col items-center flex-1">
                {/* Node */}
                <Link
                  to={step.to}
                  className={clsx(
                    'flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all',
                    isDone
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                      : isCurrent
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                      : 'border-gray-600 bg-gray-900 text-gray-500'
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <span className="text-xs font-bold">{step.step}</span>
                  )}
                </Link>
                {/* Label */}
                <div className="mt-2 text-center px-1">
                  <p
                    className={clsx(
                      'text-xs font-semibold',
                      isDone ? 'text-emerald-400' : isCurrent ? 'text-cyan-300' : 'text-gray-500'
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5 leading-tight">{step.description}</p>
                  {isCurrent && (
                    <Link
                      to={step.to}
                      className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      {step.ctaText} <ArrowRight size={10} />
                    </Link>
                  )}
                </div>
              </div>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div
                  className={clsx(
                    'h-0.5 flex-shrink-0 w-8 mt-4',
                    steps[i + 1].accessible || isDone ? 'bg-emerald-500/40' : 'bg-gray-700'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical list */}
      <div className="lg:hidden space-y-2">
        {steps.map((step, i) => {
          const isCurrent = i === currentIdx;
          const isDone = step.completed;
          return (
            <Link
              key={step.step}
              to={step.to}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-4 py-3 border transition-all',
                isDone
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : isCurrent
                  ? 'border-cyan-500/50 bg-cyan-500/10'
                  : 'border-gray-700 bg-gray-900/50'
              )}
            >
              <div
                className={clsx(
                  'flex items-center justify-center w-7 h-7 rounded-full border-2 shrink-0',
                  isDone ? 'border-emerald-500 text-emerald-400' : isCurrent ? 'border-cyan-500 text-cyan-400' : 'border-gray-600 text-gray-500'
                )}
              >
                {isDone ? <CheckCircle2 size={14} /> : <span className="text-xs font-bold">{step.step}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={clsx(
                    'text-sm font-medium',
                    isDone ? 'text-emerald-400' : isCurrent ? 'text-cyan-300' : 'text-gray-500'
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-gray-500 truncate">{step.description}</p>
              </div>
              {isDone && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
              {isCurrent && <ArrowRight size={14} className="text-cyan-400 shrink-0" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
