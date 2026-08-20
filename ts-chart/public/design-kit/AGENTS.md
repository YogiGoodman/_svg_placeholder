# TS Chart — Trading SPA UX Kit (for coding agents)

A portable, terminal-grade design system for **energy-trading timeseries SPAs**
built with **Angular + TradingView lightweight-charts**. Drop this folder into a
project (or hand it to a coding agent) as the single source of truth for look,
feel, and charting conventions. Everything is token-driven — no hardcoded colors.

## What's in here

> **New in round 11:** `ACCESSIBILITY_GUIDE.md` (colour-vision-deficiency
> palettes, the colour × shape identity model, contrast floors) and
> `SEARCH_ARCHITECTURE.md` (the provider seam and the Elasticsearch migration).
> Read the accessibility guide before touching `series-palettes.ts` — the CVD
> palettes deliberately break the OKLCh lightness rule, and that is the point.

```
design-kit/
  AGENTS.md              ← you are here (how to consume the kit)
  DESIGN_GUIDE.md        ← full design system: color, type, spacing, components, states
  CHART_STYLE_GUIDE.md   ← lightweight-charts v5 styling + chart-mode semantics
  UX_ENGINEERING_PLAYBOOK.md ← 30 transferable trader-facing UX/eng principles + failure log
  WORKSPACE_PERSISTENCE.md   ← workspace state: localStorage now, backend design at scale
  DEVEXTREME_TREELIST_GUIDE.md ← taking a DevExtreme TreeList to this row spec: DOM, CSS, theming, lazy loading
  scss/
    _tokens.scss         ← all design tokens (dark + light), :root & [data-theme]
    _utilities.scss      ← reusable classes (.ts-btn, .ts-segmented, .ts-badge, …)
    _reset.scss          ← minimal opinionated reset (reduced-motion aware)
  tokens/
    tokens.css           ← framework-agnostic CSS custom properties (same as _tokens)
    tokens.json          ← structured tokens for design tools (Figma/Penpot)
```

## How to use it (Angular)

1. Import once, globally, in order:
   ```scss
   // styles.scss
   @use 'design-kit/scss/tokens';
   @use 'design-kit/scss/reset';
   @use 'design-kit/scss/utilities';
   ```
   (Or just link `tokens/tokens.css` for a non-SCSS app.)
2. Set the theme on the root element — the whole palette remaps:
   ```html
   <html data-theme="dark">   <!-- or "light" -->
   ```
   Optional density: `data-density="compact"`.
3. **Never write a raw hex in a component.** Reference `var(--ts-*)` or add a
   token. Reach for a utility class before writing CSS. Exception: **series chart
   colors** come from a runtime slot palette (assigned on selection, dual-theme
   hex pairs) — see CHART_STYLE_GUIDE.md — because canvas charts need concrete
   hex values.

> **Keep this kit truthful.** Any UI/UX change in the app must update
> `DESIGN_GUIDE.md` / `CHART_STYLE_GUIDE.md` (source of the in-app
> "Export design kit" zip, mirrored in `docs/`) in the same change.

## Non-negotiable rules (what makes it feel premium)

- **Accent is rationed** — `--ts-accent` for the primary signal only. Amber
  (`--ts-highlight`) means "now" (today marker / price pill) and nothing else.
- **Every number is mono + tabular** (`.ts-mono`) so columns don't jitter.
- **Up/down are semantic** (`--ts-up` / `--ts-down`), only for signed values.
- **States are first-class**: welcome / loading skeleton / 403 / 404 / empty —
  never a blank screen. Placeholder SVGs carry a single bottom instruction.
- **Motion ≤ 240ms**, respect `prefers-reduced-motion`.

## Charts (lightweight-charts v5) — see CHART_STYLE_GUIDE.md

- Transparent chart background; grid is a whisper; hide native price lines /
  attribution and draw your own legend + markers.
- Read tokens live: `getComputedStyle(el).getPropertyValue('--ts-…')` so charts
  re-theme with the app.
- **One chart instance.** Re-theme via `applyOptions` + recreate series; never
  destroy the chart to recolor. Add/remove series by **reconciling** the desired
  set against the drawn set — removing one series must not rebuild the rest.
- **Per-series units**: each legend row shows its own value + unit; do not show a
  single common UOM across mixed-unit series. Show a delta only where a
  point-over-point change is meaningful (latest / as-of / candles).

## Chart modes (energy-trading semantics — gate per series)

Not every series supports every mode. Gate with a **union policy**: enable a mode
if *any* charted series supports it, draw only the compatible series and dim the
rest in the legend with an `n/a` tag. Disable a mode only when no charted series
supports it; explain either case with a tooltip naming the affected series.

| Mode | Meaning |
|---|---|
| **Latest** | Most recent published timeseries. Available for all series. |
| **As of** | Point-in-time snapshot — the series as known on a chosen date (data vintages). Needs an as-of date picker. |
| **Forward** | Forward curve / term structure by delivery bucket (months → quarters → seasons → cal years), snapshot as-of a date. |
| **Strip** | Block-average of consecutive forward contracts (e.g. Cal / seasonal strip). |
| **Seasonal** | One line per year overlaid on a common Jan–Dec axis; recent year brightest. |
| **Candles** | OHLC bars. |

## Compare

Selection can hold several series; **compare charts at most 3** via a layout
control: **Single / Overlay** (one price scale) **/ Split** (up to 3 side-by-side
panes). All panes share one date-range / crosshair event.

---

Attribution: illustrations & tokens are the TS Chart project's authored assets;
icons by [Lucide](https://lucide.dev) (ISC); lightweight-charts is Apache-2.0.
Synthetic demo data only.
