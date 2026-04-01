import { csvDataService } from '../services/csvDataService.js';
import { liveDataService } from '../services/liveDataService.js';
import { sendSuccess, sendError } from '../common/response.js';


export const getHistorical = (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = csvDataService.getHistorical(req.params.deviceId, page, limit);
    return sendSuccess(res, result, 'Historical data retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

export const getRange = (req, res) => {
  try {
    const { from, to } = req.query;
    const data = csvDataService.getRange(req.params.deviceId, from, to);
    return sendSuccess(res, { count: data.length, data }, 'Range data retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

export const getSummary = (req, res) => {
  try {
    const summary = csvDataService.getSummary(req.params.deviceId);
    return sendSuccess(res, summary, 'Summary retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

export const getConsumption = (req, res) => {
  try {
    const interval = req.query.interval || 'hourly';
    const result = csvDataService.getConsumption(req.params.deviceId, interval);
    return sendSuccess(res, { interval, entries: result }, 'Consumption data retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};


export const getLiveSnapshot = (req, res) => {
  try {
    const reading = liveDataService.getLatestLiveReading(req.params.deviceId);
    return sendSuccess(res, reading, 'Live snapshot');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};
