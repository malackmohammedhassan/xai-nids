/** ExportButton.tsx — Download chart data as CSV or JSON */
import React, { useCallback } from 'react';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  data: unknown;
  filename: string;
  format?: 'json' | 'csv';
  label?: string;
  className?: string;
}

function toCSV(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) return '';
  const keys = Object.keys(data[0] as Record<string, unknown>);
  const rows = (data as Record<string, unknown>[]).map((row) =>
    keys.map((k) => JSON.stringify(row[k] ?? '')).join(','),
  );
  return [keys.join(','), ...rows].join('\n');
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  data,
  filename,
  format = 'json',
  label = 'Export',
  className = '',
}) => {
  const handleExport = useCallback(() => {
    const content =
      format === 'csv' ? toCSV(data) : JSON.stringify(data, null, 2);
    const mime = format === 'csv' ? 'text/csv' : 'application/json';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, filename, format]);

  return (
    <button
      onClick={handleExport}
      className={`flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700 hover:text-white ${className}`}
    >
      <Download className="h-3 w-3" />
      {label}
    </button>
  );
};
