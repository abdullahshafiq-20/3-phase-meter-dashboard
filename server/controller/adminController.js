import { getSanitizedUsers } from '../services/userService.js';
import { csvDataService } from '../services/csvDataService.js';
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
  const devices = csvDataService.getDevices();
  return sendSuccess(res, {
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    deviceCount: devices.length,
    devices
  }, 'System status');
};

export const reloadCsv = async (_req, res) => {
  try {
    await csvDataService.initialize();
    return sendSuccess(res, null, 'CSV data reloaded successfully');
  } catch (err) {
    return sendError(res, `Failed to reload CSV: ${err.message}`, 500);
  }
};
