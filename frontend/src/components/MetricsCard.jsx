import React from 'react';

const colorMap = {
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
};

export default function MetricsCard({ label, value, color = 'cyan' }) {
  const c = colorMap[color] || colorMap.cyan;
  const display = value !== null && value !== undefined ? (value * 100).toFixed(1) + '%' : '—';

  return (
    <div className={`glass-card p-4 border ${c.border}`}>
      <p className="text-xs text-soc-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${c.text}`}>{display}</p>
    </div>
  );
}
