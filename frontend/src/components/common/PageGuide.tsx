/**
 * PageGuide — The collapsible "About this page" banner shown at the top of
 * every functional page.
 *
 * Contains:
 *  • A one-liner description of what the page does
 *  • A prerequisite guard (renders a CTA instead of children when blocked)
 *  • An expandable "How it works" detail section
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, ChevronDown, ChevronUp, ArrowRight, AlertTriangle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Prerequisite {
  /** Human-readable description of what is missing */
  label: string;
  /** Route to navigate to in order to satisfy this prerequisite */
  to: string;
  /** CTA link text */
  ctaText: string;
  /** Whether this prerequisite is satisfied (pass `true` to let through) */
  met: boolean;
}

interface PageGuideProps {
  /** Short sentence describing what this page does */
  tagline: string;
  /** Zero or more prerequisites; first unmet one blocks the page */
  prerequisites?: Prerequisite[];
  /** Optional expandable how-it-works content */
  howItWorksContent?: React.ReactNode;
  /** Page children — rendered only when all prerequisites are met */
  children: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PageGuide({
  tagline,
  prerequisites = [],
  howItWorksContent,
  children,
}: PageGuideProps) {
  const [open, setOpen] = useState(false);

  // First unmet prerequisite acts as a blocker
  const blocker = prerequisites.find((p) => !p.met);

  return (
    <div className="space-y-4">
      {/* ── Tagline + How it works ── */}
      <div className="rounded-xl border border-gray-700/60 bg-gray-800/30 overflow-hidden">
        <div className="flex items-start gap-3 px-4 py-3">
          <Info size={14} className="text-cyan-400 shrink-0 mt-0.5" />
          <p className="flex-1 text-sm text-gray-300">{tagline}</p>
          {howItWorksContent && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0 ml-2"
              aria-expanded={open}
            >
              How it works
              {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>

        {open && howItWorksContent && (
          <div className="border-t border-gray-700/40 px-4 py-3 text-xs text-gray-400 leading-relaxed space-y-2">
            {howItWorksContent}
          </div>
        )}
      </div>

      {/* ── Prerequisite blocker ── */}
      {blocker ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-amber-500/30 bg-amber-900/10 px-5 py-4">
          <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300">Prerequisite needed</p>
            <p className="text-xs text-amber-400/70 mt-0.5">{blocker.label}</p>
          </div>
          <Link
            to={blocker.to}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 border border-amber-500/30 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/30 transition-colors shrink-0"
          >
            {blocker.ctaText}
            <ArrowRight size={13} />
          </Link>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
