import { useMemo, useId, useState, useEffect, useRef } from 'react';
import { useDevice } from '../context/DeviceContext';
import { useDashboard } from '../context/DashboardContext';
import { useLive } from '../context/LiveContext';
import { useInsights } from '../context/InsightsContext';
import { evaluateMeterStability } from '../utils/meterStability';
import { Zap, TrendingUp, Gauge, Clock, Activity, BarChart3, AlertTriangle, Wifi, WifiOff, Server } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const FLEET_NOMINAL_V = Number(import.meta.env.VITE_NOMINAL_VOLTAGE) || 230;

function formatTimeSince(seconds) {
  if (seconds === null || seconds === undefined) return 'Never';
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function DeviceCard({ deviceId, data, isSelected, onSelect, ratedCapacityW }) {
  const [secondsAgo, setSecondsAgo] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (data?.lastSeenMs) {
      setSecondsAgo(Math.round((Date.now() - data.lastSeenMs) / 1000));
      timerRef.current = setInterval(() => {
        setSecondsAgo(Math.round((Date.now() - data.lastSeenMs) / 1000));
      }, 1000);
    } else {
      setSecondsAgo(null);
    }
    return () => clearInterval(timerRef.current);
  }, [data?.lastSeenMs]);

  const reading = data?.current;
  const isOnline = secondsAgo !== null && secondsAgo < 30;
  const stability = useMemo(
    () =>
      evaluateMeterStability(reading, {
        nominalVoltage: FLEET_NOMINAL_V,
        ratedCapacityW: ratedCapacityW ?? 10000,
      }),
    [reading, ratedCapacityW]
  );

  const unstableBorder =
    stability.unstable && stability.severity === 'critical'
      ? 'ring-2 ring-red-alarm/40 border-red-alarm/35'
      : stability.unstable && stability.severity === 'warning'
        ? 'ring-2 ring-amber-500/40 border-amber-500/35'
        : '';
  const unstableBg =
    stability.severity === 'critical'
      ? 'bg-red-alarm/[0.04]'
      : stability.severity === 'warning'
        ? 'bg-amber-500/[0.06]'
        : '';

  return (
    <button
      type="button"
      onClick={() => onSelect(deviceId)}
      className={`text-left w-full glass-panel glass-panel-hover p-5 transition-all duration-200 cursor-pointer ${
        isSelected ? 'ring-2 ring-cyan-electric/40 border-cyan-electric/30' : unstableBorder
      } ${stability.unstable ? unstableBg : ''}`}
    >
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Server size={16} className="text-grid-400 shrink-0" />
          <span className="text-sm font-bold text-slate-900 tracking-tight truncate">{deviceId}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {stability.unstable && (
            <span
              title={stability.flags.map((f) => f.label).join(' · ')}
              className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] font-bold ${
                stability.severity === 'critical'
                  ? 'bg-red-alarm/15 text-red-alarm border border-red-alarm/25'
                  : 'bg-amber-500/15 text-amber-800 border border-amber-500/25'
              }`}
            >
              <AlertTriangle size={10} />
              Unstable
            </span>
          )}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ${
              isOnline ? 'bg-green-ok/10 text-green-ok' : secondsAgo !== null ? 'bg-amber-500/10 text-amber-700' : 'bg-slate-200 text-grid-500'
            }`}
          >
            {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
            {isOnline ? 'Live' : formatTimeSince(secondsAgo)}
          </div>
        </div>
      </div>
      {stability.unstable && stability.flags.length > 0 && (
        <p className="text-[10px] text-grid-600 mb-2 leading-snug line-clamp-2" title={stability.flags.map((f) => f.label).join(' · ')}>
          {stability.flags.slice(0, 3).map((f) => f.label).join(' · ')}
          {stability.flags.length > 3 ? ` +${stability.flags.length - 3}` : ''}
        </p>
      )}

      {reading ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-grid-500">Power</p>
              <p className="text-lg font-bold data-readout text-slate-900">{reading.ap?.toFixed(0)}<span className="text-xs text-grid-400 ml-0.5">W</span></p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-grid-500">PF</p>
              <p className={`text-lg font-bold data-readout ${reading.pf < 0.85 ? 'text-red-alarm' : 'text-green-ok'}`}>
                {reading.pf?.toFixed(3)}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-grid-500">Freq</p>
              <p className="text-lg font-bold data-readout text-slate-900">{reading.f?.toFixed(1)}<span className="text-xs text-grid-400 ml-0.5">Hz</span></p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-[8px] text-grid-500">VA</p>
              <p className="text-xs data-readout font-semibold text-phase-a">{reading.va?.toFixed(1)}V</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-grid-500">VB</p>
              <p className="text-xs data-readout font-semibold text-phase-b">{reading.vb?.toFixed(1)}V</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-grid-500">VC</p>
              <p className="text-xs data-readout font-semibold text-phase-c">{reading.vc?.toFixed(1)}V</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-[8px] text-grid-500">IA</p>
              <p className="text-xs data-readout font-semibold text-phase-a">{reading.ca?.toFixed(2)}A</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-grid-500">IB</p>
              <p className="text-xs data-readout font-semibold text-phase-b">{reading.cb?.toFixed(2)}A</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-grid-500">IC</p>
              <p className="text-xs data-readout font-semibold text-phase-c">{reading.cc?.toFixed(2)}A</p>
            </div>
          </div>
          <div className="flex justify-between items-baseline pt-1 border-t border-grid-700/20">
            <span className="text-[9px] text-grid-500">Energy</span>
            <span className="text-xs data-readout font-semibold">{reading.e?.toFixed(2)} kWh</span>
          </div>
        </div>
      ) : (
        <div className="py-4 text-center text-grid-500 text-sm">
          Waiting for data...
        </div>
      )}
    </button>
  );
}

