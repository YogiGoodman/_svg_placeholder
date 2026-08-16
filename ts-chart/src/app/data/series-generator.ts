// =============================================================================
// Deterministic seeded timeseries generator.
// Same series id -> identical data every reload (stable "real-looking" demo).
// No API, no randomness leak across series.
// =============================================================================

import { LinePoint, OhlcPoint, SeriesMeta } from './models';

// --- Seeded PRNG (mulberry32) ------------------------------------------------
function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Date helpers ------------------------------------------------------------
/** Fixed "today" so the prototype is reproducible. */
export const TODAY = '2026-08-16';

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function dayOfYear(d: Date): number {
  return Math.floor(
    (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
      Date.UTC(d.getUTCFullYear(), 0, 0)) /
      86400000,
  );
}

const TWO_PI = Math.PI * 2;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Generate a daily line series ending on TODAY spanning `days` days back.
 * Deterministic per series id. Blends drift + seasonal sine + mean-reverting
 * random walk, clamped to an optional floor.
 */
export function generateLine(meta: SeriesMeta, days = 730): LinePoint[] {
  const { base, drift, volatility, seasonality, seasonPhase = 0, floor } = meta.shape;
  const rnd = mulberry32(hashSeed(meta.id));
  const end = new Date(`${TODAY}T00:00:00Z`);
  const points: LinePoint[] = [];

  // Work forward from the oldest date so drift accrues naturally.
  let walk = 0; // mean-reverting deviation (fraction of base)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);

    const tYears = (days - 1 - i) / 365;
    const trend = base * (1 + drift * tYears);

    const dayOfYear = Math.floor(
      (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
        Date.UTC(d.getUTCFullYear(), 0, 0)) /
        86400000,
    );
    const season =
      base * seasonality * Math.sin(TWO_PI * ((dayOfYear + seasonPhase) / 365));

    // Ornstein–Uhlenbeck-ish mean reversion keeps the walk bounded.
    const shock = (rnd() - 0.5) * 2 * volatility;
    walk = walk * 0.94 + shock;

    let value = trend + season + base * walk;
    if (floor !== undefined) value = Math.max(floor, value);

    points.push({ time: toISO(d), value: round(value) });
  }
  return points;
}

/** Derive OHLC candles from a daily line by synthesizing intraday spread. */
export function generateOhlc(meta: SeriesMeta, days = 730): OhlcPoint[] {
  const line = generateLine(meta, days);
  const rnd = mulberry32(hashSeed(meta.id + ':ohlc'));
  const spread = meta.shape.volatility * meta.shape.base * 0.9;

  return line.map((p, i) => {
    const prevClose = i === 0 ? p.value : line[i - 1].value;
    const open = round(prevClose + (rnd() - 0.5) * spread * 0.4);
    const close = p.value;
    const hi = Math.max(open, close) + rnd() * spread;
    const lo = Math.min(open, close) - rnd() * spread;
    return {
      time: p.time,
      open,
      high: round(hi),
      low: round(meta.shape.floor !== undefined ? Math.max(meta.shape.floor, lo) : lo),
      close,
    };
  });
}

function round(n: number): number {
  // Adaptive precision: small numbers keep more decimals.
  const abs = Math.abs(n);
  const p = abs >= 100 ? 100 : abs >= 10 ? 1000 : 10000;
  return Math.round(n * p) / p;
}

// --- As-of (point-in-time vintage) -------------------------------------------
/**
 * The series *as it was known on `asOf`*. History is truncated at the as-of date
 * (no future leakage) and the most recent ~6 weeks are lightly re-revised — a
 * different as-of date yields a subtly different tail, mimicking data vintages.
 * Deterministic per (series, asOf).
 */
export function generateAsOf(meta: SeriesMeta, asOf: string, days = 730): LinePoint[] {
  const full = generateLine(meta, days);
  const cut = full.findIndex((p) => p.time > asOf);
  const hist = cut === -1 ? full : full.slice(0, cut);
  if (hist.length === 0) return full.slice(0, 1);
  const rnd = mulberry32(hashSeed(`${meta.id}:asof:${asOf}`));
  const n = hist.length;
  const window = 42; // revised tail length
  const amp = meta.shape.volatility * meta.shape.base * 0.8;
  return hist.map((p, i) => {
    const ageFromEdge = n - 1 - i;
    if (ageFromEdge >= window) return p;
    const w = (window - ageFromEdge) / window; // stronger nearer the as-of edge
    let v = p.value + (rnd() - 0.5) * 2 * amp * w;
    if (meta.shape.floor !== undefined) v = Math.max(meta.shape.floor, v);
    return { time: p.time, value: round(v) };
  });
}

// --- Forward curve (term structure) ------------------------------------------
export type DeliveryBucket = 'month' | 'quarter' | 'season' | 'year';

/** A point on a forward curve — x is the delivery period, not a trade date. */
export interface CurvePoint {
  time: string; // delivery-period start ('YYYY-MM-DD')
  value: number;
  label: string; // human delivery label, e.g. 'Mar-27', 'Q1-27', 'Cal-28'
  bucket: DeliveryBucket;
}

