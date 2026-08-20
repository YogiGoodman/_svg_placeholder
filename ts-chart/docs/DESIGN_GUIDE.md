# TS Chart — Design Guide

A dark-first, terminal-grade design system for timeseries applications. Everything
is token-driven so the entire look is portable: copy `docs/tokens.css` (or
`src/styles/_tokens.scss`) into any app and consume `var(--ts-*)`.

> Principle: **a blank outline, then rich data.** Empty states are deliberate and
> beautiful; data interactions are dense but calm.

---

## 1. Foundations

### 1.1 Color

The palette comes from a hand-authored "terminal chart" language. Dark is the
default; light is a **remap of the same token names** — never hardcode a hex in a
component, always reference a token. The dark ladder is **near-neutral with a
whisper of cool** (TradingView-class), never blue-saturated: a blue surface
raises perceived brightness in long sessions and fights the blue accent and
blue series hues — neutral surfaces make the data colors pop.

| Role | Token | Dark | Light |
|---|---|---|---|
| App background | `--ts-bg` | `#0d0f12` | `#f5f7fa` |
| Panel / card | `--ts-bg-elevated` | `#12151a` | `#ffffff` |
| Inset / chart well | `--ts-bg-inset` | `#0a0c0f` | `#eef1f6` |
| Hover fill | `--ts-bg-hover` | `#191d23` | `#eef2f7` |
| Active / selected | `--ts-bg-active` | `#20252c` | `#e3ecf6` |
| Border | `--ts-border` | `#252a31` | `#dbe2ea` |
| Grid major / minor | `--ts-grid-strong` / `--ts-grid-weak` | `#1d2127` / `#16191e` | `#e5eaf1` / `#eef2f7` |
| Text primary | `--ts-text` | `#d7dde4` | `#26313f` |
| Text bright (values) | `--ts-text-bright` | `#f3f6f9` | `#0c1219` |
| Text muted (labels/axis) | `--ts-text-muted` | `#8b96a3` | `#6b7787` |
| Accent (default series) | `--ts-accent` | `#3fb6f0` | `#1f8fd0` |
| Highlight (today/price pill) | `--ts-highlight` | `#f5a623` | `#d9861a` |
| Up / Down | `--ts-up` / `--ts-down` | `#26c281` / `#ef5f6b` | `#10a56a` / `#e0384a` |

**Color usage rules**
- **Contrast is a hard rule, not a taste.** Any numeric text under 12px must
  sit at **≥4.5:1** against its surface — `--ts-text-muted` is tuned for this
  (5.5:1 on panels in dark). `--ts-text-faint` is decoration only, **never
  numbers**. Style never outranks legibility on a trading screen.
- **Accent is rationed.** Use `--ts-accent` for the primary interactive/series
  signal only. Two accents on screen fighting = noise.
- **Amber = "now".** `--ts-highlight` is reserved for the today marker and the
  last-value price pill. Never use it for generic emphasis.
- **Up/down are semantic**, not decorative — only for signed values and candles.
- **Series colors are assigned, not stored.** A 12-slot palette of dark/light hex
  pairs (`core/series-color.service.ts`) assigns hues **in selection order**:
  survivors keep their slot, freed slots are reused, and each slot resolves to the
  hex for the active theme (charts re-color on theme toggle). Catalog metadata
  carries **no** color — unselected series render neutral (no dot) in the tree and
  search, which scales to catalogs of any size. The palette is
  **OKLCh-normalized**: every hue at the same perceptual lightness/chroma
  (dark L≈0.76, light L≈0.55, C≈0.125), hue-rotated for max separation — no
  series shouts, none recedes, none is confusable with chrome grays.

### 1.2 Typography

- **Sans** (`--ts-font-sans`, Inter): UI chrome, labels, prose.
- **Mono** (`--ts-font-mono`): every number. All numerics use
  `font-variant-numeric: tabular-nums` (utility `.ts-mono`) so columns align and
  values don't jitter on update.
- Scale: `10 / 11 / 12 / 13 / 14 / 16 / 20 / 26 px`. UI density lives at 11–13px;
  14px base; 20–26px only for hero values.
- Weights: 400 body, 500 controls, 600 titles/values, 700 symbols/avatars.

### 1.3 Spacing, radius, elevation

