# TS Chart — Accessibility Guide

Scope: what this app does for colour-vision deficiency (CVD), low vision and
keyboard users, why each decision was made, and how to verify it.

---

## 1. The constraint, stated honestly

Deuteranopia and protanopia — roughly **8% of men** — collapse the red–green
opponent axis. What survives is blue↔yellow plus **luminance**. Tritanopia
(~0.01%) loses blue–yellow instead, so red–green survives. Achromatopsia loses
hue entirely.

The consequence is arithmetic, not opinion:

> **A red–green-safe categorical palette cannot have 24 hues.**

Okabe–Ito — the reference CVD-safe set from the Color Universal Design project,
chosen to stay separable under protanopia, deuteranopia *and* tritanopia — is
**eight** colours. This app allows up to twelve series on one chart. Eight is the
ceiling; six is comfortable.

That gap is the whole reason the shape channel exists.

---

## 2. Identity binds to a slot, and a slot is colour × shape

`SeriesColorService` assigns each selected series a **slot**. A slot resolves to
both a colour and a glyph:

```
slot -> { colour: entries[slot % entries.length],
          glyph:  glyphs[floor(slot / entries.length)] }
```

With an 8-colour cycle and 3 glyphs that is **24 unambiguous slots** — the same
count the default palette offers. The app's default cap is 8 and its maximum is
12, so an ordinary session never leaves the first cycle and never repeats a
colour at all.

Because everything downstream reads the same slot, the four identity surfaces
cannot drift apart:

| Surface | Source |
|---|---|
| Tree row dot | `tree-node.component.ts` |
| Legend row dot | `chart-view.component.ts` |
| Inspector card dot | `info-panel.component.ts` |
| Search result dot | `search-results.component.ts` |
| Right-edge value tag | `chart-view.component.ts` (`.lastval`) |
| Marks on the line itself | `updateMarkers()` |

**On the default palette the glyph is a circle**, so adopting the channel is
visually free until a palette that needs it is selected.

**The channel is one preference, not two.** "Series shapes" (Auto / On / Off,
`tschart.markers`) governs the canvas marks *and* the glyph in every chrome
surface, through the single choke point `SeriesColorService.glyph()`. Before,
`never` stripped shapes from the lines and left them in the legend, so the two
halves of the same identity system disagreed.

---

## 3. The three palettes

| id | Label | Colours | Glyphs | Slots | For |
|---|---|---|---|---|---|
| `default` | Default | 24 | — | 24 | Unimpaired colour vision |
| `cvd-rg` | Red–green safe | 8 (Okabe–Ito) | ●■▲ | 24 | Deutan + protan |
| `mono` | Shape-first | 4 tones of one hue, `lineWidth: 3` | ●■▲◆✕✚ | 24 | Achromatopsia, greyscale print, low vision, glare, projectors |

**One "Red–green safe", not two.** Deutan and protan simulations of a
blue/orange/yellow/purple set are near-identical, so offering both would ask the
user to self-diagnose a condition most people know only as *"some colours look
the same to me"*. See playbook §38.

**Three, not five.** `cvd-by` (tritan) and `high-contrast` were retired in round
13. Tritan is rare enough (~0.01%) that its own menu row cost more readers than
it served, and high-contrast's distinguishing promise — a heavier stroke — was
never wired: its `lineWidth: 3` was dead code while the chart hard-coded 2.
Shape-first now carries that stroke and covers the same low-vision/glare need,
because maximum luminance separation is what it already was.

**Retired ids migrate, they do not reset.** `RETIRED_PALETTES` maps
`cvd-by → cvd-rg` and `high-contrast → mono` in `readPalette()`. A stored id we
no longer ship is still a stated preference; letting it fall through to the
"never chosen" branch would silently re-decide for the one person who had
already decided.

### Lightness is deliberately NOT normalised here

Playbook rule 8 requires the default palette to be OKLCh-normalised — fixed
perceptual lightness, hue rotated — so no series shouts. **That rule is
suspended for the CVD palettes and the suspension is load-bearing.** When the
hue axis collapses, lightness is the channel carrying identity; flattening it
deletes exactly what makes the palette work. Anyone "fixing" these to a uniform
L will silently break them.

The bound is contrast, not uniformity — see §4.

---

## 4. Contrast targets

| Element | Floor | Standard |
|---|---|---|
| Numeric text under 12px | 4.5:1 vs its surface | WCAG 2.1 SC 1.4.3 |
| **Chart line** (a graphical object, not text) | **3:1 vs the chart well** | WCAG 2.1 SC 1.4.11 |
| Value-tag text on its colour fill | 4.5:1 vs that fill | SC 1.4.3 |
| Palette swatches, focus ring | 3:1 | SC 1.4.11 |

Measured, not estimated. Two failures were found this way and both looked fine:

