/** Presets for relative time windows ending at `now` (or optional anchor). */

export const CHART_TIME_PRESETS = [
  { id: '1m', label: '1 min', durationMs: 60 * 1000 },
  { id: '15m', label: '15 min', durationMs: 15 * 60 * 1000 },
  { id: '30m', label: '30 min', durationMs: 30 * 60 * 1000 },
  { id: '1h', label: '1 hour', durationMs: 60 * 60 * 1000 },
  { id: '2h', label: '2 hours', durationMs: 2 * 60 * 60 * 1000 },
  { id: '4h', label: '4 hours', durationMs: 4 * 60 * 60 * 1000 },
  { id: '12h', label: '12 hours', durationMs: 12 * 60 * 60 * 1000 },
  { id: '24h', label: '24 hours', durationMs: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7 days', durationMs: 7 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'All data', durationMs: null },
];

/**
 * @param {string} presetId
 * @param {string | null} [anchorIso] — end of window (default: now)
 * @returns {{ from: string | null; to: string | null; label: string }}
 */
export function getWindowFromPreset(presetId, anchorIso = null) {
  const preset = CHART_TIME_PRESETS.find((p) => p.id === presetId) || CHART_TIME_PRESETS.find((p) => p.id === '24h');
  const endMs = anchorIso ? new Date(anchorIso).getTime() : Date.now();
  if (Number.isNaN(endMs)) {
    const now = Date.now();
    return {
      from: null,
      to: new Date(now).toISOString(),
      label: preset.label,
    };
  }
  if (preset.durationMs == null) {
    return { from: null, to: null, label: preset.label };
  }
  const startMs = endMs - preset.durationMs;
  return {
    from: new Date(startMs).toISOString(),
    to: new Date(endMs).toISOString(),
    label: preset.label,
  };
}

export function formatWindowRange(from, to) {
  if (!from && !to) return 'All data';
  const a = from ? new Date(from) : null;
  const b = to ? new Date(to) : null;
  if (a && b && !Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
    return `${a.toLocaleString()} → ${b.toLocaleString()}`;
  }
  return '';
}
