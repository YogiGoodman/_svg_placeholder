# DevExtreme TreeList — customization guide

Everything learned taking a `dx-tree-list` from stock to a trader-facing tree:
pixel-identical to a hand-rolled recursive component, with the app owning
selection, expansion, colors, theme and how much of a branch renders at once.

Written to be lifted. Section 0 is the configuration, 1–2 are the DOM and CSS
you must fight, 3–4 are theming and data loading, 5–6 are wiring and the traps.

Everything here was verified in the browser against the running app, not
inferred from the DevExtreme docs. If you are lifting this into another
DevExtreme application, the four sections that matter are **Cell DOM**,
**CSS parity layer**, **Theming**, and **Edge cases**.

Files:

```
src/app/layout/right-panel/dx-tree/
├── dx-browse-panel.component.ts   chrome: header, tabs, search, footer
├── dx-theme.ts                    DevExtreme theme ↔ app theme signal
├── dx-tree-list.component.ts      flatten + state wiring
├── dx-tree-list.component.html    dx-tree-list + cell template
└── dx-tree-list.component.scss    CSS parity layer
```

---

## 0 · The whole configuration

Every option below is load-bearing. Copy this block first, then read the sections
that explain the non-obvious ones.

```html
<dx-tree-list
  [dataSource]="store"                        <!-- CustomStore, §4 -->
  keyExpr="id"
  parentIdExpr="parentId"
  hasItemsExpr="hasItems"                     <!-- expander before children exist, §4 -->
  [rootValue]="null"                          <!-- default is 0; ours is null -->
  [remoteOperations]="{ filtering: true }"    <!-- turns on parentIds in load(), §4 -->
  [showColumnHeaders]="false"
  [showBorders]="false"
  [showRowLines]="false"
  [hoverStateEnabled]="false"                 <!-- app owns hover, §2 -->
  [expandedRowKeys]="expandedKeys()"          <!-- expansion is app state, §5 -->
  height="100%"
  (onRowClick)="onRowClick($event)"
>
  <dxo-scrolling mode="virtual" [useNative]="true" />
  <dxo-load-panel [enabled]="false" />        <!-- never veil the tree, §4 -->
  <dxi-column dataField="label" cellTemplate="nodeCell" [allowSorting]="false" />
  <div *dxTemplate="let cell of 'nodeCell'"> … </div>
</dx-tree-list>
```

Deliberately **not** configured, and why it matters: no `dxo-selection` (the app
owns selection, so `.dx-selection` never appears — style your own state, §5) and
no `focusedRowEnabled` (so `.dx-row-focused` never appears). Turning either on
reintroduces DevExtreme state classes this stylesheet does not override, §7.

---

## 1 · Cell DOM

Every override follows from what DevExtreme actually renders for the first data
column (`grids/tree_list/rows/m_rows.js`), plus what `devextreme-angular` adds:

```html
<td class="dx-treelist-cell-expandable">
  <div class="dx-treelist-icon-container">                 <!-- the indentation -->
    <div class="dx-treelist-empty-space"></div>            <!-- one per level -->
    <div class="dx-treelist-empty-space dx-treelist-empty-space--last
                dx-treelist-collapsed"></div>              <!-- expand-glyph slot -->
  </div>
  <div class="dx-treelist-text-content">                   <!-- DevExtreme -->
    <div class="dx-template-wrapper">                      <!-- devextreme-angular -->
      …your cellTemplate…
    </div>
  </div>
</td>
```

Four consequences drive the entire stylesheet:

1. **The icon container IS the indentation** — `level + 1` spacer divs, 18px
   each. `display: none` on it does not hide an arrow; it flattens the tree to a
   single level.
2. **The expand glyph is an absolutely positioned `::before`.** Zero width does
   not remove it; `content: none` does.
3. **Cell templates land in `.dx-treelist-text-content`**, not `.dx-cell-content`
   (that is dxDataGrid). DevExtreme themes it `display: inline-block`.
4. **`devextreme-angular` wraps every `*dxTemplate` in `.dx-template-wrapper`**,
   an unstyled div that appears in no DevExtreme documentation or source.

