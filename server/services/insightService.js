import { config } from '../config/index.js';
import { getDeviceReadings } from './csvDataService.js';


const safeStats = (arr) => {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const v of arr) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, max, sum, avg: sum / (arr.length || 1) };
};

const mean = (arr) => {
  let sum = 0;
  for (const v of arr) sum += v;
  return sum / (arr.length || 1);
};

const stdDev = (arr) => {
  const avg = mean(arr);
  let sumSq = 0;
  for (const v of arr) sumSq += (v - avg) ** 2;
  return Math.sqrt(sumSq / (arr.length || 1));
};


export const getPeakDemand = (deviceId) => {
  const readings = getDeviceReadings(deviceId);
  if (!readings.length) {
    return { deviceId, peakApW: 0, timestamp: null };
  }
  let peak = readings[0];
  let peakAp = Number(peak?.ap);
  if (!Number.isFinite(peakAp)) peakAp = -Infinity;
  for (const row of readings) {
    const ap = Number(row.ap);
    if (Number.isFinite(ap) && ap > peakAp) {
      peak = row;
      peakAp = ap;
    }
  }
  const w = Number(peak?.ap);
  return {
    deviceId,
    peakApW: Number.isFinite(w) ? w : 0,
    timestamp: peak.bucket
  };
};

export const getEnergyCost = (deviceId, unitPrice = 0) => {
  const readings = getDeviceReadings(deviceId);
  const consumedKwh = Math.max(0, readings.at(-1).e - readings[0].e);
  return {
    deviceId,
    unitPrice,
    consumedKwh: Number(consumedKwh.toFixed(6)),
    totalCost: Number((consumedKwh * unitPrice).toFixed(6)),
    periodStart: readings[0].bucket,
    periodEnd: readings.at(-1).bucket
  };
};

export const getPowerFactorInsight = (deviceId) => {
  const readings = getDeviceReadings(deviceId);
  const pfValues = readings.map((r) => r.pf);
  const stats = safeStats(pfValues);
  const lowPfReadings = readings.filter((r) => r.pf < 0.85);
  return {
    deviceId,
    avgPf: Number(stats.avg.toFixed(4)),
    minPf: Number(stats.min.toFixed(4)),
    maxPf: Number(stats.max.toFixed(4)),
    lowPfCount: lowPfReadings.length,
    lowPfPeriods: lowPfReadings.slice(0, 200).map((r) => ({ timestamp: r.bucket, pf: r.pf }))
  };
};

export const getPhaseImbalanceInsight = (deviceId) => {
  const readings = getDeviceReadings(deviceId);
  const timeline = readings.map((r) => {
    const values = [r.ca, r.cb, r.cc];
    const avg = (values[0] + values[1] + values[2]) / 3;
    let maxDev = 0;
    for (const v of values) {
      const dev = Math.abs(v - avg);
      if (dev > maxDev) maxDev = dev;
    }
    return {
      timestamp: r.bucket,
      ca: r.ca,
      cb: r.cb,
      cc: r.cc,
      imbalancePercent: Number(((maxDev / (avg || 1)) * 100).toFixed(4))
    };
  });
  const imbalanceValues = timeline.map((t) => t.imbalancePercent);
  const stats = safeStats(imbalanceValues);
  return {
    deviceId,
    avgImbalancePercent: Number(stats.avg.toFixed(4)),
    maxImbalancePercent: Number(stats.max.toFixed(4)),
    highImbalanceCount: imbalanceValues.filter((v) => v > 10).length,
    timeline
  };
};

export const getVoltageStabilityInsight = (deviceId, nominalVoltage = config.nominalVoltage) => {
  const readings = getDeviceReadings(deviceId);
  const asPhase = (key) => {
    const values = readings.map((r) => r[key]);
    const stats = safeStats(values);
    return {
      avg: Number(stats.avg.toFixed(4)),
      stdDev: Number(stdDev(values).toFixed(4)),
      min: Number(stats.min.toFixed(4)),
      max: Number(stats.max.toFixed(4)),
      timeline: readings.map((r) => ({
        timestamp: r.bucket,
        value: r[key],
        deviation: Number((r[key] - nominalVoltage).toFixed(4))
      }))
    };
  };
  return {
    deviceId,
    nominalVoltage,
    va: asPhase('va'),
    vb: asPhase('vb'),
    vc: asPhase('vc')
  };
};

