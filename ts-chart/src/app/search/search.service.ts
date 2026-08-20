import { computed, inject, Injectable, signal, Signal } from '@angular/core';
import { LocalSeriesSearchProvider } from './local-series-search.provider';
import { parseScopedQuery, ScopeToken } from './query-parser';
import {
  Filters,
  SeriesHit,
  SeriesSearchProvider,
  SeriesSearchRequest,
  SERIES_SEARCH_PROVIDER,
} from './search.types';

/** Debounce for a network provider. Skipped entirely when the provider is local. */
const NETWORK_DEBOUNCE_MS = 140;
/** Past this many accumulated hits, narrowing beats scrolling. */
const HARD_CAP = 500;
const CACHE_MAX = 50;

export interface SearchSessionOptions {
  pageSize?: number;
  /** Ids to boost (typically recents). */
  boostIds?: () => readonly string[];
}

/**
 * One search surface's state. Surfaces cannot share a single query signal — the
 * toolbar and the palette would overwrite each other — but they must share one
 * provider, one cache and one ranking, which is why the root service hands
 * these out rather than being one.
 */
export interface SearchSession {
  readonly raw: Signal<string>;
  readonly text: Signal<string>;
  readonly tokens: Signal<readonly ScopeToken[]>;
  readonly hits: Signal<readonly SeriesHit[]>;
  readonly total: Signal<number>;
  readonly took: Signal<number>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<string | null>;
  readonly hasMore: Signal<boolean>;
  readonly capped: Signal<boolean>;
  setQuery(text: string): void;
  loadMore(): void;
  retry(): void;
  reset(): void;
  destroy(): void;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  /**
   * The seam. Swapping to Spring Boot + Elasticsearch is one provider binding
   * in `app.config.ts`; nothing in any component changes.
   */
  private readonly provider: SeriesSearchProvider =
    inject(SERIES_SEARCH_PROVIDER, { optional: true }) ?? inject(LocalSeriesSearchProvider);

  /** Shared across sessions: same query from two surfaces costs one request. */
  private readonly cache = new Map<string, { at: number; hits: readonly SeriesHit[]; total: number; took: number }>();

  createSession(opts: SearchSessionOptions = {}): SearchSession {
    const pageSize = opts.pageSize ?? 25;
    const provider = this.provider;
    const cache = this.cache;

    const raw = signal('');
    const parsed = computed(() => parseScopedQuery(raw()));
    const text = computed(() => parsed().text);
    const tokens = computed(() => parsed().tokens);

    const hits = signal<readonly SeriesHit[]>([]);
    const total = signal(0);
    const took = signal(0);
    const loading = signal(false);
    const error = signal<string | null>(null);
    const skip = signal(0);

    let debounce: ReturnType<typeof setTimeout> | undefined;
    let abort: AbortController | undefined;
    let seq = 0;
    let destroyed = false;

    const keyOf = (req: SeriesSearchRequest) =>
      `${provider.id}|${req.q}|${JSON.stringify(req.filters ?? {})}|${JSON.stringify(
        req.exclude ?? {},
      )}|${req.skip}|${req.take}`;

    const run = async (append: boolean) => {
      if (destroyed) return;
      const p = parsed();
      const hasFilters = Object.keys(p.filters).length > 0 || Object.keys(p.exclude).length > 0;
      if (!hasFilters && p.text.length < provider.minQueryLength) {
        hits.set([]);
        total.set(0);
        error.set(null);
        loading.set(false);
        return;
      }

      const req: SeriesSearchRequest = {
        q: p.text,
        filters: p.filters as Filters,
        exclude: p.exclude as Filters,
        skip: append ? skip() : 0,
        take: pageSize,
        boostIds: opts.boostIds?.(),
      };
      const key = keyOf(req);

      // Serve the cache first so the list never flashes empty, then revalidate.
      const cached = cache.get(key);
      if (cached && !append) {
        hits.set(cached.hits);
        total.set(cached.total);
        took.set(cached.took);
      }

      abort?.abort();
      abort = new AbortController();
      const mine = ++seq;
      loading.set(true);
      try {
        const res = await provider.search({ ...req, signal: abort.signal });
        // A superseded response must never overwrite a newer one.
        if (destroyed || mine !== seq) return;
        hits.update((prev) => (append ? [...prev, ...res.hits].slice(0, HARD_CAP) : res.hits));
        total.set(res.total);
        took.set(res.took);
        error.set(null);
        skip.set((append ? skip() : 0) + res.hits.length);

        cache.set(key, { at: Date.now(), hits: res.hits, total: res.total, took: res.took });
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
      } catch (e) {
        if (destroyed || mine !== seq) return;
        // Keep whatever is on screen. A blank list plus an error is two
        // failures; the last good results plus a retry is one.
        error.set(e instanceof Error ? e.message : 'Search is unavailable');
      } finally {
        if (!destroyed && mine === seq) loading.set(false);
      }
    };

    const schedule = (append: boolean) => {
      clearTimeout(debounce);
      // Local answers are synchronous, so debouncing them would only add lag
      // that is not currently there. The delay appears when it starts costing
      // a round trip, not before.
      if (provider.isLocal) void run(append);
      else debounce = setTimeout(() => void run(append), NETWORK_DEBOUNCE_MS);
    };

    return {
      raw,
      text,
      tokens,
      hits: hits.asReadonly(),
      total: total.asReadonly(),
      took: took.asReadonly(),
      loading: loading.asReadonly(),
      error: error.asReadonly(),
      hasMore: computed(() => hits().length < Math.min(total(), HARD_CAP)),
      capped: computed(() => hits().length >= HARD_CAP && total() > HARD_CAP),
      setQuery: (v: string) => {
        raw.set(v);
        skip.set(0);
        schedule(false);
      },
      loadMore: () => {
        if (hits().length >= HARD_CAP) return;
        void run(true);
      },
      retry: () => {
        clearTimeout(debounce);
        void run(false);
      },
      reset: () => {
        raw.set('');
        hits.set([]);
        total.set(0);
        error.set(null);
        skip.set(0);
      },
      destroy: () => {
        destroyed = true;
        clearTimeout(debounce);
        abort?.abort();
      },
    };
  }
}
