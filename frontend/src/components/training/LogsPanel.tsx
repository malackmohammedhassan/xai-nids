import { useRef, useEffect } from 'react';
import { Terminal } from 'lucide-react';

interface Props {
  logs: string[];
  onClear: () => void;
}

export function LogsPanel({ logs, onClear }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2 text-gray-400 text-xs">
          <Terminal size={13} />
          Training Logs ({logs.length})
        </div>
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="h-52 overflow-y-auto p-4 font-mono text-xs text-green-400 space-y-0.5">
        {logs.length === 0 ? (
          <span className="text-gray-600">No logs yet…</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap leading-5">
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
