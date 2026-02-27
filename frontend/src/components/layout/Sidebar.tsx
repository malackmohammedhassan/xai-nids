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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/dataset', label: 'Dataset', icon: Database },
  { to: '/training', label: 'Training', icon: BrainCircuit },
  { to: '/evaluation', label: 'Evaluation', icon: BarChart3 },
  { to: '/explainability', label: 'Explainability', icon: Lightbulb },
  { to: '/prediction', label: 'Prediction', icon: Target },
  { to: '/experiments', label: 'Experiments', icon: FlaskConical },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

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
      <nav className="flex-1 py-3 space-y-1 px-2 overflow-hidden">
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
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
            <Icon size={18} className="shrink-0" />
            {!sidebarCollapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
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
