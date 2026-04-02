import { getSanitizedUsers } from '../services/userService.js';
import { dataStore } from '../services/dataStore.js';
import { sendSuccess, sendError } from '../common/response.js';

export const listUsers = async (_req, res) => {
  try {
    const users = await getSanitizedUsers();
    return sendSuccess(res, { users }, 'Users retrieved');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getSystemStatus = (_req, res) => {
  const devices = dataStore.getDevices();
  const statuses = dataStore.getAllDeviceStatuses();
  return sendSuccess(res, {
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    deviceCount: devices.length,
    devices,
    statuses
  }, 'System status');
};

export const reloadCsv = async (_req, res) => {
  return sendSuccess(res, null, 'Data is now fully MQTT-driven. No CSV to reload.');
};
