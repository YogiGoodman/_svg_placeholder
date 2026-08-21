# Workspace Persistence — from localStorage to production scale

The prototype restores a trader's screen exactly as they left it. This document
specifies the current client-only mechanism and the production design on the
target stack: **Spring Boot (serving the Angular app) · Redis · MDM service ·
SQL Server (Hibernate / Hibernate Search) · Elasticsearch** (series search).

---

## 1. The payload (same shape everywhere)

One small versioned document — the *entire* restorable screen:

```jsonc
{
  "v": 1,
  "selectedIds": ["brent", "ttf", "eua"],   // ordered — order IS the color-slot order
  "hiddenIds": ["eua"],
  "compareIds": ["brent", "ttf"],
  "view": "chart",                          // chart | data
  "chartMode": "latest",                    // latest | asof | forward | strip | seasonal
  "chartType": "line",                      // line | area | candles
  "layout": "overlay",                      // single | overlay | split
  "interval": "6M",                         // 1M | 3M | 6M | 1Y | ALL
  "customRange": { "from": "2025-10-01", "to": "2025-12-24" }, // or null
  "asOf": "2026-08-16"
}
```

Typically **< 2 KB**. Series are referenced by **stable MDM ids only** — never
display names, never colors (colors are derived from selection order at render
time, so a restored workspace recolors itself correctly per theme).

## 2. Today (prototype): localStorage

- Key `tschart.workspace`, written synchronously by a signals `effect` in
  `SelectionService` on every relevant change; hydrated in field initializers
  on boot. Ids are validated against the catalog on read (dropped if unknown).
- Precedence: **restored state < URL deep-link params** (`?series=…&mode=…`),
  which run after construction — a shared link always wins.
- UX contract: restore is **silent**. No toast, no spinner — the app simply
  looks like you left it (Bloomberg behavior).

## 3. Production design

### 3.1 Topology

```
Angular SPA ──HTTP──> Spring Boot (same app wrapper)
                        │  GET/PUT /api/v1/workspace
                        ▼
                      Redis  (hot copy: ws:{userId}, TTL ~30d, refreshed on touch)
                        │  write-through (async, retry queue)
                        ▼
                      MDM service ──Hibernate──> SQL Server
                                                  workspace table:
                                                  user_id PK · payload NVARCHAR(MAX) JSON
                                                  version BIGINT · updated_at DATETIME2
```

Series **search/typeahead** (⌘K palette, tree search) is a separate read path:
`GET /api/v1/series/search?q=…` → Elasticsearch (fed by the MDM/Hibernate
Search pipeline). The tree's top levels come from MDM taxonomy; children load
lazily — the client never holds "millions of series", only what's visible.

### 3.2 Endpoints

| Verb | Path | Behavior |
|---|---|---|
| `GET` | `/api/v1/workspace` | Redis hit → return with `ETag: "<version>"`. Miss → SQL via MDM, re-warm Redis. 204 if none. |
| `PUT` | `/api/v1/workspace` | Requires `If-Match: "<version>"`. Validate payload (schema + ids exist in MDM, batch check). Bump `version`, write Redis, enqueue durable SQL write. 409 on stale version. |
| `POST` | `/api/v1/series/validate` | Batch id existence/entitlement check used on hydrate. |

User identity from the Spring Security principal — no user id in the URL.

### 3.3 Client behavior

- localStorage stays, demoted to **offline/optimistic cache**: hydrate from it
  instantly (zero-latency paint), then `GET /workspace` and reconcile (server
  wins if `version` newer; then re-render — same silent contract).
- Saves are **debounced ~2 s** client-side (server round trips are not free the
  way localStorage is) with a flush on `beforeunload`/`visibilitychange`.
- `PUT` failures: keep localStorage current, retry with backoff — the trader
  never loses their screen; sync is eventual.

### 3.4 Conflicts (multi-device / two tabs)

- `version` (monotonic) + `updated_at`; optimistic concurrency via
  `If-Match` → **409** → client re-`GET`s and merges:
  scalars take the **newest** side; `selectedIds` = union capped at maxSeries
  preserving the newer side's order. Then one clean `PUT`.
- Two tabs, same browser: `storage` event on `tschart.workspace` re-hydrates
  the passive tab (cheap, already local).

### 3.5 Integrity & entitlements

- On hydrate, ids go through `series/validate`: unknown ids dropped, forbidden
  ids kept but rendered in the existing "restricted" legend state (never
  silently removed — the trader should see *why* a series vanished from the
  chart, not wonder).
- Payload is user preference data, not market data: no PII beyond user id, but
  treat as private (entitlement-relevant selections are visible in it).

### 3.6 Sizing / ops

- Redis: ≤2 KB × users — negligible; TTL keeps it self-cleaning; SQL is the
  system of record, so Redis loss is a cold-start, not data loss.
- Metrics worth having: workspace 409 rate (conflict health), hydrate latency
  P99 (must stay invisible: <50 ms from Redis), validate-drop count (catalog
  drift signal).

## 4. Later (not now)

Named workspaces (N per user: `ws:{userId}:{slot}` + a list endpoint), shared
read-only workspaces (tokenized link resolving server-side to a snapshot), and
audit trail (append-only history table) all fit this schema without breaking
`v: 1` clients — add fields behind the version gate.

---

## 5. Keys outside the workspace payload (round 11)

Not everything belongs in `tschart.workspace`. These are stored separately and
deliberately:

| Key | Holds | Why it is not in the workspace |
|---|---|---|
| `tschart.palette` | Active series palette | An accessibility setting is a fact about the *person*, not this screen. Must survive "Reset layout" and apply before restore paints. |
| `tschart.markers` | Series shape mode (canvas + chrome) | Same. |
| `tschart.recentq` | Last 8 search queries (text) | A habit, not a screen. Recorded on a successful pick, never per keystroke. |
| `tschart.dockWidth` | Browse dock width in px | Chrome geometry, not chart state. Replaces the vestigial `tschart.panelSizes`, which is now deleted on read. |
| `tschart.theme`, `tschart.density` | Appearance | Pre-existing, same reasoning. |
| `tschart.recent`, `tschart.legend`, `tschart.maxseries`, `tschart.treeChildLimit` | Pre-existing | — |

**The payload version stays `v: 1`.** Round 11 added no field to the workspace
snapshot, so no migration is needed. If one is ever added, `readWorkspace()`
currently hard-rejects any `v !== 1` — that check must become a migration, or
every existing user loses their screen on first load.

---

## 6. Undo/redo is in memory, on purpose (round 14)

`HistoryService` holds a stack of selection snapshots
(`{ selectedIds, hiddenIds, compareIds, slots }`) and is **never persisted**.

- A restored session has no past. Offering ⌘Z for an action taken yesterday, on a
  screen that has since been rebuilt from storage, promises an inverse we cannot
  honour.
- The stack is deliberately narrower than `WorkspaceState`: mode, type, interval
  and as-of are outside it. They are one visible click away, and they sit behind
  two self-correcting effects that rewrite them after a restore — so an undo of
  them would not be a clean inverse.
- `slots` is in the snapshot because colour slots are **path-dependent**.
  `SeriesColorService.sync()` frees a removed series' slot for the next arrival,
  so undoing a removal without restoring the map hands the series back in a
  different colour than the one that was on screen a second earlier.

The workspace persist effect fires on every undo step, which is correct — storage
follows the screen — and cheap, since the payload is small.
