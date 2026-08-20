# ts-chart — instructions for Claude

Trader-facing charting SPA (Angular 20, standalone components + signals,
lightweight-charts v5). Target users are commodity traders conditioned by
Bloomberg/TradingView — every change is judged by that bar.

## Non-negotiable: keep the design kit truthful

The user menu has **Export design kit** — it zips `public/design-kit/` and is
handed to other teams/agents as the source of truth. Any UI/UX/styling change
MUST, in the same change:

1. Update `docs/DESIGN_GUIDE.md` and/or `docs/CHART_STYLE_GUIDE.md`
   (and `docs/WORKSPACE_PERSISTENCE.md` for persistence changes).
2. Copy changed guides into `public/design-kit/`, and any changed
   `src/styles/_*.scss` into `public/design-kit/scss/`. Token changes also
   update `docs/tokens.css` + `docs/tokens.json` + `public/design-kit/tokens/`.
3. Verify with `diff -q docs/<file> public/design-kit/<file>` (must be silent).

The kit files that must stay in sync: `AGENTS.md`, `DESIGN_GUIDE.md`,
`CHART_STYLE_GUIDE.md`, `UX_ENGINEERING_PLAYBOOK.md`, `WORKSPACE_PERSISTENCE.md`,
`DEVEXTREME_TREELIST_GUIDE.md`, `ACCESSIBILITY_GUIDE.md`, `SEARCH_ARCHITECTURE.md`,
`scss/*`, `tokens/*` (mirrors of `docs/` + `src/styles/`). The export list in `src/app/core/export.service.ts` must name
every one of them — a guide that is not in `KIT_FILES` never reaches the zip.

## Also non-negotiable: keep the playbook current

`docs/UX_ENGINEERING_PLAYBOOK.md` is the distilled, transferable set of
trader-facing UX/engineering learnings. **Qualifying test for any change:** *does
this decision generalize beyond this one feature to any trader-facing app?*

- **Yes** → in the same change, add or update the matching **Rule / Why / Source**
  entry in the playbook. If you tried an approach and rejected it, add it to the
  playbook's **failure log** (Tried / Failed because / Lesson) so it is not
  repeated. Then re-sync to `public/design-kit/` and `diff -q`-verify.
- **No** (a one-off tweak, a local fix) → a component or guide note is enough; do
  not bloat the playbook.

Treat the playbook like the guides: a change that establishes a durable principle
but leaves the playbook stale is an incomplete change.

## UX invariants (never regress these)

- **Never a silent blank chart.** Spec builders exclude hidden / mode-incompatible
  / broken-status series; zero drawables with a selection → in-chart notice.
  A broken series never blanks a panel that has healthy ones.
- **Live values never reflow chrome.** Rows containing ticking numbers are
  `flex-wrap: nowrap` with `overflow: hidden` and reserved `ch` widths.
- **No native `title` tooltips** — themed `tsTooltip` directive only.
- **Numbers are mono + tabular** (`.ts-mono`), always.
- **Contrast**: numeric text under 12px uses tokens with ≥4.5:1 on their surface
  (`--ts-text-muted` is tuned for this; `--ts-text-faint` is decoration only).
- **Series identity** comes only from `SeriesColorService`. A series gets a
  **slot**, and a slot resolves to a color **and** a glyph:
  `color = entries[slot % n]`, `glyph = glyphs[floor(slot / n)]`. Slots are
  assigned in selection order and are stable for a series' whole lifetime on the
  chart. Never stored in catalog metadata, never raw hex in components (charts
  are the one exception: canvas needs concrete hex). The SAME color AND glyph
  appear in tree dot, legend, inspector, search row, and right-edge label.
- **Palette is an accessibility preference**, one of five variants
  (`series-palettes.ts`), persisted to `tschart.palette` — its own key, NOT the
  workspace, so it survives "Reset layout" and applies before restore paints.
  The CVD variants are deliberately not lightness-normalized; see
  `docs/ACCESSIBILITY_GUIDE.md` §3 before "fixing" them.
