import { useDevice } from '../context/DeviceContext';
import { useLive } from '../context/LiveContext';
import { Radio, Wifi, WifiOff, TrendingUp, Zap } from 'lucide-react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  Legend
} from 'recharts';

const chartTooltip = {
  backgroundColor: 'rgba(255,255,255,0.97)',
  border: '1px solid rgba(148,163,184,0.35)',
  borderRadius: '12px',
  fontSize: '12px',
  boxShadow: '0 10px 40px rgba(15,23,42,0.12)'
};

function LiveValue({ label, value, unit, color }) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-grid-700/30 last:border-0">
      <span className="text-grid-400 text-sm">{label}</span>
      <span className="data-readout font-bold text-lg" style={{ color }}>
        {value}{' '}
        <span className="text-xs text-grid-500">{unit}</span>
      </span>
    </div>
  );
}

function formatPct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const v = Number(n);
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

export default function LivePage() {
  const { selectedDevice } = useDevice();
  const { connected, current, history } = useLive();

  const vNom = current?.displayNominalV ?? 230;
  const iRated = current?.displayRatedA ?? 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Live View</h2>
          <p className="text-grid-400 text-sm mt-1">
            {selectedDevice} — stream · charts track the <strong>highest</strong> phase voltage &amp; current each
            tick · target {vNom} V, reference {iRated} A per phase
          </p>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
            connected ? 'bg-green-ok/10 border-green-ok/20 text-green-ok' : 'bg-red-alarm/10 border-red-alarm/20 text-red-alarm'
          }`}
        >
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {!current ? (
        <div className="glass-panel p-12 text-center">
          <Radio size={32} className="text-grid-500 mx-auto mb-3 animate-pulse" />
          <p className="text-grid-400">Waiting for live data...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-5 animate-fade-in">
              <h3 className="text-xs font-semibold text-grid-500 uppercase tracking-wider mb-3">Voltage (all phases)</h3>
              <LiveValue label="Phase A" value={current.va?.toFixed(2)} unit="V" color="#22d3ee" />
              <LiveValue label="Phase B" value={current.vb?.toFixed(2)} unit="V" color="#a78bfa" />
              <LiveValue label="Phase C" value={current.vc?.toFixed(2)} unit="V" color="#fb923c" />
              <div className="mt-4 pt-3 border-t border-grid-700/30">
                <p className="text-[10px] uppercase tracking-widest text-grid-500 font-semibold mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Highest phase (this sample)
                </p>
                <p className="data-readout text-2xl font-extrabold text-cyan-600">{current.maxV?.toFixed(2)} V</p>
              </div>
            </div>

            <div className="glass-panel p-5 animate-fade-in">
              <h3 className="text-xs font-semibold text-grid-500 uppercase tracking-wider mb-3">Current (all phases)</h3>
              <LiveValue label="Phase A" value={current.ca?.toFixed(3)} unit="A" color="#22d3ee" />
              <LiveValue label="Phase B" value={current.cb?.toFixed(3)} unit="A" color="#a78bfa" />
              <LiveValue label="Phase C" value={current.cc?.toFixed(3)} unit="A" color="#fb923c" />
              <div className="mt-4 pt-3 border-t border-grid-700/30">
                <p className="text-[10px] uppercase tracking-widest text-grid-500 font-semibold mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Highest phase (this sample)
                </p>
                <p className="data-readout text-2xl font-extrabold text-violet-600">{current.maxA?.toFixed(3)} A</p>
              </div>
            </div>

            <div className="glass-panel p-5 animate-fade-in">
              <h3 className="text-xs font-semibold text-grid-500 uppercase tracking-wider mb-3">Power &amp; grid</h3>
              <LiveValue label="Active Power" value={current.ap?.toFixed(1)} unit="W" color="#22d3ee" />
              <LiveValue label="Reactive Power" value={current.rp?.toFixed(1)} unit="VAR" color="#fb923c" />
              <LiveValue
                label="Power Factor"
                value={current.pf?.toFixed(4)}
                unit=""
                color={current.pf < 0.85 ? '#f43f5e' : '#22c55e'}
              />
              <LiveValue label="Frequency" value={current.f?.toFixed(3)} unit="Hz" color="#0f172a" />
            </div>
          </div>

          {/* Real-time deviation readouts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-transparent px-5 py-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-800/80">Voltage vs target</p>
              <p className="data-readout text-3xl font-black text-slate-900 mt-1">{formatPct(current.voltageDriftPct)}</p>
              <p className="text-xs text-grid-500 mt-2 leading-snug">
                Compared with {vNom} V on the <strong>highest</strong> phase. Negative means below target.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-transparent px-5 py-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-900/80">Toward voltage limit</p>
              <p className="data-readout text-3xl font-black text-slate-900 mt-1">{formatPct(current.voltageLimitStressPct)}</p>
              <p className="text-xs text-grid-500 mt-2 leading-snug">
                0% in the 220–240 V comfort band. Rises as you approach under/over limits (210 / 245 V).
              </p>
            </div>
            <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-transparent px-5 py-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-900/80">Current vs reference</p>
              <p className="data-readout text-3xl font-black text-slate-900 mt-1">{formatPct(current.currentVsRatedPct)}</p>
              <p className="text-xs text-grid-500 mt-2 leading-snug">
                Peak phase current compared to a {iRated} A reference value (adjust in your deployment settings if needed).
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4 shadow-sm flex flex-col justify-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-grid-500">Band guide</p>
              <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                Shaded band on the chart is the <strong>healthy voltage window</strong> (220–240 V). Nominal target line at{' '}
                {vNom} V.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.25)] p-6 min-w-0 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">Phase extremes over time</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md">
                    Cyan: highest line voltage · Violet: highest phase current — updated every sample.
                  </p>
                </div>
              </div>
              <div className="w-full min-w-0" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height={320} minWidth={200}>
                  <ComposedChart data={history} margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
                    <defs>
                      <linearGradient id="gradV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis
                      yAxisId="v"
                      domain={[200, 255]}
                      tick={{ fontSize: 10, fill: '#0891b2' }}
                      tickLine={false}
                      axisLine={{ stroke: '#bae6fd' }}
                      label={{ value: 'V (max phase)', angle: -90, position: 'insideLeft', style: { fill: '#0891b2', fontSize: 10 } }}
                    />
                    <YAxis
                      yAxisId="a"
                      orientation="right"
                      tick={{ fontSize: 10, fill: '#7c3aed' }}
                      tickLine={false}
                      axisLine={{ stroke: '#ddd6fe' }}
                      label={{ value: 'A (max phase)', angle: 90, position: 'insideRight', style: { fill: '#7c3aed', fontSize: 10 } }}
                    />
                    <Tooltip
                      contentStyle={chartTooltip}
                      formatter={(value, name) => [typeof value === 'number' ? value.toFixed(3) : value, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <ReferenceArea yAxisId="v" y1={220} y2={240} fill="#22c55e" fillOpacity={0.07} />
                    <ReferenceLine yAxisId="v" y={vNom} stroke="#475569" strokeDasharray="5 5" strokeWidth={1.2} label={{ value: `${vNom} V`, fill: '#64748b', fontSize: 10, position: 'insideTopLeft' }} />
                    <Area
                      yAxisId="v"
                      type="monotone"
                      dataKey="maxV"
                      name="Max voltage (V)"
                      stroke="#0891b2"
                      strokeWidth={2.5}
                      fill="url(#gradV)"
                      dot={false}
                      isAnimationActive={false}
                      activeDot={{ r: 5, strokeWidth: 0, fill: '#0891b2' }}
                    />
                    <Line
                      yAxisId="a"
                      type="monotone"
                      dataKey="maxA"
                      name="Max current (A)"
                      stroke="#7c3aed"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                      activeDot={{ r: 5, strokeWidth: 0, fill: '#7c3aed' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.25)] p-6 min-w-0 backdrop-blur-sm">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight mb-1">Active power (rolling)</h3>
              <p className="text-xs text-slate-500 mb-5">Total real power for correlation with the extremes chart.</p>
              <div className="w-full min-w-0" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height={320} minWidth={200}>
                  <ComposedChart data={history} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
                    <defs>
                      <linearGradient id="gradP" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} width={48} />
                    <Tooltip contentStyle={chartTooltip} />
                    <Area
                      type="monotone"
                      dataKey="ap"
                      name="Active power (W)"
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      fill="url(#gradP)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
