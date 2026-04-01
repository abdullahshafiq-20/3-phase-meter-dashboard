/* eslint-disable react-refresh/only-export-components -- utility exports used by Insights page */
import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

function formatTick(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * @param {{ bucket: string }[]} series
 * @param {string} yKey
 * @param {string} color
 * @param {(row: object) => boolean} highlight
 * @param {number} [height]
 * @param {string} [yLabel]
 */
export function InsightMiniChart({ series, yKey, color, highlight, height = 132, yLabel }) {
  const data = useMemo(() => {
    if (!Array.isArray(series) || series.length === 0) return [];
    return series.map((row) => {
      const ts = new Date(row.bucket).getTime();
      return {
        ...row,
        _x: ts,
        _hl: highlight ? !!highlight(row) : false
      };
    });
  }, [series, highlight]);

  if (data.length === 0) {
    return <p className="text-[11px] text-grid-500 py-6">No series data</p>;
  }

  return (
    <div className="w-full mt-2 -ml-1">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
          <XAxis
            dataKey="_x"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTick}
            tick={{ fontSize: 9, fill: '#64748b' }}
            minTickGap={28}
          />
          <YAxis
            width={44}
            tick={{ fontSize: 9, fill: '#64748b' }}
            tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : Number(v).toFixed(v >= 10 ? 0 : 2))}
            label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: '#94a3b8' } } : undefined}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
            labelFormatter={(ts) => formatTick(ts)}
            formatter={(value) => [typeof value === 'number' ? value.toFixed(3) : value, yKey]}
          />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={color}
            strokeWidth={1.75}
            dot={(props) => {
              const { cx, cy, payload } = props;
              if (cx == null || cy == null) return null;
              if (payload?._hl) {
                return <circle cx={cx} cy={cy} r={5} fill="#f43f5e" stroke="#fff" strokeWidth={1} />;
              }
              return null;
            }}
            isAnimationActive={false}
            activeDot={{ r: 4, fill: color }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-[9px] text-grid-500 mt-1 uppercase tracking-wide">Red markers — stressed or high-impact moments</p>
    </div>
  );
}

export function percentileHighAp(rows, p = 0.92) {
  const vals = rows.map((r) => r.ap).filter((v) => Number.isFinite(v));
  if (!vals.length) return () => false;
  const sorted = [...vals].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  const thr = sorted[idx];
  return (r) => Number.isFinite(r.ap) && r.ap >= thr;
}

/** @param {{ curve: { hour: number; avgDemandW: number; sampleCount: number }[] }} dailyLoadCurve */
export function InsightHourlyBarChart({ dailyLoadCurve, height = 140 }) {
  const data = dailyLoadCurve?.curve?.length
    ? dailyLoadCurve.curve.filter((e) => e.sampleCount > 0)
    : [];
  if (!data.length) {
    return <p className="text-[11px] text-grid-500 py-6">No hourly data</p>;
  }
  const peakHour = dailyLoadCurve.peakHourUTC;
  return (
    <div className="w-full mt-2">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
          <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} />
          <YAxis
            width={40}
            tick={{ fontSize: 9, fill: '#64748b' }}
            tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
            formatter={(value) => [Number(value).toFixed(1), 'Avg W']}
            labelFormatter={(h) => `Hour ${h}:00 UTC`}
          />
          <Bar dataKey="avgDemandW" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((e) => (
              <Cell key={e.hour} fill={e.hour === peakHour ? '#f43f5e' : '#6366f1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[9px] text-grid-500 mt-1 uppercase tracking-wide">Red bar — peak demand hour (UTC)</p>
    </div>
  );
}