- **Space**: 4pt scale (`--ts-space-1..12`). Panels breathe at 12–16px; dense rows
  at 4–8px.
- **Radius**: `xs 4` (chips) → `sm 6` (buttons/rows) → `md 8` (cards/inputs) →
  `lg 12` (panels) → `pill`.
- **Elevation**: three shadows only. `1` = hairline lift (pills), `2` = poppers,
  `3` = overlays/drawers. Depth also reads through surface steps
  (`bg → bg-elevated → bg-inset`), not just shadow.

### 1.4 Motion

- Easings: `--ts-ease` (standard) and `--ts-ease-out` (entrances).
- Durations: `120 / 180 / 240ms`. Nothing animates longer than 240ms.
- Everything hover/expand/collapse/tab transitions; entrances use small
  translate+fade or `grid-template-rows: 0fr→1fr` (see info cards).
- **Respect `prefers-reduced-motion`** — the reset collapses all durations to ~0.

---

## 2. Layout

```
┌──────────────────────────── Toolbar (48px) ──────────────────────────────┐
│ [☰] ◆ TS Chart                                    ☀  ▐  (avatar → menu)  │
├──┬───────────────────────────────────────────────────────────────────────┤
│🔍│  Chart card                                                           │
│ⓘ │  ┌ ONE header row: SYM 72.64 +0.4 (+0.5%) lo–hi │ Latest▾ 📅 1M…ALL  │
│  │  │                              … type▾ Compare Chart|Data 📷 ⛶     │ │
│r │  │            chart · legend · today line · value tags              │ │
│a │  └ footer 22px: ICE Brent (reference) · as of 16 Aug 2026 · demo    │ │
│i │                                                                       │
│l │   [browse drawer ⇐ overlay]                [inspector overlay ⇒]      │
└──┴───────────────────────────────────────────────────────────────────────┘
```

- **Chart-first, transient chrome.** The chart card owns the pixels. Selection
  (tree + search) and series details are **overlay drawers**, not permanent
  panels: a 48px **icon rail** opens the browse drawer; the **inspector** opens
  from a legend-row click, the rail, or `⌘.`. Scrim/Esc closes both. ⌘K is the
  fast selection path; the drawer is the browse fallback.
- **Vertical space is sacred.** Toolbar 48px; the chart header is **ONE row**
  that never wraps: stats strip (identity first — symbol · last · Δ1d · lo–hi,
  shrinks/truncates before anything else moves) → **mode dropdown** (a 5-button
  segmented could not survive width changes; dropdowns scale past 5 modes) →
  as-of date (contextual) → interval buttons (highest-frequency switch keeps
  buttons) → custom range (as-of only) → right-aligned actions. Provenance
  lives in a 22px **status footer** at the card's bottom, terminal-style —
  never in the header.
- **Responsive**: the same overlay model works at every width — drawers are
  already drawers on mobile; below 768px they span from the screen edge.

---

## 3. Components

