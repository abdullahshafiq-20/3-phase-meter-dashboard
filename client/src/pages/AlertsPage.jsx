import { useMemo, useState } from 'react';
import { useDevice } from '../context/DeviceContext';
import { useAlerts } from '../context/AlertsContext';
import { CHART_TIME_PRESETS } from '../utils/timeWindow';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { Bell, Activity, Radio, RefreshCw, ChevronDown } from 'lucide-react';

function severityStyle(sev) {
  if (sev === 'critical') return 'bg-red-alarm/15 text-red-alarm border-red-alarm/30';
  if (sev === 'warning') return 'bg-amber-500/15 text-amber-800 border-amber-500/30';
  return 'bg-slate-200/80 text-slate-700 border-slate-300';
}

function formatTs(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function ConsumerAlertCard({ alert, timeLabel }) {
  const sev = alert.severity || 'info';
  return (
    <li className={`rounded-xl border px-4 py-3 list-none ${severityStyle(sev)}`}>
      <div className="flex flex-wrap items-center gap-2 gap-y-1 mb-1">
        {timeLabel && <span className="text-[10px] text-grid-500 font-medium">{timeLabel}</span>}
        <span className={`text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded ${severityStyle(sev)}`}>
          {sev === 'critical' ? 'Needs action' : sev === 'warning' ? 'Watch closely' : 'FYI'}
        </span>
      </div>
      <p className="text-base font-semibold text-slate-900 leading-snug">{alert.plainTitle || alert.message}</p>
      <p className="text-sm text-slate-600 mt-2 leading-relaxed">{alert.plainSummary || alert.message}</p>
      {alert.whatYouCanDo && (
        <p className="text-sm text-slate-700 mt-3 pl-3 border-l-2 border-cyan-electric/50 leading-relaxed">
          <span className="font-semibold text-slate-800">What you can do: </span>
          {alert.whatYouCanDo}
        </p>
      )}
      <p className="text-[10px] text-grid-500 mt-2 font-mono">
        Reference: {alert.code}
      </p>
    </li>
  );
}

function CollapsePanel({ id, title, subtitle, defaultOpen, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-xl border border-grid-700/50 overflow-hidden bg-grid-900/20">
      <button
        type="button"
        id={`${id}-btn`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-grid-900/40 transition-colors cursor-pointer"
      >
        <span>
          <span className="text-sm font-semibold text-slate-900 block">{title}</span>
          {subtitle && <span className="text-xs text-grid-500 mt-0.5 block">{subtitle}</span>}
        </span>
        <ChevronDown className={`w-5 h-5 text-grid-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-btn`} className="px-4 pb-4 border-t border-grid-700/30">
          {children}
        </div>
      )}
    </div>
  );
}

