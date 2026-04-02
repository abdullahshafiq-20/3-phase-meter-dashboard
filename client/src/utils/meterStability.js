/**
 * Client-side stability rules aligned with server alertService.js / insight thresholds.
 * Flags a meter as unstable when the latest reading violates any key bound.
 */

const F_LOW = 49.5;
const F_HIGH = 50.5;
const V_LOW = 210;
const V_HIGH = 245;
const V_PHASE_SPREAD_WARN = 10;
const PHASE_IMB_PCT_WARN = 10;
const PHASE_IMB_PCT_CRIT = 20;
const LOAD_IMBALANCE_FRAC = 0.3;
const CURRENT_NEAR_ZERO_FRAC = 0.05;
const CURRENT_OVERLOAD_A = 70;
const RP_HIGH_PF_LOW = 0.85;
const RP_RATIO_WARN = 0.35;
const NOMINAL_VOLTAGE_DEFAULT = 230;

const mean = (a, b, c) => (a + b + c) / 3;

/**
 * @param {object} r — normalized row (va,vb,vc, ca,cb,cc, f, pf, ap, rp)
 * @param {{ nominalVoltage?: number; ratedCapacityW?: number }} [opts]
 * @returns {{ unstable: boolean; severity: 'ok' | 'warning' | 'critical'; flags: { code: string; severity: string; label: string }[] }}
 */
export function evaluateMeterStability(r, opts = {}) {
  if (!r || typeof r !== 'object') {
    return { unstable: false, severity: 'ok', flags: [] };
  }

  const nominal = opts.nominalVoltage ?? NOMINAL_VOLTAGE_DEFAULT;
  const rated = opts.ratedCapacityW ?? 10000;

  const va = Number(r.va);
  const vb = Number(r.vb);
  const vc = Number(r.vc);
  const ca = Number(r.ca);
  const cb = Number(r.cb);
  const cc = Number(r.cc);
  const f = Number(r.f);
  const pf = Math.abs(Number(r.pf));
  const ap = Number(r.ap);
  const rp = Number(r.rp);

  /** @type {{ code: string; severity: 'critical' | 'warning'; label: string }[]} */
  const flags = [];

  if (Number.isFinite(f)) {
    if (f < F_LOW) flags.push({ code: 'FREQ_UNDER', severity: 'critical', label: 'Frequency low' });
    else if (f > F_HIGH) flags.push({ code: 'FREQ_OVER', severity: 'critical', label: 'Frequency high' });
  }

  const voltages = [va, vb, vc].filter(Number.isFinite);
  if (voltages.length === 3) {
    const vmin = Math.min(va, vb, vc);
    const vmax = Math.max(va, vb, vc);
    if (vmin < V_LOW) flags.push({ code: 'VOLT_UNDER', severity: 'critical', label: 'Voltage sag' });
    if (vmax > V_HIGH) flags.push({ code: 'VOLT_OVER', severity: 'critical', label: 'Voltage swell' });
    if (vmax - vmin > V_PHASE_SPREAD_WARN) {
      flags.push({ code: 'VOLT_IMBALANCE', severity: 'warning', label: 'Voltage imbalance' });
    }
    const vavg = (va + vb + vc) / 3;
    if (Number.isFinite(vavg) && Math.abs(vavg - nominal) > 10) {
      flags.push({ code: 'VOLT_OFF_NOMINAL', severity: 'warning', label: 'Voltage off nominal' });
    }
  }

  const currents = [ca, cb, cc].filter(Number.isFinite);
  if (currents.length === 3) {
    const imax = Math.max(ca, cb, cc);
    const imin = Math.min(ca, cb, cc);
    const iavg = mean(ca, cb, cc);
    const phaseImbPct = iavg > 1e-6 ? ((imax - iavg) / iavg) * 100 : 0;
    if (phaseImbPct > PHASE_IMB_PCT_CRIT) {
      flags.push({ code: 'PHASE_IMBALANCE_SEVERE', severity: 'critical', label: 'Severe current imbalance' });
    } else if (phaseImbPct > PHASE_IMB_PCT_WARN) {
      flags.push({ code: 'PHASE_IMBALANCE_MOD', severity: 'warning', label: 'Current imbalance' });
    }
    if (imax > 0.5) {
      const nearZero = [ca, cb, cc].some((c) => c <= Math.max(imax * CURRENT_NEAR_ZERO_FRAC, 0.02));
      if (nearZero) flags.push({ code: 'PHASE_FAILURE', severity: 'critical', label: 'Possible lost phase' });
    }
    if (imax > 1e-6 && (imax - imin) / imax > LOAD_IMBALANCE_FRAC) {
      flags.push({ code: 'LOAD_IMBALANCE', severity: 'warning', label: 'Load imbalance' });
    }
    if (imax > CURRENT_OVERLOAD_A || (Number.isFinite(ap) && ap > rated * 0.9)) {
      flags.push({ code: 'OVERLOAD', severity: 'critical', label: 'Overload risk' });
    }
  }

  if (Number.isFinite(pf)) {
    if (pf < 0.8) flags.push({ code: 'PF_VERY_LOW', severity: 'critical', label: 'Very low PF' });
    else if (pf < 0.85) flags.push({ code: 'PF_LOW', severity: 'warning', label: 'Low PF' });
    const cosPf = Math.max(0.01, Math.min(1, Math.abs(pf)));
    const thdEstimate = Number((Math.sqrt(1 / (cosPf * cosPf) - 1) * 100).toFixed(4));
    if (thdEstimate > 20) {
      flags.push({ code: 'THD_HIGH', severity: 'warning', label: 'High THD estimate (from PF)' });
    }
  }

  const apSafe = Math.abs(ap) > 1e-6 ? ap : 1e-6;
  const rpRatio = Math.abs(rp) / Math.abs(apSafe);
  if (Number.isFinite(pf) && pf < RP_HIGH_PF_LOW && rpRatio > RP_RATIO_WARN) {
    flags.push({ code: 'POWER_INEFFICIENCY', severity: 'critical', label: 'High reactive share' });
  }

  const hasCritical = flags.some((x) => x.severity === 'critical');
  const hasWarning = flags.some((x) => x.severity === 'warning');
  let severity = 'ok';
  if (hasCritical) severity = 'critical';
  else if (hasWarning) severity = 'warning';

  return {
    unstable: flags.length > 0,
    severity,
    flags,
  };
}
