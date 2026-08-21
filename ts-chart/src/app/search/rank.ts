import { MatchKind } from './search.types';

/**
 * Relevance weights. The ordering is the part that matters, not the absolute
 * numbers: an exact ticker must outrank everything, because a trader typing
 * `CL` wants WTI Crude Oil first and has no interest in every series whose
 * description happens to contain "cl".
 *
 * These need not match Elasticsearch's scores. The contract is only "higher is
 * better, and the provider's returned order is authoritative" — the client
 * never re-sorts, so the two implementations can rank differently in the tail
 * without the UI caring.
 */
export const RANK: Record<MatchKind, number> = {
  'symbol-exact': 1000,
  'symbol-prefix': 900,
  'name-prefix': 700,
  'name-word-prefix': 600,
  'name-substring': 400,
  tag: 300,
  path: 200,
  description: 100,
};

/**
 * Recency is applied as a TIE-BREAK in the provider's sort, not added to the
 * score. Folding it in was measurably wrong: three recently-viewed Brent
 * contracts outranked Brent Crude Oil itself for the query "brent". What the
 * user looked at yesterday breaks ties; it does not beat a better match.
 */

export interface Scored {
  score: number;
  matchedOn: MatchKind;
}

/** Score one record against a lowercased query. Null when nothing matches. */
export function scoreSeries(
  fields: {
    symbol: string;
    name: string;
    path: readonly string[];
    tags?: readonly string[];
    description?: string;
  },
  q: string,
): Scored | null {
  const sym = fields.symbol.toLowerCase();
  const name = fields.name.toLowerCase();

  if (sym === q) return { score: RANK['symbol-exact'], matchedOn: 'symbol-exact' };
  if (sym.startsWith(q)) return { score: RANK['symbol-prefix'], matchedOn: 'symbol-prefix' };
  if (name.startsWith(q)) return { score: RANK['name-prefix'], matchedOn: 'name-prefix' };
  if (name.split(/\s+/).some((w) => w.startsWith(q)))
    return { score: RANK['name-word-prefix'], matchedOn: 'name-word-prefix' };
  if (name.includes(q)) return { score: RANK['name-substring'], matchedOn: 'name-substring' };
  if (fields.tags?.some((t) => t.toLowerCase().startsWith(q)))
    return { score: RANK.tag, matchedOn: 'tag' };
  if (fields.path.some((p) => p.toLowerCase().includes(q)))
    return { score: RANK.path, matchedOn: 'path' };
  if (fields.description?.toLowerCase().includes(q))
    return { score: RANK.description, matchedOn: 'description' };
  return null;
}
