import { csvDataService } from '../services/csvDataService.js';
import { sendSuccess, sendError } from '../common/response.js';

export const listDevices = (_req, res) => {
  const devices = csvDataService.getDevices();
  return sendSuccess(res, { devices }, 'Devices retrieved');
};

export const getDeviceInfo = (req, res) => {
  try {
    const info = csvDataService.getDeviceInfo(req.params.deviceId);
    return sendSuccess(res, info, 'Device info retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 404);
  }
};