function StatCard({ icon, label, value, unit, accent = '#0ea5e9', delay = 0 }) {
  const SvgIcon = icon;
  const display = value === null || value === undefined || value === '' ? '—' : value;
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
  const { selectedDevice, selectDevice } = useDevice();
  const { dashboard: data, devicesLoading } = useDashboard();
  const { ratedCapacity } = useInsights();
  const { current: liveStream, connected: liveConnected, deviceData, allDeviceIds } = useLive();
  const gradId = useId().replace(/:/g, '');

  const fleetStability = useMemo(() => {
    let critical = 0;
    let warning = 0;
    for (const id of allDeviceIds) {
      const r = deviceData[id]?.current;
      if (!r) continue;
      const s = evaluateMeterStability(r, {
        nominalVoltage: FLEET_NOMINAL_V,
        ratedCapacityW: ratedCapacity ?? 10000,
      });
      if (s.severity === 'critical') critical += 1;
      else if (s.severity === 'warning') warning += 1;
    }
    return { critical, warning, unstableTotal: critical + warning };
  }, [allDeviceIds, deviceData, ratedCapacity]);

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

  const liveReading = liveStream ?? data?.liveReading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Fleet Dashboard</h2>
          <p className="text-grid-400 text-sm mt-1">
            {allDeviceIds.length} device{allDeviceIds.length !== 1 ? 's' : ''} discovered
            {fleetStability.unstableTotal > 0 && (
              <span className="ml-2 text-slate-700">
                ·{' '}
                <span className="font-semibold text-red-alarm">{fleetStability.critical}</span> critical /{' '}
                <span className="font-semibold text-amber-700">{fleetStability.warning}</span> warning (insight-threshold breach)
              </span>
            )}
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
            {liveConnected ? 'WebSocket connected' : 'Connecting…'}
          </span>
        </div>
      </div>

      {/* Device cards grid */}
      {allDeviceIds.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity size={16} className="text-cyan-electric" /> All Devices — Live
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allDeviceIds.map((id) => (
              <DeviceCard
                key={id}
                deviceId={id}
                data={deviceData[id]}
                isSelected={id === selectedDevice}
                onSelect={selectDevice}
                ratedCapacityW={ratedCapacity}
              />
            ))}
          </div>
        </div>
      )}

      {allDeviceIds.length === 0 && !devicesLoading && (
        <div className="glass-panel p-12 text-center">
          <Server size={40} className="text-grid-500 mx-auto mb-3 animate-pulse" />
          <p className="text-grid-400 text-lg font-semibold">Waiting for devices to connect...</p>
          <p className="text-grid-500 text-sm mt-1">Start the meter simulator to see live data appear here.</p>
        </div>
      )}

      {/* Selected device detail */}
      {selectedDevice && data && (
        <>
          <div className="border-t border-grid-700/30 pt-6">
            <h3 className="text-lg font-bold tracking-tight mb-1">
              {selectedDevice} — Detail View
            </h3>
            <p className="text-grid-400 text-sm mb-4">
              {data?.deviceInfo?.totalReadings?.toLocaleString()} readings accumulated
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Zap} label="Total Consumed" value={data?.summary?.totalConsumedKwh?.toLocaleString(undefined, { maximumFractionDigits: 1 })} unit="kWh" delay={0} />
            <div className="glass-panel glass-panel-hover p-5 animate-slide-up space-y-1" style={{ animationDelay: '50ms' }}>
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: '#d9770620' }}>
                  <TrendingUp size={18} style={{ color: '#d97706' }} />
                </div>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-grid-400 font-semibold mb-1">Peak Demand</p>
              <p className="text-2xl font-bold data-readout text-slate-900">
                {data?.summary?.peakDemandW != null ? Number(data.summary.peakDemandW).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}<span className="text-sm text-grid-400 ml-1">W</span>
              </p>
              <p className="text-[11px] text-grid-500 leading-snug pt-1">
                {fmtUtcTimestamp(data?.summary?.peakDemandTimestamp) ?? '—'}
              </p>
            </div>
            <StatCard icon={Gauge} label="Avg Power Factor" value={data?.summary?.avgPowerFactor?.toFixed(3)} unit="" accent="#16a34a" delay={100} />
            <StatCard icon={AlertTriangle} label="Low PF Events" value={data?.summary?.lowPfCount} unit="events" accent="#dc2626" delay={150} />
          </div>

          {/* Live readings */}
          {liveReading && (
            <div className="glass-panel p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Activity size={16} className="text-cyan-electric" /> Live Phase Readings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <p className="text-xs text-grid-500 font-semibold uppercase">Voltage (V)</p>
                  <PhaseGauge label="Phase A" value={liveReading.va} unit="V" color="#00e5ff" min={210} max={250} />
                  <PhaseGauge label="Phase B" value={liveReading.vb} unit="V" color="#7c4dff" min={210} max={250} />
                  <PhaseGauge label="Phase C" value={liveReading.vc} unit="V" color="#ff9100" min={210} max={250} />
                </div>
                <div className="space-y-3">
                  <p className="text-xs text-grid-500 font-semibold uppercase">Current (A)</p>
                  <PhaseGauge label="Phase A" value={liveReading.ca} unit="A" color="#00e5ff" min={0} max={Math.max(30, (liveReading.ca ?? 0) * 1.5)} />
                  <PhaseGauge label="Phase B" value={liveReading.cb} unit="A" color="#7c4dff" min={0} max={Math.max(30, (liveReading.cb ?? 0) * 1.5)} />
                  <PhaseGauge label="Phase C" value={liveReading.cc} unit="A" color="#ff9100" min={0} max={Math.max(30, (liveReading.cc ?? 0) * 1.5)} />
                </div>
                <div className="space-y-3">
                  <p className="text-xs text-grid-500 font-semibold uppercase">Key Metrics</p>
                  <div className="space-y-4">
                    <div className="flex justify-between items-baseline"><span className="text-grid-400 text-sm">Active Power</span><span className="data-readout text-slate-900 font-bold">{liveReading.ap?.toFixed(1)} W</span></div>
                    <div className="flex justify-between items-baseline"><span className="text-grid-400 text-sm">Reactive Power</span><span className="data-readout text-slate-900 font-bold">{liveReading.rp?.toFixed(1)} VAR</span></div>
                    <div className="flex justify-between items-baseline"><span className="text-grid-400 text-sm">Power Factor</span><span className="data-readout text-slate-900 font-bold">{liveReading.pf?.toFixed(4)}</span></div>
                    <div className="flex justify-between items-baseline"><span className="text-grid-400 text-sm">Frequency</span><span className="data-readout text-slate-900 font-bold">{liveReading.f?.toFixed(3)} Hz</span></div>
                    <div className="flex justify-between items-baseline"><span className="text-grid-400 text-sm">Energy (cumul.)</span><span className="data-readout text-slate-900 font-bold">{liveReading.e?.toFixed(2)} kWh</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-panel min-w-0 p-6 animate-slide-up" style={{ animationDelay: '250ms' }}>
              <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-cyan-electric" /> Recent Power Trend
              </h3>
              {recentChartData.length === 0 ? (
                <p className="text-sm text-grid-500">No recent readings yet. Data appears as soon as the simulator sends it.</p>
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
                      <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: '#64748b' }} interval="preserveStartEnd" minTickGap={24}
                        tickFormatter={(v) => (v ? new Date(v).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')} stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} width={48} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [fmtW(v), 'Active Power']}
                        labelFormatter={(l) => (l ? new Date(l).toLocaleString() : '')} />
                      <Area type="monotone" dataKey="ap" stroke="#0ea5e9" fill={`url(#${gradId})`} strokeWidth={2} dot={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="glass-panel min-w-0 p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
              <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Zap size={16} className="text-amber-signal" /> Daily Consumption
              </h3>
              <div className="w-full min-w-[280px]" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height={240} minWidth={200} initialDimension={{ width: 400, height: 240 }}>
                  <BarChart data={data?.dailyConsumption || []} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dce5f2" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} width={48} />
                    <Tooltip contentStyle={chartTooltipStyle}
                      formatter={(v) => typeof v === 'number' && !Number.isNaN(v) ? [`${v.toFixed(2)} kWh`, 'Consumed'] : [String(v), 'Consumed']} />
                    <Bar dataKey="consumedKwh" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Load curve */}
          {loadCurveData.length > 0 && (
            <div className="glass-panel min-w-0 p-6 animate-slide-up" style={{ animationDelay: '350ms' }}>
              <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock size={16} className="text-phase-b" /> Hourly Load Curve (Avg Demand by Hour)
              </h3>
              <div className="w-full min-w-[280px]" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height={220} minWidth={200} initialDimension={{ width: 400, height: 220 }}>
                  <BarChart data={loadCurveData} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dce5f2" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }}
                      label={{ value: 'Hour (UTC)', position: 'insideBottom', offset: -12, style: { fill: '#64748b', fontSize: 10 } }} stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} width={48} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [fmtW(v), 'Avg demand']}
                      labelFormatter={(h) => `${String(h).padStart(2, '0')}:00 UTC`} />
                    <Bar dataKey="avgDemandW" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
