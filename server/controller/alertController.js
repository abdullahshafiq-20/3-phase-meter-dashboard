import { sendSuccess, sendError } from '../common/response.js';
import { getAlertsTimeline, getLiveAlertSnapshot } from '../services/alertService.js';

export const timeline = (req, res) => {
  try {
    const { from, to, limit, ratedCapacity } = req.query;
    const data = getAlertsTimeline(req.params.deviceId, {
      from,
      to,
      limit,
      ratedCapacityW: ratedCapacity != null ? Number(ratedCapacity) : undefined
    });
    return sendSuccess(res, data, 'Alert timeline');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

export const liveSnapshot = (req, res) => {
  try {
    const { ratedCapacity } = req.query;
    const data = getLiveAlertSnapshot(req.params.deviceId, {
      ratedCapacityW: ratedCapacity != null ? Number(ratedCapacity) : undefined
    });
    return sendSuccess(res, data, 'Live alert snapshot');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};
