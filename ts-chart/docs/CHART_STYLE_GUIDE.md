# TS Chart — Lightweight Charts Style Guide

How to make [lightweight-charts](https://github.com/tradingview/lightweight-charts)
(v5, Apache-2.0) look like TS Chart: calm, dense, and readable. Every color is a
design token so charts re-theme with the app. Reference implementation:
`src/app/layout/center-panel/chart-view.component.ts`.

---

## 1. Chart options preset

Read tokens off a mounted element with
`getComputedStyle(el).getPropertyValue('--ts-…').trim()` so the chart always
matches the live theme.

```ts
import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts';

const chart = createChart(el, {
  autoSize: true,                              // built-in ResizeObserver
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' }, // inherit panel bg
    textColor: v('--ts-text-muted'),
    fontFamily: v('--ts-font-mono'),           // numbers are always mono
    fontSize: 11,
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: v('--ts-grid-weak') },
    horzLines: { color: v('--ts-grid-strong') },
  },
  rightPriceScale: {
    borderColor: v('--ts-border'),
    scaleMargins: { top: 0.14, bottom: 0.1 },  // headroom for legend + today pill
  },
  timeScale: { borderColor: v('--ts-border'), rightOffset: 4, fixLeftEdge: true },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { color: v('--ts-text-muted'), width: 1, style: LineStyle.Dashed,
                labelBackgroundColor: v('--ts-bg-active') },
    horzLine: { color: v('--ts-text-muted'), width: 1, style: LineStyle.Dashed,
                labelBackgroundColor: v('--ts-bg-active') },
  },
});
```

**Rules**
- **Transparent background** — the chart sits on `--ts-bg-elevated`; never paint a
  second background.
- **Grid is a whisper**: minor lines `--ts-grid-weak`, major `--ts-grid-strong`.
- **Dashed muted crosshair**, magnet mode. The axis labels use `--ts-bg-active`
  pills so they read on any grid line.
- Hide native `attributionLogo`, series price lines and last-value labels — we draw
  our own (below) for full control.

## 2. Series presets (v5 `addSeries(Definition, opts)`)

```ts
// Area (default for prices) — gradient fill from the series color
const s = chart.addSeries(AreaSeries, {
  lineColor: color, lineWidth: 2,
  topColor: rgba(color, 0.28), bottomColor: rgba(color, 0.02),
  priceLineVisible: false, lastValueVisible: false,
  crosshairMarkerBackgroundColor: color,
  crosshairMarkerBorderColor: v('--ts-bg'),
});

// Line — same, no fill.  Candles — up/down from tokens, no borders:
chart.addSeries(CandlestickSeries, {
  upColor: v('--ts-up'), downColor: v('--ts-down'),
  wickUpColor: v('--ts-up'), wickDownColor: v('--ts-down'),
  borderVisible: false, priceLineVisible: false, lastValueVisible: false,
});
```

- **Line width 2** for the primary series; **1 dotted** for overlays (moving
  averages) in `--ts-text-muted` so they recede.
- Gradient area fills use the series hue at 0.28 → 0.02 alpha — present but never
  muddy.

## 3. The signatures that make it feel premium

1. **Fixed left legend with live values + controls.** **One fully-opaque
   container** (`bg-elevated`, single hairline border, shadow-1) holding
   borderless rows — one border for the whole legend, not per row. Two banned
   alternatives, both field-tested and failed: translucent panels (smudge over
   price action) and ghost text with text-shadow (unreadable wherever lines
   run). Not a chart primitive; driven by `subscribeCrosshairMove`, falling
   back to the last datapoint when the cursor leaves. **Rows only, no header**
   — row 1 carries identity, the toolbar carries the mode. Row-label click
   opens the series inspector; the collapse control sits below the rows inside
   the container.
   *Future (needs async data): an inline 3-dot loading indicator per legend
   row while a series loads — capital.com does this well.*
2. **Crosshair tooltip (toggle, default off).** `subscribeCrosshairMove` also
   yields `param.point` — position a solid card at `point + 14px`, flipping
   left/up near the right/bottom edges; `pointer-events: none` so it never
   steals the crosshair. Content: hovered date + per-series `dot · SYM ·
   value + unit`. Only the pane physically under the pointer shows it. One row per series: `● label  value  👁  ✕` — the
   **👁/✕ reveal only on row hover or keyboard focus** (buttons keep their width so
   rows never shift). The eye toggles visibility (row dims to 45% but **stays
   listed** — hide must never look like delete, so feed the legend all selected
   series, not just the visible ones); the ✕ removes it from the set. The
   collapse control sits **below the last row**; collapsed = chevron + count
   only. The whole legend unmounts when no series is charted.
2. **Today marker.** Compute `timeScale().timeToCoordinate(markerTime)` and position
   a dashed amber (`--ts-highlight`) vertical rule + pill; recompute on
   `subscribeVisibleLogicalRangeChange` and via a `ResizeObserver`. In `asof` mode
   the same primitive becomes the "AS OF" cut; in `seasonal` it is hidden.
3. **Per-series value tags.** For each visible series, a tag in the series color
   pinned to the right edge at `series.priceToCoordinate(last)` — so every line reads
   its own last value. **De-overlap them**: sort by y, sweep down enforcing a
   16px minimum gap, clamp to the host — near-equal last values (spread trades)
   must stay individually legible.
4. **OHLC readout for candles.** The legend value area shows
   `O … H … L … C …` (letters muted, values bright, C colored vs open) driven
   by the crosshair, falling back to the last bar. Close-only readouts on
   candles are a red flag to anyone off a terminal.

```ts
chart.subscribeCrosshairMove(p => {
  const d = p.seriesData.get(series);          // {value} or {open,high,low,close}
  legend.value = d?.value ?? d?.close ?? lastValue;
  legend.date  = p.time ?? 'latest';
});
```

## 4. Multiple series & modes, concisely

- Legend row = `dot · short-label · value **+ its own unit** · eye · remove`. Each
  series shows **its own UOM** — never a single common unit across mixed-unit
  series. Long names live in the info panel, **not** the legend.
- Show a **delta only where a point-over-point change is meaningful** (`latest`,
  `asof`, `candlestick`); hide it in `forward` / `strip` / `seasonal`.
- **Add/remove series by reconciling** the desired set against the drawn set
  (key each drawable by `id + mode`): only new ids `addSeries`, dropped ids
  `removeSeries`, survivors keep their data. Removing one legend row must **not**
  rebuild the rest or snap the zoom. Visibility (`hiddenIds`) drops a series from
  the desired set the same way; the row dims to 45%.
- **Colors come from a slot palette, not metadata.** A 12-slot dual-theme palette
  assigns a hue on selection (survivors keep slots, freed slots are reused) and
  resolves per active theme — see `core/series-color.service.ts`. Palette entries
  must be 6-digit hex (gradient `rgba()` derivation requires it). In `latest`, a
  lone series renders as a filled **area**; 2+ render as **lines** (width 2) so
  overlap reads.
- **Chart modes** follow energy-trading conventions with **union gating**: enable
  a mode if *any* charted series supports it; draw only the compatible series and
  dim the rest in the legend with an `n/a` tag (they return on mode switch).
  Disable a mode only when no series supports it; tooltips name the affected
  series either way:
  - `asof` — **point-in-time snapshot**: history truncated at a chosen as-of date,
    with a light vintage revision of the recent tail (an earlier as-of differs from
    latest). Driven by a real **date picker**, never a fixed offset.
  - `forward` — **forward curve**: x-axis is the delivery period (monthly near-dated,
    coarsening to quarters then calendar years), snapshot as-of the selected date.
  - `strip` — **block-average of consecutive forward contracts** (e.g. Cal strip),
    drawn as a `LineType.WithSteps` step per calendar year — not a monthly mean.
  - `seasonal` — groups by year, remaps each point to a base year (`2000-MM-DD`) and
    overlays one line per year (recent brightest); dedupe times after remap.
- **Chart type is separate from mode.** Type (line / area / **candles**) decides how
  a series is *drawn*; mode decides *what data*. **Line is the default.** Candles
  apply to a single OHLC-capable series on a time-axis mode (latest / as-of);
  area only for a lone series (overlapping fills muddy). Gate types in the
  picker with disabled rows + tooltips — **never silently downgrade** (it makes
  two types render identically and erodes trust). In as-of mode, candle data is
  **truncated at the as-of date** (no future leakage), like the line vintages.
- **Never render a silent blank.** Spec builders exclude hidden, mode-incompatible
  and broken-status series; when that leaves zero drawables while series are
  selected, show a centered in-chart notice. Guard every "last point" read
  (`last?.close ?? …`) — a blank chart plus a console error is the fastest way
  to lose a trader.
- **Every visible series is drawn.** Selecting a series always adds a line.
  A **Compare** control picks the **layout**: **Single** (one), **Overlay** (all on
  one price scale), or **Split** (up to 3 chosen panes). Panes share one date-range /
  crosshair event.

## 5. Re-theming (no flicker)

On theme change, **`applyOptions` for layout/grid/scales/crosshair** and
**recreate the series** (so gradient stops and up/down colors refresh cleanly).
Series hues resolve per theme through the assigned slot palette, so the same
selection re-colors to the light/dark variants automatically; also recolor
surviving series in place (`applyOptions`) when their assigned hex changes.
Keep the same `IChartApi` instance — never destroy the chart just to recolor it.

## 6. Data / interval

- Generate once, **slice by interval** (`1M/3M/6M/1Y/ALL`) rather than regenerating
  — keeps pan/zoom stable.
- `timeScale().fitContent()` after `setData`.
- **Zoom controls**: a `− / + / fit` pill overlays the chart bottom-right and
  reveals on chart hover. Zoom scales the visible logical range ±25% around its
  center (`setVisibleLogicalRange`); fit = `fitContent()`. Enforce a minimum
  window (~5 bars). **Double-click** on the chart also fits all data.
- **Measure tool (Shift+drag)**: on `pointerdown` with `shiftKey`, freeze
  panning (`applyOptions({ handleScroll: false, handleScale: false })`), draw a
  translucent accent rect, and label it `Δvalue (Δ%) · N days` — values via
  `series.coordinateToPrice(y)`, dates via `timeScale().coordinateToTime(x)`.
  **Snap x to bar centers** (round-trip `coordinateToTime` →
  `timeToCoordinate`) and **clamp the label inside the host** (top + right
  edges) — an approximate or clipped measurement is worse than none. The rect
  persists after release until Esc or the next plain click; restore
  scroll/scale on `pointerup`.
- **Custom windows**: slicing honors an explicit from–to range when set
  (`sliceRange`), else the preset interval (`sliceInterval`); the render
  signature must include the range so caches invalidate.
- **Crosshair sync across panes**: each pane publishes `{ paneId, time, vals }`
  to a shared service from `subscribeCrosshairMove` — but **only while the
  pointer is physically inside that pane** (tracked via pointerenter/leave; this
  makes the sync loop-proof). Other panes mirror it with
  `setCrosshairPosition(value, time, firstTrackedSeries)` using a per-series
  `Map<time, value>` index, and `clearCrosshairPosition()` when the hover ends
  or the time is absent from their data. The same published hover drives the
  toolbar **stats strip** (hovered value + date, falling back to last).
- Time as `'YYYY-MM-DD'`; values mono-formatted with adaptive precision
  (`src/app/core/format.ts`).

## 7. Screenshot & fullscreen

- **Screenshot**: `html-to-image` `toBlob` of the chart card at `pixelRatio: 2`
  with `backgroundColor = --ts-bg-elevated`; download + copy to clipboard, plus a
  320ms white shutter flash.
- **Fullscreen**: native Fullscreen API on the chart card; swap maximize/minimize
  icon from the `document.fullscreenElement` state; browser handles `Esc`.

## 8. Checklist

- [ ] Background transparent; grid = whisper.
- [ ] Numbers mono + tabular.
- [ ] One amber accent (today + price pill), nothing else amber.
- [ ] Legend live, concise, toggles visibility.
- [ ] Re-theme via `applyOptions` + series recreate, one chart instance.
- [ ] `autoSize` + overlay reposition on resize.
- [ ] Empty/error/loading states before the chart ever mounts.
- [ ] Points pass `sanitizePoints` before `setData` (no null/NaN/dupes throw).
- [ ] Lines solid; identity via right-edge symbol+value labels.
- [ ] Crosshair readout = hovered timestamp only, `—` when a series has no point.
- [ ] Wheel/pinch zoom anchors on the cursor's data point.

## 9. Scale & resilience (round 10)

**Right-edge identity labels.** The per-series value tags carry **symbol + value**
(`ValueTag { y, value, color, label }`, rendered as `.lastval` with `__sym` +
`__val`). They are de-overlapped (16px sweep + host clamp) and are the authoritative
identifier past the palette core. Populate `label` from a `series() → symbol` map in
`updateOverlays()`. Lines stay solid (`LineStyle.Solid`); dash is semantic only.

**Data hygiene at the boundary.** Every point array passes `sanitizePoints`
(`src/app/data/sanitize.ts`) immediately before `api.setData` in `render()`: drops
null/undefined/NaN and malformed dates, sorts ascending, dedupes timestamps. It is
**memoized by input identity** so repeat renders return the same cleaned reference —
that preserves the survivor `dataRef !== data` diff (no re-`setData`, no flicker).
lightweight-charts throws on nulls/dupes/out-of-order; this guarantees it never sees
them. Zero drawables still routes to the in-chart notice — never a silent blank.

**Missing-data readouts.** `legendRows` reads a `hovering = hoverDate() !== null`
guard: while the crosshair is active a series with no point on that date resolves to
`null` → `formatValue` renders `—`; `lastVals` (latest known) is used **only** at
idle. The hover card (`cardRows`) already filters `value != null`. No carry-forward.

**Anchored zoom.** `buildChart` sets `handleScale.mouseWheel` + `pinch` and
`handleScroll.mouseWheel` explicitly; wheel/pinch zoom keeps the time under the
cursor fixed (TradingView ⌘/ctrl+wheel feel). The `.zoom` +/− buttons zoom around
centre and sit **bottom-left, raised above the time axis** — the right edge is
reserved for price-axis values + identity labels and controls must not occlude them.

**Multi-field observations (target).** OHLC/bid-ask series show one field per series
in compare; per-field chips only when a single/few series are focused. See
`DESIGN_GUIDE.md` §7.4.

---

## 10 · Pane containment, markers and viewport control (round 11)

### Clip every overlay to its pane

`.chart-host` and `.pane` both set `overflow: hidden`. The measure rectangle,
its label and the right-edge value tags are absolutely positioned against the
host, and in a split layout the panes are flex siblings separated only by a
border. A border is not a boundary: without the clip those overlays paint over
the neighbouring chart and read as *that* chart's data.

### Any drag takes pointer capture

`setPointerCapture` on pointerdown, and `pointercancel` / `lostpointercapture`
handled identically to `pointerup`. A shift-drag released over a sibling pane
otherwise never delivers the origin's `pointerup`, so the origin stays at
`handleScroll/handleScale: false` — pan and zoom dead until Escape. Wrap the
call in try/catch: it throws `NotFoundError` for a pointer the browser no longer
tracks, and that must not skip the cleanup that follows it.

Leave the price-scale strip alone — that is lightweight-charts' own drag target
(`axisPressedMouseMove`), so a measure must not start there.

### Identity markers: sparse, never per bar

```ts
createSeriesMarkers(series, marks, { zOrder: 'aboveSeries' })
```

Six marks across the visible range plus one pinned at the last bar, recomputed
on `subscribeVisibleLogicalRangeChange` behind a single rAF guard, and skipped
entirely above 12 drawn series. One mark per bar turns a 730-point daily series
into a mat of dots and makes the redraw O(n).

**Four shapes exist** — `SeriesMarkerShape = 'circle' | 'square' | 'arrowUp' |
'arrowDown'` (`typings.d.ts:4922`). That covers three glyph cycles with one
spare. The DOM chrome is SVG and unconstrained.

Lines stay `lineStyle: Solid`; dash remains semantic-only.

### Viewport controls live on the card, not the pane

`chart-panel` holds `viewChildren(ChartViewComponent)` and fans `zoomBy(±1)` /
`fitAll()` to every pane, so split panes stay on one window. Two panes at
different zooms do not merely look untidy — they invite a misread.