| Component | Anatomy & rules |
|---|---|
| **Toolbar** | Left: nav toggle, logo mark + wordmark (no status badges — nothing that undermines trust). Right: **theme toggle** (single source of truth), info toggle, avatar. Avatar opens a **CDK overlay** popover — identity, density, max-series, reset layout, **export design kit**, version. Theme is **not** duplicated in the popover. |
| **Command palette** | **⌘K** opens a centered palette: type a ticker → ↑↓ → ↵ toggles the series into the chart and the input clears for the next ticker (rapid multi-add, Bloomberg muscle memory); Esc closes. Empty query shows **recent** series. Below the series, filtered **commands** (theme, chart/data view, layouts, allowed modes, panel toggles, clear selection) with their shortcuts. The whole select-and-chart loop needs no mouse. |
| **Icon rail + drawers** | A 48px rail replaces permanent side panels: 🔍 opens the **browse drawer** (tabs + search + tree, overlay, scrim/Esc closes — stays open during multi-select), ⓘ opens the **series inspector**, 🌳 (`list-tree`) opens the **DevExtreme tree** (right dock, see `docs/DEVEXTREME_TREELIST_GUIDE.md`). The right dock is now a **multi-view dock** — `LayoutService.rightView` selects between `'details'` and `'dxTree'`; clicking the already-active view's rail button closes the dock. The inspector also opens contextually from a **legend-row click**. Both closed by default — selection is an event, not a state. |
| **Nav tree** (inside the browse drawer) | 3 tabs (Forecast / Contracts / Regions). Leaves are **multi-select** — clicking toggles a series into the comparison set; the cap is set in the user menu (default 8, oldest drops out when full). **Unselected leaves are plain text** (no dot, no icon — scales to huge catalogs); a **selected** leaf shows its assigned palette dot + a subtle `--ts-accent-weak` background, nothing else (no tick, caption never swaps → zero layout shift). Search replaces the tree with a flat result list using the same convention. Parents show a leaf **count**; status badges (`LOCKED` / `N/A`) stay. **Expansion state is held app-wide** (service, not component-local) so switching tabs round-trips losslessly; top levels start expanded. A node may be **both a series and a group** (e.g. Curve Builder › Brent › M+1): the row body charts that node's own series and the **chevron alone** expands, so previewing M+1 never unfolds twenty-four contracts underneath it. Such a row carries the leaf's color dot and selected background. **Long branches fold:** a node renders at most `childLimit` children (default 12, set in the user menu, `All` disables) and closes the list with a **"Show N more"** row in `--ts-accent-strong`, aligned to the leaf-label rail. Loading a fifty-contract curve quickly is not the same as making it readable. |
| **Chart panel** | A single `lg`-radius card with a **one-row toolbar** (never wraps): **stats strip first** (identity + price, terminal grammar; truncates before anything moves) → **mode dropdown** (Latest/As of/Forward/Strip/Seasonal — disabled rows tooltip why) → contextual as-of date → interval buttons → custom-range (as-of only) → right-aligned actions (type▾, Compare, Chart|Data, screenshot, fullscreen). Below the chart body, a 22px **status footer**: `source · as of date · demo data`. Preferences (crosshair tooltip, density, max-series) live in the **user menu**, never in the toolbar — toolbars are for actions, menus are for preferences. |
| **Chart zoom** | A glassy **− / + / fit** pill overlays the chart bottom-right, **always visible** (discoverability beats minimalism for core controls). Fit uses the `unfold-horizontal` icon — never a fullscreen-lookalike. Zoom steps ±25% around the visible-range center; fit = `fitContent()`. |
| **Chart type vs mode** | **Type** = *how* it's drawn (line / area / candles) — a small capital.com-style dropdown; **Line is the default**. `area` needs a **single** series (overlapping fills reduce readability) and `candles` one OHLC-capable series on a time-axis mode — unavailable types are **disabled with an explanatory tooltip, never silently downgraded** (silent fallbacks make two types look identical). **Mode** = *what data* (below). They are independent. |
| **Chart modes** | Gated by per-series capability (`core/modes.ts`) with a **union policy**: a mode is enabled if **any** charted series supports it; incompatible series stay in the legend **dimmed with an `n/a` tag** (not drawn) and return on mode switch. A mode is fully disabled only when *no* series supports it — tooltips name the affected series either way. **Latest** — plain timeseries (all series). **As of** — point-in-time snapshot as-of a chosen **date** (vintage-revised tail), `AS OF` marker. **Forward** — forward curve by delivery bucket (months → quarters → cal years), as-of a date. **Strip** — block-average of consecutive forward contracts (Cal strip), stepped per year. **Seasonal** — one line per year on a Jan–Dec axis, recent brightest. |
| **Compare / layout** | Selection holds up to `maxSeries` (8) and **every visible series is drawn** (overlay). A **Compare** popover picks the **layout**: **Single** (one), **Overlay** (all, one price scale), or **Split** (up to 3 chosen panes). Panes share one date-range/crosshair event. |
| **Legend** (fixed, left, **collapsible**) | **Rows only — no header — ONE fully-opaque container** (`bg-elevated` + single hairline border + shadow-1): one border for the whole legend, not per row — smoother, calmer. Two failed alternatives, banned permanently: a translucent panel (reads as a smudge over price action) and bare/ghost text over lines (unreadable wherever lines run, both themes). Rows are borderless inside, hover = `bg-hover` + action icons reveal; **clicking a row's label opens the series inspector**. Values **column-align**. The collapse control sits below the last row inside the container; collapsed = the container shrinks to chevron + total count (`▸ 3`). The whole legend **disappears when no series is charted**. | One row per series `dot · label · value **+ its own unit** · 👁 · 🗑` — the **eye/trash reveal only on row hover or keyboard focus** (buttons keep their width, so nothing shifts; TradingView pattern). Each series shows **its own UOM**. Values are **live** (crosshair-driven, fall back to last); a signed **delta per row** only where meaningful (latest / as-of). **Eye** shows/hides (row dims to 45%, stays listed — hide is never delete); series that don't support the active mode dim with an **`n/a`** tag instead of a value. **🗑** removes from the selection. Per-series value tags pin to the right edge. |
| **Info panel** | Titled **"Series Details"** with a live count badge. |
| **Info cards** | **One collapsible card per selected series** (reusable `grid-rows 0fr→1fr` animation). Header is a single 40px center-aligned row: `symbol … Δ pill · 🗑 · chevron` (chevron far right). Each card shows the series value, signed change, source, frequency, currency, category and 2-year range. First card open, rest collapsed. |
| **Data table** | Chart↔Data toggle renders the same series as a virtualized table (CDK `cdk-virtual-scroll`), sortable by date, OHLC or value+Δ, with a min/avg/max footer. |
| **Buttons** | `.ts-icon-btn` (30px square, active = accent-weak), `.ts-btn` (+ `--primary`), `.ts-segmented` (inset track, active pill with shadow-1). |

