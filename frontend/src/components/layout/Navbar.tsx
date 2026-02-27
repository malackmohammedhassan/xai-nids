import { useEffect, useState } from 'react';
import { Activity, Wifi, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import { healthApi } from '@/api';
import { useAppStore } from '@/store/appStore';

export function Navbar() {
  const { health, setHealth } = useAppStore();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setChecking(true);
      try {
        const h = await healthApi.check();
        if (!cancelled) setHealth(h);
      } catch {
        if (!cancelled) setHealth(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setHealth]);

  const isOk = health?.status === 'ok';

  return (
    <header className="h-14 border-b border-gray-700 bg-gray-900 flex items-center px-4 gap-4 shrink-0">
      <span className="text-white font-semibold text-sm tracking-wide">
        {import.meta.env.VITE_APP_TITLE ?? 'XAI-NIDS'}
      </span>

      <div className="flex-1" />

      {/* Backend status */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-400">API</span>
        {checking ? (
          <Activity size={14} className="text-yellow-400 animate-pulse" />
        ) : isOk ? (
          <Wifi size={14} className="text-emerald-400" />
        ) : (
          <WifiOff size={14} className="text-red-400" />
        )}
        <span
          className={clsx(
            'font-medium',
            isOk ? 'text-emerald-400' : checking ? 'text-yellow-400' : 'text-red-400'
          )}
        >
          {checking ? 'Checking' : isOk ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Active training indicator */}
      {health?.active_training && (
        <div className="flex items-center gap-1 text-xs text-cyan-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          Training
        </div>
      )}
    </header>
  );
}