export const getReactivePowerInsight = (deviceId) => {
  const readings = getDeviceReadings(deviceId);
  const rpValues = readings.map((r) => r.rp);
  const stats = safeStats(rpValues);
  const threshold = stats.avg * 1.35;
  return {
    deviceId,
    avgRp: Number(stats.avg.toFixed(4)),
    maxRp: Number(stats.max.toFixed(4)),
    highLoadThreshold: Number(threshold.toFixed(4)),
    highReactivePeriods: readings
      .filter((r) => r.rp > threshold)
      .slice(0, 200)
      .map((r) => ({ timestamp: r.bucket, rp: r.rp, ap: r.ap, pf: r.pf }))
  };
};

export const getFrequencyStabilityInsight = (deviceId) => {
  const readings = getDeviceReadings(deviceId);
  const freqValues = readings.map((r) => r.f);
  const stats = safeStats(freqValues);
  const timeline = readings.map((r) => ({
    timestamp: r.bucket,
    frequency: r.f,
    deviationFrom50: Number((r.f - 50).toFixed(4))
  }));
  const outOfBand = timeline.filter((item) => Math.abs(item.deviationFrom50) > 0.2);
  return {
    deviceId,
    avgFrequency: Number(stats.avg.toFixed(4)),
    stdDevFrequency: Number(stdDev(freqValues).toFixed(4)),
    minFrequency: Number(stats.min.toFixed(4)),
    maxFrequency: Number(stats.max.toFixed(4)),
    outOfBandCount: outOfBand.length,
    outOfBand: outOfBand.slice(0, 200),
    timeline
  };
};

export const getAnomalies = (deviceId) => {
  const readings = getDeviceReadings(deviceId);
  const events = [];

  for (let i = 1; i < readings.length; i += 1) {
    const prev = readings[i - 1];
    const curr = readings[i];

    if (curr.e < prev.e) {
      events.push({
        type: 'energy_drop',
        severity: 'critical',
        timestamp: curr.bucket,
        prevE: prev.e,
        currE: curr.e,
        delta: Number((curr.e - prev.e).toFixed(6))
      });
    }

    if (curr.pf > 0.99) {
      events.push({ type: 'pf_unity', severity: 'info', timestamp: curr.bucket, pf: curr.pf });
    } else if (curr.pf < 0.8) {
      events.push({ type: 'pf_low', severity: 'warning', timestamp: curr.bucket, pf: curr.pf });
    }

    for (const phase of ['va', 'vb', 'vc']) {
      if (curr[phase] < 220) {
        events.push({ type: 'voltage_sag', severity: 'warning', timestamp: curr.bucket, phase, value: curr[phase] });
      } else if (curr[phase] > 242) {
        events.push({ type: 'voltage_swell', severity: 'warning', timestamp: curr.bucket, phase, value: curr[phase] });
      }
    } 

    if (Math.abs(curr.f - 50) > 0.2) {
      events.push({ type: 'frequency_deviation', severity: 'warning', timestamp: curr.bucket, f: curr.f, deviation: Number((curr.f - 50).toFixed(4)) });
    }

    if (prev.ap > 0) {
      const pctChange = Math.abs(curr.ap - prev.ap) / prev.ap;
      if (pctChange > 0.3) {
        events.push({
          type: 'power_surge_or_drop',
          severity: 'warning',
          timestamp: curr.bucket,
          prevAp: prev.ap,
          currAp: curr.ap,
          changePercent: Number((pctChange * 100).toFixed(2))
        });
      }
    }
  }

  const summary = {};
  for (const event of events) {
    summary[event.type] = (summary[event.type] || 0) + 1;
  }

  return {
    deviceId,
    totalEvents: events.length,
    summary,
    events: events.slice(0, 500)
  };
};

export const getLoadProfile = (deviceId) => {
  const readings = getDeviceReadings(deviceId);
  const apValues = readings.map((r) => r.ap);
  const stats = safeStats(apValues);

  const top5 = [...readings]
    .sort((a, b) => b.ap - a.ap)
    .slice(0, 5)
    .map((r) => ({ timestamp: r.bucket, ap: r.ap, pf: r.pf, ca: r.ca, cb: r.cb, cc: r.cc }));

  const bottom5 = [...readings]
    .sort((a, b) => a.ap - b.ap)
    .slice(0, 5)
    .map((r) => ({ timestamp: r.bucket, ap: r.ap, pf: r.pf }));

  return {
    deviceId,
    avgDemandW: Number(stats.avg.toFixed(3)),
    maxDemandW: stats.max,
    minDemandW: stats.min,
    top5DemandMoments: top5,
    bottom5DemandMoments: bottom5
  };
};

