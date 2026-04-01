import { csvDataService } from '../services/csvDataService.js';
import { liveDataService } from '../services/liveDataService.js';
import * as insightService from '../services/insightService.js';
import { sendSuccess, sendError } from '../common/response.js';

export const getDashboard = (req, res) => {
  try {
    const { deviceId } = req.params;
    const readings = csvDataService.getDeviceReadings(deviceId);
    const info = csvDataService.getDeviceInfo(deviceId);
    const summary = csvDataService.getSummary(deviceId);
    const consumption = csvDataService.getConsumption(deviceId, 'daily');
    const peakDemand = insightService.getPeakDemand(deviceId);
    const powerFactor = insightService.getPowerFactorInsight(deviceId);
    const loadCurve = insightService.getDailyLoadCurve(deviceId);
    const live = liveDataService.getLatestLiveReading(deviceId);

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

    const totalConsumed = Math.max(0, readings.at(-1).e - readings[0].e);
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
