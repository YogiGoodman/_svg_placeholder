// =============================================================================
// Series palettes — color AND shape, because color alone does not scale.
// =============================================================================

/** Dual-theme palette entry. 6-digit hex only (chart hexA() requires it). */
export interface PaletteEntry {
  dark: string;
  light: string;
}

/** Non-color identity channel. Drawn in chrome always; on canvas conditionally. */
export type GlyphId = 'circle' | 'square' | 'triangle' | 'diamond' | 'cross' | 'plus';

export type PaletteId = 'default' | 'cvd-rg' | 'cvd-by' | 'high-contrast' | 'mono';

export interface PaletteVariant {
  id: PaletteId;
  label: string;
  /** One plain-language line for the preferences menu. */
  hint: string;
  /** The color cycle. `slot % entries.length` picks one. */
  entries: readonly PaletteEntry[];
  /** Shape cycle. `slot / entries.length` picks one. Empty = channel off. */
  glyphs: readonly GlyphId[];
  /** Whether on-canvas markers are on when the user leaves markers on `auto`. */
  markersDefault: boolean;
  /** Optional heavier stroke (high-contrast). */
  lineWidth?: number;
}

/**
 * The default palette: OKLCh-normalized, every entry at the same perceptual
 * lightness and chroma (dark L≈0.76, light L≈0.55, C≈0.125) with hue rotated
 * for maximum separation. Slots 0–11 are the maximally-separated core; 12–23
 * fill the wheel at finer intervals for high-N comparison.
 */
const DEFAULT_ENTRIES: readonly PaletteEntry[] = [
  { dark: '#67b9fb', light: '#1f77b5' }, // blue
  { dark: '#dfa54d', light: '#9b6500' }, // amber
  { dark: '#73c786', light: '#2e8548' }, // green
  { dark: '#bd9ef5', light: '#7d5eaf' }, // purple
  { dark: '#f69088', light: '#af504b' }, // red
  { dark: '#26cac3', light: '#00817c' }, // teal
  { dark: '#de93d7', light: '#995494' }, // pink
  { dark: '#ee9b5f', light: '#a85a19' }, // orange
  { dark: '#27c6dd', light: '#007e92' }, // cyan
  { dark: '#a7bd5d', light: '#697b10' }, // lime
  { dark: '#cab049', light: '#896f00' }, // gold
  { dark: '#9aaaff', light: '#5d69ba' }, // violet
  { dark: '#4fc3e8', light: '#0d7ea3' }, // sky
  { dark: '#e2b15a', light: '#8a6410' }, // honey
  { dark: '#8fd07a', light: '#4f8a2e' }, // fern
  { dark: '#d29bec', light: '#8452a6' }, // orchid
  { dark: '#f2857e', light: '#b24a45' }, // salmon
  { dark: '#5bcfb0', light: '#0c8a70' }, // mint
  { dark: '#eb90bd', light: '#a8507e' }, // rose
  { dark: '#e6a955', light: '#9c6412' }, // caramel
  { dark: '#6fb6e0', light: '#2f6f9a' }, // steel
  { dark: '#c0c063', light: '#7a7a18' }, // olive
  { dark: '#b7a3ee', light: '#6a58b0' }, // periwinkle
  { dark: '#e58fa0', light: '#a85062' }, // dusk-rose
];

/**
 * Red–green safe, derived from the Okabe–Ito Color Universal Design set — the
 * reference categorical palette for protanopia, deuteranopia AND tritanopia.
 *
 * NOTE, and this is the important part: these entries are deliberately NOT
 * lightness-normalized the way the default palette is. Deutan/protan CVD
 * collapses the red–green opponent axis, leaving blue↔yellow plus LUMINANCE.
 * Flattening lightness — correct for the default palette, where hue alone
 * carries identity — would delete the channel that is doing the work here.
 * Every entry still clears 3:1 against the chart well (WCAG 1.4.11: a 2px line
 * is a graphical object, so 3:1, not 4.5:1).
 */
const CVD_RG_ENTRIES: readonly PaletteEntry[] = [
  { dark: '#56b4e9', light: '#1d79b0' }, // sky blue
  { dark: '#e69f00', light: '#8a6000' }, // orange
  { dark: '#00c08b', light: '#00695a' }, // bluish green
  { dark: '#f0e442', light: '#6f6100' }, // yellow
  { dark: '#8ab6f0', light: '#00539c' }, // blue
  { dark: '#f0703c', light: '#a83c00' }, // vermillion
  { dark: '#cc79a7', light: '#8c3f6b' }, // reddish purple
  { dark: '#9aa7b4', light: '#4c5866' }, // slate
];

/**
 * Blue–yellow safe (tritanopia). The impaired axis is blue↔yellow, so this
 * leans on red, green, purple and orange — which deutan/protan users cannot
 * use, and tritan users can. Offered separately for exactly that reason.
 */