// Bonus insights

export const getHarmonicDistortion = (deviceId) => {
  const readings = getDeviceReadings(deviceId);
  const timeline = readings.map((r) => {
    const cosPf = Math.max(0.01, Math.min(1, Math.abs(r.pf)));
    const thdEstimate = Number((Math.sqrt(1 / (cosPf * cosPf) - 1) * 100).toFixed(4));
    return {
      timestamp: r.bucket,
      pf: r.pf,
      thdEstimatePercent: thdEstimate
    };
  });

  const thdValues = timeline.map((t) => t.thdEstimatePercent);
  const stats = safeStats(thdValues);
  return {
    deviceId,
    note: 'THD estimated from power factor — displacement power factor approach',
    avgThdPercent: Number(stats.avg.toFixed(4)),
    maxThdPercent: Number(stats.max.toFixed(4)),
    highThdPeriods: thdValues.filter((t) => t > 20).length,
    timeline
  };
};

export const getDailyLoadCurve = (deviceId) => {
  const readings = getDeviceReadings(deviceId);
  const hourBuckets = Array.from({ length: 24 }, () => ({
    sumAp: 0,
    sumPf: 0,
    count: 0,
    maxAp: -Infinity
  }));

  for (const r of readings) {
    const ap = Number(r.ap);
    const pf = Number(r.pf);
    if (!Number.isFinite(ap) || !Number.isFinite(pf)) continue;
    const d = new Date(r.bucket);
    if (Number.isNaN(d.getTime())) continue;
    const hour = d.getUTCHours();
    const b = hourBuckets[hour];
    b.sumAp += ap;
    b.sumPf += pf;
    b.count += 1;
    if (ap > b.maxAp) b.maxAp = ap;
  }

  const curve = hourBuckets.map((bucket, hour) => ({
    hour,
    avgDemandW: bucket.count > 0 ? Number((bucket.sumAp / bucket.count).toFixed(3)) : 0,
    maxApW: bucket.count > 0 ? Number(bucket.maxAp.toFixed(3)) : 0,
    avgPf: bucket.count > 0 ? Number((bucket.sumPf / bucket.count).toFixed(4)) : 0,
    sampleCount: bucket.count
  }));

  const validCurve = curve.filter((e) => e.sampleCount > 0);
  if (validCurve.length === 0) {
    return {
      deviceId,
      peakHourUTC: null,
      peakAvgDemandW: 0,
      offPeakHourUTC: null,
      offPeakAvgDemandW: 0,
      curve
    };
  }

  // Peak = among hours that have data: highest avg demand; ties broken by higher instantaneous max (spike hour).
  const peakHour = validCurve.reduce((best, e) => {
    if (e.avgDemandW > best.avgDemandW) return e;
    if (e.avgDemandW === best.avgDemandW && e.maxApW > best.maxApW) return e;
    return best;
  }, validCurve[0]);

  const offPeakHour = validCurve.reduce((best, e) => {
    if (e.avgDemandW < best.avgDemandW) return e;
    if (e.avgDemandW === best.avgDemandW && e.maxApW < best.maxApW) return e;
    return best;
  }, validCurve[0]);

  return {
    deviceId,
    peakHourUTC: peakHour.hour,
    peakAvgDemandW: peakHour.avgDemandW,
    offPeakHourUTC: offPeakHour.hour,
    offPeakAvgDemandW: offPeakHour.avgDemandW,
    curve
  };
};

export const getCapacityUtilization = (deviceId, ratedCapacityW = 10000) => {
  const readings = getDeviceReadings(deviceId);
  const apValues = readings.map((r) => r.ap);
  const stats = safeStats(apValues);

  const overCapacityCount = apValues.filter((ap) => ap > ratedCapacityW).length;

  return {
    deviceId,
    ratedCapacityW,
    avgUtilizationPercent: Number(((stats.avg / ratedCapacityW) * 100).toFixed(2)),
    peakUtilizationPercent: Number(((stats.max / ratedCapacityW) * 100).toFixed(2)),
    overCapacityEvents: overCapacityCount,
    totalReadings: readings.length
  };
};
