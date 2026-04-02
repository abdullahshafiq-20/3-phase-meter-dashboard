import { dataStore } from '../services/dataStore.js';
import * as insightService from '../services/insightService.js';
import { sendSuccess, sendError } from '../common/response.js';

export const getDashboard = (req, res) => {
  try {
    const { deviceId } = req.params;
    const readings = dataStore.getDeviceReadings(deviceId);
    const info = dataStore.getDeviceInfo(deviceId);
    const summary = dataStore.getSummary(deviceId);
    const consumption = dataStore.getConsumption(deviceId, 'daily');
    const peakDemand = insightService.getPeakDemand(deviceId);
    const powerFactor = insightService.getPowerFactorInsight(deviceId);
    const loadCurve = insightService.getDailyLoadCurve(deviceId);
    const live = dataStore.getLatestReading(deviceId);

    const recentReadings = readings.slice(-24).map((r) => ({
      bucket: r.bucket,
      ap: r.ap,
      pf: r.pf,
      va: r.va,
      vb: r.vb,
      vc: r.vc,
      ca: r.ca,
      cb: r.cb,
      cc: r.cc
    }));

    const totalConsumed = readings.length > 1 ? Math.max(0, readings.at(-1).e - readings[0].e) : 0;
    const lastDayConsumption = consumption.at(-1)?.consumedKwh || 0;
    const peakReadingDate = new Date(peakDemand.timestamp);
    const peakReadingHourUTC = Number.isNaN(peakReadingDate.getTime())
      ? null
      : peakReadingDate.getUTCHours();

    return sendSuccess(res, {
      deviceInfo: info,
      liveReading: live,
      summary: {
        totalConsumedKwh: Number(totalConsumed.toFixed(4)),
        lastDayConsumedKwh: Number(lastDayConsumption.toFixed(4)),
        peakDemandW: peakDemand.peakApW,
        peakDemandTimestamp: peakDemand.timestamp,
        peakReadingHourUTC,
        avgPowerFactor: powerFactor.avgPf,
        lowPfCount: powerFactor.lowPfCount,
        peakHourUTC: loadCurve.peakHourUTC,
        offPeakHourUTC: loadCurve.offPeakHourUTC,
        avgVoltage: {
          va: summary.va.avg,
          vb: summary.vb.avg,
          vc: summary.vc.avg
        },
        avgCurrent: {
          ca: summary.ca.avg,
          cb: summary.cb.avg,
          cc: summary.cc.avg
        }
      },
      recentReadings,
      dailyConsumption: consumption,
      loadCurve: loadCurve.curve
    }, 'Dashboard data');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

export const getAllDevicesDashboard = (_req, res) => {
  try {
    const statuses = dataStore.getAllDeviceStatuses();
    const latest = dataStore.getAllLatestReadings();
    return sendSuccess(res, { statuses, latest }, 'All devices dashboard');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};
