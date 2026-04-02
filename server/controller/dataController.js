import { dataStore } from '../services/dataStore.js';
import { sendSuccess, sendError } from '../common/response.js';
import { parseRangeQuery } from '../common/rangeQuery.js';

export const getHistorical = (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = dataStore.getHistorical(req.params.deviceId, page, limit);
    return sendSuccess(res, result, 'Historical data retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

export const getRecentReadings = (req, res) => {
  try {
    const { limit } = req.query;
    const result = dataStore.getRecentReadings(req.params.deviceId, limit);
    return sendSuccess(res, result, 'Recent readings retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

export const getRange = (req, res) => {
  try {
    const { from, to } = parseRangeQuery(req.query);
    const data = dataStore.getRange(req.params.deviceId, from, to);
    return sendSuccess(res, { count: data.length, data }, 'Range data retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

export const getSummary = (req, res) => {
  try {
    const summary = dataStore.getSummary(req.params.deviceId);
    return sendSuccess(res, summary, 'Summary retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

export const getConsumption = (req, res) => {
  try {
    const interval = req.query.interval || 'hourly';
    const result = dataStore.getConsumption(req.params.deviceId, interval);
    return sendSuccess(res, { interval, entries: result }, 'Consumption data retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

export const getLiveSnapshot = (req, res) => {
  try {
    const reading = dataStore.getLatestReading(req.params.deviceId);
    return sendSuccess(res, reading, 'Live snapshot');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};
