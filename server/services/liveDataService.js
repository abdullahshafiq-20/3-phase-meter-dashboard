import { hivemqClient } from '../config/hivemq.js';
import { socketConfig } from '../config/socket.js';
import { dataStore } from './dataStore.js';
import { logger } from '../common/logger.js';
import { config } from '../config/index.js';

// ── Seed chunk counters (for log throttling) ────────────────────────
// Counts how many seed chunks have arrived per device so we can log
// only every LOG_EVERY_N_CHUNKS instead of for every chunk.
const seedChunkCountByDevice = new Map();
const LOG_EVERY_N_CHUNKS = 50; // log once per 50 seed chunks per device

// ── 30-second emission gate per device ──────────────────────────────
// Only push a live:reading socket event once every EMIT_INTERVAL_MS per device.
// Seed chunks (bulk_publish historical data) NEVER emit socket events —
// only the meter_simulator single-row messages do, and only when gated.
const EMIT_INTERVAL_MS = 8000; // 8 seconds
const lastEmittedAtByDevice = new Map();   // deviceId → Date.now() of last socket emit
const lastEmittedBucketByDevice = new Map(); // deviceId → ISO bucket string of last emitted row

/**
 * Returns true if we should push a live socket event for this device right now.
 * Enforces the 30-second gate and deduplicates by bucket timestamp.
 */
const shouldEmit = (deviceId, bucket) => {
  const lastBucket = lastEmittedBucketByDevice.get(deviceId);
  if (lastBucket === bucket) {
    // Exact same reading already sent — skip silently.
    return false;
  }
  const lastAt = lastEmittedAtByDevice.get(deviceId);
  if (lastAt && (Date.now() - lastAt) < EMIT_INTERVAL_MS) {
    // Within the 30-second window — suppress.
    return false;
  }
  return true;
};

/**
 * Record that we just emitted for this device.
 */
const markEmitted = (deviceId, bucket) => {
  lastEmittedAtByDevice.set(deviceId, Date.now());
  lastEmittedBucketByDevice.set(deviceId, bucket);
};

// ── Subscription ─────────────────────────────────────────────────────
const subscribeHistorical = () => {
  try {
    const historicalDeviceIds = Array.isArray(config.historicalDeviceIds) ? config.historicalDeviceIds : [];
    const scopedTopics = historicalDeviceIds.length
      ? historicalDeviceIds.map((id) => `meter/historical/${id}/#`)
      : [config.hivemq.topics.historical];

    const onHistoricalMessage = (topic, payload) => {
      // Topic structure:
      //   meter/historical/{deviceId}          ← meter_simulator live row  (single object)
      //   meter/historical/{deviceId}/seed/{n} ← bulk_publish seed chunk   (array)
      const parts = topic.split('/');
      const deviceId = parts[2] || parts.at(-1);
      const isSeedChunk = parts[3] === 'seed';

      // ── Seed chunks from bulk_publish ──────────────────────────────
      // These are retained historical batches.  We ingest them into the
      // in-memory store for REST API queries but NEVER emit live socket
      // events — doing so would flood connected clients on every server
      // restart / reconnect.
      if (isSeedChunk) {
        if (!config.ingestSeedOnStart) {
          // Seed ingestion disabled — skip entirely.
          return;
        }

        const rows = Array.isArray(payload) ? payload : [payload];
        const tagged = rows.map((r) => ({ ...r, deviceid: deviceId }));
        const ingested = dataStore.ingestBatch(tagged);

        // Throttled logging — only log every LOG_EVERY_N_CHUNKS chunks per device
        // to avoid flooding the console when thousands of retained chunks arrive.
        const chunkCount = (seedChunkCountByDevice.get(deviceId) || 0) + 1;
        seedChunkCountByDevice.set(deviceId, chunkCount);
        if (chunkCount === 1 || chunkCount % LOG_EVERY_N_CHUNKS === 0) {
          const total = dataStore.getDeviceStatus(deviceId).totalReadings || 0;
          logger.info(
            `HiveMQ seed: ${deviceId} — chunk #${chunkCount}, ingested ${ingested.length} new rows (store size: ${total})`
          );
        }
        return;
      }

      // ── Live / simulator rows ──────────────────────────────────────
      // meter_simulator.py publishes a single JSON object every 30 s.
      // We ingest the row then apply the 30-second gate before emitting
      // to connected socket clients.
      const rowPayload = Array.isArray(payload) ? payload[payload.length - 1] : payload;
      if (!rowPayload || typeof rowPayload !== 'object') {
        logger.warn(`liveDataService: received non-object payload on ${topic}, skipping`);
        return;
      }

      const normalized = dataStore.ingestRow({ ...rowPayload, deviceid: deviceId });

      if (shouldEmit(deviceId, normalized.bucket)) {
        socketConfig.emitLiveReading(deviceId, normalized);
        socketConfig.broadcastDeviceStatus(deviceId, dataStore.getDeviceStatus(deviceId));
        markEmitted(deviceId, normalized.bucket);
        logger.debug(
          `liveDataService: emitted live:reading for ${deviceId} bucket=${normalized.bucket}`
        );
      } else {
        logger.debug(
          `liveDataService: suppressed duplicate/early emit for ${deviceId} bucket=${normalized.bucket}`
        );
      }
    };

    for (const topic of scopedTopics) {
      hivemqClient.subscribe(topic, onHistoricalMessage);
    }
    logger.info(
      `Live data service: subscribed to HiveMQ historical topics (${scopedTopics.join(', ')}). ` +
      `Simulator rows throttled to one socket emit per ${EMIT_INTERVAL_MS / 1000}s per device.`
    );
  } catch {
    logger.warn('Live data service: HiveMQ not connected — historical subscription deferred');
  }
};

const getLatestLiveReading = (deviceId) => dataStore.getLatestReading(deviceId);
const getAllLatestReadings = () => dataStore.getAllLatestReadings();
const getConnectedDeviceIds = () => dataStore.getConnectedDeviceIds();

export const liveDataService = {
  subscribeHistorical,
  getLatestLiveReading,
  getAllLatestReadings,
  getConnectedDeviceIds,
};

export { subscribeHistorical, getLatestLiveReading, getAllLatestReadings, getConnectedDeviceIds };
