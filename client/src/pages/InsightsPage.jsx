import { useEffect, useMemo, useState } from 'react';
import { useDevice } from '../context/DeviceContext';
import { useInsights } from '../context/InsightsContext';
import { api } from '../services/api';
import { CHART_TIME_PRESETS, getWindowFromPreset } from '../utils/timeWindow';
import { InsightMiniChart, InsightHourlyBarChart, percentileHighAp } from '../components/InsightMiniChart';
import {
  TrendingUp, DollarSign, Gauge, AlertTriangle, Zap, Radio, Activity, BarChart3, Waves, Target, X
} from 'lucide-react';

function InsightCard({ title, icon, color = '#00e5ff', loading, children }) {
  const SvgIcon = icon;
  return (
    <div className="glass-panel glass-panel-hover p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <SvgIcon size={16} style={{ color }} />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-grid-500 text-sm py-4">
          <div className="w-4 h-4 border-2 border-grid-500 border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      ) : children}
    </div>
  );
}

function MetricRow({ label, value, unit, warn }) {
  return (
    <div className="flex justify-between items-baseline py-1.5">
      <span className="text-grid-400 text-sm">{label}</span>
      <span className={`data-readout font-semibold ${warn ? 'text-red-alarm' : 'text-slate-900'}`}>
        {value} {unit && <span className="text-xs text-grid-500">{unit}</span>}
      </span>
    </div>
  );
}

function percentileHighByKey(rows, key, p = 0.92) {
  const vals = rows.map((r) => r[key]).filter((v) => Number.isFinite(v));
  if (!vals.length) return () => false;
  const sorted = [...vals].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  const thr = sorted[idx];
  return (r) => Number.isFinite(r[key]) && r[key] >= thr;
}

function rowTimeMs(r) {
  const raw = r.bucket ?? r.timestamp;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? NaN : t;
}

