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

export const config = {
  port: parseNumber(process.env.PORT, 3000),
  env: process.env.NODE_ENV || 'development',
  csvPath: process.env.CSV_PATH || path.join(serverRoot, 'data', 'sample-readings.csv'),
  usersConfigPath:
    process.env.USERS_CONFIG_PATH || path.join(serverRoot, 'users.config.json'),
  nominalVoltage: parseNumber(process.env.NOMINAL_VOLTAGE, 230),
  liveTickMs: parseNumber(process.env.LIVE_TICK_MS, 10000),
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-env',
    accessExpiry: process.env.JWT_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
  }
};