- Shape-first's palest light step measured **2.27:1** against the well. Retuned
  to 3.42:1.
- `readableOn()` originally picked chip ink by comparing luminance to a
  threshold. Mid-tones sit right on it: a colour at L = 0.445 took white at
  **2.1:1** where black would have given 8.7:1. It now compares both candidates'
  actual contrast and takes the winner. Worst chip contrast across all five
  palettes went 2.12 → 4.44, then three light entries were nudged one step
  darker to clear 4.5:1 outright.

`contrastRatio()` and `readableOn()` live in `series-palettes.ts` — use them
rather than adding a hand-maintained table of foreground hexes.

---

## 5. Marks on the line

Drawn only when the palette needs them (`markersDefault`) or the user forces
them, and always **sparse**: six across the visible range plus one pinned at the
last bar, recomputed on visible-range change behind a single rAF guard, and
skipped entirely above 12 drawn series.

One mark per bar is the scientific-plotting convention and turns a 730-point
daily series into a mat of dots; the accessibility guidance for dense data is
explicitly *"evenly-spaced intervals or points of interest"*.

**Library constraint:** lightweight-charts v5 ships exactly four marker shapes —
`SeriesMarkerShape = 'circle' | 'square' | 'arrowUp' | 'arrowDown'`
(`typings.d.ts:4922`). That covers three glyph cycles with one in reserve. The
DOM chrome is SVG and carries the full six-glyph vocabulary.

**Lines stay solid.** The literature's first answer for redundant encoding is
dash/dot, but dash already means forecast/vintage in this app — which is
precisely why shape has to carry identity instead.

---

## 6. Preference storage

| Preference | Key | Why not the workspace |
|---|---|---|
| Palette | `tschart.palette` | An accessibility setting is a fact about the *person*, not about this screen. It must survive "Reset layout" and apply before any workspace restore paints. |
| Series shapes | `tschart.markers` | Same. |

When the user has never chosen, `prefers-contrast: more` selects `mono` —
someone who already told the OS should not have to tell us again. An explicit
choice wins from then on.

---

## 7. Beyond colour

- **Active/selected state is never colour alone.** Search result rows and tree
  rows carry a 2px inset border as well as the tint. A CVD user picking out "the
  active row" from a blue wash is the same failure this work exists to fix.
- **Keyboard.** `/` focuses the toolbar search (ignored while typing), ⌘K opens
  the palette, `⌘/` and `⌘.` toggle the docks, arrows and Home/End move the
  active option, Enter adds, ⌘Enter charts only that series, Escape closes. The
  dock resizer is a `role="separator"` with arrow-key resizing — a drag handle
  that only answers to a mouse is decoration, not a control.
- **ARIA.** Search inputs are `role="combobox"` with `aria-expanded`,
  `aria-controls` and `aria-activedescendant`; lists are `role="listbox"` with
  `role="option"` rows. On-chart state is announced with a `.ts-sr-only` span
  rather than by overloading `aria-selected`, which means "is the active
  descendant".
- **Motion.** `prefers-reduced-motion` is honoured globally in `_reset.scss` and
  by the card drag preview.

### The honest limit

A canvas chart has no accessible content, and no ARIA patch changes that. The
app's real answer is the **Data table view**, which presents the same series as
a date-aligned matrix with CSV export. Treat it as the text alternative.

*Not yet done, and named here so it is not lost:* `role="img"` plus a generated
summary on the chart host, a visible-on-focus skip link to the table,
`forced-colors` handling, and `role="list"` on the legend.

---

## 8. Verification checklist

- [ ] Each palette in **both themes** and **both densities**
- [ ] Switching palette updates tree dot, legend, inspector, value tag and line marks **together**
- [ ] 12 series on `cvd-rg`: slots 9–12 repeat a colour but stay distinguishable by shape
- [ ] Every palette entry ≥3:1 against `--ts-bg-inset`, computed in-page
- [ ] Every value-tag ink ≥4.5:1 against its own fill
- [ ] Deutan / protan / tritan simulation over a 12-series overlay
- [ ] Markers stay sparse when zoomed in and disappear above 12 series
- [ ] Tab through search: combobox → options → footer, with a visible focus ring
- [ ] One screen-reader pass over the search combobox (option count, activedescendant, "on chart")
- [ ] `prefers-contrast: more` selects Shape-first on a profile that never chose
- [ ] A stored `high-contrast` / `cvd-by` resolves to its successor, not to Default
- [ ] Series shapes = Off leaves no glyph anywhere — canvas AND legend/tag/tree/search

---

## References

- Okabe M., Ito K. — *Color Universal Design* (the 8-colour palette)
- WCAG 2.1 SC 1.4.3 (text contrast), SC 1.4.11 (non-text contrast)
- CSS Color 4 / OKLCh (perceptual palette generation)