Both wrappers in (3) and (4) shrink-wrap unless made flex, and a row with
`width: 100%` then resolves against the wrapper rather than the cell — measured
live at 106px inside a 299px cell. That is what strands a unit or count next to
the label instead of at the row's right edge.

---

## 2 · CSS parity layer

Scoped under a `.dxtree` wrapper class, with `ViewEncapsulation.None` on the
component so the rules reach DevExtreme's DOM.

**No rule uses `!important`.** DevExtreme's theme selectors are four and five
classes deep; each override mirrors the vendor selector and prefixes `.dxtree`,
winning by exactly one class. A shorter selector loses silently and reads as a
broken override — that is the single most common failure when restyling this
widget.

| Concern | Override |
|---|---|
| Widget surface | `.dx-widget`, `.dx-treelist`, `.dx-treelist-container > .dx-treelist-rowsview` → transparent + app typography. The theme paints its own grid background (`#2a2a2a` dark / `#fff` light); hand those pixels back to the panel |
| Empty state | `.dx-treelist-nodata` themed, **never hidden** |
| Row box | `.dx-row > td` → `height: var(--ts-row-h)`, `padding: 0 var(--ts-space-3)`, radius, 120ms transition |
| Row track | `td.dx-treelist-cell-expandable` → `display: flex; align-items: center` |
| Indent step | `.dx-treelist-empty-space` → `width: 14px` (from 18px) |
| Glyph slot | `.dx-treelist-empty-space--last` → `width: 0; margin: 0` |
| Glyph | `.dx-treelist-collapsed/expanded::before` → `content: none` |
| Content chain | `.dx-treelist-text-content` **and** `.dx-template-wrapper` → `display: flex; flex: 1; min-width: 0` |
| Hover | `.dx-data-row > td:hover` → `--ts-bg-hover` |
| Selected | `td:has(.cell-row.is-selected)` → `--ts-accent-weak` (see §5) |
| "Show N more" | `.more-cell` → `--ts-accent-strong`, label indented 30px onto the leaf-label rail |

Resulting geometry is identical to the hand-rolled tree's
`padding-left: calc(var(--ts-space-3) + depth * 14px)`.

### Verified in-browser

| Metric | Hand-rolled tree | DevExtreme tree |
|---|---|---|
| padding-left, depth 0 / 1 | 12px / 26px | 12px + indent container 0 / 14 |
| Indent container, depth 0–3 | — | 0 / 14 / 28 / 42 |
| Row right edge → count / unit | 12px | 12px |
| Row height (compact density) | 24px | 24px |
| Parent label color (dark) | `rgb(215,221,228)` | `rgb(215,221,228)` |
| Leaf label color (dark) | `rgb(174,183,193)` | `rgb(174,183,193)` |

---

## 3 · Theming

**DevExtreme does not read CSS custom properties.** Each theme is a separately
compiled stylesheet, so dark mode means *loading a different file* — not
re-tokenising the loaded one. Overriding a light stylesheet with dark colors is
the wrong shape: every surface you forget stays light, and they surface later on
whichever widget you add next.

Use DevExtreme's own mechanism (`dx-theme.ts`):

1. **`angular.json`** emits both themes as non-injected style bundles, so they
   stay fetchable by URL instead of being inlined into `styles.css`:

   ```json
   { "input": "node_modules/devextreme/dist/css/dx.light.css",
     "bundleName": "dx.light", "inject": false },
   { "input": "node_modules/devextreme/dist/css/dx.dark.css",
     "bundleName": "dx.dark",  "inject": false }
   ```

2. **`index.html`** declares them with `rel="dx-theme"` — the contract
   DevExtreme's theme module reads. At startup it removes these tags and inserts
   a single active `<link>`; `data-active="true"` picks the initial one:

   ```html
   <link rel="dx-theme" href="dx.light.css" data-theme="generic.light">
   <link rel="dx-theme" href="dx.dark.css"  data-theme="generic.dark" data-active="true">
   ```

