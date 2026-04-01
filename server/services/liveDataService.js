import { config } from '../config/index.js';
import { getDeviceReadings, normalizeTelemetryExportRow } from './csvDataService.js';

const jitter = (base, spread) => base + (Math.random() * 2 - 1) * spread;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const deviceState = new Map();

const ensureState = (deviceId) => {
  if (deviceState.has(deviceId)) return deviceState.get(deviceId);
  const baseline = getDeviceReadings(deviceId).at(-1);
  const state = normalizeTelemetryExportRow({
    ...baseline,
    bucket: new Date().toISOString()
  });
  deviceState.set(deviceId, state);
  return state;
};

const nextLiveReading = (deviceId) => {
  const prev = ensureState(deviceId);
  const now = new Date().toISOString();

  const currentBase = (prev.ca + prev.cb + prev.cc) / 3;
  const randomImbalance = Math.random() < 0.15 ? 1.8 : 0.8;

  const ca = clamp(jitter(currentBase, randomImbalance), 0, 500);
  const cb = clamp(jitter(currentBase, randomImbalance), 0, 500);
  const cc = clamp(jitter(currentBase, randomImbalance), 0, 500);
  const avgCurrent = (ca + cb + cc) / 3;

  const va = clamp(jitter(prev.va || 230, 2.5), 220, 242);
  const vb = clamp(jitter(prev.vb || 230, 2.5), 220, 242);
  const vc = clamp(jitter(prev.vc || 230, 2.5), 220, 242);
  const avgVoltage = (va + vb + vc) / 3;

  const pfDrop = Math.random() < 0.1 ? 0.08 : 0;
  const pf = clamp(jitter(prev.pf || 0.95, 0.02) - pfDrop, 0.7, 1);

  const ap = Number((avgVoltage * avgCurrent * pf * 0.95).toFixed(3));
  const rp = Number((ap * (1 - pf)).toFixed(3));
  const f = Number(clamp(jitter(50, 0.08), 49.6, 50.4).toFixed(3));

  const eIncrement = Math.max(ap / 360000, 0.0005);
  const e = Number((prev.e + eIncrement).toFixed(6));

  const next = {
    bucket: now,
    deviceid: deviceId,
    datatype: 'TCMData',
    e,
    f,
    ap,
    ca: Number(ca.toFixed(3)),
    cb: Number(cb.toFixed(3)),
    cc: Number(cc.toFixed(3)),
    pf: Number(pf.toFixed(4)),
    rp,
    va: Number(va.toFixed(3)),
    vb: Number(vb.toFixed(3)),
    vc: Number(vc.toFixed(3))
  };

  const normalized = normalizeTelemetryExportRow(next);
  deviceState.set(deviceId, normalized);
  return normalized;
};

const getLatestLiveReading = (deviceId) => nextLiveReading(deviceId);

const attachClient = (ws, deviceId) => {
  const sendReading = () => {
    try {
      ws.send(JSON.stringify(nextLiveReading(deviceId)));
    } catch {
      clearInterval(timer);
    }
  };

  sendReading();
  const timer = setInterval(sendReading, config.liveTickMs);

  ws.on('close', () => clearInterval(timer));
  ws.on('error', () => clearInterval(timer));
};

export const liveDataService = {
  nextLiveReading,
  getLatestLiveReading,
  attachClient
};

export { nextLiveReading, getLatestLiveReading, attachClient };
