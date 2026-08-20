import { InjectionToken } from '@angular/core';
import { SeriesMeta } from '../data/models';

/**
 * Facet keys a query can be scoped by. Both providers must honour every key
 * listed here, so adding one is a deliberate two-sided change.
 */
export type ScopeKey = 'tab' | 'class' | 'source' | 'freq' | 'unit' | 'ccy' | 'tag' | 'status';

/** OR within a key, AND across keys. */
export type Filters = Partial<Record<ScopeKey, readonly string[]>>;

/**
 * A search request. The field names deliberately mirror DevExtreme's
 * `LoadOptions` (`skip`/`take`/`filter`/`searchValue`) because that shape is
 * already the repo's vocabulary for lazy loading — and because it maps
 * one-to-one onto an Elasticsearch `from`/`size`/`query` request, which is
 * where this is going.
 */
export interface SeriesSearchRequest {
  /** Free text, with any scope tokens already stripped out. */
  q: string;
  filters?: Filters;
  exclude?: Filters;
  /** Offset paging. `skip` -> Elastic `from`, `take` -> Elastic `size`. */
  skip?: number;
  take?: number;
  /** Ids to boost mildly (recents). Ranking stays provider-authoritative. */
  boostIds?: readonly string[];
  /** Providers MUST honour this — a superseded request has to abort in flight. */
  signal?: AbortSignal;
}

export type MatchKind =
  | 'symbol-exact'
  | 'symbol-prefix'
  | 'name-prefix'
  | 'name-word-prefix'
  | 'name-substring'
  | 'tag'
  | 'path'
  | 'description';

export interface SearchHighlight {
  field: 'symbol' | 'name' | 'path';
  /**
   * Fragments containing `<em>` marks. NEVER assigned via innerHTML — the
   * renderer splits on the tag and interpolates the parts, so a hostile
   * fragment from a future server is inert by construction.
   */
  fragment: string;
}

/**
 * A hit is SELF-CONTAINED. A result row must render without reaching into the
 * local catalog — that is the entire point of the abstraction, and the moment
 * a row reads `SERIES[id]` the backend swap stops being a drop-in.
 */
export interface SeriesHit {
  id: string;
  symbol: string;
  name: string;
  path: readonly string[];
  unit: string;
  source: string;
  frequency: string;
  tab: string;
  status?: 'ok' | 'forbidden' | 'missing';
  /** Opaque relevance, higher is better. The client NEVER re-sorts. */
  score: number;
  matchedOn?: MatchKind;
  highlights?: readonly SearchHighlight[];
}

export interface SeriesSearchResponse {
  hits: readonly SeriesHit[];
  /** May exceed `hits.length` — this is the count for "N of M". */
  total: number;
  skip: number;
  take: number;
  /** Provider time in ms, surfaced in the footer once this is a real round trip. */
  took: number;
}

export interface SeriesSearchProvider {
  readonly id: string;
  /** Local is 1 — traders type `CL` and expect a hit. A server may want 2. */
  readonly minQueryLength: number;
  /**
   * True when answers are synchronous. The service skips debouncing entirely
   * for a local provider, so today's palette stays exactly as instant as it is.
   */
  readonly isLocal: boolean;
  search(req: SeriesSearchRequest): Promise<SeriesSearchResponse>;
  /**
   * Resolve ids to hits. Easy to forget and load-bearing: once the catalog
   * lives on a server, restored workspaces and deep links reference ids this
   * client has never seen.
   */
  lookup(ids: readonly string[], signal?: AbortSignal): Promise<readonly SeriesHit[]>;
}

export const SERIES_SEARCH_PROVIDER = new InjectionToken<SeriesSearchProvider>(
  'SERIES_SEARCH_PROVIDER',
);

/** Adapt a local catalog record into the wire shape. */
export function toHit(meta: SeriesMeta, score = 0, matchedOn?: MatchKind): SeriesHit {
  return {
    id: meta.id,
    symbol: meta.symbol,
    name: meta.name,
    path: meta.path,
    unit: meta.unit,
    source: meta.source,
    frequency: meta.frequency,
    tab: meta.tab,
    status: meta.status,
    score,
    matchedOn,
  };
}
