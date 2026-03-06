/** TooltipWrapper.tsx — Simple CSS tooltip for any element */
import React from 'react';

interface TooltipWrapperProps {
  tip: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const POSITION_CLASSES = {
  top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
  bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
};

export const TooltipWrapper: React.FC<TooltipWrapperProps> = ({
  tip,
  children,
  position = 'top',
  className = '',
}) => (
  <div className={`group relative inline-flex ${className}`}>
    {children}
    <div
      className={`pointer-events-none absolute z-50 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-slate-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 ${POSITION_CLASSES[position]}`}
    >
      {tip}
    </div>
  </div>
);
