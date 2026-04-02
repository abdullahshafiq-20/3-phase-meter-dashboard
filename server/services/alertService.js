import { config } from '../config/index.js';
import { getDeviceReadings, normalizeTelemetryExportRow } from './dataStore.js';
import { getLatestLiveReading } from './liveDataService.js';

/** @typedef {'critical' | 'warning' | 'info'} AlertSeverity */

/** @typedef {{ code: string; severity: AlertSeverity; message: string; plainTitle?: string; plainSummary?: string; whatYouCanDo?: string }} AlertItem */

const PLAIN_ALERT_COPY = {
  GRID_FREQ_INSTABILITY: {
    title: 'Power frequency is jumping around',
    detail: 'The grid frequency is moving more than usual. Sensitive equipment can misbehave when this happens.',
    tip: 'Note the time. If lights or machines flicker, reduce large loads and call your utility if it continues.'
  },
  GRID_VOLT_INSTABILITY: {
    title: 'Supply voltage is unstable',
    detail: 'Voltage has been swinging noticeably between readings.',
    tip: 'Avoid starting heavy motors until voltage steadies; contact your utility or electrician if it persists.'
  },
  FREQ_UNDER: {
    title: 'Mains frequency is too low',
    detail: 'Frequency has dropped below the safe band (under 49.5 Hz).',
    tip: 'This is usually a grid issue. Turn off non‑essential loads and report it to your electricity supplier.'
  },
  FREQ_OVER: {
    title: 'Mains frequency is too high',
    detail: 'Frequency is above the safe band (over 50.5 Hz).',
    tip: 'Report unusual readings to your supplier; protect sensitive electronics if problems continue.'
  },
  VOLT_UNDER: {
    title: 'Voltage is dangerously low on a phase',
    detail: 'At least one phase is below 210 V — equipment may shut down or overheat.',
    tip: 'Reduce load where possible and have an electrician check the installation and utility supply.'
  },
  VOLT_OVER: {
    title: 'Voltage is too high on a phase',
    detail: 'A phase is above 245 V — this can damage appliances and insulation over time.',
    tip: 'Switch off sensitive gear and arrange a professional check of the service and neutral.'
  },
  VOLT_IMBALANCE: {
    title: 'Phases do not share voltage evenly',
    detail: 'The three line voltages differ more than they should.',
    tip: 'Imbalance wears motors and can point to wiring or load issues — schedule an electrical inspection.'
  },
  PHASE_IMBALANCE_SEVERE: {
    title: 'Serious uneven current across phases',
    detail: 'One or more phases are carrying much more current than the others.',
    tip: 'Rebalance loads across phases where you can, and ask an electrician to review the distribution.'
  },
  PHASE_IMBALANCE_MOD: {
    title: 'Uneven current between phases',
    detail: 'Currents are moderately mismatched between phases.',
    tip: 'Plan to rebalance loads; overheating on one phase can develop if this continues.'
  },
  PHASE_FAILURE: {
    title: 'Possible loss of a phase',
    detail: 'One phase appears to carry almost no current while others are live.',
    tip: 'Treat this as urgent — turn off heavy equipment and call an electrician before equipment damage occurs.'
  },
  OVERLOAD: {
    title: 'System is close to overload',
    detail: 'Current or total power is very high compared to safe capacity.',
    tip: 'Stagger large machines, shed non‑essential load, and confirm your supply rating with an engineer.'
  },
  LOAD_IMBALANCE: {
    title: 'Load is uneven across phases',
    detail: 'Phase currents differ by more than about a third.',
    tip: 'Move single‑phase loads between phases over time to even things out.'
  },
  PF_VERY_LOW: {
    title: 'Very poor power factor',
    detail: 'Your site is drawing extra reactive power, which wastes energy and may incur penalties.',
    tip: 'Ask an engineer about power‑factor correction (capacitor banks) suited to your loads.'
  },
  PF_LOW: {
    title: 'Power factor could be better',
    detail: 'Energy is not being used as efficiently as it could be.',
    tip: 'Review motor and lighting mix; correction equipment often pays back through lower bills.'
  },
  PF_MARGINAL: {
    title: 'Power factor is acceptable',
    detail: 'Nothing urgent, but there is room to improve efficiency.',
    tip: 'Optional: review loads during peak hours for future savings.'
  },
  AP_SURGE: {
    title: 'Load jumped up quickly',
    detail: 'Power demand rose sharply in a short time.',
    tip: 'Check if large equipment started together; soft‑start or stagger starts if this is repeated.'
  },
  AP_DROP: {
    title: 'Load fell sharply',
    detail: 'Power use dropped suddenly — something large may have tripped or switched off.',
    tip: 'Verify critical circuits; unexpected drops can mean a protection device operated.'
  },
  POWER_INEFFICIENCY: {
    title: 'Energy is being wasted',
    detail: 'Low power factor together with high reactive power means you are paying for “unused” energy.',
    tip: 'Plan power‑factor correction and review inductive loads (motors, old transformers).'
  },
  REACTIVE_HIGH: {
    title: 'Reactive power is elevated',
    detail: 'The site is exchanging extra reactive energy with the grid.',
    tip: 'Capacitor or filter maintenance may be needed — have maintenance staff review compensation gear.'
  },
  RP_TREND_UP: {
    title: 'Reactive power is creeping up',
    detail: 'Reactive power has risen over recent readings.',
    tip: 'Capacitor stages may be failing or loads changed — schedule a power‑quality check.'
  },
  GRID_UNSTABLE_COMBO: {
    title: 'Grid looks stressed',
    detail: 'Both frequency and voltage look abnormal at the same time — a stronger sign of supply issues.',
    tip: 'Document times, protect sensitive loads, and contact your utility if the pattern repeats.'
  },
  OVERLOAD_COMBINED: {
    title: 'High power and high currents together',
    detail: 'The meter sees heavy total power and heavy phase currents — the system is working near its limits.',
    tip: 'Avoid adding load until capacity is confirmed with a professional.'
  }
};