3. **`dx-theme.ts`** swaps the active href from the app's own theme signal:

   ```ts
   effect(() => {
     const next = theme.theme() === 'dark' ? 'generic.dark' : 'generic.light';
     if (dxThemes.current() !== next) dxThemes.current(next);
   });
   ```

Side effect worth having: `styles.css` drops from ~788 kB to ~11 kB, because only
the active theme is fetched rather than both being inlined into the critical path.

---

## 4 · Load on demand, and folding long branches

A production forward curve carries thirty to fifty monthly contracts. Two
separate problems follow, and they need separate answers.

### Loading (a cost problem)

`CustomStore` + `remoteOperations: { filtering: true }` + `hasItemsExpr` is
DevExtreme's documented load-on-demand contract. The widget calls `load()` with
only the `parentIds` it is about to render.

**Only contract lists are lazy.** `TreeNode.lazy` marks the branches whose
children come from the server — `Contracts` and `Rolling Contracts`, at the
bottom of `Curve Builder › Brent › M+1 › Contracts`. The taxonomy above them is
known when the tab loads and is answered on the spot. Making the *whole* tree
lazy is the obvious mistake: every group expansion then becomes a round trip the
data never needed.

```ts
private loadChildren(parentId: string | null): FlatNode[] | Promise<FlatNode[]> {
  const key = parentId ?? ROOT;
  const node = parentId ? this.index().nodeById.get(parentId) : undefined;

  if (node?.lazy && !this.fetched.has(key)) {           // first visit only
    return this.fetchBranch(key, node).then((c) => this.render(key, c, parentId));
  }
  const children = this.fetched.get(key) ?? this.index().byParent.get(key) ?? [];
  return this.render(key, children, parentId);          // synchronous
}
```

`hasItemsExpr` is what makes this work at all: it tells the widget a node has
children so it can draw an expander *before* those children exist. Without it a
lazily-loaded branch renders as a leaf and can never be opened.

### Never show a pending state for data you already hold

A fetched branch is cached in `fetched` for the session, and **the return type is
the signal**: an array resolves on the current tick, a promise makes DevExtreme
raise a pending state. So the batch loader stays synchronous unless some branch
genuinely has to be fetched:

```ts
return branches.some((b) => b instanceof Promise)
  ? Promise.all(branches).then((all) => all.flat())
  : (branches as FlatNode[][]).flat();
```

`<dxo-load-panel [enabled]="false" />` on top of that: the panel greys out the
whole tree, which is a veil over the operator's primary navigation for data that
is already in memory.

Measured — collapse and re-expand a loaded branch three times, then reveal its
folded remainder: **0 fetches, 0 load panels**. First-ever expansion of two more
curves: exactly **2 fetches**, one per contract list, none for the group levels
above them. With everything collapsed the widget holds **7 rows** against a tree
of roughly 200 nodes.

### Folding (a readability problem)

Loading a fifty-contract branch quickly does not make it readable. Children are
capped at `TreeStateService.childLimit` (default 12, set from the user menu,
`0` = show all) and the remainder folds behind a synthetic **"Show N more"**
row — a real TreeList row carrying `isMore`, so virtual scrolling, indentation
and keyboard navigation treat it like any other.

Truncation happens **inside the same load that produced the branch**, where the
full child list is already in hand:

```ts
const rows = children.slice(0, limit).map((node) => toRow(node, parentId));
rows.push({ id: `${key}::more`, parentId, isMore: true,
            moreCount: children.length - limit, /* … */ });
```

That is one `slice` on data already held — no second pass over the tree, and no
row objects built for children that are not displayed. Revealing a branch adds
its key to a `revealed` set and calls `refresh(true)`, so DevExtreme re-requests
only what it currently shows and repaints only the rows that changed.

Verified across cap settings on the three seeded contract lists (30 / 40 / 50):

| Cap | Children rendered | "Show N more" |
|---|---|---|
| 12 (default) | 12 | 18 / 28 / 38 |
| 8 | 8 | 22 / 32 / 42 |
| All (`0`) | 30 / 40 / 50 | none |

