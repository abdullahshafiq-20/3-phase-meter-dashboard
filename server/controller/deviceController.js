import { dataStore } from '../services/dataStore.js';
import { sendSuccess, sendError } from '../common/response.js';

export const listDevices = (_req, res) => {
  const devices = dataStore.getDevices();
  const statuses = dataStore.getAllDeviceStatuses();
  return sendSuccess(res, { devices, statuses }, 'Devices retrieved');
};

export const getDeviceInfo = (req, res) => {
  try {
    const info = dataStore.getDeviceInfo(req.params.deviceId);
    return sendSuccess(res, info, 'Device info retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 404);
  }
};