export default function AlertsPage() {
  const { selectedDevice } = useDevice();
  const {
    ratedCapacity,
    setRatedCapacity,
    timelinePreset,
    setTimelinePreset,
    timelineWindowLabel,
    timeline,
    live,
    loading,
    liveLoading,
    error,
    loadTimeline,
    pollLive
  } = useAlerts();

  const chartData = useMemo(() => {
    if (!timeline?.timeline?.length) return [];
    return timeline.timeline.map((p) => ({
      t: new Date(p.bucket).getTime(),
      bucket: p.bucket,
      health: p.health,
      risk: p.risk,
      critical: p.criticalCount,
      warnings: p.warningCount
    }));
  }, [timeline]);

  const s = timeline?.summary;

  const { livePrimary, liveRest } = useMemo(() => {
    const raw = live?.alerts ?? [];
    if (!raw.length) return { livePrimary: null, liveRest: [] };
    const primary = raw[raw.length - 1];
    const rest = raw.length > 1 ? raw.slice(0, -1) : [];
    return { livePrimary: primary, liveRest: rest };
  }, [live?.alerts]);

  const recentEventsChrono = useMemo(() => {
    if (!timeline?.alertEvents?.length) return [];
    return [...timeline.alertEvents].reverse();
  }, [timeline?.alertEvents]);
  const recentPrimary = recentEventsChrono[0];
  const recentRest = recentEventsChrono.slice(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Bell className="w-7 h-7 text-cyan-electric" />
            Alerts & health
          </h2>
          <p className="text-grid-400 text-sm mt-1 max-w-2xl">
            {selectedDevice} — Summaries are written for <strong>operators and managers</strong> (not electricians’ jargon).
            Technical codes appear in small print for your support team. Data is kept in memory when you switch pages.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-grid-500 font-semibold mb-1">
              Rated capacity (W)
            </label>
            <input
              type="number"
              min="1"
              value={ratedCapacity}
              onChange={(e) => setRatedCapacity(Number(e.target.value))}
              className="w-36 bg-grid-900 border border-grid-700 text-slate-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-electric/50 data-readout"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              loadTimeline();
              pollLive();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-grid-700 bg-grid-900 text-sm font-medium text-slate-800 hover:border-cyan-electric/40 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading || liveLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-alarm/30 bg-red-alarm/10 text-red-alarm text-sm px-4 py-3">{error}</div>
      )}

      {/* Live snapshot */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-3">
          <Radio className="w-4 h-4 text-cyan-electric" />
          <h3 className="text-sm font-semibold text-slate-900">Live snapshot</h3>
          {liveLoading && <span className="text-[10px] text-grid-500">Updating…</span>}
        </div>
        {!live ? (
          <p className="text-sm text-grid-500">Waiting for live reading…</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-lg border border-grid-700/60 bg-grid-900/40 p-4">
              <p className="text-[10px] uppercase tracking-widest text-grid-500 font-semibold">Health</p>
              <p className="text-3xl font-extrabold data-readout mt-1">{live.health}</p>
              <p className="text-xs text-grid-500 mt-1">{live.healthBand?.label}</p>
            </div>
            <div className="rounded-lg border border-grid-700/60 bg-grid-900/40 p-4">
              <p className="text-[10px] uppercase tracking-widest text-grid-500 font-semibold">Failure risk</p>
              <p className="text-3xl font-extrabold data-readout mt-1">{live.risk}</p>
              <p className="text-xs text-grid-500 mt-1">{live.riskBand?.label}</p>
            </div>
            <div className="rounded-lg border border-grid-700/60 bg-grid-900/40 p-4">
              <p className="text-[10px] uppercase tracking-widest text-grid-500 font-semibold">Phase imbalance</p>
              <p className="text-3xl font-extrabold data-readout mt-1">
                {live.phaseImbalancePercent != null ? `${live.phaseImbalancePercent}%` : '—'}
              </p>
              <p className="text-xs text-grid-500 mt-1">{formatTs(live.bucket)}</p>
            </div>
            <div className="lg:col-span-3">
              <p className="text-[10px] uppercase tracking-widest text-grid-500 font-semibold mb-2">
                What needs attention right now
              </p>
              {!live.alerts?.length ? (
                <p className="text-sm text-grid-500">All clear on the latest reading — no issues flagged.</p>
              ) : (
                <>
                  <p className="text-xs text-grid-600 mb-3 rounded-lg bg-slate-100/80 border border-grid-700/30 px-3 py-2">
                    <span className="font-semibold text-slate-800">Reading time:</span>{' '}
                    {formatTs(live.bucket)}
                  </p>
                  <ul className="space-y-3">
                    {livePrimary && (
                      <ConsumerAlertCard key={`live-top-${livePrimary.code}`} alert={livePrimary} />
                    )}
                  </ul>
                  {liveRest.length > 0 && (
                    <CollapsePanel
                      id="live-alerts-more"
                      title={`Other findings on this reading (${liveRest.length})`}
                      subtitle="Expand to see the rest from the same meter snapshot."
                      defaultOpen={false}
                    >
                      <ul className="space-y-3 mt-3">
                        {liveRest.map((a, idx) => (
                          <ConsumerAlertCard key={`live-rest-${a.code}-${idx}`} alert={a} />
                        ))}
                      </ul>
                    </CollapsePanel>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Historical timeline */}
      <div className="glass-panel p-5">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-electric" />
            <h3 className="text-sm font-semibold text-slate-900">Historical window (accumulated readings)</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-grid-500 font-semibold mr-1">Chart window</span>
            {CHART_TIME_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setTimelinePreset(p.id)}
                className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${
                  timelinePreset === p.id
                    ? 'bg-cyan-electric/10 text-cyan-electric border border-cyan-electric/30'
                    : 'text-grid-500 border border-transparent hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
            <span className="text-xs text-grid-500 ml-auto">{timelineWindowLabel}</span>
          </div>
        </div>
        {loading || !s ? (
          <div className="flex items-center gap-2 text-grid-500 text-sm py-8">
            <div className="w-4 h-4 border-2 border-grid-500 border-t-transparent rounded-full animate-spin" />
            Loading timeline…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="rounded-lg border border-grid-700/50 p-3 bg-grid-900/30">
                <p className="text-[10px] text-grid-500 uppercase">Samples</p>
                <p className="text-xl font-bold data-readout">{s.points}</p>
              </div>
              <div className="rounded-lg border border-grid-700/50 p-3 bg-grid-900/30">
                <p className="text-[10px] text-grid-500 uppercase">Critical</p>
                <p className="text-xl font-bold text-red-alarm data-readout">{s.criticalEvents}</p>
              </div>
              <div className="rounded-lg border border-grid-700/50 p-3 bg-grid-900/30">
                <p className="text-[10px] text-grid-500 uppercase">Warnings</p>
                <p className="text-xl font-bold text-amber-700 data-readout">{s.warningEvents}</p>
              </div>
              <div className="rounded-lg border border-grid-700/50 p-3 bg-grid-900/30">
                <p className="text-[10px] text-grid-500 uppercase">Latest H / R</p>
                <p className="text-lg font-bold data-readout">
                  {s.latestHealth ?? '—'} / {s.latestRisk ?? '—'}
                </p>
                <p className="text-[10px] text-grid-500">
                  {s.latestHealthBand?.label} · {s.latestRiskBand?.label}
                </p>
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="h-72 w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
                    <XAxis
                      dataKey="t"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(ts) =>
                        new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      }
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      minTickGap={32}
                    />
                    <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} width={36} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 1]} tick={{ fontSize: 10, fill: '#64748b' }} width={36} />
                    <Tooltip
                      labelFormatter={(ts) => formatTs(typeof ts === 'number' ? new Date(ts).toISOString() : ts)}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line yAxisId="left" type="monotone" dataKey="health" name="Health" stroke="#00bcd4" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="risk" name="Risk (0–1)" stroke="#f43f5e" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            <div>
              <p className="text-[10px] uppercase tracking-widest text-grid-500 font-semibold mb-2">
                Recent events (plain language)
              </p>
              {!timeline.alertEvents?.length ? (
                <p className="p-4 text-sm text-grid-500 rounded-lg border border-grid-700/50">No issues logged in this window.</p>
              ) : (
                <>
                  <ul className="space-y-3 mb-3">
                    {recentPrimary && (
                      <ConsumerAlertCard
                        key={`recent-top-${recentPrimary.bucket}-${recentPrimary.code}`}
                        alert={recentPrimary}
                        timeLabel={formatTs(recentPrimary.bucket)}
                      />
                    )}
                  </ul>
                  {recentRest.length > 0 && (
                    <CollapsePanel
                      id="recent-alerts-more"
                      title={`Earlier in this window (${recentRest.length})`}
                      subtitle="Newest event stays visible above; open for older entries."
                      defaultOpen={false}
                    >
                      <ul className="max-h-96 overflow-y-auto space-y-3 mt-3 pr-1">
                        {recentRest.map((e, i) => (
                          <ConsumerAlertCard
                            key={`${e.bucket}-${e.code}-${i}`}
                            alert={e}
                            timeLabel={formatTs(e.bucket)}
                          />
                        ))}
                      </ul>
                    </CollapsePanel>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
