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
`scss/*`, `tokens/*` (mirrors of `docs/` + `src/styles/`).

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
- **Series colors** come only from `SeriesColorService` (OKLCh-normalized
  dual-theme 24-slot palette, assigned in selection order, stable for a series'
  whole lifetime on the chart) — never stored in catalog metadata, never raw hex
  in components (charts are the one exception: the palette itself is concrete hex
  because canvas needs it). The SAME color appears in tree dot, legend, inspector,
  and right-edge label.
- **Identity at scale**: lines are always **solid** (dash = semantic only, never
  identity); the authoritative identifier for many series is the right-edge
  colored **symbol + value** label (`ValueTag`/`.lastval`), de-overlapped.
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

**Chart-first, chrome never veils the chart.** The chart card always owns its
pixels and is never covered. Selection (tree/search) and series details
(inspector) are **in-flow docks** — the chart flexes beside them — toggled from
the 48px icon rail (⌘K / ⌘/ / ⌘. also), each with its own close (×). The **tree
dock is persistent and OPEN by default** (a primary driver); the **inspector dock
is non-modal and closed by default**. NO scrim, NO blur over the chart (a modal
veil over live data fails desk review). On small screens docks collapse to fixed
overlays. Dock state persists (`tschart.dock`). The rail is the single toggle
owner — the toolbar carries no panel toggles. The chart header is ONE row that
never wraps (strip truncates first; mode is a dropdown, intervals stay buttons);
provenance lives in the card's status footer. Preferences go in the user menu,
never in toolbars.

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
