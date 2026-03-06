/** HowItWorks.tsx — Expandable "?" info panel for technical explanations */
import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface HowItWorksProps {
  title: string;
  children: React.ReactNode;
  learnMoreUrl?: string;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Compact expandable info block.
 * Usage:
 *   <HowItWorks title="How does PCA work?">
 *     PCA reduces high-dimensional data to 2D by finding directions of
 *     maximum variance...
 *   </HowItWorks>
 */
export const HowItWorks: React.FC<HowItWorksProps> = ({
  title,
  children,
  learnMoreUrl,
  defaultOpen = false,
  className = '',
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-lg border border-slate-700/60 bg-slate-800/30 overflow-hidden transition-all ${className}`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700/30 transition-colors"
        aria-expanded={open}
      >
        <HelpCircle size={13} className="text-indigo-400 shrink-0" />
        <span className="flex-1 text-xs font-medium text-slate-400">{title}</span>
        {open ? (
          <ChevronUp size={13} className="text-slate-500 shrink-0" />
        ) : (
          <ChevronDown size={13} className="text-slate-500 shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-3 pt-1 text-xs text-slate-400 leading-relaxed border-t border-slate-700/40 space-y-2">
          {children}
          {learnMoreUrl && (
            <a
              href={learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors mt-1"
            >
              <ExternalLink size={11} />
              Learn more
            </a>
          )}
        </div>
      )}
    </div>
  );
};

/** Convenience: render a list of concept cards, e.g. for methodology section */
interface ConceptItem {
  term: string;
  definition: string;
}
interface ConceptGlossaryProps {
  items: ConceptItem[];
  className?: string;
}
export const ConceptGlossary: React.FC<ConceptGlossaryProps> = ({ items, className = '' }) => (
  <dl className={`space-y-2 ${className}`}>
    {items.map(({ term, definition }) => (
      <div key={term}>
        <dt className="font-semibold text-slate-300">{term}</dt>
        <dd className="text-slate-500 mt-0.5">{definition}</dd>
      </div>
    ))}
  </dl>
);
