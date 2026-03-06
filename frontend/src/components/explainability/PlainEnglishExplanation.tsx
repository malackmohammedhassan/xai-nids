/** PlainEnglishExplanation.tsx — Narrative text card for a prediction explanation */
import React from 'react';
import { MessageSquare } from 'lucide-react';

interface PlainEnglishExplanationProps {
  prediction: string;
  confidence: number;
  topFeatures: { name: string; contribution: 'positive' | 'negative'; description: string }[];
  className?: string;
}

export const PlainEnglishExplanation: React.FC<PlainEnglishExplanationProps> = ({
  prediction,
  confidence,
  topFeatures,
  className = '',
}) => {
  const isAttack = prediction.toLowerCase() !== 'normal' && prediction !== '0';

  return (
    <div
      className={`rounded-xl border p-4 ${
        isAttack ? 'border-red-500/30 bg-red-950/20' : 'border-emerald-500/30 bg-emerald-950/20'
      } ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className={`h-4 w-4 ${isAttack ? 'text-red-400' : 'text-emerald-400'}`} />
        <span className="text-sm font-semibold text-slate-100">Plain Language Explanation</span>
      </div>
      <p className="text-sm text-slate-300 mb-3">
        The model classified this traffic as{' '}
        <span className={`font-bold ${isAttack ? 'text-red-300' : 'text-emerald-300'}`}>
          {prediction}
        </span>{' '}
        with{' '}
        <span className="font-medium text-white">{(confidence * 100).toFixed(1)}%</span> confidence.
      </p>
      {topFeatures.length > 0 && (
        <>
          <p className="text-xs text-slate-500 mb-2">Key factors in this decision:</p>
          <ul className="space-y-1.5">
            {topFeatures.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span
                  className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                    f.contribution === 'positive' ? 'bg-red-400' : 'bg-cyan-400'
                  }`}
                />
                <span className="text-slate-300">
                  <span className="font-medium text-slate-100">{f.name}</span>: {f.description}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
