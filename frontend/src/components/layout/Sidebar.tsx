import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Database,
  BrainCircuit,
  BarChart3,
  Lightbulb,
  Target,
  FlaskConical,
  ShieldCheck,
  Microscope,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';

type NavItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  step?: number;
  /** derive completion from store slice */
  completed?: (s: { datasetsLen: number; modelsLen: number }) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/',              label: 'Dashboard',      icon: LayoutDashboard, exact: true },
  { to: '/dataset',       label: 'Dataset',        icon: Database,       step: 1, completed: (s) => s.datasetsLen > 0 },
  { to: '/training',      label: 'Training',       icon: BrainCircuit,   step: 2, completed: (s) => s.modelsLen > 0 },
  { to: '/evaluation',    label: 'Evaluation',     icon: BarChart3,      step: 3 },
  { to: '/explainability',label: 'Explainability', icon: Lightbulb,      step: 4 },
  { to: '/prediction',    label: 'Prediction',     icon: Target,         step: 5 },
  { to: '/experiments',   label: 'Experiments',    icon: FlaskConical },
  { to: '/lab',           label: 'Intelligence Lab', icon: Microscope },
  { to: '/validation',    label: 'Validation',     icon: ShieldCheck },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, datasets, models } = useAppStore();
  const storeSnap = { datasetsLen: datasets.length, modelsLen: models.length };

  return (
    <aside
      className={clsx(
        'flex flex-col bg-gray-900 border-r border-gray-700 transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-3 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded bg-cyan-500 flex items-center justify-center shrink-0 font-bold text-gray-900 text-sm">
            XAI
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold text-white text-sm truncate">XAI-NIDS</span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="ml-auto text-gray-400 hover:text-white transition-colors"
          title={sidebarCollapsed ? 'Expand' : 'Collapse'}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-hidden">
        {/* Divider label for pipeline steps */}
        {!sidebarCollapsed && (
          <p className="px-2 pt-1 pb-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Pipeline
          </p>
        )}

        {NAV_ITEMS.map(({ to, label, icon: Icon, exact, step, completed: completedFn }) => {
          const done = completedFn ? completedFn(storeSnap) : false;
          return (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-400 font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )
              }
              title={sidebarCollapsed ? label : undefined}
            >
              {/* Icon or step number */}
              <div className="relative shrink-0">
                <Icon size={18} />
                {/* Completion dot */}
                {done && (
                  <CheckCircle2
                    size={9}
                    className="absolute -bottom-0.5 -right-0.5 text-emerald-400 bg-gray-900 rounded-full"
                  />
                )}
              </div>

              {!sidebarCollapsed && (
                <>
                  <span className="truncate flex-1">{label}</span>
                  {step && (
                    <span
                      className={clsx(
                        'text-xs font-bold shrink-0',
                        done ? 'text-emerald-500' : 'text-gray-700'
                      )}
                    >
                      {done ? '✓' : step}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Version */}
      {!sidebarCollapsed && (
        <div className="px-4 py-3 text-xs text-gray-500 border-t border-gray-700">
          v{import.meta.env.VITE_APP_VERSION ?? '2.0.0'}
        </div>
      )}
    </aside>
  );
}
