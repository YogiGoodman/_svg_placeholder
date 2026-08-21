import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Theme, ThemeService } from './theme.service';
import {
  GlyphId,
  PaletteId,
  PaletteVariant,
  RETIRED_PALETTES,
  SERIES_PALETTES,
  readableOn,
} from './series-palettes';

export type { PaletteEntry, PaletteId, GlyphId } from './series-palettes';
export { SERIES_PALETTES, PALETTE_LIST } from './series-palettes';

const PALETTE_KEY = 'tschart.palette';
const MARKERS_KEY = 'tschart.markers';

/** How on-canvas markers are decided. `auto` follows the palette's own default. */
export type MarkerMode = 'auto' | 'always' | 'never';

const FALLBACK: Record<Theme, string> = { dark: '#67b9fb', light: '#1f77b5' };

/**
 * Assigns chart identity to series *on selection* from a fixed slot palette:
 * survivors keep their slot, newcomers take the lowest free one, slots are
 * released on deselect. Catalog metadata carries no color — this is the single
 * source of truth.
 *
 * A slot resolves to a color AND a glyph:
 *
 *     slot -> { color: entries[slot % entries.length],
 *               glyph: glyphs[floor(slot / entries.length)] }
 *
 * That second channel is not decoration. A red–green-safe palette tops out
 * around 8 reliably distinguishable colors (Okabe–Ito is 8), while the app
 * allows up to 12 series — so without shape, slots 9–12 would silently repeat a
 * color and two lines would become indistinguishable with no indication. With
 * it, an 8-color palette still yields 24 unambiguous slots, matching the
 * default palette exactly.
 */
@Injectable({ providedIn: 'root' })
export class SeriesColorService {
  private readonly theme = inject(ThemeService);

  /** id -> palette slot. Stable while selected. */
  private readonly slots = signal<ReadonlyMap<string, number>>(new Map());

  /** Active palette variant. An accessibility preference, persisted on its own
   *  key — it is a fact about the person, not about this screen, so it must
   *  survive "Reset layout" and apply before any workspace restore paints. */
  readonly palette = signal<PaletteId>(this.readPalette());
  readonly markerMode = signal<MarkerMode>(this.readMarkers());

  readonly variant = computed<PaletteVariant>(() => SERIES_PALETTES[this.palette()]);

  /**
   * Whether the shape channel is on. ONE preference for both surfaces: with
   * shapes off the chrome falls back to a dot everywhere, so the legend, tags,
   * tree and search rows can never disagree with the lines about identity.
   */
  readonly markersOn = computed(() => {
    const m = this.markerMode();
    return m === 'always' ? true : m === 'never' ? false : this.variant().markersDefault;
  });

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(PALETTE_KEY, this.palette());
      } catch {
        /* ignore */
      }
    });
    effect(() => {
      try {
        localStorage.setItem(MARKERS_KEY, this.markerMode());
      } catch {
        /* ignore */
      }
    });
  }

  setPalette(id: PaletteId): void {
    this.palette.set(id);
  }
  setMarkerMode(m: MarkerMode): void {
    this.markerMode.set(m);
  }

  /**
   * Reconcile slot assignments with the ordered selection. Called synchronously
   * by SelectionService whenever the selection mutates (not via effect — that
   * would flush late and flicker fallback colors).
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

  /**
   * Slot map for a history snapshot. Slots are path-dependent — `sync()` frees a
   * removed series' slot for the next arrival — so undoing a removal without
   * restoring these hands the series back in someone else's colour.
   */
  slotSnapshot(): readonly (readonly [string, number])[] {
    return [...this.slots()];
  }

  restoreSlots(entries: readonly (readonly [string, number])[]): void {
    this.slots.set(new Map(entries));
  }

  /** id -> concrete hex for the active theme and palette. */
  readonly colorMap = computed<ReadonlyMap<string, string>>(() => {
    const t = this.theme.theme();
    const entries = this.variant().entries;
    const m = new Map<string, string>();
    for (const [id, slot] of this.slots()) {
      m.set(id, entries[slot % entries.length][t]);
    }
    return m;
  });

  /** id -> glyph for the active palette. Mirrors `colorMap` exactly. */
  readonly glyphMap = computed<ReadonlyMap<string, GlyphId>>(() => {
    const { entries, glyphs } = this.variant();
    const on = this.markersOn();
    const m = new Map<string, GlyphId>();
    for (const [id, slot] of this.slots()) {
      m.set(
        id,
        on && glyphs.length
          ? glyphs[Math.floor(slot / entries.length) % glyphs.length]
          : 'circle',
      );
    }
    return m;
  });

  /** Stroke weight for this palette — heavier where luminance carries identity. */
  lineWidth(): number {
    return this.variant().lineWidth ?? 2;
  }

  /** Reactive lookup for templates/computeds (tracks colorMap + theme). */
  color(id: string): string {
    return this.colorMap().get(id) ?? FALLBACK[this.theme.theme()];
  }

  glyph(id: string): GlyphId {
    return this.glyphMap().get(id) ?? 'circle';
  }

  /** Readable text color for a chip filled with this series' color. */
  onColor(id: string): string {
    return readableOn(this.color(id));
  }

  private readPalette(): PaletteId {
    try {
      const raw = localStorage.getItem(PALETTE_KEY);
      if (raw && raw in SERIES_PALETTES) return raw as PaletteId;
      // A palette we have since retired is still a stated preference — carry it
      // to its successor instead of treating the person as undecided.
      if (raw && raw in RETIRED_PALETTES) return RETIRED_PALETTES[raw];
      // Never chosen: honour the OS request for more contrast rather than
      // making someone who already asked the system ask us again.
      if (matchMedia('(prefers-contrast: more)').matches) return 'mono';
    } catch {
      /* ignore */
    }
    return 'default';
  }

  private readMarkers(): MarkerMode {
    try {
      const raw = localStorage.getItem(MARKERS_KEY) as MarkerMode | null;
      if (raw === 'auto' || raw === 'always' || raw === 'never') return raw;
    } catch {
      /* ignore */
    }
    return 'auto';
  }
}
