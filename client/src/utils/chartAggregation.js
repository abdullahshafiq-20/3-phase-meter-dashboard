/**
 * Bucket cumulative energy `e` into consumption per bucket (end - start kWh per group).
 * @param {{ bucket: string; e: number }[]} rows — chronological
 * @param {number} bucketMs — bucket width in milliseconds
 * @returns {{ bucket: string; consumedKwh: number; sampleCount: number }[]}
 */
export function aggregateConsumptionByInterval(rows, bucketMs) {
  if (!Array.isArray(rows) || rows.length === 0 || !Number.isFinite(bucketMs) || bucketMs < 1000) {
    return [];
  }
  const groups = new Map();
  for (const row of rows) {
    const t = new Date(row.bucket).getTime();
    if (Number.isNaN(t)) continue;
    const key = Math.floor(t / bucketMs) * bucketMs;
    if (!groups.has(key)) {
      groups.set(key, { startE: row.e, endE: row.e, count: 1, startIso: row.bucket });
    } else {
      const g = groups.get(key);
      g.endE = row.e;
      g.count += 1;
    }
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([key, g]) => ({
      bucket: new Date(key).toISOString(),
      consumedKwh: Number(Math.max(0, g.endE - g.startE).toFixed(6)),
      sampleCount: g.count,
    }));
}

/** Map preset id to bucket size for energy aggregation */
export const PRESET_TO_BUCKET_MS = {
  '1m': 10 * 1000,
  '15m': 60 * 1000,
  '30m': 5 * 60 * 1000,
  '1h': 5 * 60 * 1000,
  '2h': 15 * 60 * 1000,
  '4h': 30 * 60 * 1000,
  '12h': 60 * 60 * 1000,
  '24h': 60 * 60 * 1000,
  '7d': 24 * 60 * 60 * 1000,
  /** Fallback when rows hint missing — wide span still gets multiple bars via adaptive path below */
  all: 5 * 60 * 1000,
};

/**
 * Pick bucket width from actual time span so short data runs produce multiple bars.
 * @param {{ bucket: string }[]} rows chronological
 * @param {number} [targetBuckets] desired number of bars
 * @param {number} [min] minimum bucket width (ms)
 */
export function adaptiveBucketMs(rows, targetBuckets = 60, min = 10_000) {
  if (!Array.isArray(rows) || rows.length < 2) return min;
  const t0 = new Date(rows[0].bucket).getTime();
  const t1 = new Date(rows[rows.length - 1].bucket).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return min;
  const span = Math.max(0, t1 - t0);
  if (span <= 0) return min;
  const raw = Math.ceil(span / targetBuckets);
  const max = 7 * 24 * 60 * 60 * 1000;
  return Math.min(max, Math.max(min, raw));
}

/**
 * Return the ideal bucket width for a preset + actual data.
 * Uses the static map as a ceiling, but switches to adaptive sizing
 * when the data span is shorter than the static bucket (avoids "1 bar").
 */
export function bucketMsForPreset(presetId, rowsHint) {
  const staticMs = PRESET_TO_BUCKET_MS[presetId] ?? 60 * 60 * 1000;

  if (!Array.isArray(rowsHint) || rowsHint.length < 2) return staticMs;

  const adaptive = adaptiveBucketMs(rowsHint);
  return Math.min(staticMs, adaptive);
}