export function enrichConsumerAlert(alert) {
  const p = PLAIN_ALERT_COPY[alert.code];
  return {
    ...alert,
    plainTitle: p?.title ?? 'Something needs attention',
    plainSummary: p?.detail ?? alert.message,
    whatYouCanDo: p?.tip ?? 'If this message appears often, contact a qualified electrician or your utility.'
  };
}

export function enrichConsumerAlerts(alerts) {
  return (alerts ?? []).map(enrichConsumerAlert);
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const F_NOM = 50;
const F_LOW = 49.5;
const F_HIGH = 50.5;
const V_LOW = 210;
const V_HIGH = 245;
const V_PHASE_DIFF_WARN = 10;
const CURRENT_NEAR_ZERO_FRAC = 0.05;
const CURRENT_OVERLOAD_A = 70;
const LOAD_IMBALANCE_FRAC = 0.3;
const PHASE_IMB_PCT_WARN = 10;
const PHASE_IMB_PCT_CRIT = 20;
const AP_SPIKE_FRAC = 0.3;
const RP_HIGH_PF_LOW = 0.85;
const RP_RATIO_HIGH = 0.35;
const GRID_FREQ_SWING = 0.25;
const GRID_VOLT_SWING = 8;

const W_F = 10;
const W_V = 15;
const W_I = 20;
const W_PF = 25;
const W_RP = 15;
const W_SPIKE = 15;

const RISK_WINDOW = 8;
const NOMINAL_VOLTAGE = () => config.nominalVoltage || 230;

/** @type {Map<string, { readings: object[]; maxLen: number }>} */
const liveRing = new Map();

const getRing = (deviceId, maxLen = 40) => {
  if (!liveRing.has(deviceId)) liveRing.set(deviceId, { readings: [], maxLen });
  const b = liveRing.get(deviceId);
  b.maxLen = maxLen;
  return b;
};

export const pushLiveReading = (deviceId, reading) => {
  const b = getRing(deviceId);
  b.readings.push(reading);
  if (b.readings.length > b.maxLen) b.readings.splice(0, b.readings.length - b.maxLen);
};

const mean = (arr) => {
  if (!arr.length) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
};

const stdSample = (arr) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  let s2 = 0;
  for (const v of arr) s2 += (v - m) ** 2;
  return Math.sqrt(s2 / (arr.length - 1));
};

