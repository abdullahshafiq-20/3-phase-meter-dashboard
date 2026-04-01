import { useDevice } from '../context/DeviceContext';
import { useLive } from '../context/LiveContext';
import { Radio, Wifi, WifiOff } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const chartTooltip = { backgroundColor: '#ffffff', border: '1px solid #dce5f2', borderRadius: '8px', fontSize: '12px' };

function LiveValue({ label, value, unit, color }) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-grid-700/30 last:border-0">
      <span className="text-grid-400 text-sm">{label}</span>
      <span className="data-readout font-bold text-lg" style={{ color }}>{value} <span className="text-xs text-grid-500">{unit}</span></span>
    </div>
  );
}

export default function LivePage() {
  const { selectedDevice } = useDevice();
  const { connected, current, history } = useLive();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Live View</h2>
          <p className="text-grid-400 text-sm mt-1">{selectedDevice} — WebSocket stream (~10s interval)</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
          connected ? 'bg-green-ok/10 border-green-ok/20 text-green-ok' : 'bg-red-alarm/10 border-red-alarm/20 text-red-alarm'
        }`}>
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
          {/* Live readout grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Voltage */}
            <div className="glass-panel p-5 animate-fade-in">
              <h3 className="text-xs font-semibold text-grid-500 uppercase tracking-wider mb-3">Voltage</h3>
              <LiveValue label="Phase A" value={current.va?.toFixed(2)} unit="V" color="#00e5ff" />
              <LiveValue label="Phase B" value={current.vb?.toFixed(2)} unit="V" color="#7c4dff" />
              <LiveValue label="Phase C" value={current.vc?.toFixed(2)} unit="V" color="#ff9100" />
            </div>

            {/* Current */}
            <div className="glass-panel p-5 animate-fade-in">
              <h3 className="text-xs font-semibold text-grid-500 uppercase tracking-wider mb-3">Current</h3>
              <LiveValue label="Phase A" value={current.ca?.toFixed(3)} unit="A" color="#00e5ff" />
              <LiveValue label="Phase B" value={current.cb?.toFixed(3)} unit="A" color="#7c4dff" />
              <LiveValue label="Phase C" value={current.cc?.toFixed(3)} unit="A" color="#ff9100" />
            </div>

            {/* Power */}
            <div className="glass-panel p-5 animate-fade-in">
              <h3 className="text-xs font-semibold text-grid-500 uppercase tracking-wider mb-3">Power & Grid</h3>
              <LiveValue label="Active Power" value={current.ap?.toFixed(1)} unit="W" color="#00e5ff" />
              <LiveValue label="Reactive Power" value={current.rp?.toFixed(1)} unit="VAR" color="#ffab00" />
              <LiveValue label="Power Factor" value={current.pf?.toFixed(4)} unit="" color={current.pf < 0.85 ? '#ff1744' : '#00e676'} />
              <LiveValue label="Frequency" value={current.f?.toFixed(3)} unit="Hz" color="#ffffff" />
            </div>
          </div>

          {/* Rolling charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-panel min-w-0 p-6">
              <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider mb-4">Active Power (Rolling)</h3>
              <div className="w-full min-w-[260px]" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height={200} minWidth={200} initialDimension={{ width: 400, height: 200 }}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dce5f2" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={chartTooltip} />
                  <Line type="monotone" dataKey="ap" stroke="#00e5ff" dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel min-w-0 p-6">
              <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider mb-4">Per-Phase Voltage (Rolling)</h3>
              <div className="w-full min-w-[260px]" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height={200} minWidth={200} initialDimension={{ width: 400, height: 200 }}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dce5f2" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={chartTooltip} />
                  <Line type="monotone" dataKey="va" stroke="#00e5ff" dot={false} strokeWidth={1.5} name="V(A)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="vb" stroke="#7c4dff" dot={false} strokeWidth={1.5} name="V(B)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="vc" stroke="#ff9100" dot={false} strokeWidth={1.5} name="V(C)" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
