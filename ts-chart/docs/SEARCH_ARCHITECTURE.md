# TS Chart — Search Architecture

How series search works today, and exactly what changes when it moves to
Spring Boot + Hibernate Search over Elasticsearch.

---

## 1. Shape

```
  ⌘K palette          toolbar input          browse dock
        │                    │                    │
        └──────────┬─────────┴────────────────────┘
                   ▼
        <ts-search-results>          one row template, one ARIA contract
                   ▼
             SearchSession           per-surface signals (query, hits, total…)
                   ▼
             SearchService           shared provider + cache + parser
                   ▼
        SERIES_SEARCH_PROVIDER       ← the seam
                   ▼
   LocalSeriesSearchProvider   →   HttpSeriesSearchProvider (later)
```

Each surface gets its **own session** — the toolbar and the palette would
otherwise overwrite each other's query — but they share one provider, one cache
and one ranking. One result component means one keyboard model and one place for
a bug to live.

---

## 2. The contract

`src/app/search/search.types.ts`.

```ts
interface SeriesSearchRequest {
  q: string;                 // free text, scope tokens already stripped
  filters?: Filters;         // OR within a key, AND across keys
  exclude?: Filters;
  skip?: number;             // -> Elastic `from`
  take?: number;             // -> Elastic `size`
  boostIds?: readonly string[];
  signal?: AbortSignal;      // providers MUST honour this
}

interface SeriesSearchResponse {
  hits: readonly SeriesHit[];
  total: number;             // may exceed hits.length — this is the "of M"
  skip: number; take: number;
  took: number;              // ms, shown in the footer
}
```

The field names deliberately mirror DevExtreme's `LoadOptions`
(`skip`/`take`/`filter`/`searchValue`), which is already this repo's vocabulary
for lazy loading in `dx-tree-list.component.ts` — and which maps one-to-one onto
an Elasticsearch `from`/`size`/`query` request.

**`SeriesHit` is self-contained.** A row renders from the hit alone and never
reads `SERIES[id]`. This is the single most important rule here: the moment a
row reaches into the local catalog, the backend swap stops being a drop-in,
because the server will return ids this client has never seen.

---

## 3. Ranking

| Match | Weight |
|---|---|
| exact symbol | 1000 |
| symbol prefix | 900 |
| name prefix | 700 |
| name word prefix | 600 |
| name substring | 400 |
| tag | 300 |
| path | 200 |
| description | 100 |

Then tie-breaks, **in this order**:

1. **Shorter symbol** — puts a benchmark above the contracts derived from it
   (`BRN` before `BRN C1` / `BRN M1` / `BRN R JAN27`, all of which match the
   query "brent" on name-prefix just as well).
2. **Recency** — a tie-break only, and deliberately *below* canonical-ness.
   When recency was added to the score instead, three recently-viewed Brent
   contracts pushed Brent Crude Oil itself to fourth for the query "brent".
3. **Alphabetical** — so the order is total and the list never reshuffles.

The exact weights need not match Elasticsearch's. The contract is only *"higher
is better, and the provider's order is authoritative"* — **the client never
re-sorts**, so the two implementations may differ in the tail without the UI
caring.

Suggested Elastic equivalents: `symbol.raw` term ^10, `symbol` edge-ngram prefix
^6, `name` `match_phrase_prefix` ^4, `name` `match` ^2, `tags` term ^2, `path`
^1, `description` ^0.5.

---

## 4. Highlighting

Providers return fragments containing `<em>` marks. `parseFragment()` splits on
that tag and the template interpolates the parts:

```html
@for (p of r.nameParts; track $index) { <span [class.hl]="p.hit">{{ p.text }}</span> }
```

**No `[innerHTML]`, no `bypassSecurityTrust`, anywhere in this path.** A
fragment arriving from a future index cannot inject markup regardless of what is
in it, and the local and server render paths are byte-identical — there is no
`if (isLocal)` branch to drift.

Configure Elastic to match: `pre_tags: ["<em>"]`, `post_tags: ["</em>"]`,
`number_of_fragments: 1`, `fragment_size: 120`, `no_match_size: 0`, and
`type: "plain"` for `symbol` so short fields highlight whole.

`.hl` uses `--ts-accent-weak`. **Not amber** — `--ts-highlight` is reserved for
"now" (the today marker, the live price pill), and spending it on search
highlighting breaks that reservation.

---

## 5. Scope tokens and facets

`tag:energy brent`, `-tag:gas`, `class:"north sea"`. Parsed client-side by
`parseScopedQuery()` into `filters` / `exclude`, so the same syntax works for
both providers. Keys: `tab`, `class`, `source`, `freq`, `unit`, `ccy`, `tag`,
`status`.

