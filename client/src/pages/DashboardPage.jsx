import { useMemo, useId } from 'react';
import { useDevice } from '../context/DeviceContext';
import { useDashboard } from '../context/DashboardContext';
import { useLive } from '../context/LiveContext';
import { Zap, TrendingUp, Gauge, Clock, Activity, BarChart3, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function StatCard({ icon, label, value, unit, accent = '#0ea5e9', delay = 0 }) {
  const SvgIcon = icon;
  const display =
    value === null || value === undefined || value === '' ? '—' : value;
  return (
    <div className="glass-panel glass-panel-hover p-5 animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${accent}20` }}>
          <SvgIcon size={18} style={{ color: accent }} />
        </div>
      </div>
      <p className="text-[10px] uppercase tracking-widest text-grid-400 font-semibold mb-1">{label}</p>
      <p className="text-2xl font-bold data-readout text-slate-900">
        {display}<span className="text-sm text-grid-400 ml-1">{unit}</span>
      </p>
    </div>
  );
}

function PhaseGauge({ label, value, unit, color, min, max }) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-grid-400">{label}</span>
        <span className="data-readout font-semibold" style={{ color }}>{value?.toFixed(2)} {unit}</span>
      </div>
      <div className="h-2 bg-grid-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

const chartTooltipStyle = { backgroundColor: '#ffffff', border: '1px solid #dce5f2', borderRadius: '8px', fontSize: '12px' };

const fmtW = (v) => (typeof v === 'number' && !Number.isNaN(v) ? `${v.toFixed(1)} W` : String(v));

const fmtUtcTimestamp = (iso) => {
  if (iso == null || iso === '') return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.toLocaleString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })} UTC`;
};

export default function DashboardPage() {
  const { selectedDevice } = useDevice();
  const { dashboard: data, loading, error, devicesLoading } = useDashboard();
  const { current: liveStream, connected: liveConnected } = useLive();
  const gradId = useId().replace(/:/g, '');

  const recentChartData = useMemo(() => {
    const rows = data?.recentReadings;
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
      ...r,
      ap: Number(r.ap)
    }));
  }, [data?.recentReadings]);

  const loadCurveData = useMemo(() => {
    const curve = data?.loadCurve;
    if (!Array.isArray(curve)) return [];
    return curve.map((row) => ({
      ...row,
      hour: row.hour,
      avgDemandW: Number(row.avgDemandW)
    }));
  }, [data?.loadCurve]);

  if (devicesLoading || !selectedDevice) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-electric border-t-transparent rounded-full animate-spin" />
          <p className="text-grid-400 text-sm">Loading device list...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-electric border-t-transparent rounded-full animate-spin" />
          <p className="text-grid-400 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!data) return <p className="text-grid-400">No data available.</p>;

  const { summary, dailyConsumption, liveReading: snapshotLive, deviceInfo } = data;
  const liveReading = liveStream ?? snapshotLive;
  const peakDemandW =
    summary?.peakDemandW != null ? Number(summary.peakDemandW) : null;
  const peakDisplay =
    peakDemandW != null && !Number.isNaN(peakDemandW)
      ? peakDemandW.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Dashboard</h2>
          <p className="text-grid-400 text-sm mt-1">
            {selectedDevice} &middot; {deviceInfo?.totalReadings?.toLocaleString()} readings
          </p>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
            liveConnected
              ? 'bg-green-ok/10 border-green-ok/20'
              : 'bg-amber-500/10 border-amber-500/25'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-green-ok animate-pulse-glow' : 'bg-amber-500'}`}
          />
          <span className={`text-xs font-semibold ${liveConnected ? 'text-green-ok' : 'text-amber-800'}`}>
            {liveConnected ? 'Live stream' : 'Connecting…'}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Zap} label="Total Consumed" value={summary.totalConsumedKwh?.toLocaleString(undefined, { maximumFractionDigits: 1 })} unit="kWh" delay={0} />
        <div className="glass-panel glass-panel-hover p-5 animate-slide-up space-y-1" style={{ animationDelay: '50ms' }}>
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#d9770620' }}>
              <TrendingUp size={18} style={{ color: '#d97706' }} />
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-grid-400 font-semibold mb-1">Peak Demand</p>
          <p className="text-2xl font-bold data-readout text-slate-900">
            {peakDisplay ?? '—'}<span className="text-sm text-grid-400 ml-1">W</span>
          </p>
          <p className="text-[11px] text-grid-500 leading-snug pt-1">
            Max reading:{' '}
            {fmtUtcTimestamp(summary.peakDemandTimestamp) ??
              (summary.peakReadingHourUTC != null
                ? `${String(summary.peakReadingHourUTC).padStart(2, '0')}:00 UTC (hour only)`
                : '—')}
          </p>
          <p className="text-[11px] text-grid-500 leading-snug">
            Avg load-curve peak hour:{' '}
            {summary.peakHourUTC != null
              ? `${String(summary.peakHourUTC).padStart(2, '0')}:00 UTC (mean demand by clock hour)`
              : '—'}
          </p>
        </div>
        <StatCard icon={Gauge} label="Avg Power Factor" value={summary.avgPowerFactor?.toFixed(3)} unit="" accent="#16a34a" delay={100} />
        <StatCard icon={AlertTriangle} label="Low PF Events" value={summary.lowPfCount} unit="events" accent="#dc2626" delay={150} />
      </div>

      {/* Live readings — phase panel */}
      <div className="glass-panel p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
        <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity size={16} className="text-cyan-electric" /> Live Phase Readings
          {!liveConnected && (
            <span className="text-[10px] font-normal normal-case text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-md">
              Stream starting… (showing last snapshot until connected)
            </span>
          )}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Voltage */}
          <div className="space-y-3">
            <p className="text-xs text-grid-500 font-semibold uppercase">Voltage (V)</p>
            <PhaseGauge label="Phase A" value={liveReading?.va} unit="V" color="#00e5ff" min={210} max={250} />
            <PhaseGauge label="Phase B" value={liveReading?.vb} unit="V" color="#7c4dff" min={210} max={250} />
            <PhaseGauge label="Phase C" value={liveReading?.vc} unit="V" color="#ff9100" min={210} max={250} />
          </div>
          {/* Current */}
          <div className="space-y-3">
            <p className="text-xs text-grid-500 font-semibold uppercase">Current (A)</p>
            <PhaseGauge label="Phase A" value={liveReading?.ca} unit="A" color="#00e5ff" min={0} max={Math.max(30, liveReading?.ca * 1.5)} />
            <PhaseGauge label="Phase B" value={liveReading?.cb} unit="A" color="#7c4dff" min={0} max={Math.max(30, liveReading?.cb * 1.5)} />
            <PhaseGauge label="Phase C" value={liveReading?.cc} unit="A" color="#ff9100" min={0} max={Math.max(30, liveReading?.cc * 1.5)} />
          </div>
          {/* Key metrics */}
          <div className="space-y-3">
            <p className="text-xs text-grid-500 font-semibold uppercase">Key Metrics</p>
            <div className="space-y-4">
              <div className="flex justify-between items-baseline"><span className="text-grid-400 text-sm">Active Power</span><span className="data-readout text-slate-900 font-bold">{liveReading?.ap?.toFixed(1)} W</span></div>
              <div className="flex justify-between items-baseline"><span className="text-grid-400 text-sm">Reactive Power</span><span className="data-readout text-slate-900 font-bold">{liveReading?.rp?.toFixed(1)} VAR</span></div>
              <div className="flex justify-between items-baseline"><span className="text-grid-400 text-sm">Power Factor</span><span className="data-readout text-slate-900 font-bold">{liveReading?.pf?.toFixed(4)}</span></div>
              <div className="flex justify-between items-baseline"><span className="text-grid-400 text-sm">Frequency</span><span className="data-readout text-slate-900 font-bold">{liveReading?.f?.toFixed(3)} Hz</span></div>
              <div className="flex justify-between items-baseline"><span className="text-grid-400 text-sm">Energy (cumul.)</span><span className="data-readout text-slate-900 font-bold">{liveReading?.e?.toFixed(2)} kWh</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent power trend — min-w-0 fixes Recharts + flex/grid width collapse */}
        <div className="glass-panel min-w-0 p-6 animate-slide-up" style={{ animationDelay: '250ms' }}>
          <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-cyan-electric" /> Recent Power Trend
          </h3>
          {recentChartData.length === 0 ? (
            <p className="text-sm text-grid-500">No recent readings for this device.</p>
          ) : (
            <div className="w-full min-w-[280px]" style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height={240} minWidth={200} initialDimension={{ width: 400, height: 240 }}>
                <AreaChart data={recentChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dce5f2" />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: 9, fill: '#64748b' }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                    tickFormatter={(v) => (v ? new Date(v).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')}
                    stroke="#94a3b8"
                  />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} width={48} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(v) => [fmtW(v), 'Active Power']}
                    labelFormatter={(l) => (l ? new Date(l).toLocaleString() : '')}
                  />
                  <Area type="monotone" dataKey="ap" stroke="#0ea5e9" fill={`url(#${gradId})`} strokeWidth={2} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Daily consumption */}
        <div className="glass-panel min-w-0 p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Zap size={16} className="text-amber-signal" /> Daily Consumption
          </h3>
          <div className="w-full min-w-[280px]" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height={240} minWidth={200} initialDimension={{ width: 400, height: 240 }}>
              <BarChart data={dailyConsumption || []} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dce5f2" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} width={48} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(v) =>
                    typeof v === 'number' && !Number.isNaN(v) ? [`${v.toFixed(2)} kWh`, 'Consumed'] : [String(v), 'Consumed']
                  }
                />
                <Bar dataKey="consumedKwh" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Load curve */}
      <div className="glass-panel min-w-0 p-6 animate-slide-up" style={{ animationDelay: '350ms' }}>
        <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Clock size={16} className="text-phase-b" /> Hourly Load Curve (Avg Demand by Hour)
        </h3>
        {loadCurveData.length === 0 ? (
          <p className="text-sm text-grid-500">No load-curve data for this device.</p>
        ) : (
          <div className="w-full min-w-[280px]" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height={220} minWidth={200} initialDimension={{ width: 400, height: 220 }}>
              <BarChart data={loadCurveData} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dce5f2" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  label={{ value: 'Hour (UTC)', position: 'insideBottom', offset: -12, style: { fill: '#64748b', fontSize: 10 } }}
                  stroke="#94a3b8"
                />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} width={48} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(v) => [fmtW(v), 'Avg demand']}
                  labelFormatter={(h) => `${String(h).padStart(2, '0')}:00 UTC`}
                />
                <Bar dataKey="avgDemandW" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
