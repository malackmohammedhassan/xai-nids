import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-4 py-16 text-center',
        className
      )}
    >
      {icon && <div className="text-gray-500 opacity-60">{icon}</div>}
      <div>
        <p className="text-gray-300 font-medium">{title}</p>
        {description && (
          <p className="text-gray-500 text-sm mt-1 max-w-xs">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