- **Identity at scale**: lines are always **solid** (dash = semantic only, never
  identity); shape is the redundant channel instead. The authoritative identifier
  for many series is the right-edge colored **glyph + symbol + value** label
  (`ValueTag`/`.lastval`), de-overlapped. On-canvas markers are sparse (~6 across
  the visible range, never per bar) and skipped above 12 drawn series.
- **Search goes through `SERIES_SEARCH_PROVIDER` only.** No component imports the
  catalog for search; result rows render from a self-contained `SeriesHit`. See
  `docs/SEARCH_ARCHITECTURE.md` — breaking this silently un-does the backend swap.
- **Readouts never carry forward.** At the crosshair, a series with no point on
  the hovered date shows `—`, never a stale last value (`legendRows` hovering
  guard; `cardRows` filter).
- **Sanitize at the chart boundary.** All points pass `sanitizePoints`
  (`src/app/data/sanitize.ts`) before `setData` — drop null/NaN, validate date,
  sort, dedupe; never throw on a real feed's holes/dupes/out-of-order points.
- **Disabled** = `opacity: 0.45` + `cursor: not-allowed`; a `.dim` container
  must not compound with child `:disabled` opacity.
- **No artificial latency.** Skeletons only for genuinely async feedback.
- Modes use **union gating**: enabled if any charted series supports it;
  incompatible series dim in the legend with `n/a`.
- Tooltips explain every disabled control (which series blocks it and why).

## Layout doctrine (round-10 restructure)

**Chart-first, chrome never veils the chart** — and this has **no exception for
the ⌘K palette**, which is precisely the surface a trader opens while watching
the tape. Separation is elevation and shadow; outside-click closes. The chart card always owns its
pixels and is never covered. Selection (tree/search) and series details
(inspector) are **in-flow docks** — the chart flexes beside them — toggled from
the 48px icon rail (⌘K / ⌘/ / ⌘. also), each with its own close (×). The **tree
dock is persistent and OPEN by default** (a primary driver); the **inspector dock
is non-modal and closed by default**. NO scrim, NO blur over the chart (a modal
veil over live data fails desk review). On small screens docks collapse to fixed
overlays. Dock state persists (`tschart.dock`). The rail is the single toggle
owner — the toolbar carries no panel toggles, but it DOES carry global search,
which is a primary action rather than a toggle or a preference (every trading
terminal keeps search permanently visible). The chart header is ONE row that
never wraps (strip truncates first; mode renders segmented above a 1040px
*container* query and as a dropdown below it). The card's footer is a control
bar — zoom/fit left, interval right — and provenance lives in the series
inspector and the legend row tooltip. Preferences go in the user menu,
never in toolbars.

## Architecture notes

- State lives in `src/app/core/` services; `SelectionService` is the single
  source of truth (selection order = color slot order).
- **Workspace persists to localStorage** (`tschart.workspace`, versioned);
  URL deep-link params override on load. Production design:
  `docs/WORKSPACE_PERSISTENCE.md`.
- Tree expansion: `TreeStateService` (survives tab switches). Legend collapse:
  `tschart.legend`. Dock width: `tschart.dockWidth`. Palette / markers:
  `tschart.palette`, `tschart.markers`.
- **Search**: `src/app/search/` — one provider token, one service handing out
  per-surface sessions, one shared results component. See
  `docs/SEARCH_ARCHITECTURE.md`.
- **DevExtreme** is confined to the TreeList POC and is `@defer`red. Its theme
  service must be injected wherever a DX widget first renders — it is a root
  service whose only job is a constructor `effect()`, so it does nothing until
  something injects it.
- Icons are a curated set in `core/icons.ts` — register before use; no
  duplicate keys (`Download` etc. already present).

## Verification

`cd ts-chart && npx ng build --configuration development` — strictTemplates is
on; a green build validates all template bindings. Then walk the manual flows:
select/deselect, hide/show, theme toggle, mode × type × interval × as-of
combos, split + crosshair sync, ⌘K palette, refresh (workspace restore).
