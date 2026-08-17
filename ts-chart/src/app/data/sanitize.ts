// Defensive data hygiene for the chart boundary.
//
// Mock generators always emit complete arrays, but a real API (Spring/MDM feed,
// see docs/WORKSPACE_PERSISTENCE.md) can return null values, NaN, missing/mis-
// ordered dates or duplicate timestamps. lightweight-charts throws on any of
// these. sanitizePoints() is the single choke point that guarantees only clean,
// sorted, de-duplicated points ever reach setData — a broken point silently
// drops, never blanks the pane or throws.
//
// Results are memoized by input-array identity so repeated renders return the
// SAME cleaned reference — that keeps the chart-view survivor diff (dataRef
// comparison) stable and flicker-free.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const cache = new WeakMap<object, readonly unknown[]>();

function isFiniteNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** A point is valid if it has a well-formed date and finite numeric fields. */
function isValid(p: unknown): boolean {
  if (!p || typeof p !== 'object') return false;
  const r = p as Record<string, unknown>;
  if (typeof r['time'] !== 'string' || !DATE_RE.test(r['time'])) return false;
  // OHLC point: every leg must be finite.
  if (r['open'] !== undefined || r['close'] !== undefined) {
    return (
      isFiniteNum(r['open']) &&
      isFiniteNum(r['high']) &&
      isFiniteNum(r['low']) &&
      isFiniteNum(r['close'])
    );
  }
  // Line / curve point: value must be finite.
  if ('value' in r) return isFiniteNum(r['value']);
  return false;
}

/**
 * Drop invalid points, sort ascending by time, dedupe timestamps (last wins).
 * Never throws. Memoized by input identity for stable output references.
 */
export function sanitizePoints<T extends { time: string }>(data: readonly T[]): readonly T[] {
  if (!Array.isArray(data)) return [];
  const hit = cache.get(data);
  if (hit) return hit as readonly T[];

  const kept = data.filter(isValid) as T[];
  kept.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

  // Dedupe by time — a later duplicate overwrites an earlier one.
  const byTime = new Map<string, T>();
  for (const p of kept) byTime.set(p.time, p);
  const clean: readonly T[] = kept.length === byTime.size ? kept : Array.from(byTime.values());

  cache.set(data, clean);
  return clean;
}
