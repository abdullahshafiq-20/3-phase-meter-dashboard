import { logger } from '../common/logger.js';
import dotenv from 'dotenv';
dotenv.config();

const NUMERIC_FIELDS = ['e', 'f', 'ap', 'ca', 'cb', 'cc', 'pf', 'rp', 'va', 'vb', 'vc'];

const toNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const normalizeTelemetryExportRow = (row) => {
  const ca = toNum(row.ca);
  const cb = toNum(row.cb);
  const cc = toNum(row.cc);
  const va = toNum(row.va);
  const vb = toNum(row.vb);
  const vc = toNum(row.vc);
  const rawPf = clamp(toNum(row.pf), -1, 1);
  const pf = Math.abs(rawPf);
  let ap = toNum(row.ap);

  if (ap === 0 && pf > 0) {
    const apparentPower = va * ca + vb * cb + vc * cc;
    if (apparentPower > 0) {
      ap = Number((apparentPower * pf).toFixed(3));
    }
  }

  const bucketRaw = row.bucket;
  const bucket =
    bucketRaw instanceof Date ? bucketRaw.toISOString() : new Date(String(bucketRaw)).toISOString();

  return {
    bucket,
    deviceid: String(row.deviceid ?? (row.deviceId ?? '')),
    datatype: row.datatype != null ? String(row.datatype) : 'TCMData',
    e: toNum(row.e),
    f: toNum(row.f),
    ap,
    ca,
    cb,
    cc,
    pf,
    rp: toNum(row.rp),
    va,
    vb,
    vc
  };
};

const byDevice = new Map();
const latestByDevice = new Map();
const lastSeenByDevice = new Map();
// Per-device set of ingested bucket ISO strings for deduplication.
// Prevents re-processing retained MQTT messages on reconnect.
const seenBuckets = new Map(); // deviceId → Set<string>

// Fixed cap requested: keep only latest 5k readings per meter.
const MAX_HISTORY_PER_DEVICE = 5000;


const trimDevice = (arr) => {
  if (arr.length > MAX_HISTORY_PER_DEVICE) {
    arr.splice(0, arr.length - MAX_HISTORY_PER_DEVICE);
  }
};

const bucketMs = (row) => new Date(row.bucket).getTime();

/**
 * Ingest a single row. For live data the timestamp is usually the latest,
 * so the fast-path is an append. For out-of-order rows we binary-insert.
 */
const ingestRow = (row) => {
  const normalized = normalizeTelemetryExportRow(row);
  const deviceId = normalized.deviceid;

  // Deduplicate by bucket timestamp.
  if (!seenBuckets.has(deviceId)) seenBuckets.set(deviceId, new Set());
  const seen = seenBuckets.get(deviceId);
  if (seen.has(normalized.bucket)) {
    // Already ingested — return the normalized form but skip storage mutation.
    return normalized;
  }
  seen.add(normalized.bucket);

  if (!byDevice.has(deviceId)) byDevice.set(deviceId, []);
  const arr = byDevice.get(deviceId);
  const ts = bucketMs(normalized);

  if (arr.length === 0 || ts >= bucketMs(arr[arr.length - 1])) {
    arr.push(normalized);
  } else {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (bucketMs(arr[mid]) <= ts) lo = mid + 1;
      else hi = mid;
    }
    arr.splice(lo, 0, normalized);
  }

  trimDevice(arr);

  const latest = latestByDevice.get(deviceId);
  if (!latest || ts >= bucketMs(latest)) {
    latestByDevice.set(deviceId, normalized);
  }
  lastSeenByDevice.set(deviceId, Date.now());
  return normalized;
};

/**
 * Ingest a batch of rows (e.g. from historical MQTT retained messages).
 * Appends all rows then re-sorts + trims once for efficiency.
 */
const ingestBatch = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const results = [];
  const touchedDevices = new Set();

  for (const row of rows) {
    const normalized = normalizeTelemetryExportRow(row);
    const deviceId = normalized.deviceid;

    // Deduplicate by bucket timestamp.
    if (!seenBuckets.has(deviceId)) seenBuckets.set(deviceId, new Set());
    const seen = seenBuckets.get(deviceId);
    if (seen.has(normalized.bucket)) continue;
    seen.add(normalized.bucket);

    touchedDevices.add(deviceId);
    if (!byDevice.has(deviceId)) byDevice.set(deviceId, []);
    byDevice.get(deviceId).push(normalized);
    results.push(normalized);
  }

  for (const deviceId of touchedDevices) {
    const arr = byDevice.get(deviceId);
    arr.sort((a, b) => bucketMs(a) - bucketMs(b));
    trimDevice(arr);
    latestByDevice.set(deviceId, arr[arr.length - 1]);
    lastSeenByDevice.set(deviceId, Date.now());
  }

  return results;
};

const getDeviceReadings = (deviceId) => {
  const data = byDevice.get(deviceId);
  if (!data || data.length === 0) {
    throw Object.assign(new Error(`No data yet for device: ${deviceId}`), { statusCode: 404 });
  }
  return data;
};

const getLatestReading = (deviceId) => {
  const reading = latestByDevice.get(deviceId);
  if (!reading) {
    throw Object.assign(new Error(`No live data for device: ${deviceId}`), { statusCode: 404 });
  }
  return reading;
};

