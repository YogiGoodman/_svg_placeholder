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
- **Series colors** come only from `SeriesColorService` (OKLCh-normalized
  dual-theme slot palette, assigned in selection order) — never stored in
  catalog metadata, never raw hex in components (charts are the one exception:
  the palette itself is concrete hex because canvas needs it).
- **Disabled** = `opacity: 0.45` + `cursor: not-allowed`; a `.dim` container
  must not compound with child `:disabled` opacity.
- **No artificial latency.** Skeletons only for genuinely async feedback.
- Modes use **union gating**: enabled if any charted series supports it;
  incompatible series dim in the legend with `n/a`.
- Tooltips explain every disabled control (which series blocks it and why).

## Layout doctrine (round-9 restructure)

**Chart-first, transient chrome.** The chart card owns the pixels; selection
(browse drawer via the 48px icon rail or ⌘K) and series details (inspector,
opened from legend-row click / rail / ⌘.) are overlay drawers closed by
default — never permanent panels. The chart header is ONE row that never
wraps (strip truncates first; mode is a dropdown, intervals stay buttons);
provenance lives in the card's status footer. Preferences go in the user
menu, never in toolbars.

## Architecture notes

- State lives in `src/app/core/` services; `SelectionService` is the single
  source of truth (selection order = color slot order).
- **Workspace persists to localStorage** (`tschart.workspace`, versioned);
  URL deep-link params override on load. Production design:
  `docs/WORKSPACE_PERSISTENCE.md`.
- Tree expansion: `TreeStateService` (survives tab switches). Legend collapse:
  `tschart.legend`.
- Icons are a curated set in `core/icons.ts` — register before use; no
  duplicate keys (`Download` etc. already present).

## Verification

`cd ts-chart && npx ng build --configuration development` — strictTemplates is
on; a green build validates all template bindings. Then walk the manual flows:
select/deselect, hide/show, theme toggle, mode × type × interval × as-of
combos, split + crosshair sync, ⌘K palette, refresh (workspace restore).
