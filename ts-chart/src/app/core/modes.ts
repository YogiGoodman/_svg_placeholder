// =============================================================================
// Chart-mode capabilities & metadata.
//
// Energy-trading terminals expose several ways to look at a series, but NOT every
// series supports every view: a weather forecast has no forward curve, a market
// contract is not "revised" so it has no as-of vintage, a flat safe-haven metal
// has no meaningful seasonality. This module is the single source of truth for
// which modes a series advertises and why an unavailable one is disabled.
// =============================================================================

import { ChartMode, ChartType, SeriesMeta } from '../data/models';

export interface ModeMeta {
  id: ChartMode;
  label: string;
  /** Badge text shown on the chart legend. */
  badge: string;
  /** One-line explanation (tooltip on the mode button). */
  hint: string;
}

/** Display order + copy for the mode bar (what data — not how it's drawn). */
export const MODE_META: ModeMeta[] = [
  {
    id: 'latest',
    label: 'Latest',
    badge: 'LATEST',
    hint: 'Most recent published timeseries.',
  },
  {
    id: 'asof',
    label: 'As of',
    badge: 'AS OF',
    hint: 'Point-in-time snapshot — the series as it was known on a chosen date.',
  },
  {
    id: 'forward',
    label: 'Forward',
    badge: 'FWD CURVE',
    hint: 'Forward curve by delivery period (months → quarters → seasons → years).',
  },
  {
    id: 'strip',
    label: 'Strip',
    badge: 'STRIP',
    hint: 'Block-average of consecutive forward contracts (e.g. Cal / seasonal strip).',
  },
  {
    id: 'seasonal',
    label: 'Seasonal',
    badge: 'SEASONAL',
    hint: 'One line per year overlaid on a common Jan–Dec axis.',
  },
];

export interface TypeMeta {
  id: ChartType;
  label: string;
  icon: string;
  hint: string;
}

/** Chart type (how it's drawn) — a compact selector, à la capital.com. */
export const TYPE_META: TypeMeta[] = [
  { id: 'line', label: 'Line', icon: 'chart-line', hint: 'Line chart.' },
  { id: 'area', label: 'Area', icon: 'chart-area', hint: 'Filled area chart.' },
  {
    id: 'candles',
    label: 'Candles',
    icon: 'chart-candlestick',
    hint: 'OHLC candles — single OHLC-capable series, on Latest or As-of.',
  },
];

/** Modes on a plain time axis where OHLC candles can be drawn. */
const CANDLE_MODES = new Set<ChartMode>(['latest', 'asof']);

/** Can a series be OHLC? Candlestick contracts + liquid benchmarks. */
export function ohlcCapable(s: SeriesMeta): boolean {
  return s.chartKind === 'candlestick' || !!s.tags?.includes('benchmark');
}

/**
 * Whether a chart type is valid right now. Line is always valid; `area` needs
 * a single visible series (overlapping fills reduce readability); `candles`
 * need a single OHLC-capable series on a time-axis mode.
 */
export function typeSupported(
  type: ChartType,
  primary: SeriesMeta | null,
  mode: ChartMode,
  visibleCount: number,
): boolean {
  if (type === 'line') return true;
  if (type === 'area') return visibleCount <= 1;
  return !!primary && visibleCount === 1 && CANDLE_MODES.has(mode) && ohlcCapable(primary);
}

export const MODE_LABEL: Record<ChartMode, string> = Object.fromEntries(
  MODE_META.map((m) => [m.id, m.label]),
) as Record<ChartMode, string>;

export const MODE_BADGE: Record<ChartMode, string> = Object.fromEntries(
  MODE_META.map((m) => [m.id, m.badge]),
) as Record<ChartMode, string>;

export const MODE_HINT: Record<ChartMode, string> = Object.fromEntries(
  MODE_META.map((m) => [m.id, m.hint]),
) as Record<ChartMode, string>;

function hasTag(s: SeriesMeta, ...tags: string[]): boolean {
  return !!s.tags?.some((t) => tags.includes(t));
}

/** True if the series is a price with a tradeable forward market. */
function isForwardTradeable(s: SeriesMeta): boolean {
  if (!s.currency) return false; // weather (°C, GW) has no forward curve
  if (hasTag(s, 'spread')) return false; // spreads are derived, not a curve
  if (hasTag(s, 'continuous')) return false; // back-adjusted continuous series
  return hasTag(s, 'oil', 'gas', 'power', 'carbon', 'lng', 'metals');
}

/**
 * Derive the mode capabilities for a series from its metadata. Deterministic and
 * deliberately mixed so the UI must handle "some modes available, some not".
 * An explicit `meta.modes` override wins.
 */
export function capabilities(s: SeriesMeta): ChartMode[] {
  if (s.modes?.length) {
    return s.modes.includes('latest') ? s.modes : ['latest', ...s.modes];
  }

  const modes: ChartMode[] = ['latest'];

  // As-of vintages exist where data is revised over time: forecasts + weather.
  if (s.tab === 'forecast') modes.push('asof');

  // Forward curve + strips: only genuinely forward-traded commodities.
  if (isForwardTradeable(s)) {
    modes.push('forward');
    // Strips are quoted for gas/power/carbon/oil (not thin metals markets).
    if (hasTag(s, 'oil', 'gas', 'power', 'carbon', 'lng')) modes.push('strip');
  }

  // Seasonality only where the shape actually has a meaningful cycle.
  if (s.shape.seasonality >= 0.1) modes.push('seasonal');

  return modes;
}

export function modeSupported(s: SeriesMeta, mode: ChartMode): boolean {
  return capabilities(s).includes(mode);
}

/**
 * Modes available to ALL series in a compare set (intersection). Used to gate the
 * mode bar when comparing — a mode only one series supports would be misleading.
 * `latest` is always present.
 */
export function commonModes(list: SeriesMeta[]): ChartMode[] {
  if (!list.length) return MODE_META.map((m) => m.id);
  const sets = list.map((s) => new Set(capabilities(s)));
  return MODE_META.map((m) => m.id).filter((id) => sets.every((set) => set.has(id)));
}

/**
 * Modes available to ANY series in a compare set (union). The mode bar enables
 * these; series that lack the mode are dimmed ("n/a") on the chart instead of
 * blocking the whole set — the trader is never locked out of a view that at
 * least one charted series supports.
 */
export function unionModes(list: SeriesMeta[]): ChartMode[] {
  if (!list.length) return MODE_META.map((m) => m.id);
  const sets = list.map((s) => new Set(capabilities(s)));
  return MODE_META.map((m) => m.id).filter((id) => sets.some((set) => set.has(id)));
}

/**
 * Explain, for a compare set, why a mode is unavailable — names the series that
 * lack it (for a themed tooltip on the disabled button).
 */
export function unsupportedReason(list: SeriesMeta[], mode: ChartMode): string | null {
  if (mode === 'latest') return null;
  const missing = list.filter((s) => !modeSupported(s, mode));
  if (!missing.length) return null;
  const names = missing.map((s) => s.symbol).join(', ');
  return `Not available for ${names}`;
}