**Unknown keys stay in the free text.** A ticker like `M+1:` or a pasted
`http://…` must not silently vanish into a filter — one surprise like that and
the syntax is never trusted again.

**Facet counting gotcha:** a facet's buckets must be computed with *that facet's
own key excluded* from the filter set. Otherwise selecting `class:Energy` makes
every other class read 0 and the user can never widen. Elastic gets this free
with `post_filter` + global aggs.

---

## 6. Behaviour the UI depends on

- **Local is synchronous, and stays that way.** `provider.isLocal` makes
  `SearchService` skip debouncing entirely, so today's palette is exactly as
  instant as it was. The 140ms debounce appears only when a keystroke starts
  costing a round trip.
- **Never flash empty.** A cache hit paints immediately and revalidates behind
  it; otherwise the previous hits stay on screen. On error the hits stay too,
  with a retry — a blank list plus an error message is two failures.
- **Superseded responses are dropped** by sequence number, and the in-flight
  request is aborted via `AbortSignal`.
- **Conveyor, not dialog.** Picking a result toggles it, keeps the surface open,
  clears the input and refocuses. Do not "fix" this into a dialog that closes.
- **The cap is visible.** At `maxSeries`, the row about to displace something
  says `replaces BRN` *before* Enter, and the palette offers Undo / Raise cap
  after. `add()` returns `{ evicted }` to make that possible.

---

## 7. Migration to Spring Boot + Elasticsearch

A future developer edits **two files**.

**1. `src/app/search/http-series-search.provider.ts`** (new)

```
GET /api/v1/series/search
   ?q=brent&from=0&size=50
   &f.class=Energy&f.class=Power     # repeated param = OR within a key
   &f.freq=daily
   &x.tag=gas                        # exclusion
   &boost=brent,ttf
```

```json
{
  "hits": [{
    "id": "brent", "symbol": "BRN", "name": "Brent Crude Oil",
    "path": ["Energy", "Crude Oil"], "unit": "USD/bbl",
    "source": "ICE Brent (reference)", "frequency": "daily",
    "tab": "forecast", "status": "ok",
    "score": 41.7, "matchedOn": "symbol-prefix",
    "highlights": [
      { "field": "symbol", "fragment": "<em>BRN</em>" },
      { "field": "name",   "fragment": "<em>Brent</em> Crude Oil" }
    ]
  }],
  "total": 214, "skip": 0, "take": 50, "took": 8
}
```

Errors: `application/problem+json` (RFC 7807). `429` carries `Retry-After`.

**2. `src/app/app.config.ts`**

```ts
{ provide: SERIES_SEARCH_PROVIDER, useClass: HttpSeriesSearchProvider },
provideHttpClient(withFetch()),
```

Index mapping: `symbol` as `keyword` + `symbol.text` (edge_ngram 1–12,
lowercased) + `symbol.raw`; `name` as `text` + `name.prefix` + `name.keyword`;
`path` as `keyword[]` + `path.text`; `tags`/`source`/`frequency`/`tab`/`unit`/
`currency`/`status` as `keyword`; `description` as `text`.

If deep paging is ever needed, `search_after` requires a deterministic tiebreak
in the sort (`_score desc, symbol.raw asc`) or pages duplicate rows.

**Do not** reintroduce a catalog import in a component to "just get this
working" — that is the one change that silently un-does all of the above.

---

## 8. Recent queries and the palette's row model (round 14)

**Recent searches are text, not ids.** `RecentQueriesService`
(`src/app/search/recent-queries.service.ts`, key `tschart.recentq`, max 8) is
separate from `SelectionService.recentIds`, which is recently *charted series*. A
trader repeats a query far more often than they re-pick one id out of it.

Committed on a **successful pick** in either surface (`command-palette` and
`toolbar-search` `pick()`), never in `setQuery` — recording per keystroke fills
the list with `t`, `tt`, `ttf`.

**"Recent" rows resolve through the provider.** `SearchService.lookup(ids)` wraps
`provider.lookup()`; no surface reads `SERIES` to build a row. That was the last
place the catalog leaked into the UI, and it is exactly what breaks on the day the
backend lands.

**One listbox, three groups.** The ⌘K palette interleaves recent queries, series
hits and actions, so it owns the `role="listbox"` and a single flat index space;
`SearchResultsComponent` renders as a `role="group"` inside it via
`[embedded]="true"` and `[indexOffset]`, emitting GLOBAL indices so no caller
translates between two numbering schemes. Standalone (toolbar dropdown, browse
dock) the component is still the listbox itself.

The reason this matters is not tidiness: `aria-activedescendant` can only name a
row inside the listbox it points at. Before this, command rows were `<button>`s
outside the listbox and a screen reader never heard the highlight move onto them.
