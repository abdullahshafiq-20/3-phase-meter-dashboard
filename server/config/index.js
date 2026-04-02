import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');

const parseNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const parseCsvList = (value) =>
  String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const parseBoolean = (value, fallback = false) => {
  if (value == null) return fallback;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
};

export const config = {
  port: parseNumber(process.env.PORT, 3000),
  env: process.env.NODE_ENV || 'development',
  usersConfigPath:
    process.env.USERS_CONFIG_PATH || path.join(serverRoot, 'users.config.json'),
  nominalVoltage: parseNumber(process.env.NOMINAL_VOLTAGE, 230),
  ratedPhaseAmps: parseNumber(process.env.RATED_PHASE_CURRENT_A, 100),
  maxHistoryPerDevice: parseNumber(process.env.MAX_HISTORY_PER_DEVICE, 50000),
  historicalDeviceIds: parseCsvList(process.env.HISTORICAL_DEVICE_IDS),
  ingestSeedOnStart: parseBoolean(process.env.INGEST_SEED_ON_START, false),
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-env',
    accessExpiry: process.env.JWT_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
  },
  hivemq: {
    host: process.env.HIVE_MQ_HOST || '',
    port: parseNumber(process.env.HIVE_MQ_PORT, 8883),
    username: process.env.HIVE_MQ_USERNAME || '',
    password: process.env.HIVE_MQ_PASSWORD || '',
    websocketPort: parseNumber(process.env.HIVE_MQ_WEBSOCKET_PORT, 8884),
    topics: {
      // Single unified bus: all data comes through `meter/historical/...`
      historical: 'meter/historical/#',
    },
  },
};
