import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Shield, BarChart3, Brain, Target, FolderOpen } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Training from './pages/Training';
import Prediction from './pages/Prediction';
import Explainability from './pages/Explainability';
import ModelManager from './pages/ModelManager';

const navItems = [
  { path: '/', label: 'Dashboard', icon: BarChart3 },
  { path: '/training', label: 'Training', icon: Brain },
  { path: '/prediction', label: 'Prediction', icon: Target },
  { path: '/explainability', label: 'XAI', icon: Shield },
  { path: '/models', label: 'Models', icon: FolderOpen },
];

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-soc-bg flex">
        {/* Sidebar */}
        <aside className="w-64 bg-soc-panel border-r border-soc-border flex flex-col fixed h-full z-50">
          <div className="p-6 border-b border-soc-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-soc-accent to-blue-600 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-soc-accent font-mono">XAI-NIDS</h1>
                <p className="text-xs text-soc-muted">Intrusion Detection</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-soc-accent/10 text-soc-accent border border-soc-accent/30 glow-border'
                      : 'text-soc-muted hover:text-soc-text hover:bg-soc-card'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-soc-border">
            <p className="text-xs text-soc-muted text-center">v1.0.0 • SOC Platform</p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64 p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/training" element={<Training />} />
            <Route path="/prediction" element={<Prediction />} />
            <Route path="/explainability" element={<Explainability />} />
            <Route path="/models" element={<ModelManager />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
