import { computed, inject, Injectable, signal } from '@angular/core';
import { Theme, ThemeService } from './theme.service';

/** Dual-theme palette entry. 6-digit hex only (chart hexA() requires it). */
interface PaletteEntry {
  dark: string;
  light: string;
}

/**
 * Ordered slot palette, OKLCh-normalized: every entry sits at the same
 * perceptual lightness/chroma (dark L≈0.76, light L≈0.55, C≈0.125), hue
 * rotated for max separation — no series shouts, none recedes, none is
 * confusable with chrome grays. Slot 0 is blue (accent kinship).
 *
 * Slots 0–11 are the maximally-separated core (typical desk use). Slots 12–23
 * fill the hue wheel at finer intervals for high-N comparison (up to ~24
 * distinct series). Past the core, hue alone no longer guarantees telling two
 * lines apart — the authoritative identifier is the right-edge colored
 * name/value label (see chart-view value tags). Lines stay SOLID always; dash
 * styles are reserved for semantic meaning (forecast/vintage), never identity.
 */
export const SERIES_PALETTE: PaletteEntry[] = [
  { dark: '#67b9fb', light: '#1f77b5' }, // blue
  { dark: '#dfa54d', light: '#9b6500' }, // amber
  { dark: '#73c786', light: '#2e8548' }, // green
  { dark: '#bd9ef5', light: '#7d5eaf' }, // purple
  { dark: '#f69088', light: '#af504b' }, // red
  { dark: '#26cac3', light: '#008782' }, // teal
  { dark: '#de93d7', light: '#995494' }, // pink
  { dark: '#ee9b5f', light: '#a85a19' }, // orange
  { dark: '#27c6dd', light: '#008499' }, // cyan
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

const FALLBACK: Record<Theme, string> = { dark: '#67b9fb', light: '#1f77b5' };

/**
 * Assigns chart colors to series *on selection* from a fixed slot palette:
 * survivors keep their slot, newcomers take the lowest free one, slots are
 * released on deselect. Colors resolve per active theme, so a theme toggle
 * recolors every consumer reactively. Catalog metadata carries no color —
 * this is the single source of truth (scales past a hardcoded catalog).
 */
@Injectable({ providedIn: 'root' })
export class SeriesColorService {
  private readonly theme = inject(ThemeService);

  /** id -> palette slot. Stable while selected. */
  private readonly slots = signal<ReadonlyMap<string, number>>(new Map());

  /**
   * Reconcile slot assignments with the ordered selection. Called
   * synchronously by SelectionService whenever the selection mutates
   * (not via effect — that would flush late and flicker fallback colors).
   */
  sync(selectedIds: readonly string[]): void {
    this.slots.update((prev) => {
      const next = new Map<string, number>();
      const used = new Set<number>();
      for (const id of selectedIds) {
        const s = prev.get(id);
        if (s !== undefined && !used.has(s)) {
          next.set(id, s);
          used.add(s);
        }
      }
      for (const id of selectedIds) {
        if (next.has(id)) continue;
        let s = 0;
        while (used.has(s)) s++;
        next.set(id, s);
        used.add(s);
      }
      return next;
    });
  }

  /** id -> concrete hex for the active theme. */
  readonly colorMap = computed<ReadonlyMap<string, string>>(() => {
    const t = this.theme.theme();
    const m = new Map<string, string>();
    for (const [id, slot] of this.slots()) {
      m.set(id, SERIES_PALETTE[slot % SERIES_PALETTE.length][t]);
    }
    return m;
  });

  /** Reactive lookup for templates/computeds (tracks colorMap + theme). */
  color(id: string): string {
    return this.colorMap().get(id) ?? FALLBACK[this.theme.theme()];
  }
}