const CVD_BY_ENTRIES: readonly PaletteEntry[] = [
  { dark: '#f0736a', light: '#a8342c' }, // red
  { dark: '#74c77a', light: '#2c7a36' }, // green
  { dark: '#c49bf0', light: '#6b4ca8' }, // purple
  { dark: '#f0a34a', light: '#8f5300' }, // orange
  { dark: '#e0607f', light: '#9c2f4e' }, // pink
  { dark: '#a8d16f', light: '#4f7a18' }, // lime
  { dark: '#d97bd9', light: '#8a3a8a' }, // magenta
  { dark: '#b0b8c0', light: '#525d69' }, // slate
];

/**
 * High contrast: maximum luminance separation, low chroma, heavier stroke.
 * Serves low vision, glare and projectors as much as CVD. Six slots only —
 * past that, luminance steps stop being reliably distinguishable and the
 * glyph channel takes over.
 */
const HIGH_CONTRAST_ENTRIES: readonly PaletteEntry[] = [
  { dark: '#ffffff', light: '#000000' },
  { dark: '#9ed2ff', light: '#0b3d6b' },
  { dark: '#ffd166', light: '#6b4a00' },
  { dark: '#7fe3b0', light: '#00563a' },
  { dark: '#ff9aa8', light: '#8a0f1e' },
  { dark: '#c9b8ff', light: '#3b2478' },
];

/**
 * Shape-first: one hue at four lightness steps. For achromatopsia, monochrome
 * displays and black-and-white print — and the honest fallback for anything the
 * other variants miss. Identity is carried almost entirely by the glyph.
 */
const MONO_ENTRIES: readonly PaletteEntry[] = [
  { dark: '#f3f6f9', light: '#12151a' },
  { dark: '#b8c4d0', light: '#3a444f' },
  { dark: '#8494a4', light: '#59646f' },
  // Measured: the palest step still clears the 3:1 line floor on the light
  // well (3.42:1). An earlier #98a3ad looked right and measured 2.27:1 — the
  // whole point of a shape-first palette is that it stays legible, so the
  // lightness ladder is bounded by contrast, not by taste.
  { dark: '#5f6d7c', light: '#78838d' },
];

export const SERIES_PALETTES: Record<PaletteId, PaletteVariant> = {
  default: {
    id: 'default',
    label: 'Default',
    hint: '24 hues, tuned so no series shouts and none recedes.',
    entries: DEFAULT_ENTRIES,
    glyphs: [],
    markersDefault: false,
  },
  'cvd-rg': {
    id: 'cvd-rg',
    label: 'Red–green safe',
    hint: 'For the most common color-vision deficiency. 8 colors × 3 shapes.',
    entries: CVD_RG_ENTRIES,
    glyphs: ['circle', 'square', 'triangle'],
    markersDefault: true,
  },
  'cvd-by': {
    id: 'cvd-by',
    label: 'Blue–yellow safe',
    hint: 'For blue–yellow color-vision deficiency. 8 colors × 3 shapes.',
    entries: CVD_BY_ENTRIES,
    glyphs: ['circle', 'square', 'triangle'],
    markersDefault: true,
  },
  'high-contrast': {
    id: 'high-contrast',
    label: 'High contrast',
    hint: 'Maximum separation and a heavier line. Good in glare or on a projector.',
    entries: HIGH_CONTRAST_ENTRIES,
    glyphs: ['circle', 'square', 'triangle', 'diamond'],
    markersDefault: false,
    lineWidth: 3,
  },
  mono: {
    id: 'mono',
    label: 'Shape-first',
    hint: 'One hue, four tones. Shape carries identity — survives a grayscale print.',
    entries: MONO_ENTRIES,
    glyphs: ['circle', 'square', 'triangle', 'diamond', 'cross', 'plus'],
    markersDefault: true,
  },
};

export const PALETTE_LIST: readonly PaletteVariant[] = [
  SERIES_PALETTES.default,
  SERIES_PALETTES['cvd-rg'],
  SERIES_PALETTES['cvd-by'],
  SERIES_PALETTES['high-contrast'],
  SERIES_PALETTES.mono,
];

/** sRGB relative luminance (WCAG 2.1 definition). */
function luminance(hex: string): number {
  const v = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Contrast ratio between two hex colors (WCAG 2.1). Used by the a11y checks. */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
}

const INK_DARK = '#0a0c0f';
const INK_LIGHT = '#ffffff';

/**
 * Readable foreground for a chip whose BACKGROUND is this series color (the
 * right-edge value tag). Computed rather than hand-tabulated: a parallel table
 * of `onDark`/`onLight` hexes is one more thing to get quietly wrong.
 *
 * Picks whichever ink actually contrasts more, rather than testing luminance
 * against a threshold. A threshold looks equivalent and is not: mid-tones sit
 * right on it, so a color at luminance 0.445 took white at 2.1:1 when black
 * would have given 8.7:1. Measure, don't guess which side of the line you are on.
 */
export function readableOn(hex: string): string {
  return contrastRatio(INK_DARK, hex) >= contrastRatio(INK_LIGHT, hex) ? INK_DARK : INK_LIGHT;
}

