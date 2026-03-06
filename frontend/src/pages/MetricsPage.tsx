/**
 * MetricsPage.tsx — System telemetry dashboard.
 *
 * Polls GET /api/v2/system/metrics every 5 seconds and renders:
 *  • Total request count + error rate
 *  • Route latency table (p50 / p95 / p99 per normalized path)
 *  • Inference stats per model (count + p95 latency ms)
 *  • Training history timeline (last 50 runs)
 *  • Error frequency bar chart
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { RefreshCw, Activity, Zap, AlertTriangle, Clock } from 'lucide-react';
import { v2get } from '@/api/v2client';

// ─── Types (mirror TelemetryRegistry.summary() shape) ────────────────────────

interface RouteStats {
  count: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  mean_ms: number;
  max_ms: number;
  error_count: number;
  histogram?: Record<string, number>;
}

interface InferenceStats {
  count: number;
  p50_ms: number;
  p95_ms: number;
}

interface TrainingRun {
  model_type: string;
  duration_s: number;
  accuracy: number | null;
  row_count: number;
  timestamp: string;
}

interface MetricsSummary {
  routes: Record<string, RouteStats>;
  errors: Record<string, number>;
  inference: Record<string, InferenceStats>;
  training: TrainingRun[];
  dataset_upload_sizes_bytes: number[];
  generated_at: string;
}

// ─── Helper components ────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  colour = 'text-indigo-400',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  colour?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-semibold ${colour}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const MetricsPage: React.FC = () => {
  const [data, setData] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const summary = await v2get<MetricsSummary>('/system/metrics');
      setData(summary);
      setError(null);
      setLastRefresh(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const id = setInterval(fetchMetrics, 5_000);
    return () => clearInterval(id);
  }, [fetchMetrics]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalRequests = data
    ? Object.values(data.routes).reduce((s, r) => s + r.count, 0)
    : 0;
  const totalErrors = data
    ? Object.values(data.errors).reduce((s, c) => s + c, 0)
    : 0;
  const errorRate =
    totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) : '0.0';

  const routeRows = useMemo(
    () =>
      data ? Object.entries(data.routes).sort((a, b) => b[1].count - a[1].count) : [],
    [data],
  );

  const inferenceRows = useMemo(
    () =>
      data ? Object.entries(data.inference).sort((a, b) => b[1].count - a[1].count) : [],
    [data],
  );

  const errorBarData = useMemo(
    () =>
      data
        ? Object.entries(data.errors)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([code, count]) => ({ code, count }))
        : [],
    [data],
  );

  // Top-5 routes by hit count with histogram buckets for latency distribution chart
  const histogramData = useMemo(() => {
    if (!data) return [];
    const bucketKeys = ['<50ms', '<100ms', '<200ms', '<500ms', '<1000ms', '>=1000ms'];
    return Object.entries(data.routes)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([route, stats]) => {
        const hist = stats.histogram ?? {};
        const row: Record<string, string | number> = { route };
        for (const k of bucketKeys) row[k] = hist[k] ?? 0;
        return row;
      });
  }, [data]);

  const avgUploadMB =
    data && data.dataset_upload_sizes_bytes.length
      ? (
          data.dataset_upload_sizes_bytes.reduce((a, b) => a + b, 0) /
          data.dataset_upload_sizes_bytes.length /
          1_024 /
          1_024
        ).toFixed(2)
      : '—';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Loading telemetry…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-400">
        <AlertTriangle className="inline h-4 w-4 mr-1" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">System Telemetry</h1>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-slate-500">
              refreshed {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchMetrics}
            className="rounded p-1 text-slate-400 hover:text-slate-200"
            title="Refresh now"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Total Requests"
          value={totalRequests.toLocaleString()}
        />
        <StatCard
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Error Rate"
          value={`${errorRate}%`}
          colour={parseFloat(errorRate) > 5 ? 'text-red-400' : 'text-emerald-400'}
          sub={`${totalErrors} errors`}
        />
        <StatCard
          icon={<Zap className="h-3.5 w-3.5" />}
          label="Inference Models"
          value={Object.keys(data?.inference ?? {}).length}
        />
        <StatCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Avg Upload"
          value={`${avgUploadMB} MB`}
          sub={`${data?.dataset_upload_sizes_bytes.length ?? 0} uploads`}
        />
      </div>

      {/* Route latency table */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Route Latency (ms)</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-xs text-slate-300">
            <thead className="bg-slate-800 text-[10px] uppercase text-slate-400">
              <tr>
                {['Route', 'Hits', 'p50', 'p95', 'p99', 'Max'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {routeRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                    No data yet — make some requests first
                  </td>
                </tr>
              )}
              {routeRows.map(([route, s]) => (
                <tr key={route} className="border-t border-slate-800 hover:bg-slate-800/40">
                  <td className="px-3 py-1.5 font-mono text-[10px] text-indigo-300">{route}</td>
                  <td className="px-3 py-1.5">{s.count}</td>
                  <td className="px-3 py-1.5">{s.p50_ms}</td>
                  <td className={`px-3 py-1.5 ${s.p95_ms > 1_000 ? 'text-orange-400' : ''}`}>
                    {s.p95_ms}
                  </td>
                  <td className={`px-3 py-1.5 ${s.p99_ms > 2_000 ? 'text-red-400' : ''}`}>
                    {s.p99_ms}
                  </td>
                  <td className="px-3 py-1.5">{s.max_ms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Latency histogram — top-5 busiest routes */}
      {histogramData.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">
            Latency Distribution (top {histogramData.length} routes)
          </h2>
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={histogramData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="route"
                  tick={{ fill: '#94a3b8', fontSize: 8 }}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {['<50ms', '<100ms', '<200ms', '<500ms', '<1000ms', '>=1000ms'].map((b, i) => {
                  const fills = ['#34d399', '#6ee7b7', '#6366f1', '#f59e0b', '#f97316', '#f87171'];
                  return <Bar key={b} dataKey={b} stackId="a" fill={fills[i]} />;
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Inference stats */}
      {inferenceRows.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Inference per Model</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs text-slate-300">
              <thead className="bg-slate-800 text-[10px] uppercase text-slate-400">
                <tr>
                  {['Model', 'Predictions', 'p50 ms', 'p95 ms'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inferenceRows.map(([model, s]) => (
                  <tr key={model} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="px-3 py-1.5 font-mono text-[10px] text-purple-300">{model}</td>
                    <td className="px-3 py-1.5">{s.count}</td>
                    <td className="px-3 py-1.5">{s.p50_ms}</td>
                    <td className={`px-3 py-1.5 ${s.p95_ms > 500 ? 'text-orange-400' : ''}`}>
                      {s.p95_ms}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Error frequency chart */}
      {errorBarData.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Error Frequency</h2>
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={errorBarData} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="code"
                  tick={{ fill: '#94a3b8', fontSize: 9 }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {errorBarData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#f87171' : '#fb923c'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Training history */}
      {(data?.training ?? []).length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">
            Training History (last {data!.training.length})
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs text-slate-300">
              <thead className="bg-slate-800 text-[10px] uppercase text-slate-400">
                <tr>
                  {['Model Type', 'Duration (s)', 'Accuracy', 'Rows', 'Time'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...data!.training].reverse().map((run, i) => (
                  <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="px-3 py-1.5 font-mono text-[10px] text-indigo-300">
                      {run.model_type}
                    </td>
                    <td className="px-3 py-1.5">{run.duration_s.toFixed(1)}</td>
                    <td className="px-3 py-1.5">
                      {run.accuracy != null ? `${(run.accuracy * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-1.5">{run.row_count.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-slate-500">
                      {new Date(run.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default MetricsPage;
