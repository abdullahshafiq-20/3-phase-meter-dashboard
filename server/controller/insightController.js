import * as insightService from '../services/insightService.js';
import { config } from '../config/index.js';
import { sendSuccess, sendError } from '../common/response.js';
import { parseRangeQuery } from '../common/rangeQuery.js';

const timeOpts = (req) => parseRangeQuery(req.query);

const wrapInsight = (fn) => (req, res) => {
  try {
    const data = fn(req);
    return sendSuccess(res, data);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

export const peakDemand = wrapInsight((req) =>
  insightService.getPeakDemand(req.params.deviceId, timeOpts(req))
);

export const energyCost = wrapInsight((req) =>
  insightService.getEnergyCost(req.params.deviceId, Number(req.query.unitPrice) || 0, timeOpts(req))
);

export const powerFactor = wrapInsight((req) =>
  insightService.getPowerFactorInsight(req.params.deviceId, timeOpts(req))
);

export const phaseImbalance = wrapInsight((req) =>
  insightService.getPhaseImbalanceInsight(req.params.deviceId, timeOpts(req))
);

export const voltageStability = wrapInsight((req) =>
  insightService.getVoltageStabilityInsight(
    req.params.deviceId,
    Number(req.query.nominalVoltage) || config.nominalVoltage,
    timeOpts(req)
  )
);

export const reactivePower = wrapInsight((req) =>
  insightService.getReactivePowerInsight(req.params.deviceId, timeOpts(req))
);

export const frequencyStability = wrapInsight((req) =>
  insightService.getFrequencyStabilityInsight(req.params.deviceId, timeOpts(req))
);

export const anomalies = wrapInsight((req) =>
  insightService.getAnomalies(req.params.deviceId, timeOpts(req))
);

export const loadProfile = wrapInsight((req) =>
  insightService.getLoadProfile(req.params.deviceId, timeOpts(req))
);

export const harmonicDistortion = wrapInsight((req) =>
  insightService.getHarmonicDistortion(req.params.deviceId, timeOpts(req))
);

export const dailyLoadCurve = wrapInsight((req) =>
  insightService.getDailyLoadCurve(req.params.deviceId, timeOpts(req))
);

export const capacityUtilization = wrapInsight((req) =>
  insightService.getCapacityUtilization(
    req.params.deviceId,
    Number(req.query.ratedCapacity) || undefined,
    timeOpts(req)
  )
);
