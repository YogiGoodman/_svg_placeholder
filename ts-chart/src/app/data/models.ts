// =============================================================================
// Domain models for TS Chart
// =============================================================================

export type TabId = 'forecast' | 'contracts' | 'regions';

export type ChartKind = 'line' | 'area' | 'candlestick';

/**
 * How the series is *drawn* — orthogonal to the view mode (like capital.com's
 * chart-type selector). `candles` needs OHLC-capable data + a single series.
 */
export type ChartType = 'line' | 'area' | 'candles';

/**
 * View mode with energy-trading semantics — *what data* is shown. `latest`
 * (plain timeseries) is available for every series; the rest are gated by
 * per-series capability (see `core/modes.ts`).
 *  - `latest`   — most recent published timeseries.
 *  - `asof`     — point-in-time snapshot as data was known on a chosen date.
 *  - `forward`  — forward curve / term structure by delivery bucket, as-of a date.
 *  - `strip`    — block-average of consecutive forward contracts (Cal / seasonal strip).
 *  - `seasonal` — one line per year overlaid on a common Jan–Dec axis.
 */
export type ChartMode = 'latest' | 'asof' | 'forward' | 'strip' | 'seasonal';

/** How multiple selected series are arranged in the chart panel. */
export type ChartLayout = 'single' | 'overlay' | 'split';

export type Frequency = 'hourly' | 'daily' | 'weekly' | 'monthly';

/** A single point on a value series (lightweight-charts LineData shape). */
export interface LinePoint {
  time: string; // 'YYYY-MM-DD'
  value: number;
}

/** OHLC point (lightweight-charts CandlestickData shape). */
export interface OhlcPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Generation profile driving the deterministic dummy data. */
export interface SeriesShape {
  /** Anchor / most-recent value. */
  base: number;
  /** Long-run drift per year as a fraction of base (e.g. 0.08 = +8%/yr). */
  drift: number;
  /** Daily volatility as a fraction of base. */
  volatility: number;
  /** Seasonal amplitude as a fraction of base (0 = none). */
  seasonality: number;
  /** Phase offset for the seasonal sine, in days. */
  seasonPhase?: number;
  /** Hard floor (values clamped above this). */
  floor?: number;
}

export interface SeriesMeta {
  id: string;
  name: string;
  symbol: string;
  tab: TabId;
  /** Breadcrumb path through the tree, e.g. ['Energy', 'Crude Oil']. */
  path: string[];
  unit: string;
  currency?: string;
  source: string;
  frequency: Frequency;
  chartKind: ChartKind;
  description: string;
  shape: SeriesShape;
  tags?: string[];
  /** Simulated availability — 'forbidden'/'missing' drive error states. */
  status?: 'ok' | 'forbidden' | 'missing';
  /**
   * Explicit chart-mode capability override. When omitted, capabilities are
   * derived from the series metadata (see `capabilities()` in `core/modes.ts`)
   * so every series advertises a realistic, mixed set. `latest` is always on.
   */
  modes?: ChartMode[];
}

/**
 * A selected series decorated with its assigned chart color (see
 * `SeriesColorService` — colors are allocated on selection, not in the
 * catalog, so the palette stays theme-aware and scales to any catalog size).
 */
export type ChartedSeries = SeriesMeta & { color: string };

/** Tree node for the CDK nested tree. Leaves carry a seriesId. */
export interface TreeNode {
  id: string;
  label: string;
  /** Optional small caption under the label (e.g. unit / count). */
  caption?: string;
  icon?: string;
  children?: TreeNode[];
  /** Present only on leaves. */
  seriesId?: string;
  /** Simulated state badge on the node. */
  badge?: string;
}