/** Fine monthly forward prices out `months` months, snapshot as-of `asOf`. */
function monthlyForward(
  meta: SeriesMeta,
  asOf: string,
  months: number,
): { date: Date; value: number }[] {
  const hist = generateAsOf(meta, asOf);
  const spot = hist[hist.length - 1]?.value ?? meta.shape.base;
  const rnd = mulberry32(hashSeed(`${meta.id}:fwd:${asOf}`));
  // Contango(+)/backwardation(-) slope, fraction of spot per year. Slight
  // contango bias; gas/power get a stronger seasonal shape via meta.shape.
  const slope = (rnd() - 0.4) * 0.14;
  const start = new Date(`${asOf}T00:00:00Z`);
  const sY = start.getUTCFullYear();
  const sM = start.getUTCMonth();
  const out: { date: Date; value: number }[] = [];
  for (let k = 1; k <= months; k++) {
    const d = new Date(Date.UTC(sY, sM + k, 1));
    const tYears = k / 12;
    const trend = spot * (1 + slope * tYears);
    const season =
      spot *
      meta.shape.seasonality *
      Math.sin(TWO_PI * ((dayOfYear(d) + (meta.shape.seasonPhase ?? 0)) / 365));
    const noise = (rnd() - 0.5) * 2 * meta.shape.volatility * spot * 0.25;
    let v = trend + season + noise;
    if (meta.shape.floor !== undefined) v = Math.max(meta.shape.floor, v);
    out.push({ date: d, value: round(v) });
  }
  return out;
}

/**
 * Forward curve for display: monthly buckets near-dated, coarsening to quarters
 * then calendar years further out — matching how forward markets actually quote.
 */
export function generateForwardCurve(meta: SeriesMeta, asOf: string): CurvePoint[] {
  const mf = monthlyForward(meta, asOf, 60);
  const pts: CurvePoint[] = [];
  // Months 1..18 — monthly granularity.
  for (let i = 0; i < 18 && i < mf.length; i++) {
    const d = mf[i].date;
    pts.push({
      time: toISO(d),
      value: mf[i].value,
      label: `${MONTHS[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`,
      bucket: 'month',
    });
  }
  // Months 19..36 — quarterly averages.
  for (let start = 18; start < 36 && start < mf.length; start += 3) {
    const slice = mf.slice(start, start + 3);
    if (!slice.length) break;
    const d = slice[0].date;
    const q = Math.floor(d.getUTCMonth() / 3) + 1;
    pts.push({
      time: toISO(d),
      value: round(avg(slice.map((x) => x.value))),
      label: `Q${q}-${String(d.getUTCFullYear()).slice(2)}`,
      bucket: 'quarter',
    });
  }
  // Remaining — calendar-year averages.
  const byYear = new Map<number, number[]>();
  for (const p of mf.slice(36)) {
    const y = p.date.getUTCFullYear();
    (byYear.get(y) ?? byYear.set(y, []).get(y)!).push(p.value);
  }
  for (const [y, vals] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    pts.push({
      time: `${y}-01-01`,
      value: round(avg(vals)),
      label: `Cal-${String(y).slice(2)}`,
      bucket: 'year',
    });
  }
  return pts;
}

/**
 * Strip = block-average of consecutive forward contracts, one step per calendar
 * year (Cal strip). Stepped line at each year's start, snapshot as-of `asOf`.
 */
export function generateStrip(meta: SeriesMeta, asOf: string): CurvePoint[] {
  const mf = monthlyForward(meta, asOf, 60);
  const byYear = new Map<number, number[]>();
  for (const p of mf) {
    const y = p.date.getUTCFullYear();
    (byYear.get(y) ?? byYear.set(y, []).get(y)!).push(p.value);
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([y, vals]) => ({
      time: `${y}-01-01`,
      value: round(avg(vals)),
      label: `Cal-${String(y).slice(2)}`,
      bucket: 'year' as DeliveryBucket,
    }));
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

// --- Derived stats -----------------------------------------------------------
export interface SeriesStats {
  last: number;
  prev: number;
  changeAbs: number;
  changePct: number;
  min: number;
  max: number;
  avg: number;
  first: number;
}

export function computeStats(points: LinePoint[]): SeriesStats {
  const values = points.map((p) => p.value);
  const last = values[values.length - 1];
  const prev = values[values.length - 2] ?? last;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    last,
    prev,
    changeAbs: round(last - prev),
    changePct: prev ? round(((last - prev) / prev) * 100) : 0,
    min,
    max,
    avg: round(avg),
    first: values[0],
  };
}

// --- Interval slicing --------------------------------------------------------
export type IntervalKey = '1M' | '3M' | '6M' | '1Y' | 'ALL';

const INTERVAL_DAYS: Record<IntervalKey, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  ALL: Infinity,
};

export function sliceInterval<T extends { time: string }>(
  data: T[],
  interval: IntervalKey,
): T[] {
  const n = INTERVAL_DAYS[interval];
  if (!isFinite(n)) return data;
  return data.slice(Math.max(0, data.length - n));
}

/** Explicit from–to window (inclusive, 'YYYY-MM-DD' lexicographic). */
export function sliceRange<T extends { time: string }>(data: T[], from: string, to: string): T[] {
  return data.filter((p) => p.time >= from && p.time <= to);
}

/** Earliest generated date (~2 years back from the fixed TODAY). */
export const DATA_MIN = '2024-08-17';
