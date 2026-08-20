import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GlyphId } from './series-palettes';

/**
 * The series identity mark. Replaces the plain color dot everywhere a series is
 * named — legend row, tree row, inspector card, search result, right-edge value
 * tag — so identity survives when color alone cannot carry it.
 *
 * On the default palette `glyph` is `circle` and this renders exactly the dot it
 * replaced: adopting the shape channel costs nothing visually until a palette
 * that needs it is chosen.
 *
 * Paths are drawn in a 10×10 box and scaled by `size`, so every shape reads at
 * the same visual weight as the 8px dot it stands in for.
 */
@Component({
  selector: 'ts-glyph',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 10 10"
      [attr.fill]="filled() ? color() : 'none'"
      [attr.stroke]="color()"
      [attr.stroke-width]="filled() ? 0 : 2"
      stroke-linecap="round"
      aria-hidden="true"
      focusable="false"
    >
      @switch (glyph()) {
        @case ('square') {
          <rect x="1" y="1" width="8" height="8" rx="1" />
        }
        @case ('triangle') {
          <path d="M5 0.8 L9.4 8.6 L0.6 8.6 Z" />
        }
        @case ('diamond') {
          <path d="M5 0.6 L9.4 5 L5 9.4 L0.6 5 Z" />
        }
        @case ('cross') {
          <path d="M1.6 1.6 L8.4 8.4 M8.4 1.6 L1.6 8.4" stroke-width="2.2" [attr.fill]="'none'" />
        }
        @case ('plus') {
          <path d="M5 1 L5 9 M1 5 L9 5" stroke-width="2.2" [attr.fill]="'none'" />
        }
        @default {
          <circle cx="5" cy="5" r="4" />
        }
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
      }
      svg {
        display: block;
      }
    `,
  ],
})
export class SeriesGlyphComponent {
  readonly glyph = input<GlyphId>('circle');
  readonly color = input<string>('currentColor');
  readonly size = input<number>(8);
  /** Open shapes (cross/plus) are stroke-only regardless of this. */
  readonly filled = computed(() => this.glyph() !== 'cross' && this.glyph() !== 'plus');
}
