import { useDevice } from '../context/DeviceContext';
import { useInsights } from '../context/InsightsContext';
import {
  TrendingUp, DollarSign, Gauge, AlertTriangle, Zap, Radio, Activity, BarChart3, Waves, Target
} from 'lucide-react';

function InsightCard({ title, icon: Icon, color = '#00e5ff', loading, children }) {
  return (
    <div className="glass-panel glass-panel-hover p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <Icon size={16} style={{ color }} />
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

export default function InsightsPage() {
  const { selectedDevice } = useDevice();
  const {
    insights,
    loading,
    unitPrice,
    setUnitPrice,
    ratedCapacity,
    setRatedCapacity
  } = useInsights();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Insights</h2>
        <p className="text-grid-400 text-sm mt-1">{selectedDevice} — Analytical deep-dive</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

        {/* Peak Demand */}
        <InsightCard title="Peak Demand" icon={TrendingUp} color="#ffab00" loading={loading}>
          {insights.peakDemand && <>
            <MetricRow label="Peak Active Power" value={insights.peakDemand.peakApW?.toLocaleString()} unit="W" />
            <MetricRow label="Timestamp" value={new Date(insights.peakDemand.timestamp).toLocaleString()} />
          </>}
        </InsightCard>

        {/* Energy Cost */}
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
          </>}
        </InsightCard>

        {/* Power Factor */}
        <InsightCard title="Power Factor" icon={Gauge} color="#00e5ff" loading={loading}>
          {insights.powerFactor && <>
            <MetricRow label="Average PF" value={insights.powerFactor.avgPf?.toFixed(4)} warn={insights.powerFactor.avgPf < 0.85} />
            <MetricRow label="Min PF" value={insights.powerFactor.minPf?.toFixed(4)} warn={insights.powerFactor.minPf < 0.85} />
            <MetricRow label="Max PF" value={insights.powerFactor.maxPf?.toFixed(4)} />
            <MetricRow label="Low PF Events (<0.85)" value={insights.powerFactor.lowPfCount} warn={insights.powerFactor.lowPfCount > 0} />
          </>}
        </InsightCard>

        {/* Phase Imbalance */}
        <InsightCard title="Phase Imbalance" icon={Activity} color="#7c4dff" loading={loading}>
          {insights.phaseImbalance && <>
            <MetricRow label="Avg Imbalance" value={`${insights.phaseImbalance.avgImbalancePercent?.toFixed(2)}%`} />
            <MetricRow label="Max Imbalance" value={`${insights.phaseImbalance.maxImbalancePercent?.toFixed(2)}%`} warn={insights.phaseImbalance.maxImbalancePercent > 10} />
            <MetricRow label="High Imbalance Events (>10%)" value={insights.phaseImbalance.highImbalanceCount} warn={insights.phaseImbalance.highImbalanceCount > 0} />
          </>}
        </InsightCard>

        {/* Voltage Stability */}
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
          </>}
        </InsightCard>

        {/* Reactive Power */}
        <InsightCard title="Reactive Power" icon={Waves} color="#ff1744" loading={loading}>
          {insights.reactivePower && <>
            <MetricRow label="Avg Reactive Power" value={insights.reactivePower.avgRp?.toFixed(2)} unit="VAR" />
            <MetricRow label="Max Reactive Power" value={insights.reactivePower.maxRp?.toFixed(2)} unit="VAR" />
            <MetricRow label="High Load Periods" value={insights.reactivePower.highReactivePeriods?.length || 0} warn={(insights.reactivePower.highReactivePeriods?.length || 0) > 10} />
          </>}
        </InsightCard>

        {/* Frequency Stability */}
        <InsightCard title="Frequency Stability" icon={Radio} color="#00bcd4" loading={loading}>
          {insights.frequencyStability && <>
            <MetricRow label="Avg Frequency" value={insights.frequencyStability.avgFrequency?.toFixed(4)} unit="Hz" />
            <MetricRow label="Std Dev" value={insights.frequencyStability.stdDevFrequency?.toFixed(4)} unit="Hz" />
            <MetricRow label="Min / Max" value={`${insights.frequencyStability.minFrequency} / ${insights.frequencyStability.maxFrequency}`} unit="Hz" />
            <MetricRow label="Out of Band (±0.2Hz)" value={insights.frequencyStability.outOfBandCount} warn={insights.frequencyStability.outOfBandCount > 0} />
          </>}
        </InsightCard>

        {/* Anomalies */}
        <InsightCard title="Anomalies" icon={AlertTriangle} color="#ff1744" loading={loading}>
          {insights.anomalies && <>
            <MetricRow label="Total Events" value={insights.anomalies.totalEvents} warn={insights.anomalies.totalEvents > 50} />
            {insights.anomalies.summary && Object.entries(insights.anomalies.summary).map(([type, count]) => (
              <MetricRow key={type} label={type.replace(/_/g, ' ')} value={count} warn={count > 10} />
            ))}
          </>}
        </InsightCard>

        {/* Load Profile */}
        <InsightCard title="Load Profile" icon={BarChart3} color="#ffab00" loading={loading}>
          {insights.loadProfile && <>
            <MetricRow label="Avg Demand" value={insights.loadProfile.avgDemandW?.toFixed(1)} unit="W" />
            <MetricRow label="Max Demand" value={insights.loadProfile.maxDemandW?.toFixed(1)} unit="W" />
            <MetricRow label="Min Demand" value={insights.loadProfile.minDemandW?.toFixed(1)} unit="W" />
            <p className="text-[10px] text-grid-500 font-semibold mt-3 uppercase">Top 5 Demand Moments</p>
            {insights.loadProfile.top5DemandMoments?.map((m, i) => (
              <MetricRow key={i} label={new Date(m.timestamp).toLocaleString()} value={m.ap?.toFixed(0)} unit="W" />
            ))}
          </>}
        </InsightCard>

        {/* Harmonic Distortion */}
        <InsightCard title="THD Estimate" icon={Waves} color="#e040fb" loading={loading}>
          {insights.harmonicDistortion && <>
            <MetricRow label="Avg THD" value={`${insights.harmonicDistortion.avgThdPercent?.toFixed(2)}%`} />
            <MetricRow label="Max THD" value={`${insights.harmonicDistortion.maxThdPercent?.toFixed(2)}%`} warn={insights.harmonicDistortion.maxThdPercent > 20} />
            <MetricRow label="High THD Periods (>20%)" value={insights.harmonicDistortion.highThdPeriods} warn={insights.harmonicDistortion.highThdPeriods > 0} />
            <p className="text-[10px] text-grid-500 mt-2 italic">{insights.harmonicDistortion.note}</p>
          </>}
        </InsightCard>

        {/* Daily Load Curve */}
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
          </>}
        </InsightCard>

        {/* Capacity Utilization */}
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
          </>}
        </InsightCard>
      </div>
    </div>
  );
}
