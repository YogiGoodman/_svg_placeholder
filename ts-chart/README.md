# TS Chart

A dark-first, terminal-grade **timeseries charting prototype** built with Angular 20
and TradingView's [lightweight-charts](https://github.com/tradingview/lightweight-charts).
Browse forecast series, contracts and regional markets in a resizable 3-panel
workspace, preview any series as a polished chart or a data table, and read its
metadata in collapsible info cards.

> **No account, no API keys, no network.** All ~30 well-known data sources
> (Brent, WTI, TTF, Henry Hub, EUA carbon, power markets, weather, metals, LNG…)
> are **hardcoded metadata** rendered with **deterministic seeded** dummy
> timeseries — the chart looks real and is stable across reloads.

## Quick start

```bash
cd ts-chart
npm install
npm start          # → http://localhost:4200
```

Build: `npm run build` (output in `dist/ts-chart`).

## Highlights

- **3-panel workspace** — collapsible, drag-resizable side panels (`angular-split`),
  sizes persisted; responsive down to slide-over drawers on mobile.
- **Navigation tree** — 3 tabs, multi-level tree, live search, status badges,
  colored series dots. **Multi-select** — click leaves to build a comparison set
  (cap configurable in the user menu, default 8).
- **Premium chart** — **multi-series overlay** with a fixed live legend
  (per-series **show/hide** + **remove**), colored per-series right-edge value tags,
  dashed crosshair, **amber TODAY marker**, interval control, **Chart ↔ Data** toggle.
- **Chart modes** — **Latest** (plain timeseries, all series), **As of**
  (actual + dashed forecast past an as-of cut), **Strip** (monthly-averaged step),
  **Seasonal** (years overlaid on a Jan–Dec axis), **Candles**.
- **Compare** — with 2+ series, switch **Overlay** ↔ **Split** (side-by-side, up to 3).
- **Info panel** — **one collapsible card per selected series** (value, signed
  change, source, frequency, category, 2y range).
- **Theme** — dark default + light, instant token remap; comfortable/compact density.
- **Utilities** — one-click **screenshot** (download + clipboard, shutter flash),
  native **fullscreen**, deep-link `?series=<id>[,<id>…]&mode=<mode>&layout=<layout>`,
  `⌘/Ctrl+/` and `⌘/Ctrl+.` panel shortcuts.
- **First-class states** — welcome, loading skeletons, 403/404 errors, empty search,
  all using authored SVG illustrations.

## Architecture

```
src/app/
  core/     theme · layout · selection · fullscreen · screenshot · icons · format
  data/     models · series-catalog (3 tabs, ~30 series) · seeded generator
  layout/
    toolbar/       toolbar + user-menu (CDK overlay popover)
    workspace/     angular-split host + mobile drawers
    left-panel/    nav tabs + recursive tree-node
    center-panel/  chart-panel → chart-view · data-table · empty-state
    right-panel/   info-panel + collapsible info-card
  styles/   _tokens · _reset · _utilities  (all var(--ts-*), zero hardcoded hex)
```

State is **Angular signals** throughout; components are standalone + `OnPush`.

## Design deliverables

- [`docs/DESIGN_GUIDE.md`](docs/DESIGN_GUIDE.md) — full app design system.
- [`docs/CHART_STYLE_GUIDE.md`](docs/CHART_STYLE_GUIDE.md) — lightweight-charts styling.
- [`docs/tokens.css`](docs/tokens.css) / [`docs/tokens.json`](docs/tokens.json) —
  exportable, framework-agnostic tokens.

## Stack

Angular 20 · lightweight-charts 5 · @angular/cdk 20 · angular-split 20 ·
lucide-angular · html-to-image. All open source.

## Attribution

Placeholder & error illustrations in `public/assets/placeholders/` are the
project's authored SVG design assets. Icons by [Lucide](https://lucide.dev) (ISC).
Data values are realistic references to public benchmarks; **timeseries are
synthetic** and for demonstration only.