const getAllLatestReadings = () => Object.fromEntries(latestByDevice);

const getDevices = () => {
  return Array.from(byDevice.keys()).sort();
};

const getDeviceStatus = (deviceId) => {
  const lastSeen = lastSeenByDevice.get(deviceId);
  const readings = byDevice.get(deviceId);
  return {
    deviceId,
    lastSeen: lastSeen ? new Date(lastSeen).toISOString() : null,
    lastSeenMs: lastSeen ?? null,
    secondsSinceLastData: lastSeen ? Math.round((Date.now() - lastSeen) / 1000) : null,
    totalReadings: readings?.length ?? 0,
    online: lastSeen ? (Date.now() - lastSeen) < 30000 : false,
    firstSeen: readings?.[0]?.bucket ?? null,
    latestBucket: readings?.at(-1)?.bucket ?? null,
  };
};

const getAllDeviceStatuses = () => {
  const statuses = {};
  for (const deviceId of byDevice.keys()) {
    statuses[deviceId] = getDeviceStatus(deviceId);
  }
  return statuses;
};

const getDeviceInfo = (deviceId) => {
  const data = getDeviceReadings(deviceId);
  return {
    deviceId,
    firstSeen: data[0]?.bucket,
    lastSeen: data[data.length - 1]?.bucket,
    totalReadings: data.length,
    online: lastSeenByDevice.has(deviceId) ? (Date.now() - lastSeenByDevice.get(deviceId)) < 30000 : false,
    secondsSinceLastData: lastSeenByDevice.has(deviceId) ? Math.round((Date.now() - lastSeenByDevice.get(deviceId)) / 1000) : null,
  };
};

const getRecentReadings = (deviceId, limit = 400) => {
  const data = getDeviceReadings(deviceId);
  const l = Math.min(5000, Math.max(1, Number(limit) || 400));
  const slice = data.slice(-l);
  return {
    limit: l,
    total: data.length,
    data: slice
  };
};

const getHistorical = (deviceId, page = 1, limit = 50) => {
  const data = getDeviceReadings(deviceId);
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(500, Math.max(1, Number(limit) || 50));
  const start = (p - 1) * l;
  const paged = data.slice(start, start + l);

  return {
    page: p,
    limit: l,
    total: data.length,
    totalPages: Math.ceil(data.length / l),
    data: paged
  };
};

const getRange = (deviceId, from, to) => {
  const data = getDeviceReadings(deviceId);

  let fromTs = Number.NEGATIVE_INFINITY;
  if (from != null && String(from).trim() !== '') {
    const t = new Date(from).getTime();
    if (Number.isFinite(t)) fromTs = t;
  }

  let toTs = Number.POSITIVE_INFINITY;
  if (to != null && String(to).trim() !== '') {
    const t = new Date(to).getTime();
    if (Number.isFinite(t)) toTs = t;
  }

  if (fromTs === Number.NEGATIVE_INFINITY && toTs === Number.POSITIVE_INFINITY) {
    return data;
  }

  return data.filter((entry) => {
    const ts = new Date(entry.bucket).getTime();
    if (!Number.isFinite(ts)) return false;
    return ts >= fromTs && ts <= toTs;
  });
};

const getSummary = (deviceId) => {
  const data = getDeviceReadings(deviceId);
  const summary = {};

  for (const field of NUMERIC_FIELDS) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const row of data) {
      const v = row[field];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    const avg = sum / (data.length || 1);
    summary[field] = { min: Number(min.toFixed(6)), max: Number(max.toFixed(6)), avg: Number(avg.toFixed(6)) };
  }

  return summary;
};

const getConsumption = (deviceId, interval = 'hourly') => {
  const data = getDeviceReadings(deviceId);
  const buckets = new Map();
  const keyFormatter =
    interval === 'daily'
      ? (iso) => iso.slice(0, 10)
      : (iso) => `${iso.slice(0, 13)}:00:00.000Z`;

  for (const row of data) {
    const key = keyFormatter(row.bucket);
    if (!buckets.has(key)) {
      buckets.set(key, { startE: row.e, endE: row.e, count: 1 });
    } else {
      const item = buckets.get(key);
      item.endE = row.e;
      item.count += 1;
    }
  }

  return Array.from(buckets.entries()).map(([bucket, value]) => ({
    bucket,
    consumedKwh: Number((value.endE - value.startE).toFixed(6)),
    sampleCount: value.count
  }));
};

const getConnectedDeviceIds = () => Array.from(latestByDevice.keys()).sort();

export const dataStore = {
  normalizeTelemetryExportRow,
  ingestRow,
  ingestBatch,
  getDeviceReadings,
  getLatestReading,
  getAllLatestReadings,
  getDevices,
  getDeviceStatus,
  getAllDeviceStatuses,
  getDeviceInfo,
  getRecentReadings,
  getHistorical,
  getRange,
  getSummary,
  getConsumption,
  getConnectedDeviceIds,
};

export {
  getDeviceReadings,
  getLatestReading,
  getAllLatestReadings,
  getDevices,
  getDeviceStatus,
  getAllDeviceStatuses,
  getDeviceInfo,
  getRecentReadings,
  getHistorical,
  getRange,
  getSummary,
  getConsumption,
  getConnectedDeviceIds,
};
