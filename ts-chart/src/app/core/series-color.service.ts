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
