import { Injectable } from '@angular/core';
import { SERIES } from '../data/series-catalog.data';
import { SeriesMeta } from '../data/models';
import { localHighlight } from './highlight';
import { scoreSeries } from './rank';
import {
  Filters,
  ScopeKey,
  SeriesHit,
  SeriesSearchProvider,
  SeriesSearchRequest,
  SeriesSearchResponse,
  toHit,
} from './search.types';

/** Project a catalog record onto a facet key. */
function facetValue(m: SeriesMeta, key: ScopeKey): readonly string[] {
  switch (key) {
    case 'tab':
      return [m.tab];
    case 'class':
      return [m.path[0] ?? ''];
    case 'source':
      return [m.source];
    case 'freq':
      return [m.frequency];
    case 'unit':
      return [m.unit];
    case 'ccy':
      return [m.currency ?? ''];
    case 'tag':
      return m.tags ?? [];
    case 'status':
      return [m.status ?? 'ok'];
  }
}

function matchesFilters(m: SeriesMeta, f: Filters | undefined, want: boolean): boolean {
  if (!f) return true;
  for (const [k, vals] of Object.entries(f) as [ScopeKey, readonly string[]][]) {
    if (!vals?.length) continue;
    const mine = facetValue(m, k).map((v) => v.toLowerCase());
    const hit = vals.some((v) => mine.includes(v.toLowerCase()));
    if (hit !== want) return false;
  }
  return true;
}

/**
 * The provider that ships today: the hardcoded catalog, ranked.
 *
 * It satisfies exactly the same contract the HTTP provider will, including
 * generating `<em>` highlight fragments, so the render path never learns which
 * one answered. `search()` is synchronous under the Promise — see `isLocal`,
 * which the service uses to skip debouncing so the palette stays instant.
 */
@Injectable({ providedIn: 'root' })
export class LocalSeriesSearchProvider implements SeriesSearchProvider {
  readonly id = 'local';
  readonly minQueryLength = 1;
  readonly isLocal = true;

  async search(req: SeriesSearchRequest): Promise<SeriesSearchResponse> {
    const t0 = performance.now();
    const q = req.q.trim().toLowerCase();
    const skip = req.skip ?? 0;
    const take = req.take ?? 50;
    const boost = new Set(req.boostIds ?? []);

    const scored: SeriesHit[] = [];
    for (const meta of Object.values(SERIES)) {
      if (!matchesFilters(meta, req.filters, true)) continue;
      if (!matchesFilters(meta, req.exclude, false)) continue;

      // An empty query with active facets is a valid browse, not a no-op.
      const s = q ? scoreSeries(meta, q) : { score: 1, matchedOn: undefined };
      if (!s) continue;

      const hit = toHit(meta, s.score, s.matchedOn);
      scored.push(
        q
          ? {
              ...hit,
              highlights: [
                { field: 'symbol' as const, fragment: localHighlight(meta.symbol, q) },
                { field: 'name' as const, fragment: localHighlight(meta.name, q) },
              ],
            }
          : hit,
      );
    }

    // Match quality first, then the tie-breaks in this order:
    //
    //  1. Shorter symbol. This is what puts a benchmark above the contracts
    //     derived from it — "BRN" before "BRN C1"/"BRN M1"/"BRN R JAN27", all
    //     of which match "brent" on name-prefix just as well.
    //  2. Recency. Deliberately BELOW canonical-ness and deliberately NOT added
    //     to the score: when it was a score addend, three recently-viewed Brent
    //     contracts pushed Brent Crude Oil itself to fourth for the query
    //     "brent". What the user opened yesterday breaks ties; it does not beat
    //     a more canonical match.
    //  3. Alphabetical, so the order is total and the list never reshuffles.
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        a.symbol.length - b.symbol.length ||
        Number(boost.has(b.id)) - Number(boost.has(a.id)) ||
        a.symbol.localeCompare(b.symbol),
    );

    return {
      hits: scored.slice(skip, skip + take),
      total: scored.length,
      skip,
      take,
      took: Math.round(performance.now() - t0),
    };
  }

  async lookup(ids: readonly string[]): Promise<readonly SeriesHit[]> {
    return ids.map((id) => SERIES[id]).filter(Boolean).map((m) => toHit(m));
  }
}
