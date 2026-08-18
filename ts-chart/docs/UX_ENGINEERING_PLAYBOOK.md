# Trader-Facing UX Engineering Playbook

Distilled principles for building **production-grade trader-facing applications** —
charting terminals, order tickets, risk screens, market-data dashboards. Written
for a senior engineer/architect who is starting from these learnings rather than
rediscovering them.

Every principle below was earned building **TS Chart** (a commodity-series
charting SPA) across many review rounds against the standards traders actually
live in — **Bloomberg Terminal, TradingView, capital.com**. Each carries a
**Source**: a file in this repo where it is implemented, and/or an external
standard where one governs.

> How to read this: the **Rule** is the imperative. The **Why** is the trader's
> reason (not an aesthetic one). The **Source** is where to verify or copy it.
> The deeper specs live in the companion docs — see the map at the end.

---

## 1 · Space & real-estate — the chart owns the pixels

A trader stares at one screen for eight hours. Every pixel of permanent chrome is
rent charged against the data. The discipline is **not** "fit everything in one
frame" — it is **transient chrome**: show a control when it is needed, remove it
when it is not.

**1. Chart-first, and chrome never veils the chart.**
The primary surface (the chart / the blotter) always owns its pixels and is never
covered. Selection and detail UI are **in-flow docks** — the chart flexes beside
them — toggled from a slim icon rail, each with its own close control. A dock that
is a *primary driver* of the app (the series tree) is persistent and open by
default; a dock used in bursts (the inspector) is non-modal and closed by default.
Never a modal overlay + scrim/blur over live data.
*Why:* an operator must read the chart *while* selecting or inspecting; a browse
panel that veils the price action — even blurred — fails a trading-desk review.
Docking costs some width but keeps both surfaces legible, which is the trade a
desk actually wants. (Bloomberg/capital.com dock; they don't modal-veil.)
*Source:* `src/app/layout/workspace/workspace.component.ts` (rail + in-flow docks,
no scrim); `core/layout.service.ts` (persisted dock state).

**2. One header row that structurally cannot wrap.**
Put identity/price first, make secondary switchers dropdowns, and reserve
segmented buttons for the single highest-frequency control. Flexible text
truncates before anything moves.
*Why:* a header that wraps to a second/third band on a narrow window is a visible
failure and steals chart height unpredictably.
*Source:* `src/app/layout/center-panel/chart-panel.component.ts` (single `.bar`,
mode dropdown, interval buttons, `nowrap`).

**3. Budget vertical pixels explicitly.**
Count the chrome above the first data pixel and justify every band (e.g. toolbar
48px, chart header 42px, status footer 22px). Tighten further in fullscreen.
*Why:* on a 1080p laptop, 150px of stacked chrome is a fifth of the chart gone.

**4. Progressive disclosure beats cramming.**
Reach for a command palette, a drawer, or a popover before adding another always-
visible control. One primary action per surface.
*Why:* density that cannot be quieted becomes noise; noise slows decisions.

**5. Provenance and metadata belong in a status footer, not the header.**
"Source · as-of date · data mode" sits in a thin footer on the data surface.
*Why:* it must be *available* (traders verify vintage constantly) but it is not an
*action* — prime top real estate is for what you do, not what you read.
*Source:* `chart-panel.component.ts` (`.cfoot`).

**6. Preferences go in menus; toolbars are for actions.**
A monthly toggle (crosshair-tooltip, density, max-series) lives in the user menu.
An hourly action (mode, interval, screenshot) lives on the toolbar.
*Why:* mixing the two swells the action bar and buries the thing you click often.
*Source:* `src/app/layout/toolbar/user-menu.component.ts`.

---

## 2 · Color system

Color on a trading screen is **data encoding**, not decoration. The palette must
survive dozens of series, two themes, and long sessions without any hue lying
about importance.

**7. Assign series colors at runtime; never store them in the data.**
Hold a fixed slot palette; allocate a slot when a series is selected (in
selection order), release it on deselect, keep it stable while selected.
*Why:* a catalog of millions of series cannot carry per-row colors, and a stored
hex cannot be theme-aware. Assignment-on-use scales and re-themes for free.
*Source:* `src/app/core/series-color.service.ts` (`SeriesColorService`).

**8. OKLCh-normalize the categorical palette.**
Generate hues at a *fixed perceptual lightness and chroma*, rotating hue only, so
no series shouts, none recedes, and none collides with the chrome grays.
*Why:* naive hex palettes (e.g. lime `#a3e635` vs slate `#8fa1b6`) differ wildly
in perceived brightness — the eye reads brightness as importance, which is a lie
about the data.
*Source:* `SERIES_PALETTE` in `series-color.service.ts` (24 dark/light pairs — a
12-hue core plus 12 finer fills for high-N compare); standard: **CSS Color 4 / OKLCh**.

**9. Dual theme is one set of token names, remapped — never a fork.**
Components reference `var(--ts-*)`; light theme redefines the same names.
Runtime-assigned series hues resolve to the active theme's variant.
*Why:* forked stylesheets drift; one token vocabulary guarantees parity.
*Source:* `src/styles/_tokens.scss` (`:root[data-theme='light']`).

**10. Neutral-dark surfaces, not blue-saturated.**
The dark ladder is near-neutral charcoal with only a whisper of cool.
*Why:* a blue-tinted surface fights the blue interactive accent and the blue
series lines, and raises perceived brightness in long sessions. Neutral surfaces
make the data colors pop. (TradingView `#131722`; Bloomberg is black.)
*Source:* `_tokens.scss` dark ladder (`--ts-bg:#0d0f12`, `--ts-bg-elevated:#12151a`).

**11. Ration the accent; keep semantic colors semantic.**
One accent for *interactive* signal only. Up/down colors exclusively for signed
values and candles. A single "now" highlight (amber) for the current marker.
No decorative gradients.
*Why:* if blue also means "avatar" and amber also means "emphasis", the trader
can no longer read color as meaning.
*Source:* `_tokens.scss` (`--ts-accent`, `--ts-up/--ts-down`, `--ts-highlight`);
neutral avatar in `toolbar.component.ts`.

**12. Contrast is a hard rule for numerics, not a matter of taste.**
Any number under 12px must sit at **≥4.5:1** against its surface. Keep a separate
"faint" token for decoration that is never allowed on a number.
*Why:* stylishly-dim price text is unreadable in a bright office — and prices are
the whole point.
*Source:* `--ts-text-muted` (tuned to ~5.5:1) vs `--ts-text-faint`;
standard: **WCAG 2.1 SC 1.4.3**.

---

## 3 · Typography & numerics

**13. Every number is monospace with `tabular-nums`.**
All numerics use a mono font and tabular figures.
*Why:* columns align and a value doesn't change width as it ticks — no jitter, no
horizontal scanning cost.
*Source:* `.ts-mono` utility in `src/styles/_utilities.scss`.

**14. A tight, purposeful type scale; weight maps to hierarchy.**
Dense UI lives at 10–13px; larger sizes are reserved for hero values. Weight
(400/500/600/700) encodes role, not decoration.
*Why:* a terminal is information-dense by nature; a loose scale wastes the height
you fought for in §1.
*Source:* `_tokens.scss` type scale; `DESIGN_GUIDE.md` §1.2.

**15. Per-series units — never a single shared unit across mixed-unit series.**
Each legend/table row shows its own UOM (EUR/MWh, USD/bbl, °C).
*Why:* overlaying gas, crude, and temperature under one implied unit is actively
misleading; verbosity is the cheaper error.
*Source:* legend rows in `chart-view.component.ts`; data-table headers.

---

## 4 · Chart engineering (canvas / lightweight-charts)

**16. Transparent chart background + whisper-quiet grid.**
The chart paints no background (inherits the panel surface); grid lines use the
faintest tokens.
*Why:* a second background creates a seam; a loud grid competes with the series.
*Source:* `CHART_STYLE_GUIDE.md` §1; `chart-view.component.ts` `buildChart`.

**17. Reconcile series; never rebuild the set.**
Key each drawable by `id + mode`; on change, add only new ids, remove only dropped
ids, and let survivors keep their data.
*Why:* rebuilding flickers and snaps the user's zoom — unacceptable while they're
reading a level. Removing one series must not disturb the rest.
*Source:* `chart-view.component.ts` `render()` reconciliation.

**18. One chart instance for its whole life.**
Re-theme by `applyOptions` + recoloring series in place; never destroy and
recreate the chart to restyle it.
*Why:* teardown loses zoom/scroll state and costs a frame; it reads as a flash.
*Source:* `chart-view.component.ts` `applyTheme()`.

**19. Never render a silent blank.**
Exclude hidden, mode-incompatible, and broken-status series from drawing; when
that leaves nothing drawable, show an explicit in-chart notice. Guard every
"last data point" read (`last?.close ?? …`).
*Why:* a blank chart — worse, a blank chart plus a console error — is the fastest
way to lose a risk-taker's trust.
*Source:* `chart-view.component.ts` (`drawnCount`, `.nodraw`, candle guards).

**20. Union gating for mixed capability, not lowest-common-denominator lockout.**
When a control (e.g. "forward curve") applies to some selected series but not all,
enable it if *any* series supports it and dim the incompatible ones in the legend
— don't disable the control for everyone.
*Why:* locking a whole feature because one of eight series lacks it punishes the
trader for comparing.
*Source:* `src/app/core/modes.ts` (`unionModes`); legend `n/a` state.

**21. De-overlap value tags and floating labels.**
After positioning right-edge tags, sweep and clamp them to a minimum gap. The tags
carry **symbol + value** (not value alone) — see Rule 31, they are the identifier
at high series counts.
*Why:* two series at near-equal levels — the exact case in a spread trade — stack
into an illegible smear without a de-overlap pass.
*Source:* `chart-view.component.ts` `updateOverlays()` (`ValueTag`, `.lastval`).

**22. Own the legend, markers, and tooltips as DOM overlays.**
Draw live values, per-series tags, the today/as-of marker, and any crosshair
tooltip yourself over the canvas; drive them from the crosshair subscription. Sync
crosshair across split panes with `setCrosshairPosition`, guarded so it can't
feed back on itself.
*Why:* native chart chrome can't match terminal density or cross-pane behavior;
owning it is the only route to the details that read as "premium".
*Source:* `chart-view.component.ts`; `src/app/core/chart-interaction.service.ts`.

---

## 5 · Interaction & reflexes

Traders don't "use" a terminal, they play it — by muscle memory. The app must
answer reflexes, not just clicks.

**23. A command palette (⌘K) is the primary path, not a shortcut.**
Type a symbol → Enter → charted; the input clears for the next symbol. The browse
UI is the fallback.
*Why:* every Bloomberg/TradingView user's first instinct is to type a ticker; a
mouse-only selection flow feels like a toy.
*Source:* `src/app/layout/command-palette/command-palette.component.ts`.

**24. No artificial latency, ever.**
Never add a synthetic delay/skeleton to synchronous work; reserve skeletons for
genuinely async waits (a real fetch, an explicit retry).
*Why:* traders are latency-paranoid — a fake 380ms shimmer reads as a slow app,
not as polish.
*Source:* removed selection-delay effect in `chart-panel.component.ts`.

**25. Reveal row actions on hover/focus, but reserve their width.**
Management icons (hide/remove) appear on row hover or keyboard focus; the space
they occupy is always reserved so nothing shifts.
*Why:* always-on icons are clutter; icons that reflow the row on hover are worse.
Reserved-width reveal is the TradingView pattern.
*Source:* `chart-view.component.ts` legend `.lrow__btn`.

**26. Persist and silently restore the entire workspace.**
Selection (and its order), hidden set, mode, chart type, layout, interval/range,
and view all persist and restore on load — silently. Deep-link URLs override.
*Why:* a trader reopening to a blank welcome screen is a tool that forgets them;
Bloomberg never forgets your screen.
*Source:* `selection.service.ts` (`WorkspaceState`); scale design in
`WORKSPACE_PERSISTENCE.md`.

**27. Keyboard parity across the whole surface.**
Visible focus rings, arrow-key tree navigation, `Esc` to dismiss any overlay,
shortcuts for the frequent switches.
*Why:* a hand that has to reach for the mouse for a routine action breaks the
flow a terminal exists to protect.
*Source:* `left-panel.component.ts` `onTreeKey`; global keys in `app.ts`.

---

**Lazy-load the level that is actually remote, not the whole tree.** Mark the
branches whose children come from the server and answer everything else on the
spot. If the entire structure goes through the async path, every expansion the
data never needed becomes a round trip, and the operator sees a spinner for a
folder you already had in memory.
*Why:* "the tree is slow" and "this branch is remote" get conflated into one
mechanism, and the cost lands on the ninety percent of expansions that were free.
*Source:* `TreeNode.lazy` marks contract lists only; the taxonomy above them is
answered synchronously.

**A spinner over data you already hold is a lie about latency.** Cache a fetched
branch, and make the cached read *synchronous* — with most grid libraries the
return type is the signal, so `Promise.resolve(cached)` still raises a pending
state even though it settles on the same tick. Disable the widget's global load
panel outright: it veils the operator's primary navigation, and §24 already bans
manufactured waiting.
*Why:* traders read a tree while prices move. A flash of grey on a branch they
opened two seconds ago reads as instability in the data, not in the widget.
*Source:* `dx-tree-list.component.ts` — `fetched` cache, the array-vs-promise
branch in `store.load`, and `<dxo-load-panel [enabled]="false" />`.

**Cap what a branch renders; loading it fast is a different problem from
reading it.** A forward curve with fifty monthly contracts loads in
milliseconds and is still unusable — it buries every sibling branch and turns
scanning into scrolling. Render a fixed number (12 here, a user preference) and
fold the rest behind a "Show N more" row that states the count it is hiding.
*Why:* lazy loading solves cost, not legibility, and the two get conflated
because both are described as "there are too many". The operator's complaint is
about the screen, not the network.
*Where to do it:* inside the same load that produced the branch, where the full
child list is already in hand — one `slice`, no second pass, and no row objects
built for children that are never shown. Make the affordance a real row of the
tree, not chrome bolted underneath it, so virtual scrolling, indentation and
keyboard navigation treat it like everything else.
*Style it as an action, not as data:* the accent token, not a muted one, and
aligned to the same rail as the labels it summarises.
*Source:* `dx-tree/dx-tree-list.component.ts` (`loadChildren`, `revealMore`),
`TreeStateService.childLimit`.

**A node that is both a leaf and a group gets two targets, not one.**
In a real instrument taxonomy a node often *is* a series and *contains* series
(Curve Builder › Brent › M+1 is a tradable curve point with 24 contracts under
it). Give the row body the leaf action — chart it — and reserve expansion for the
chevron alone, with a padded hit area. Show the leaf's color dot on it so its
selected state reads the same as any other series.
*Why:* the default "parents expand, leaves select" rule silently makes such a
node unchartable, and a trader who clicks it to preview one curve point instead
gets two dozen rows shoved onto the screen. The taxonomy is the product's, not
the widget's — the interaction model has to follow the data, not the other way
round.
*Source:* `tree-node.component.ts` (`hasOwnSeries` / `activateParent`) and the DX
mirror in `dx-tree/dx-tree-list.component.ts`.

---

## 6 · Tidiness & states (the difference between "prototype" and "product")

**28. Empty, loading, and error states are first-class, not afterthoughts.**
Design them: a welcome empty state with one instruction, a real skeleton for real
waits, distinct restricted/missing states. No blank regions, no redundant "nothing
selected" chrome.
*Why:* a trader judges reliability in the first thirty seconds, and half of those
seconds are non-happy-path.
*Source:* `empty-state.component.ts`; per-series restricted/missing legend states.

**29. One disabled look, one focus ring, themed tooltips only.**
Disabled = a single opacity + `not-allowed` treatment (never double-faded inside a
dimmed container). Focus = one accent ring. Tooltips = the app's themed bubble,
never the native `title`.
*Why:* inconsistent disabled/focus/tooltip treatments are the tell of an
unfinished app; consistency is cheap credibility.
*Source:* `_utilities.scss`, `_reset.scss`, `src/app/core/tooltip.directive.ts`.

**30. Live values must never reflow chrome.**
Any row containing ticking numbers is `nowrap`, truncates under pressure, and
reserves `ch`-width slots per numeric field.
*Why:* a button that jumps a row because a price gained a digit is a defect, full
stop — motion where none is intended reads as instability.
*Source:* stats strip in `chart-panel.component.ts`.

---

## 7 · Scale & resilience — many series, imperfect data

A comparison screen can hold 20–30 series, each possibly multi-field, fed by a
real backend that returns holes. These rules keep it legible and unbreakable.

**31. Identity at scale = solid line + right-edge colored name/value label.**
Past roughly the palette core (~8–12 series) hue alone can no longer guarantee two
lines are told apart. The authoritative identifier is a **colored pill at the
right edge carrying the series symbol and its value**, de-overlapped and sorted.
Lines stay **solid**; dash/dot styles are reserved for semantic meaning
(forecast, vintage), never identity.
*Why:* on capital.com's 30-series compare view you read the right-edge labels, not
the tangle of lines; that is what makes high-N legible at all.
*Source:* `chart-view.component.ts` `updateOverlays()` (`ValueTag.label`, `.lastval`);
`SeriesColorService` (24-slot palette); standard: **capital.com multi-series**.

**32. For many series, offer a normalized %-change axis.**
Overlaying a dozen instruments on their absolute scales is unreadable; a shared
**% change from the window start** axis puts them on one comparable scale.
*Why:* absolute EUR/MWh vs USD/bbl vs index points share no axis — the only honest
common denominator across mixed units is relative change. (Bloomberg/capital.com
default many-series compare to %.)
*Source:* design spec in `DESIGN_GUIDE.md` (many-series compare); planned axis mode.

**33. Readouts reflect the hovered timestamp — never carry forward.**
When the crosshair is on a date where a series has no point, its legend/tooltip
readout is "—", not the last known value. Idle (no crosshair) may show the latest.
*Why:* a value shown against a date the series doesn't cover is a phantom reading —
in multi-series mode, series have different coverage and this happens constantly.
*Source:* `chart-view.component.ts` `legendRows` (hovering guard); `cardRows` filter.

**34. Sanitize at the chart boundary — never throw on bad data.**
One choke point cleans every point before it reaches the chart engine: drop
null/undefined/NaN, validate the date, sort ascending, dedupe timestamps. A broken
point silently disappears; it never blanks the pane or throws.
*Why:* a real feed returns holes, out-of-order points, and duplicates; the chart
library throws on all three. Defensive hygiene is cheaper than a crashed panel.
*Source:* `src/app/data/sanitize.ts` (`sanitizePoints`, memoized for ref-stability).

**35. Wheel zoom anchors on the data point under the cursor.**
Wheel/pinch zoom keeps the time under the cursor fixed and expands/contracts the
range around it (TradingView ⌘/ctrl+wheel feel). Button zoom may work around
centre, but the pointer gesture must anchor.
*Why:* a trader zooms *into a level*; a zoom that drifts the point they're reading
off-screen forces a re-pan every time.
*Source:* `chart-view.component.ts` `buildChart` (`handleScale.mouseWheel`).

**36. A collapsed container must surface the selections hidden inside it.**
When a tree parent is collapsed over selected descendants, badge the parent with
the count of active selections underneath.
*Why:* otherwise a selection simply vanishes from view and the operator loses track
of what is charted — state that is invisible is state that is wrong.
*Source:* `tree-node.component.ts` (`selectedInside`, `.sel-badge`).

**37. Multi-field "observations" (OHLC etc.) don't multiply into the compare view.**
A series with several fields per timestamp (O/H/L/C, bid/ask) shows **one field**
(default close) when compared against other series — never N series × M fields as
N·M lines. Per-field toggle **chips** appear only when a single/few series are
focused; color stays per-series, the field is distinguished *within* that series'
focused view. Right-edge label names the tracked field.
*Why:* 12 series × 4 fields = 48 lines is an unreadable mat; the OHLC detail a
trader wants is per-focused-series, not smeared across the whole comparison.
*Source:* design spec in `DESIGN_GUIDE.md` (observations); `CHART_STYLE_GUIDE.md`.

---

## 8 · Anti-patterns — what we tried and why it failed

The most credible part of any playbook is the scar tissue. Each of these was
actually shipped in a review round, rejected on inspection, and reversed. Don't
repeat them.

| Tried | Failed because | Lesson |
|---|---|---|
| **Translucent legend panel** (55% + blur over the chart) | reads as a smudge over the price action beneath it | an overlay on data is either opaque or absent — never semi-transparent |
| **Ghost legend text** (no container, text-shadow over lines) | unreadable wherever a series line runs behind it, in both themes | text over a busy canvas needs an opaque backing, not a shadow |
| **Blue-saturated dark theme** (navy surfaces) | competed with the blue accent and blue series; tiring | dark surfaces are near-neutral; save saturation for data and signal |
| **Fake 380ms skeleton on every selection** | felt like latency where there was none | never simulate a wait; §24 |
| **Everything crammed into the chart header** | wrapped to two/three misaligned bands at real widths | one row, dropdowns for secondary controls; §2 |
| **Permanent left+right panels** for tree/details | ~22% of chart width rented for transient tasks | dock the tree, keep the inspector on-demand; §1 |
| **Modal overlay drawers + blur scrim over the chart** | operator cannot read the chart while selecting; blur reads as a smudge; failed desk review | primary surface stays visible — chrome docks in-flow or is non-modal, never a modal veil; §1 |
| **Line-style (dash/dot) to tell series apart** at high N | dashes already mean forecast/vintage — reusing them for identity destroys that meaning | keep lines solid; identify by right-edge colored name/value label; §31 |
| **Stale carry-forward value in the legend on hover** | showed a value on a date where the series had no point — a phantom reading | at the crosshair, absent point → "—", never the last known value; §33 |
| **`SYM +N` legend header** | duplicated identity (row 1) and mode (toolbar) already on screen | don't repeat a value the eye can already see |
| **Hardcoded per-series colors in the catalog** | didn't scale past a demo catalog; not theme-aware | assign colors at runtime; §7–8 |
| **`display: none` on the vendor widget's icon container** (DevExtreme TreeList) | that container holds the indent spacers, not just the glyph — the whole hierarchy flattened to one level | never hide a vendor node to kill what it *draws*; neutralise the paint (`content: none`, `width: 0`) and leave the box that carries the geometry |
| **Short override selectors** (`.dxtree .dx-treelist-empty-space`) against a vendor theme | the vendor rule was `.dx-treelist-rowsview .dx-row > td.dx-treelist-cell-expandable .dx-treelist-empty-space` — four classes; the override silently lost and looked like it had no effect | mirror the vendor's own selector and prefix your scope class, so you win by one class instead of reaching for `!important` |
| **`hasChildren` alone deciding row behaviour** in a tree | nodes that are both a series and a group (Curve Builder › Brent › M+1) became unchartable — clicking to preview them expanded 24 contracts instead | branch on *what the node carries*, not on whether it has children; body charts, chevron expands |
| **Overriding the vendor's light theme with dark colors** instead of loading its dark theme | the grid painted a `#2a2a2a` slab behind the tree in dark mode, and every un-enumerated vendor surface stayed light | swap the vendor's theme stylesheet from your theme signal; override only the surfaces your app deliberately owns |
| **Trusting full-page screenshots while iterating on CSS** | the capture returned cached frames, so computed styles and "what I saw" disagreed three times and sent two fixes down the wrong path | verify with `getComputedStyle` / `getBoundingClientRect` on the painted element (`elementFromPoint`), and treat a screenshot that contradicts a measurement as a stale screenshot |
| **Routing the whole tree through the lazy `CustomStore`** | every group expansion became an async load with a load panel, for a taxonomy that was in memory the whole time | mark only the genuinely remote level lazy; answer the rest synchronously |
| **Returning `Promise.resolve(cached)` from a cached branch read** | the grid raised its pending state and flashed a load panel even though the promise settled on the same tick | return an array for cached reads — with grid libraries the return type, not the timing, is what triggers the spinner |
| **Hanging the deep contract lists directly off the curve root** | flattened `Curve Builder › Brent › M+1 › Contracts` into `Curve Builder › contracts`, losing the level a trader navigates by | volume fixtures must keep the production shape; a fixture that changes the hierarchy tests a tree nobody will ship |
| **Seeding long demo branches by reusing a pool of existing series ids** | one click lit up five rows, because every node bound to that series showed selected — the fixture lied about how selection behaves at scale | generate real records for volume fixtures; reused ids make identity bugs that only appear in the fixture, and hide the ones that do not |
| **Assuming the cell template's parent is the widget's cell** | `devextreme-angular` silently wraps every `*dxTemplate` in its own unstyled `.dx-template-wrapper` div; the cell stretched to 299px while the row inside it stayed at 106px, so the unit and count never reached the right edge | when a framework binding layer sits between you and the widget, it has its own DOM — measure the real child chain in the browser before writing the third override |
| **Styling `.dx-cell-content` in a TreeList** | that class is dxDataGrid's; TreeList wraps cell templates in `.dx-treelist-text-content` | verify the wrapper class against the vendor's renderer source, not against a sibling widget |

---

## 9 · Process & meta

**Self-maintaining design system.** The docs are the source of truth, exported to
downstream teams, and kept in sync by contract — every UI change updates the guide
and re-syncs the exported copy (`diff -q` to verify). A design kit that lies is
worse than none.
*Source:* `CLAUDE.md` sync contract; `src/app/core/export.service.ts`.

**Iterate against a named external standard and verify with pixels.** Pick the bar
explicitly (Bloomberg / TradingView / capital.com) and screenshot-check each
round against it — code-level reasoning misses what the eye catches.

---

## Source-of-truth map

| For… | Read |
|---|---|
| Tokens, typography, components, layout doctrine | `DESIGN_GUIDE.md` |
| Chart internals (options, series presets, reconciliation, overlays, modes) | `CHART_STYLE_GUIDE.md` |
| Workspace state from localStorage to a Spring/Redis/SQL/Elastic backend | `WORKSPACE_PERSISTENCE.md` |
| Standing invariants for anyone (human or agent) changing the code | `CLAUDE.md` |
| Consuming the design system in another app | `AGENTS.md` + `scss/`, `tokens/` |

**External standards referenced:** WCAG 2.1 (contrast), CSS Color 4 / OKLCh
(perceptual palette), TradingView Lightweight Charts (chart engine),
Bloomberg/TradingView/capital.com (interaction conventions).

---

## 10 · Restyling a third-party widget to an in-house row spec

A vendor grid/tree (DevExtreme TreeList here, but the rules hold for AG Grid,
Kendo, PrimeNG) can be made pixel-identical to a hand-rolled component, but only
if you treat its DOM as a contract you read rather than one you fight.

**Rule: measure the rendered box chain in the browser, don't infer it.** Two
rounds of correct-looking CSS failed here because the DOM had an element in it
that neither the vendor's docs nor its renderer source mentioned — the Angular
binding layer's own wrapper div. Reading source tells you what the vendor draws;
only the live page tells you what your framework added on top.
*Source:* the `.dx-template-wrapper` fix, found by dumping `getComputedStyle` and
`getBoundingClientRect` down the cell's child chain.

**Rule: read the vendor's renderer before writing a single override.** Find which
element holds the geometry, which holds the paint, and what class wraps your own
template. Guessing produces dead CSS that looks like a specificity problem.
*Why:* in DevExtreme TreeList, indentation is `level + 1` spacer divs inside
`.dx-treelist-icon-container`; the expand glyph is an absolutely-positioned
`::before` on the trailing spacer; and cell templates are wrapped in
`.dx-treelist-text-content` (not `.dx-cell-content`). None of that is guessable.
*Source:* `node_modules/devextreme/esm/__internal/grids/tree_list/rows/m_rows.js`.

**Rule: retune the vendor's geometry, don't replace it.** Keep the spacer
elements and set their `width` to your design's indent step; collapse only the
slot whose glyph you are replacing. Re-implementing indentation with your own
padding fights the widget's virtualisation and best-fit measurement.
*Why:* DX ships an 18px spacer plus a 4px trailing margin; the ts-chart row spec
is 14px per level with no trailing gap. Setting spacer `width: 14px` and
`--last { width: 0 }` reproduces `padding-left: calc(space-3 + depth * 14px)`
exactly, with DX still owning row recycling.
*Source:* `src/app/layout/right-panel/dx-tree/dx-tree-list.component.scss`.

**Rule: match the vendor's selector specificity, scoped by one wrapper class.**
Copy their selector, prefix your scope class. `!important` hides which rule is
actually load-bearing and makes the next override worse.
*Source:* same file — every indent rule is
`.dxtree .dx-treelist-rowsview .dx-row > td.dx-treelist-cell-expandable …`.

**Rule: if you drive state from your own store, the vendor's state classes are
dead — style your own.** Selection here lives in `SelectionService`, so DX never
applies `.dx-selection`; the cell template flags itself and the row reacts with
`td:has(.cell-row.is-selected)`, which keeps the highlight reactive to signals
without a `repaintRows` call.
*Why:* rules written against vendor state classes that the configuration never
produces are the most expensive kind of dead CSS — they read as working code.
*Source:* `dx-tree-list.component.scss` selection block.

**Rule: a vendor widget's dark mode is a different stylesheet, not different
tokens.** Component libraries compile one stylesheet per theme. Dark mode means
swapping the file through the vendor's own theme API and driving that swap from
your app's theme signal — not overriding a light stylesheet with dark colors.
*Why:* an override list only covers the surfaces you happened to notice. Every
one you missed stays light, and they appear later on whichever widget you add
next — the bug arrives long after the change that caused it. Swapping the file
also keeps the inactive theme out of the critical path (788 kB → 11 kB of
app CSS here).
*Source:* `dx-tree/dx-theme.ts` plus the `rel="dx-theme"` links in `index.html`.

**Rule: the vendor's empty/no-data state gets themed, never hidden.** Hiding it
converts an explainable empty state into a silent blank panel — rule §28 applies
to embedded widgets too.

---

*This playbook is a living document. Per the `CLAUDE.md` sync contract, any future
change that establishes a transferable trader-facing UX/engineering learning must
add or update the corresponding entry here (and record rejected approaches in the
failure log), then re-sync to the exported kit.*
