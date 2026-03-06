/** AnomalyOverlay.tsx — Isolation Forest result: PCA scatter + anomaly stats */
import React, { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ZAxis, Legend,
} from 'recharts';
import { AlertTriangle, CheckCircle, Activity } from 'lucide-react';

interface AnomalyPoint {
  x: number;
  y: number;
  label: string;
  is_anomaly: boolean;
  score: number;
}

interface AnomalyOverlayProps {
  data: {
    points: AnomalyPoint[];
    anomaly_count: number;
    anomaly_pct: number;
    sample_size: number;
    viz_type?: string;
  };
  maxPoints?: number;
}

const NORMAL_COLOUR = '#22d3ee';   // cyan-400
const ANOMALY_COLOUR = '#f87171';  // red-400

export const AnomalyOverlay: React.FC<AnomalyOverlayProps> = ({
  data,
  maxPoints = 3000,
}) => {
  const { normalPoints, anomalyPoints } = useMemo(() => {
    let pts = data.points ?? [];
    if (pts.length > maxPoints) {
      const step = Math.ceil(pts.length / maxPoints);
      pts = pts.filter((_, i) => i % step === 0);
    }
    return {
      normalPoints: pts.filter((p) => !p.is_anomaly),
      anomalyPoints: pts.filter((p) => p.is_anomaly),
    };
  }, [data.points, maxPoints]);

  const riskLevel: 'low' | 'medium' | 'high' =
    data.anomaly_pct < 3 ? 'low' : data.anomaly_pct < 8 ? 'medium' : 'high';

  const riskConfig = {
    low:    { label: 'Low anomaly rate',    colour: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    medium: { label: 'Moderate anomaly rate', colour: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
    high:   { label: 'High anomaly rate',   colour: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  }[riskLevel];

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {/* Total / anomalies / normal */}
        <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
            <Activity size={12} /> Sample size
          </div>
          <p className="text-lg font-bold text-white leading-none">
            {data.sample_size.toLocaleString()}
          </p>
        </div>

        <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-red-400 text-xs">
            <AlertTriangle size={12} /> Anomalies
          </div>
          <p className="text-lg font-bold text-red-400 leading-none">
            {data.anomaly_count.toLocaleString()}
            <span className="text-sm font-normal text-slate-500 ml-1">
              ({data.anomaly_pct.toFixed(1)}%)
            </span>
          </p>
        </div>

        <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-cyan-400 text-xs">
            <CheckCircle size={12} /> Normal
          </div>
          <p className="text-lg font-bold text-cyan-400 leading-none">
            {(data.sample_size - data.anomaly_count).toLocaleString()}
            <span className="text-sm font-normal text-slate-500 ml-1">
              ({(100 - data.anomaly_pct).toFixed(1)}%)
            </span>
          </p>
        </div>
      </div>

      {/* Risk badge */}
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${riskConfig.bg} ${riskConfig.colour}`}>
        <AlertTriangle size={13} />
        {riskConfig.label} — Isolation Forest
        {riskLevel === 'high' && (
          <span className="ml-1 text-slate-300 font-normal">
            · Consider reviewing features or contamination parameter
          </span>
        )}
      </div>

      {/* Scatter overlay */}
      <p className="text-xs text-slate-500 -mb-1">
        PCA projection coloured by anomaly status
        {(normalPoints.length + anomalyPoints.length) < data.points.length && (
          <span className="ml-1 text-slate-600">
            (sub-sampled to {(normalPoints.length + anomalyPoints.length).toLocaleString()})
          </span>
        )}
      </p>
      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="x"
            type="number"
            name="PC1"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            dataKey="y"
            type="number"
            name="PC2"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <ZAxis range={[7, 7]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: 8,
              fontSize: 12,
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as AnomalyPoint;
              return (
                <div className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs space-y-0.5">
                  <p className={p.is_anomaly ? 'text-red-400 font-semibold' : 'text-cyan-400 font-semibold'}>
                    {p.is_anomaly ? '⚠ Anomaly' : '✓ Normal'}
                  </p>
                  <p className="text-slate-400">Score: {p.score.toFixed(3)}</p>
                  {p.label && p.label !== 'unknown' && (
                    <p className="text-slate-400">Label: {p.label}</p>
                  )}
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => (
              <span style={{ color: value === 'Normal' ? NORMAL_COLOUR : ANOMALY_COLOUR, fontSize: 11 }}>
                {value}
              </span>
            )}
          />
          <Scatter name="Normal"  data={normalPoints}  fill={NORMAL_COLOUR}  opacity={0.55} />
          <Scatter name="Anomaly" data={anomalyPoints} fill={ANOMALY_COLOUR} opacity={0.85} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
