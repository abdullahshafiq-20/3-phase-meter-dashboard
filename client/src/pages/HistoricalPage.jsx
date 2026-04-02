import { useEffect, useMemo, useState } from 'react';
import { useDevice } from '../context/DeviceContext';
import { useHistorical } from '../context/HistoricalContext';
import { api } from '../services/api';
import { CHART_TIME_PRESETS, getWindowFromPreset, formatWindowRange } from '../utils/timeWindow';
import { aggregateConsumptionByInterval, bucketMsForPreset } from '../utils/chartAggregation';
import { Calendar, ChevronLeft, ChevronRight, Table, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const chartTooltip = { backgroundColor: '#ffffff', border: '1px solid #dce5f2', borderRadius: '8px', fontSize: '12px' };

export default function HistoricalPage() {
  const { selectedDevice } = useDevice();
  const [tab, setTab] = useState('consumption');
  const {
    chartPreset,
    setChartPreset,
    tableData,
    page,
    setPage,
    rangeData,
    rangeFilter,
    setRangeFilter,
    applyRange,
    loadingTable,
    loadingRange
  } = useHistorical();

  const [chartRows, setChartRows] = useState([]);
  const [consumptionBars, setConsumptionBars] = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);

  const chartWindow = useMemo(() => getWindowFromPreset(chartPreset), [chartPreset]);
  const chartWindowLabel = formatWindowRange(chartWindow.from, chartWindow.to);

  useEffect(() => {
    let cancelled = false;
    if (!selectedDevice || (tab !== 'consumption' && tab !== 'voltage')) {
      setChartRows([]);
      setConsumptionBars([]);
      return;
    }
    (async () => {
      setLoadingChart(true);
      try {
        const res = await api.getRange(
          selectedDevice,
          chartWindow.from ?? undefined,
          chartWindow.to ?? undefined
        );
        const rows = res.data?.data ?? [];
        if (cancelled) return;
        setChartRows(rows);
        const bucketMs = bucketMsForPreset(chartPreset, rows);
        setConsumptionBars(aggregateConsumptionByInterval(rows, bucketMs));
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setChartRows([]);
          setConsumptionBars([]);
        }
      } finally {
        if (!cancelled) setLoadingChart(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDevice, chartPreset, tab, chartWindow.from, chartWindow.to]);

  const tabs = [
    { key: 'consumption', label: 'Consumption', icon: BarChart3 },
    { key: 'voltage', label: 'Voltage Trends', icon: BarChart3 },
    { key: 'table', label: 'Raw Data', icon: Table },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Historical Data</h2>
        <p className="text-grid-400 text-sm mt-1">{selectedDevice} — accumulated readings from MQTT</p>
      </div>

      {/* Date range filter — raw table */}
      <div className="glass-panel p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-grid-500 font-semibold mb-1">From</label>
          <input type="datetime-local" value={rangeFilter.from} onChange={(e) => setRangeFilter((prev) => ({ ...prev, from: e.target.value }))}
            className="bg-grid-900 border border-grid-700 text-slate-800 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-electric/50" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-grid-500 font-semibold mb-1">To</label>
          <input type="datetime-local" value={rangeFilter.to} onChange={(e) => setRangeFilter((prev) => ({ ...prev, to: e.target.value }))}
            className="bg-grid-900 border border-grid-700 text-slate-800 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-electric/50" />
        </div>
        <button onClick={applyRange}
          className="px-4 py-2 bg-cyan-electric/10 border border-cyan-electric/20 text-cyan-electric rounded-lg text-sm font-semibold hover:bg-cyan-electric/20 transition-colors flex items-center gap-2 cursor-pointer">
          <Calendar size={14} /> Load table range
        </button>
        {loadingRange ? <span className="text-grid-400 text-xs">Filtering...</span> : <span className="text-grid-400 text-xs">{rangeData.count} readings in table range</span>}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-grid-700/50 pb-0">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 cursor-pointer ${
              tab === t.key ? 'bg-grid-800 text-cyan-electric border border-grid-700 border-b-0' : 'text-grid-400 hover:text-slate-900'
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Presets for chart tabs */}
      {(tab === 'consumption' || tab === 'voltage') && (
        <div className="glass-panel p-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-grid-500 font-semibold mr-2">Chart window</span>
          {CHART_TIME_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setChartPreset(p.id)}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${
                chartPreset === p.id ? 'bg-cyan-electric/10 text-cyan-electric border border-cyan-electric/30' : 'text-grid-500 border border-transparent hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
          {!loadingChart && (
            <span className="text-xs text-grid-500 ml-auto">
              {chartRows.length} readings{chartWindowLabel ? ` · ${chartWindowLabel}` : ''}
            </span>
          )}
        </div>
      )}

      {/* TAB: Consumption Chart */}
      {tab === 'consumption' && (
        <div className="glass-panel p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider">Energy consumption (ΔkWh per bucket)</h3>
          </div>
          {loadingChart ? <p className="text-grid-400 text-sm">Loading chart…</p> : null}
          <div className="w-full min-w-[280px]" style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height={350} minWidth={200} initialDimension={{ width: 400, height: 350 }}>
              <BarChart data={consumptionBars}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dce5f2" />
                <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: '#64748b' }} angle={-45} textAnchor="end" height={60} tickFormatter={(v) => new Date(v).toLocaleString()} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={chartTooltip} labelFormatter={(v) => new Date(v).toLocaleString()} formatter={(v) => [`${Number(v).toFixed(4)} kWh`, 'Consumed']} />
                <Bar dataKey="consumedKwh" fill="#00e5ff" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {!loadingChart && consumptionBars.length === 0 && (
            <p className="text-center text-grid-500 text-sm mt-4">No readings in this window yet.</p>
          )}
        </div>
      )}

      {/* TAB: Voltage Trends */}
      {tab === 'voltage' && (
        <div className="glass-panel p-6 animate-fade-in">
          <h3 className="text-sm font-semibold text-grid-400 uppercase tracking-wider mb-4">Per-phase voltage</h3>
          {loadingChart ? <p className="text-grid-400 text-sm">Loading chart…</p> : null}
          <div className="w-full min-w-[280px]" style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height={350} minWidth={200} initialDimension={{ width: 400, height: 350 }}>
              <LineChart data={chartRows}>
                {chartRows.length > 0 ? (
                  <>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dce5f2" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => new Date(v).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={chartTooltip} labelFormatter={(l) => new Date(l).toLocaleString()} />
                    <Legend />
                    <Line type="monotone" dataKey="va" stroke="#00e5ff" dot={false} strokeWidth={1.5} name="V(A)" />
                    <Line type="monotone" dataKey="vb" stroke="#7c4dff" dot={false} strokeWidth={1.5} name="V(B)" />
                    <Line type="monotone" dataKey="vc" stroke="#ff9100" dot={false} strokeWidth={1.5} name="V(C)" />
                  </>
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {!loadingChart && chartRows.length === 0 && (
            <p className="text-center text-grid-500 text-sm mt-4">No readings in this window yet.</p>
          )}
        </div>
      )}

      {/* TAB: Raw Data Table */}
      {tab === 'table' && tableData && (
        <div className="glass-panel overflow-hidden animate-fade-in">
          {loadingTable ? <p className="px-4 py-3 text-grid-400 text-sm">Loading table...</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-grid-700/50 bg-grid-800/50">
                  {['Time', 'E(kWh)', 'AP(W)', 'PF', 'F(Hz)', 'VA', 'VB', 'VC', 'CA', 'CB', 'CC', 'RP(VAR)'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-grid-400 uppercase tracking-wider font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.data.map((r, i) => (
                  <tr key={i} className="border-b border-grid-700/30 hover:bg-grid-800/30 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap text-grid-300 data-readout">{new Date(r.bucket).toLocaleString()}</td>
                    <td className="px-3 py-2.5 data-readout">{r.e.toFixed(2)}</td>
                    <td className="px-3 py-2.5 data-readout font-semibold text-cyan-electric">{r.ap.toFixed(1)}</td>
                    <td className={`px-3 py-2.5 data-readout font-semibold ${r.pf < 0.85 ? 'text-red-alarm' : 'text-green-ok'}`}>{r.pf.toFixed(4)}</td>
                    <td className="px-3 py-2.5 data-readout">{r.f.toFixed(3)}</td>
                    <td className="px-3 py-2.5 data-readout text-phase-a">{r.va.toFixed(1)}</td>
                    <td className="px-3 py-2.5 data-readout text-phase-b">{r.vb.toFixed(1)}</td>
                    <td className="px-3 py-2.5 data-readout text-phase-c">{r.vc.toFixed(1)}</td>
                    <td className="px-3 py-2.5 data-readout text-phase-a">{r.ca.toFixed(3)}</td>
                    <td className="px-3 py-2.5 data-readout text-phase-b">{r.cb.toFixed(3)}</td>
                    <td className="px-3 py-2.5 data-readout text-phase-c">{r.cc.toFixed(3)}</td>
                    <td className="px-3 py-2.5 data-readout">{r.rp.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-grid-700/50">
            <span className="text-grid-400 text-xs">Page {tableData.page} of {tableData.totalPages} ({tableData.total} total)</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg bg-grid-800 border border-grid-700 text-grid-400 hover:text-slate-900 disabled:opacity-30 cursor-pointer">
                <ChevronLeft size={16} />
              </button>
              <button disabled={page >= tableData.totalPages} onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg bg-grid-800 border border-grid-700 text-grid-400 hover:text-slate-900 disabled:opacity-30 cursor-pointer">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