const linearRegressionSlope = (ys) => {
  const n = ys.length;
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i;
    const y = ys[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const den = n * sumX2 - sumX * sumX;
  if (den === 0) return 0;
  return (n * sumXY - sumX * sumY) / den;
};

/**
 * @param {object} r
 * @param {object | null} prev
 * @param {{ recentF?: number[]; recentVavg?: number[]; ratedCapacityW?: number; rpPrev?: number; rpPrev2?: number }} ctx
 */
export function analyzeReading(raw, prevRaw, ctx = {}) {
  const r = normalizeTelemetryExportRow(raw);
  const prev = prevRaw != null ? normalizeTelemetryExportRow(prevRaw) : null;
  /** @type {AlertItem[]} */
  const alerts = [];
  const rated = ctx.ratedCapacityW ?? 10000;
  const voltages = [r.va, r.vb, r.vc];
  const currents = [r.ca, r.cb, r.cc];
  const vmin = Math.min(...voltages);
  const vmax = Math.max(...voltages);
  const vspread = vmax - vmin;
  const imax = Math.max(...currents);
  const imin = Math.min(...currents);
  const iavg = mean(currents);

  const recentF = ctx.recentF ?? [];
  if (recentF.length >= 3) {
    const spread = Math.max(...recentF) - Math.min(...recentF);
    if (spread > GRID_FREQ_SWING) {
      alerts.push({
        code: 'GRID_FREQ_INSTABILITY',
        severity: 'warning',
        message: 'Frequency fluctuating — possible grid instability'
      });
    }
  }

  const recentV = ctx.recentVavg ?? [];
  if (recentV.length >= 3) {
    const spread = Math.max(...recentV) - Math.min(...recentV);
    if (spread > GRID_VOLT_SWING) {
      alerts.push({
        code: 'GRID_VOLT_INSTABILITY',
        severity: 'warning',
        message: 'Supply voltage swinging — monitor grid stability'
      });
    }
  }

  if (r.f < F_LOW) {
    alerts.push({ code: 'FREQ_UNDER', severity: 'critical', message: 'Under-frequency — below 49.5 Hz' });
  } else if (r.f > F_HIGH) {
    alerts.push({ code: 'FREQ_OVER', severity: 'critical', message: 'Over-frequency — above 50.5 Hz' });
  }

  if (vmin < V_LOW) {
    alerts.push({ code: 'VOLT_UNDER', severity: 'critical', message: 'Under-voltage — phase below 210 V' });
  }
  if (vmax > V_HIGH) {
    alerts.push({ code: 'VOLT_OVER', severity: 'critical', message: 'Over-voltage — phase above 245 V' });
  }
  if (vspread > V_PHASE_DIFF_WARN) {
    alerts.push({
      code: 'VOLT_IMBALANCE',
      severity: 'warning',
      message: `Voltage imbalance — ${vspread.toFixed(1)} V spread between phases`
    });
  }

  const phaseImbPct = iavg > 1e-6 ? ((imax - iavg) / iavg) * 100 : 0;
  if (phaseImbPct > PHASE_IMB_PCT_CRIT) {
    alerts.push({
      code: 'PHASE_IMBALANCE_SEVERE',
      severity: 'critical',
      message: `Severe current imbalance — ${phaseImbPct.toFixed(1)}%`
    });
  } else if (phaseImbPct > PHASE_IMB_PCT_WARN) {
    alerts.push({
      code: 'PHASE_IMBALANCE_MOD',
      severity: 'warning',
      message: `Moderate current imbalance — ${phaseImbPct.toFixed(1)}%`
    });
  }

  if (imax > 0.5) {
    const nearZero = currents.some((c) => c <= Math.max(imax * CURRENT_NEAR_ZERO_FRAC, 0.02));
    if (nearZero) {
      alerts.push({
        code: 'PHASE_FAILURE',
        severity: 'critical',
        message: 'Possible phase failure — one phase current near zero'
      });
    }
  }

  if (imax > CURRENT_OVERLOAD_A || r.ap > rated * 0.9) {
    alerts.push({
      code: 'OVERLOAD',
      severity: 'critical',
      message: 'Overload risk — high current or active power near rated capacity'
    });
  }

  if (imax > 1e-6 && (imax - imin) / imax > LOAD_IMBALANCE_FRAC) {
    alerts.push({
      code: 'LOAD_IMBALANCE',
      severity: 'warning',
      message: 'Load imbalance — >30% spread across phase currents'
    });
  }

  if (r.pf < 0.8) {
    alerts.push({
      code: 'PF_VERY_LOW',
      severity: 'critical',
      message: 'Very low power factor — corrective action recommended'
    });
  } else if (r.pf < 0.9) {
    alerts.push({
      code: 'PF_LOW',
      severity: 'warning',
      message: 'Low power factor — energy inefficiency'
    });
  } else if (r.pf < 0.95) {
    alerts.push({
      code: 'PF_MARGINAL',
      severity: 'info',
      message: 'Power factor acceptable but could be improved'
    });
  }

  if (prev && prev.ap > 1e-6) {
    const ch = (r.ap - prev.ap) / prev.ap;
    if (ch > AP_SPIKE_FRAC) {
      alerts.push({
        code: 'AP_SURGE',
        severity: 'warning',
        message: `Sudden load increase — +${(ch * 100).toFixed(0)}% active power`
      });
    } else if (ch < -AP_SPIKE_FRAC) {
      alerts.push({
        code: 'AP_DROP',
        severity: 'warning',
        message: `Sharp load drop — possible shutdown or shedding (${(ch * 100).toFixed(0)}%)`
      });
    }
  }

  const apSafe = Math.abs(r.ap) > 1e-6 ? r.ap : 1e-6;
  const rpRatio = Math.abs(r.rp) / Math.abs(apSafe);
  if (r.pf < RP_HIGH_PF_LOW && rpRatio > RP_RATIO_HIGH) {
    alerts.push({
      code: 'POWER_INEFFICIENCY',
      severity: 'critical',
      message: 'Power inefficiency — low PF with high reactive power share'
    });
  } else if (r.rp > 0 && rpRatio > 0.5 && r.pf < 0.9) {
    alerts.push({
      code: 'REACTIVE_HIGH',
      severity: 'warning',
      message: 'Elevated reactive power — check compensation / capacitors'
    });
  }

  const rpPrev = ctx.rpPrev;
  const rpPrev2 = ctx.rpPrev2;
  if (
    rpPrev != null &&
    rpPrev2 != null &&
    rpPrev > 1e-6 &&
    r.rp > rpPrev * 1.12 &&
    rpPrev > rpPrev2 * 1.08
  ) {
    alerts.push({
      code: 'RP_TREND_UP',
      severity: 'warning',
      message: 'Reactive power trending up — possible capacitor or PF issue'
    });
  }

  if (recentF.length >= 2 && recentV.length >= 2) {
    const fOk = recentF.every((f) => f >= F_LOW && f <= F_HIGH);
    const vnom = NOMINAL_VOLTAGE();
    const vOk = recentV.every((v) => Math.abs(v - vnom) < 15);
    if (!fOk && !vOk) {
      alerts.push({
        code: 'GRID_UNSTABLE_COMBO',
        severity: 'critical',
        message: 'Grid instability — simultaneous frequency and voltage stress'
      });
    }
  }

  if (r.ap > rated * 0.85 && imax > 40) {
    alerts.push({
      code: 'OVERLOAD_COMBINED',
      severity: 'critical',
      message: 'Overload condition — high active power and phase currents'
    });
  }

  return { alerts, phaseImbalancePercent: Number(phaseImbPct.toFixed(2)) };
}

export function computeHealth(raw, prevRaw, ratedCapacityW = 10000) {
  const r = normalizeTelemetryExportRow(raw);
  const prev = prevRaw != null ? normalizeTelemetryExportRow(prevRaw) : null;
  const vnom = NOMINAL_VOLTAGE();
  const vavg = (r.va + r.vb + r.vc) / 3;
  const currents = [r.ca, r.cb, r.cc];
  const iavg = mean(currents);
  const imax = Math.max(...currents);
  const F_dev = Math.abs(r.f - F_NOM);
  const V_dev = Math.abs(vavg - vnom);
  const I_imbalance = iavg > 1e-6 ? (imax - iavg) / iavg : 0;
  const PF_loss = Math.max(0, 1 - Math.min(1, Math.abs(r.pf)));
  const apAbs = Math.abs(r.ap);
  const RP_ratio = apAbs > 1e-6 ? clamp(Math.abs(r.rp) / apAbs, 0, 2) : 0;
  let Power_spike = 0;
  if (prev && Math.abs(prev.ap) > 1e-6) {
    Power_spike = Math.abs(r.ap - prev.ap) / Math.abs(prev.ap);
  }
  Power_spike = clamp(Power_spike, 0, 3);

  let health =
    100 -
    W_F * clamp(F_dev, 0, 1) -
    W_V * clamp(V_dev / 10, 0, 5) -
    W_I * clamp(I_imbalance, 0, 1.5) -
    W_PF * clamp(PF_loss, 0, 1) -
    W_RP * clamp(RP_ratio, 0, 1) -
    W_SPIKE * clamp(Power_spike, 0, 1);

  if (r.ap > ratedCapacityW * 0.95) health -= 8;
  health = clamp(health, 0, 100);
  return Number(health.toFixed(2));
}

export function healthInterpretation(score) {
  if (score >= 90) return { band: 'healthy', label: 'Healthy' };
  if (score >= 75) return { band: 'slight', label: 'Slight issues' };
  if (score >= 50) return { band: 'degrading', label: 'Degrading' };
  return { band: 'critical', label: 'Critical' };
}

function severityScore(sev) {
  if (sev === 'critical') return 1;
  if (sev === 'warning') return 0.5;
  return 0.15;
}

function computeRiskScore(windowRows) {
  if (windowRows.length < 3) return { risk: 0, components: {} };
  const healths = windowRows.map((w) => w.health);
  const hs = healths.length;
  const dHealth = healths[hs - 2] - healths[hs - 1];
  const drop = clamp(dHealth / 20, 0, 1);

  const aps = windowRows.map((w) => w.reading.ap);
  const pfs = windowRows.map((w) => w.reading.pf);
  const volts = windowRows.map((w) => (w.reading.va + w.reading.vb + w.reading.vc) / 3);
  const mAp = mean(aps);
  const varAp = mAp > 1e-6 ? stdSample(aps) / mAp : 0;
  const varPf = stdSample(pfs);
  const mV = mean(volts);
  const varV = mV > 1e-6 ? stdSample(volts) / mV : 0;
  const variability = clamp(varAp + varPf + varV * 2, 0, 3) / 3;

  let viol = 0;
  for (const w of windowRows) {
    for (const a of w.alerts) viol += severityScore(a.severity);
  }
  viol = clamp(viol / 8, 0, 1);

  const slope = linearRegressionSlope(healths);
  const trend = clamp(-slope / 3, 0, 1);

  const risk = clamp(0.4 * drop + 0.2 * variability + 0.2 * viol + 0.2 * trend, 0, 1);
  return {
    risk: Number(risk.toFixed(4)),
    components: { drop, variability, violations: viol, trend }
  };
}

export function riskInterpretation(risk) {
  if (risk < 0.3) return { band: 'safe', label: 'Safe' };
  if (risk < 0.6) return { band: 'monitor', label: 'Monitor' };
  if (risk < 0.8) return { band: 'high', label: 'High risk' };
  return { band: 'failure', label: 'Likely failure soon' };
}

function buildSeriesForReadings(readings, ratedCapacityW) {
  const series = [];
  const recentF = [];
  const recentV = [];
  for (let i = 0; i < readings.length; i += 1) {
    const r = readings[i];
    const prev = i > 0 ? readings[i - 1] : null;
    recentF.push(r.f);
    if (recentF.length > 4) recentF.shift();
    const vavg = (r.va + r.vb + r.vc) / 3;
    recentV.push(vavg);
    if (recentV.length > 4) recentV.shift();
    const ctx = {
      recentF: [...recentF],
      recentVavg: [...recentV],
      ratedCapacityW,
      rpPrev: i > 0 ? readings[i - 1].rp : undefined,
      rpPrev2: i > 1 ? readings[i - 2].rp : undefined
    };
    const { alerts, phaseImbalancePercent } = analyzeReading(r, prev, ctx);
    const health = computeHealth(r, prev, ratedCapacityW);
    series.push({
      bucket: r.bucket,
      reading: r,
      alerts,
      phaseImbalancePercent,
      health,
      alertCount: alerts.length,
      criticalCount: alerts.filter((a) => a.severity === 'critical').length,
      warningCount: alerts.filter((a) => a.severity === 'warning').length
    });
  }

  for (let i = 0; i < series.length; i += 1) {
    const start = Math.max(0, i - RISK_WINDOW + 1);
    const win = series.slice(start, i + 1);
    const { risk, components } = computeRiskScore(win);
    series[i].risk = risk;
    series[i].riskComponents = components;
  }
  return series;
}

/**
 * @param {string} deviceId
 * @param {{ from?: string; to?: string; limit?: number; ratedCapacityW?: number }} [opts]
 */
export function getAlertsTimeline(deviceId, opts = {}) {
  const raw = getDeviceReadings(deviceId);
  let rows = raw;
  if (opts.from || opts.to) {
    const fromTs = opts.from ? new Date(opts.from).getTime() : Number.NEGATIVE_INFINITY;
    const toTs = opts.to ? new Date(opts.to).getTime() : Number.POSITIVE_INFINITY;
    rows = raw.filter((r) => {
      const t = new Date(r.bucket).getTime();
      return t >= fromTs && t <= toTs;
    });
  }
  let tail = rows;
  const limit = Math.min(5000, Math.max(100, Number(opts.limit) || 2000));
  if (tail.length > limit) tail = tail.slice(-limit);

  const rated = opts.ratedCapacityW ?? 10000;
  const series = buildSeriesForReadings(tail, rated);
  const flattened = [];
  for (const pt of series) {
    for (const a of pt.alerts) {
      flattened.push({
        bucket: pt.bucket,
        ...enrichConsumerAlert(a),
        health: pt.health,
        risk: pt.risk
      });
    }
  }

  const last = series.at(-1);
  const summary = {
    deviceId,
    points: series.length,
    totalAlertEvents: flattened.length,
    criticalEvents: flattened.filter((e) => e.severity === 'critical').length,
    warningEvents: flattened.filter((e) => e.severity === 'warning').length,
    latestHealth: last?.health ?? null,
    latestRisk: last?.risk ?? null,
    latestHealthBand: last ? healthInterpretation(last.health) : null,
    latestRiskBand: last ? riskInterpretation(last.risk) : null
  };

  return {
    summary,
    timeline: series.map((s) => ({
      bucket: s.bucket,
      health: s.health,
      risk: s.risk,
      phaseImbalancePercent: s.phaseImbalancePercent,
      alerts: enrichConsumerAlerts(s.alerts),
      criticalCount: s.criticalCount,
      warningCount: s.warningCount
    })),
    alertEvents: flattened.slice(-500),
    ratedCapacityW: rated
  };
}

/**
 * @param {string} deviceId
 * @param {{ ratedCapacityW?: number }} [opts]
 */
export function getLiveAlertSnapshot(deviceId, opts = {}) {
  const reading = getLatestLiveReading(deviceId);
  pushLiveReading(deviceId, reading);
  const buf = getRing(deviceId);
  const prev = buf.readings.length > 1 ? buf.readings[buf.readings.length - 2] : null;
  const window = buf.readings.slice(-6);
  const recentF = window.map((x) => x.f);
  const recentVavg = window.map((x) => (x.va + x.vb + x.vc) / 3);
  const rated = opts.ratedCapacityW ?? 10000;
  const rpPrev = prev?.rp;
  const rpPrev2 = buf.readings.length > 2 ? buf.readings[buf.readings.length - 3]?.rp : undefined;
  const { alerts, phaseImbalancePercent } = analyzeReading(reading, prev, {
    recentF,
    recentVavg,
    ratedCapacityW: rated,
    rpPrev,
    rpPrev2
  });
  const health = computeHealth(reading, prev, rated);

  const miniSeries = buildSeriesForReadings(window, rated);
  const lastRisk = miniSeries.at(-1)?.risk ?? 0;

  return {
    source: 'live',
    deviceId,
    bucket: reading.bucket,
    reading,
    alerts: enrichConsumerAlerts(alerts),
    health,
    healthBand: healthInterpretation(health),
    risk: lastRisk,
    riskBand: riskInterpretation(lastRisk),
    phaseImbalancePercent
  };
}