The affordance uses `--ts-accent-strong` — it is an action, not data. Measured
contrast against the panel: **9.29:1 dark, 4.8:1 light**, and its text aligns to
the same rail as the leaf labels it summarises (`margin-left: 30px` = dot margin
15 + dot 7 + row gap 8).

---

## 5 · State wiring

| Concern | Mechanism |
|---|---|
| Data | `buildIndex()` flattens the tree once and precomputes per-parent leaf counts and series ids, so row templates do no recursive work |
| Expansion | `TreeStateService` → `[expandedRowKeys]`, scoped to the active tree so DevExtreme never sees foreign keys. `onRowExpanding`/`onRowCollapsing` **cancel** DevExtreme's own transition and toggle the service instead. **This is not optional:** without it, keyboard navigation (→ / ←) and `expandRow()` expand a row in the widget's private state — the chevron keeps pointing right at an open branch, and the next unrelated toggle rewrites `expandedRowKeys` and silently collapses it |
| Selection | `SelectionService` read in the cell template; `onRowClick` toggles for any node carrying a `seriesId` |
| Selected highlight | No `dxo-selection` is configured, so DevExtreme never applies `.dx-selection`. The cell flags itself `.is-selected` and the row reacts via `td:has(.cell-row.is-selected)` — reactive to signals, no `repaintRows()`, and the highlight spans the indent area |
| Dual-role nodes | A node may be both a series and a group. The row body charts its own series; `onTwistClick` stops propagation so the chevron expands without charting. Plain groups toggle from anywhere on the row |
| Colors | `SeriesColorService.color(id)` in the cell template |
| Child cap | `TreeStateService.childLimit` (persisted, user-menu control). Changing it clears the `revealed` set; switching tab does not, because reveals are keyed by branch id |
| Lazy cache | `fetched: Map<string, TreeNode[]>` — one fetch per branch per session |

---

## 6 · What is a workaround, and what is not

Read this before copying. Four things here fight the widget rather than use it,
and one is a deliberate trade you may want to make differently.

| # | Thing | Why it is here | What it costs you |
|---|---|---|---|
| 1 | **`display: flex` on `<td>`** | The indent container and cell content have to share one horizontal track. There is no DevExtreme option for this | Leaves table layout behind. Fine at one column; re-check if you add columns or depend on best-fit width measurement |
| 2 | **Hiding DevExtreme's expander** (`content: none`, `width: 0`) and drawing a Lucide chevron in the cell template | The widget has no custom-expand-icon API, and its glyphs are two different DXIcons code points, so `transform: rotate()` cannot animate between them | The vendor expander still exists in the DOM at zero width. Harmless, but it is dead weight the widget still reasons about |
| 3 | **`td:has(.cell-row.is-selected)` for the selected row** | No `dxo-selection` is configured, so `.dx-selection` never appears | See the note below — this is the one worth reconsidering |
| 4 | **`refresh(true)` to reveal a folded branch** | There is no per-parent invalidation API; `loadDescendants()` explicitly will not reload cached data | Re-asks the store for every visible branch to change one. Cheap because cached branches answer synchronously, but it is heavier than the intent |

Everything else — `CustomStore` + `parentIds`, `hasItemsExpr`, `remoteOperations`,
`expandedRowKeys`, `cellTemplate`, `loadPanel` — is the documented API used as
documented.

### The selection trade

Binding selection through the app's own service and styling `:has()` keeps one
source of truth and avoids a second state to reconcile. The alternative is more
native and worth considering if you want the widget's own behaviour:

```html
<dxo-selection mode="multiple" showCheckBoxesMode="none" />
<!-- [(selectedRowKeys)] bound to your store -->
```

That gives you `.dx-selection` to style, keyboard selection, and recursive
parent/child selection for free — at the cost of keeping DevExtreme's selection
state in step with yours. This app has an ordered, capped selection with colour
slots, so a second owner was the wrong shape. A simpler app should probably use
`dxo-selection`.

### Fixture vs. production

Two places where this repo is a demo and production is not:

- **`hasItems` is derived from `children.length`.** That only works because the
  fixture holds the whole tree. In production it must be a field on the payload —
  a lazy node's children do not exist when its row is built, so deriving it would
  render every unloaded branch as a leaf that can never be opened.
- **`requestChildren()` resolves from the seeded catalog.** It is the only method
  that changes when this talks to a server. The surrounding machinery — one
  in-flight request per branch, cache written on arrival, failures deliberately
  not cached so the next expand retries — is already written for a real call.

There is no retry, backoff, or error row: a rejected load leaves the branch
closed and the operator can try again. Decide whether that is enough for you.

---

## 7 · Edge cases

- **`ViewEncapsulation.None` is required** — DevExtreme renders outside Angular's
  emulated encapsulation. Scope every rule under one wrapper class; the styles
  stay in the document once the component has loaded.
- **Theme swap is async.** `themes.current()` changes a `<link href>`, so there
  is a brief unstyled moment while the new stylesheet downloads. Preload the
  inactive theme if that flash matters.
- **`angular.json` changes need a dev-server restart.** `ng serve` does not
  re-read it, so theme bundles 404 until you restart — the failure looks exactly
  like a broken theme config.
- **Enabling `focusedRowEnabled` or `dxo-selection` reintroduces DevExtreme state
  classes** (`.dx-row-focused`, `.dx-selection`, `.dx-treelist-focus-overlay`)
  that this stylesheet does not override, because in this configuration they are
  never rendered. Add overrides for them if you turn those features on.
- **Making `<td>` a flex container** is what allows the indent container and cell
  content to sit on one track. It works with one column; re-check if you add
  columns or rely on best-fit width measurement.
- **Accessibility is not at parity.** The hand-rolled tree's rows are real
  `<button>`s with `aria-expanded` / `aria-current`; DevExtreme rows are table
  cells driven by its own keyboard navigation.
- **Bundle.** The panel is eagerly imported by `workspace.component.ts`, putting
  DevExtreme in the initial chunk (why `angular.json` budgets were raised).
  Production should wrap it in `@defer` inside the `@case ('dxTree')` branch and
  restore the original budgets.
- **Returning a promise is what makes DevExtreme show a pending state**, whether
  or not it resolves immediately. Cached reads must return an array, not
  `Promise.resolve(array)`.
- **`refresh(true)` is the only way to invalidate a lazily-loaded branch.**
  `loadDescendants()` explicitly does not reload cached data, and there is no
  per-parent invalidation API. `refresh(true)` re-requests what is on screen and
  repaints only changed rows, which is cheap because expansion is bound to
  `expandedRowKeys` and therefore survives it.
- **A synthetic row must not be mistaken for data.** The "show more" row is
  matched first in the cell template and short-circuited first in `onRowClick`,
  before the series and group branches.
- **License warning** logged to console (no key configured, per POC scope).

---

## Manual checklist

- [ ] Dark and light theme, plus toggling between them while the tree is open
- [ ] Normal and compact density (`[data-density='compact']`)
- [ ] Indent alignment at depth 0–3 across all tabs, against the hand-rolled tree
- [ ] Unit and leaf count flush at the right edge at every depth
- [ ] Hover highlight matches color and timing
- [ ] Leaf selection: dot color + accent-weak background across the indent
- [ ] Collapsed parent with selections: pill badge
- [ ] Dual-role node: row body charts, chevron expands, independently
- [ ] Disabled / locked / missing leaves: opacity, icon color, tooltip reason
- [ ] Long label truncation (ellipsis, no reflow)
- [ ] Chevron rotation (180ms)
- [ ] Keyboard → / ← expands and collapses, and the chevron agrees with the row
- [ ] Expanding a group above a contract list never waits on anything
- [ ] Re-expanding a loaded contract list shows no spinner and refetches nothing
- [ ] Long branch: 12 children then "Show N more"; revealing keeps expansion and scroll
- [ ] Child cap preference: 8 / 12 / 20 / All all take effect live
- [ ] "Show N more" contrast and alignment in both themes
- [ ] Empty search state