---

## 4. States (first-class, not afterthoughts)

- **Welcome / empty**: hero placeholder SVG carrying a single bottom instruction
  ("Select a series from the tree to begin") — no redundant "no series selected"
  chrome. The info panel and search have their own smaller empty states.
- **Loading**: selection renders **instantly** — never add artificial latency to
  synchronous data (traders read fake delay as a slow app). The `.ts-skeleton`
  shimmer is reserved for genuinely async feedback (e.g. the explicit Retry
  action on a missing series).
- **Error**: restricted series → `403` SVG + "Pick another"; missing data → `404`
  SVG + "Retry". Both use the authored error illustrations. **Per-series policy:**
  a broken (restricted / missing) series never blanks a chart that has healthy
  ones — healthy series draw, broken rows dim in the legend with a lock/alert
  icon; the full-panel error shows only when *every* selected series is broken.
  When a mode leaves nothing drawable, the chart shows an explicit centered
  notice ("Nothing to chart in this mode…") — **never a silent blank**.
- **Empty search**: points placeholder + the query echoed back.

All illustrations live in `public/assets/placeholders/` and are `currentColor`- or
token-tinted so they theme automatically.

---

## 5. Interaction details that matter

- **Cursors**: `pointer` on every interactive surface (tree rows, legend rows,
  toggles, tabs); `col-resize` on split gutters; `not-allowed` on disabled controls.
- **Focus**: visible 2px accent ring (`:focus-visible`) — keyboard parity.
- **Keyboard**: `⌘/Ctrl + K` command palette (type-ticker-to-chart + commands);
  `⌘/Ctrl + /` toggles the nav; `⌘/Ctrl + .` toggles details; `Esc` exits
  fullscreen / clears a measurement / closes the palette.
- **Chart reflexes**: **Shift+drag** measures (Δvalue, Δ%, Δdays — rect persists
  until Esc or the next click); **double-click** fits all data; a hover-revealed
  **− / + / fit** pill zooms ±25% around center. In **split layout the crosshair
  syncs across panes** (hover one pane, all panes + the stats strip track the
  same date); the toolbar **stats strip follows the crosshair** and falls back to
  last on leave.
- **Tooltips**: always the themed `tsTooltip` bubble — never native `title`
  (inconsistent chrome tooltips read as unfinished).
- **Live values must never reflow chrome.** Any strip/label that ticks on hover
  gets `flex-wrap: nowrap` on its row, `overflow: hidden` truncation, and
  reserved `ch`-unit widths per numeric slot — buttons never jump rows.
- **The toolbar is ONE row and never wraps — a second band is a layout
  failure.** The stats strip shrinks/truncates first; everything else is
  fixed-size at a 30px optical height. Secondary choices (mode) are dropdowns,
  not button rows — segmented buttons are reserved for the highest-frequency
  switch (intervals). The custom-range picker appears **only in As-of mode**.
