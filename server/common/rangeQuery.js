/**
 * Normalize `from` / `to` query params: drop empty strings, array duplicates, and invalid dates
 * so APIs behave like an open-ended range (full history) instead of filtering everything out.
 */
export function parseRangeQuery(query) {
  const pick = (raw) => {
    if (raw == null) return undefined;
    const v = Array.isArray(raw) ? raw[0] : raw;
    const s = String(v).trim();
    if (s === '' || s === 'undefined' || s === 'null') return undefined;
    const t = new Date(s).getTime();
    if (!Number.isFinite(t)) return undefined;
    return s;
  };
  return {
    from: pick(query?.from),
    to: pick(query?.to)
  };
}