export default function InsightsPage() {
  const { selectedDevice } = useDevice();
  const {
    insights,
    loading,
    unitPrice,
    setUnitPrice,
    ratedCapacity,
    setRatedCapacity,
    timePreset,
    setTimePreset,
    windowLabel,
  } = useInsights();

  const [recent, setRecent] = useState([]);
  const [chartExpand, setChartExpand] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!selectedDevice) {
      setRecent([]);
      return;
    }
    const win = getWindowFromPreset(timePreset);
    (async () => {
      try {
        const res = await api.getRange(
          selectedDevice,
          win.from ?? undefined,
          win.to ?? undefined
        );
        const rows = res.data?.data ?? [];
        if (!cancelled) setRecent(rows);
      } catch (e) {
        console.error(e);
        if (!cancelled) setRecent([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDevice, timePreset]);

  const anomalyTimeMs = useMemo(() => {
    const ev = insights.anomalies?.events;
    if (!ev?.length) return new Set();
    return new Set(ev.map((e) => new Date(e.timestamp).getTime()));
  }, [insights.anomalies]);

  const highAp = useMemo(() => percentileHighAp(recent, 0.92), [recent]);
  const highRp = useMemo(() => percentileHighByKey(recent, 'rp', 0.9), [recent]);

  const peakTs = insights.peakDemand?.timestamp;
  const peakMs = peakTs ? new Date(peakTs).getTime() : NaN;
  const peakNear = (r) => Number.isFinite(peakMs) && Math.abs(rowTimeMs(r) - peakMs) < 3000;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Insights</h2>
        <p className="text-grid-400 text-sm mt-1">{selectedDevice} — Real-time analytical deep-dive (computed from live accumulated data)</p>
      </div>

      <div className="glass-panel p-4 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-grid-500 font-semibold mr-2">Time window</span>
        {CHART_TIME_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setTimePreset(p.id)}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${
              timePreset === p.id ? 'bg-cyan-electric/10 text-cyan-electric border border-cyan-electric/30' : 'text-grid-500 border border-transparent hover:text-slate-900'
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="text-xs text-grid-500 ml-auto">{windowLabel}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

        <InsightCard title="Peak Demand" icon={TrendingUp} color="#ffab00" loading={loading}>
          {insights.peakDemand && <>
            <MetricRow label="Peak Active Power" value={insights.peakDemand.peakApW?.toLocaleString()} unit="W" />
            <MetricRow label="Timestamp" value={new Date(insights.peakDemand.timestamp).toLocaleString()} />
            {recent.length > 0 && (
              <InsightMiniChart
                series={recent}
                yKey="ap"
                color="#ffab00"
                yLabel="W"
                highlight={(r) => peakNear(r) || highAp(r)}
                onExpand={() =>
                  setChartExpand({
                    kind: 'line',
                    title: 'Peak demand — active power',
                    series: recent,
                    yKey: 'ap',
                    color: '#ffab00',
                    yLabel: 'W',
                    highlight: (r) => peakNear(r) || highAp(r),
                  })
                }
              />
            )}
          </>}
        </InsightCard>

        <InsightCard title="Energy Cost" icon={DollarSign} color="#00e676" loading={loading}>
          <div className="mb-3">
            <label className="block text-[10px] uppercase tracking-widest text-grid-500 font-semibold mb-1">Unit Price ($/kWh)</label>
            <input type="number" step="0.01" min="0" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))}
              className="w-full bg-grid-900 border border-grid-700 text-slate-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-electric/50 data-readout" />
          </div>
          {insights.energyCost && <>
            <MetricRow label="Consumed" value={insights.energyCost.consumedKwh?.toFixed(2)} unit="kWh" />
            <MetricRow label="Total Cost" value={`$${insights.energyCost.totalCost?.toFixed(2)}`} />
            <p className="text-[10px] text-grid-500 mt-2">{new Date(insights.energyCost.periodStart).toLocaleDateString()} → {new Date(insights.energyCost.periodEnd).toLocaleDateString()}</p>
            {recent.length > 0 && (
              <InsightMiniChart
                series={recent}
                yKey="e"
                color="#00e676"
                yLabel="kWh"
                highlight={(r) => highAp(r)}
                onExpand={() =>
                  setChartExpand({
                    kind: 'line',
                    title: 'Energy cost context — cumulative kWh',
                    series: recent,
                    yKey: 'e',
                    color: '#00e676',
                    yLabel: 'kWh',
                    highlight: (r) => highAp(r),
                  })
                }
              />
            )}
          </>}
        </InsightCard>

        <InsightCard title="Power Factor" icon={Gauge} color="#00e5ff" loading={loading}>
          {insights.powerFactor && <>
            <MetricRow label="Average PF" value={insights.powerFactor.avgPf?.toFixed(4)} warn={insights.powerFactor.avgPf < 0.85} />
            <MetricRow label="Min PF" value={insights.powerFactor.minPf?.toFixed(4)} warn={insights.powerFactor.minPf < 0.85} />
            <MetricRow label="Max PF" value={insights.powerFactor.maxPf?.toFixed(4)} />
            <MetricRow label="Low PF Events (<0.85)" value={insights.powerFactor.lowPfCount} warn={insights.powerFactor.lowPfCount > 0} />
            {recent.length > 0 && (
              <InsightMiniChart
                series={recent}
                yKey="pf"
                color="#00e5ff"
                highlight={(r) => r.pf < 0.85}
                onExpand={() =>
                  setChartExpand({
                    kind: 'line',
                    title: 'Power factor',
                    series: recent,
                    yKey: 'pf',
                    color: '#00e5ff',
                    yLabel: 'PF',
                    highlight: (r) => r.pf < 0.85,
                  })
                }
              />
            )}
          </>}
        </InsightCard>

        <InsightCard title="Phase Imbalance" icon={Activity} color="#7c4dff" loading={loading}>
          {insights.phaseImbalance && <>
            <MetricRow label="Avg Imbalance" value={`${insights.phaseImbalance.avgImbalancePercent?.toFixed(2)}%`} />
            <MetricRow label="Max Imbalance" value={`${insights.phaseImbalance.maxImbalancePercent?.toFixed(2)}%`} warn={insights.phaseImbalance.maxImbalancePercent > 10} />
            <MetricRow label="High Imbalance Events (>10%)" value={insights.phaseImbalance.highImbalanceCount} warn={insights.phaseImbalance.highImbalanceCount > 0} />
            {insights.phaseImbalance.timeline?.length > 0 && (
              <InsightMiniChart
                series={insights.phaseImbalance.timeline}
                yKey="imbalancePercent"
                color="#7c4dff"
                yLabel="%"
                highlight={(r) => r.imbalancePercent > 10}
                onExpand={() =>
                  setChartExpand({
                    kind: 'line',
                    title: 'Phase imbalance',
                    series: insights.phaseImbalance.timeline,
                    yKey: 'imbalancePercent',
                    color: '#7c4dff',
                    yLabel: '%',
                    highlight: (r) => r.imbalancePercent > 10,
                  })
                }
              />
            )}
          </>}
        </InsightCard>

        <InsightCard title="Voltage Stability" icon={Zap} color="#ff9100" loading={loading}>
          {insights.voltageStability && <>
            <p className="text-[10px] text-grid-500 mb-2">Nominal: {insights.voltageStability.nominalVoltage}V</p>
            {['va', 'vb', 'vc'].map((phase) => (
              <MetricRow key={phase}
                label={`${phase.toUpperCase()} avg`}
                value={`${insights.voltageStability[phase]?.avg?.toFixed(2)}V ±${insights.voltageStability[phase]?.stdDev?.toFixed(2)}`}
                warn={Math.abs(insights.voltageStability[phase]?.avg - insights.voltageStability.nominalVoltage) > 10}
              />
            ))}
            {recent.length > 0 && (
              <InsightMiniChart
                series={recent.map((r) => ({
                  bucket: r.bucket,
                  vavg: (r.va + r.vb + r.vc) / 3
                }))}
                yKey="vavg"
                color="#ff9100"
                yLabel="V"
                highlight={(r) => {
                  const row = recent.find((x) => x.bucket === r.bucket);
                  if (!row) return false;
                  const v = [row.va, row.vb, row.vc];
                  const spread = Math.max(...v) - Math.min(...v);
                  return spread > 10 || Math.min(...v) < 210 || Math.max(...v) > 245;
                }}
                onExpand={() =>
                  setChartExpand({
                    kind: 'line',
                    title: 'Voltage stability — average phase voltage',
                    series: recent.map((r) => ({ bucket: r.bucket, vavg: (r.va + r.vb + r.vc) / 3 })),
                    yKey: 'vavg',
                    color: '#ff9100',
                    yLabel: 'V',
                    highlight: (r) => {
                      const row = recent.find((x) => x.bucket === r.bucket);
                      if (!row) return false;
                      const v = [row.va, row.vb, row.vc];
                      const spread = Math.max(...v) - Math.min(...v);
                      return spread > 10 || Math.min(...v) < 210 || Math.max(...v) > 245;
                    },
                  })
                }
              />
            )}
          </>}
        </InsightCard>

        <InsightCard title="Reactive Power" icon={Waves} color="#ff1744" loading={loading}>
          {insights.reactivePower && <>
            <MetricRow label="Avg Reactive Power" value={insights.reactivePower.avgRp?.toFixed(2)} unit="VAR" />
            <MetricRow label="Max Reactive Power" value={insights.reactivePower.maxRp?.toFixed(2)} unit="VAR" />
            <MetricRow label="High Load Periods" value={insights.reactivePower.highReactivePeriods?.length || 0} warn={(insights.reactivePower.highReactivePeriods?.length || 0) > 10} />
            {recent.length > 0 && (
              <InsightMiniChart
                series={recent}
                yKey="rp"
                color="#ff1744"
                yLabel="VAR"
                highlight={(r) => highRp(r) || (Number.isFinite(r.pf) && r.pf < 0.85 && r.rp > (r.ap || 0) * 0.2)}
                onExpand={() =>
                  setChartExpand({
                    kind: 'line',
                    title: 'Reactive power',
                    series: recent,
                    yKey: 'rp',
                    color: '#ff1744',
                    yLabel: 'VAR',
                    highlight: (r) => highRp(r) || (Number.isFinite(r.pf) && r.pf < 0.85 && r.rp > (r.ap || 0) * 0.2),
                  })
                }
              />
            )}
          </>}
        </InsightCard>

        <InsightCard title="Frequency Stability" icon={Radio} color="#00bcd4" loading={loading}>
          {insights.frequencyStability && <>
            <MetricRow label="Avg Frequency" value={insights.frequencyStability.avgFrequency?.toFixed(4)} unit="Hz" />
            <MetricRow label="Std Dev" value={insights.frequencyStability.stdDevFrequency?.toFixed(4)} unit="Hz" />
            <MetricRow label="Min / Max" value={`${insights.frequencyStability.minFrequency} / ${insights.frequencyStability.maxFrequency}`} unit="Hz" />
            <MetricRow label="Out of Band (±0.2Hz)" value={insights.frequencyStability.outOfBandCount} warn={insights.frequencyStability.outOfBandCount > 0} />
            {recent.length > 0 && (
              <InsightMiniChart
                series={recent}
                yKey="f"
                color="#00bcd4"
                yLabel="Hz"
                highlight={(r) => r.f < 49.5 || r.f > 50.5 || Math.abs(r.f - 50) > 0.2}
                onExpand={() =>
                  setChartExpand({
                    kind: 'line',
                    title: 'Frequency',
                    series: recent,
                    yKey: 'f',
                    color: '#00bcd4',
                    yLabel: 'Hz',
                    highlight: (r) => r.f < 49.5 || r.f > 50.5 || Math.abs(r.f - 50) > 0.2,
                  })
                }
              />
            )}
          </>}
        </InsightCard>

        <InsightCard title="Anomalies" icon={AlertTriangle} color="#ff1744" loading={loading}>
          {insights.anomalies && <>
            <MetricRow label="Total Events" value={insights.anomalies.totalEvents} warn={insights.anomalies.totalEvents > 50} />
            {insights.anomalies.summary && Object.entries(insights.anomalies.summary).map(([type, count]) => (
              <MetricRow key={type} label={type.replace(/_/g, ' ')} value={count} warn={count > 10} />
            ))}
            {recent.length > 0 && (
              <InsightMiniChart
                series={recent}
                yKey="ap"
                color="#ff1744"
                yLabel="W"
                highlight={(r) => anomalyTimeMs.has(rowTimeMs(r)) || highAp(r)}
                onExpand={() =>
                  setChartExpand({
                    kind: 'line',
                    title: 'Anomalies — active power',
                    series: recent,
                    yKey: 'ap',
                    color: '#ff1744',
                    yLabel: 'W',
                    highlight: (r) => anomalyTimeMs.has(rowTimeMs(r)) || highAp(r),
                  })
                }
              />
            )}
          </>}
        </InsightCard>

        <InsightCard title="Load Profile" icon={BarChart3} color="#ffab00" loading={loading}>
          {insights.loadProfile && <>
            <MetricRow label="Avg Demand" value={insights.loadProfile.avgDemandW?.toFixed(1)} unit="W" />
            <MetricRow label="Max Demand" value={insights.loadProfile.maxDemandW?.toFixed(1)} unit="W" />
            <MetricRow label="Min Demand" value={insights.loadProfile.minDemandW?.toFixed(1)} unit="W" />
            <p className="text-[10px] text-grid-500 font-semibold mt-3 uppercase">Top 5 Demand Moments</p>
            {insights.loadProfile.top5DemandMoments?.map((m, i) => (
              <MetricRow key={i} label={new Date(m.timestamp).toLocaleString()} value={m.ap?.toFixed(0)} unit="W" />
            ))}
            {recent.length > 0 && (
              <InsightMiniChart
                series={recent}
                yKey="ap"
                color="#ffab00"
                yLabel="W"
                highlight={(r) => highAp(r)}
                onExpand={() =>
                  setChartExpand({
                    kind: 'line',
                    title: 'Load profile — active power',
                    series: recent,
                    yKey: 'ap',
                    color: '#ffab00',
                    yLabel: 'W',
                    highlight: (r) => highAp(r),
                  })
                }
              />
            )}
          </>}
        </InsightCard>

        <InsightCard title="THD Estimate" icon={Waves} color="#e040fb" loading={loading}>
          {insights.harmonicDistortion && <>
            <MetricRow label="Avg THD" value={`${insights.harmonicDistortion.avgThdPercent?.toFixed(2)}%`} />
            <MetricRow label="Max THD" value={`${insights.harmonicDistortion.maxThdPercent?.toFixed(2)}%`} warn={insights.harmonicDistortion.maxThdPercent > 20} />
            <MetricRow label="High THD Periods (>20%)" value={insights.harmonicDistortion.highThdPeriods} warn={insights.harmonicDistortion.highThdPeriods > 0} />
            <p className="text-[10px] text-grid-500 mt-2 italic">{insights.harmonicDistortion.note}</p>
            {insights.harmonicDistortion.timeline?.length > 0 && (
              <InsightMiniChart
                series={insights.harmonicDistortion.timeline}
                yKey="thdEstimatePercent"
                color="#e040fb"
                yLabel="%"
                highlight={(r) => r.thdEstimatePercent > 20}
                onExpand={() =>
                  setChartExpand({
                    kind: 'line',
                    title: 'THD estimate',
                    series: insights.harmonicDistortion.timeline,
                    yKey: 'thdEstimatePercent',
                    color: '#e040fb',
                    yLabel: '%',
                    highlight: (r) => r.thdEstimatePercent > 20,
                  })
                }
              />
            )}
          </>}
        </InsightCard>

        <InsightCard title="Daily Load Curve" icon={BarChart3} color="#7c4dff" loading={loading}>
          {insights.dailyLoadCurve && <>
            <MetricRow
              label="Peak Hour (UTC)"
              value={insights.dailyLoadCurve.peakHourUTC == null ? '—' : `${String(insights.dailyLoadCurve.peakHourUTC).padStart(2, '0')}:00`}
            />
            <MetricRow label="Peak Avg Demand" value={insights.dailyLoadCurve.peakAvgDemandW?.toFixed(1)} unit="W" />
            <MetricRow
              label="Off-Peak Hour (UTC)"
              value={insights.dailyLoadCurve.offPeakHourUTC == null ? '—' : `${String(insights.dailyLoadCurve.offPeakHourUTC).padStart(2, '0')}:00`}
            />
            <MetricRow label="Off-Peak Avg Demand" value={insights.dailyLoadCurve.offPeakAvgDemandW?.toFixed(1)} unit="W" />
            <InsightHourlyBarChart
              dailyLoadCurve={insights.dailyLoadCurve}
              onExpand={() =>
                setChartExpand({
                  kind: 'bar',
                  title: 'Daily load curve (UTC hours)',
                  dailyLoadCurve: insights.dailyLoadCurve,
                })
              }
            />
          </>}
        </InsightCard>

        <InsightCard title="Capacity Utilization" icon={Target} color="#00e676" loading={loading}>
          <div className="mb-3">
            <label className="block text-[10px] uppercase tracking-widest text-grid-500 font-semibold mb-1">Rated Capacity (W)</label>
            <input type="number" min="1" value={ratedCapacity} onChange={(e) => setRatedCapacity(Number(e.target.value))}
              className="w-full bg-grid-900 border border-grid-700 text-slate-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-electric/50 data-readout" />
          </div>
          {insights.capacityUtilization && <>
            <MetricRow label="Rated Capacity" value={insights.capacityUtilization.ratedCapacityW?.toLocaleString()} unit="W" />
            <MetricRow label="Avg Utilization" value={`${insights.capacityUtilization.avgUtilizationPercent}%`} />
            <MetricRow label="Peak Utilization" value={`${insights.capacityUtilization.peakUtilizationPercent}%`} warn={insights.capacityUtilization.peakUtilizationPercent > 100} />
            <MetricRow label="Over-Capacity Events" value={insights.capacityUtilization.overCapacityEvents} warn={insights.capacityUtilization.overCapacityEvents > 0} />
            {recent.length > 0 && (
              <InsightMiniChart
                series={recent}
                yKey="ap"
                color="#00e676"
                yLabel="W"
                highlight={(r) => Number.isFinite(r.ap) && r.ap >= ratedCapacity * 0.85}
                onExpand={() =>
                  setChartExpand({
                    kind: 'line',
                    title: 'Capacity — active power vs headroom',
                    series: recent,
                    yKey: 'ap',
                    color: '#00e676',
                    yLabel: 'W',
                    highlight: (r) => Number.isFinite(r.ap) && r.ap >= ratedCapacity * 0.85,
                  })
                }
              />
            )}
          </>}
        </InsightCard>
      </div>

      {chartExpand ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-sm"
          onClick={() => setChartExpand(null)}
          role="presentation"
        >
          <div
            className="glass-panel max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-grid-700/60"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={chartExpand.title}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <h3 className="text-lg font-bold text-slate-900">{chartExpand.title}</h3>
              <button
                type="button"
                onClick={() => setChartExpand(null)}
                className="p-2 rounded-lg border border-grid-700 text-grid-500 hover:text-slate-900 hover:bg-grid-800/50 cursor-pointer"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            {chartExpand.kind === 'line' ? (
              <InsightMiniChart
                series={chartExpand.series}
                yKey={chartExpand.yKey}
                color={chartExpand.color}
                yLabel={chartExpand.yLabel}
                height={400}
                highlight={chartExpand.highlight}
              />
            ) : (
              <InsightHourlyBarChart dailyLoadCurve={chartExpand.dailyLoadCurve} height={360} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
