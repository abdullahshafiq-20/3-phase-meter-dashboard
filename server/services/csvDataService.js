import fs from 'node:fs';
import { parse } from 'csv-parse';
import { config } from '../config/index.js';
import { logger } from '../common/logger.js';

const NUMERIC_FIELDS = ['e', 'f', 'ap', 'ca', 'cb', 'cc', 'pf', 'rp', 'va', 'vb', 'vc'];

const toNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Normalizes one telemetry_export / TCMData row to the same shape used everywhere
 * (matches the CSV stream `data` handler — ap reconstruction, PF clamp, types).
 * Safe to call on rows already normalized (idempotent for typical values).
 * @param {Record<string, unknown>} row
 */
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

let records = [];
const byDevice = new Map();


const initialize = () =>
  new Promise((resolve, reject) => {
    const rows = [];

    const parser = fs
      .createReadStream(config.csvPath, { encoding: 'utf-8' })
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true
        })
      );

    parser.on('data', (row) => {
      rows.push(normalizeTelemetryExportRow(row));
    });

    parser.on('error', (err) => {
      reject(err);
    });

    parser.on('end', () => {
      records = rows.sort((a, b) => new Date(a.bucket) - new Date(b.bucket));

      byDevice.clear();
      for (const record of records) {
        if (!byDevice.has(record.deviceid)) byDevice.set(record.deviceid, []);
        byDevice.get(record.deviceid).push(record);
      }

      logger.info(`Loaded ${records.length} readings across ${byDevice.size} device(s)`);
      resolve();
    });
  });

const getDeviceReadings = (deviceId) => {
  const data = byDevice.get(deviceId);
  if (!data) throw Object.assign(new Error(`Device not found: ${deviceId}`), { statusCode: 404 });
  return data;
};

const getDevices = () => Array.from(byDevice.keys()).sort();

const getDeviceInfo = (deviceId) => {
  const data = getDeviceReadings(deviceId);
  return {
    deviceId,
    firstSeen: data[0]?.bucket,
    lastSeen: data[data.length - 1]?.bucket,
    totalReadings: data.length
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

const getRecentReadings = (deviceId, limit = 400) => {
  const data = getDeviceReadings(deviceId);
  const l = Math.min(2000, Math.max(1, Number(limit) || 400));
  const slice = data.slice(-l);
  return {
    limit: l,
    total: data.length,
    data: slice
  };
};

const getRange = (deviceId, from, to) => {
  const data = getDeviceReadings(deviceId);
  const fromTs = from ? new Date(from).getTime() : Number.NEGATIVE_INFINITY;
  const toTs = to ? new Date(to).getTime() : Number.POSITIVE_INFINITY;

  return data.filter((entry) => {
    const ts = new Date(entry.bucket).getTime();
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

export const csvDataService = {
  initialize,
  normalizeTelemetryExportRow,
  getDeviceReadings,
  getDevices,
  getDeviceInfo,
  getHistorical,
  getRecentReadings,
  getRange,
  getSummary,
  getConsumption
};

// Also export individual functions for direct imports
export {
  initialize as initializeCsvData,
  getDeviceReadings,
  getDevices,
  getDeviceInfo,
  getHistorical,
  getRecentReadings,
  getRange,
  getSummary,
  getConsumption
};