- **Crosshair tooltip (optional, OFF by default):** a preference in the user
  menu enables a solid card that follows the crosshair — hovered date + one
  row per drawn series (dot · SYM · value + unit). Solid surface, `shadow-2`,
  `pointer-events: none`, flips near right/bottom edges. Persists with the
  workspace.
- **Blue is the interactive accent and nothing else.** Industry-standard choice
  (TradingView, capital.com); keep it for genuine interaction signals (active
  tab, selected states, focus). **No decorative blue** — gradients on avatars
  and similar ornaments use neutral surfaces.
- **Focus & disabled**: one global `:focus-visible` accent ring (reset); text
  inputs suppress it and paint their own accent border/shadow (wrapper
  `:focus-within`) — never two rings at once. Disabled = `opacity: 0.45` +
  `cursor: not-allowed` everywhere; a `.dim` container never compounds with
  child `:disabled` opacity (double-fade reads as broken).
- **Workspace restore**: the entire screen (selection + order, hidden set,
  compare picks, mode, type, layout, interval/custom range, as-of, view)
  persists (`tschart.workspace`, localStorage in the prototype — production
  design in `WORKSPACE_PERSISTENCE.md`) and restores **silently** on load; the
  app simply looks like the trader left it. Legend collapse and tree expansion
  persist too.
- **Deep links**: `?series=<id>[,<id>…]&mode=<mode>&layout=<layout>` restores the
  full comparison set, chart mode, and overlay/split layout on load (shareable)
  — deep links **override** the restored workspace.
- **Custom date range**: a calendar-range button beside the interval presets
  opens a From–To picker; while a custom window is live, no preset shows
  active. Presets and custom are mutually exclusive.
- **Data export**: the data table footer has CSV download + copy-for-Excel
  (TSV clipboard) — numbers must always have an exit to a spreadsheet.
- **Provenance**: the toolbar shows `{source} · as of {date}` for the primary
  series — always say where numbers come from, even in a prototype.
- **Keyboard in the tree**: ↑↓ walk visible rows, → expands / steps into, ←
  collapses; Enter toggles selection (native buttons).
- **Scrollbars**: thin, token-colored, only where a region actually scrolls;
  `body` never scrolls (the app owns its regions).

---

## 5b. Maturity vs. trading terminals (capital.com / TradingView)

Where this system stands against terminals traders live in, and what "trader-worthy"
still needs. The design language here is deliberately *calm* — the discipline is
**don't fit everything in one frame**; use progressive disclosure (dropdowns,
popovers, collapsible legend) and keep one primary action per surface.

- **Matched now (the *feel*):** dark terminal palette, tokenized dual theme, a
  single uncluttered chart, a **chart-type selector** separated from view mode,
  compact icon toolbars, collapsible legend, per-series live values, no duplicated
  counters, first-class empty/loading/error states, **keyboard-first workflow**
  (⌘K palette), **crosshair sync across split panes**, hover-tracking stats
  strip, measure tool + zoom/fit reflexes, zero artificial latency.
- **Data realism (biggest gap):** live/streaming feed, intraday timeframes
  (1m…4H) + tick, session/holiday handling, revision-aware history. (This prototype
  uses deterministic seeded data.)
- **Analysis tools:** indicators (MA / RSI / volume), drawing tools, price
  alerts, saved layouts & watchlists per user, spread/ratio builder.
- **Trust & performance:** virtualize everything, sub-16ms interactions at 50+
  series, full screen-reader parity, undo/redo.

Treat the list top-down: data realism and a couple of core indicators buy the most
trader trust per unit of effort.

## 6. Using the system elsewhere

1. Copy `docs/tokens.css` → include once globally, set `data-theme` on `<html>`.
2. Reach for the utility classes (`.ts-mono`, `.ts-badge`, `.ts-icon-btn`,
   `.ts-segmented`, `.ts-panel`, `.ts-empty`, `.ts-skeleton`) before writing CSS.
3. Never introduce a raw hex in a component — add a token instead.
4. For charts, see `CHART_STYLE_GUIDE.md`.

## 7. Series identity & observations at scale (round 10)

A comparison view can hold **20–30 series** at once. Design rules for keeping that
legible — validated against capital.com's 30-series compare:

**7.1 Palette.** `SeriesColorService` holds a **24-slot** OKLCh-normalized
dual-theme palette: a 12-hue maximally-separated core plus 12 finer fills. A slot
is assigned in selection order and is **stable for the series' whole lifetime on
the chart** — the same color shows in the tree dot, legend swatch, inspector
swatch, and right-edge label. Past ~24 series hues repeat; that is acceptable
because the label (below) is the real identifier.

**7.2 The right-edge label is the identifier — not the line color.** Each tracked
series gets a colored pill at the right edge carrying **symbol + value**,
vertically de-overlapped and sorted. At high N you identify a series by reading
these labels, not by tracing a hue through a tangle of lines. Lines are **always
solid**; dash/dot is reserved for *semantic* distinctions (forecast vs actual,
data vintage) and must never be spent on identity.

**7.3 Many-series compare uses a normalized %-change axis.** Absolute scales for
mixed-unit instruments (EUR/MWh, USD/bbl, index points) share no axis. For a
many-series overlay, normalize each series to **% change from the window start**
so one axis is honest for all. Absolute mode stays for one or few same-unit series.

**7.4 Observations (multi-field series).** Some series carry several fields per
timestamp — OHLC (open/high/low/close), bid/ask. Rules:

- In a **compare** (many-series) view, show **one field per series** (default
  close). Never expand to N series × M fields — 12 × 4 = 48 lines is an unreadable
  mat.
- Per-field **toggle chips** (O · H · L · C) appear only when a **single or few
  series are focused**. Color stays per-series; the *field* is distinguished
  *within* that focused series' view (weight/opacity or a candle), not as new
  top-level colors.
- The right-edge label names the tracked field when it is not the default.
- Legend/axis follow the same one-field-per-series rule; the focused-series chips
  drive a secondary, scoped readout.

*(7.3 normalized axis and 7.4 chips are the specified target; the round-10 change
shipped the 24-slot palette, right-edge identity labels, the solid-line rule, and
the data-resilience foundations they build on.)*

---

## 8. Palette variants & redundant encoding (round 11)

Series identity is no longer a colour — it is a **slot**, and a slot resolves to
a colour *and* a shape:

```
slot -> { colour: entries[slot % entries.length],
          glyph:  glyphs[floor(slot / entries.length)] }
```

Five palettes ship: Default (24 hues), Red–green safe (Okabe–Ito, 8 × 3 shapes),
Blue–yellow safe, High contrast (6, heavier stroke) and Shape-first (4 tones,
shape carries identity). All five expose 24 slots, so no consumer changes.

Two rules that look like details and are not:

- **The CVD palettes are not lightness-normalised.** §1.1's OKLCh rule holds
  only while hue carries identity. When the hue axis collapses, lightness *is*
  the channel, and flattening it destroys the palette.
- **Chart lines are graphical objects**, so their contrast floor is 3:1 against
  the chart well, not 4.5:1. Value-tag text sits on a colour fill and takes the
  4.5:1 text rule, with the ink chosen by comparing both candidates' contrast —
  never by testing luminance against a threshold.

Search-match highlighting uses `--ts-accent-weak`. **Not amber**: `--ts-highlight`
is reserved for "now", and spending it here breaks that reservation.

Full detail, including hex tables and the verification checklist:
`ACCESSIBILITY_GUIDE.md`.

## 9. Chart card chrome (round 11)

The card header is one non-wrapping row; **mode** renders as segmented buttons
above a 1040px *container* query and collapses to a dropdown below it. A
container query, not a media query — the deciding width is the card's, which
changes when the dock opens or the resizer moves while the viewport does not.

The card footer is a **control bar**: zoom out / in / fit at the left, interval
buttons right-aligned. Provenance moved to the series inspector and the legend
row tooltip. A custom window (from a deep link or a restored workspace) shows as
a clearable chip there — it is the only control for a value that applies in
every mode, so it must never be hidden behind one.

The browse dock has a **resizer with zero layout width**: the element is
`width: 0` and both its 7px hit area and 2px line are pseudo-elements straddling
the border, invisible until hover with a 120ms delay. Adding it moved nothing.
