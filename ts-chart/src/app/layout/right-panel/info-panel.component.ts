import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { LucideAngularModule } from 'lucide-angular';
import { SelectionService } from '../../core/selection.service';
import { SeriesColorService } from '../../core/series-color.service';
import { SeriesGlyphComponent } from '../../core/series-glyph.component';
import { ChartedSeries } from '../../data/models';
import {
  computeStats,
  generateLine,
  generateOhlc,
  SeriesStats,
} from '../../data/series-generator';
import { formatPct, formatSigned, formatValue } from '../../core/format';
import { TooltipDirective } from '../../core/tooltip.directive';
import { InfoCardComponent } from './info-card.component';

interface SeriesCard {
  meta: ChartedSeries;
  stats: SeriesStats;
}

@Component({
  selector: 'app-info-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    TooltipDirective,
    InfoCardComponent,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
      SeriesGlyphComponent,
  ],
  template: `
    <section class="panel">
      <header class="phead">
        <span>Series Details</span>
        @if (sel.count() > 0) {
          <span class="ts-badge">{{ sel.count() }}</span>
        }
        <span class="phead__spacer"></span>
        <button
          class="ts-icon-btn phead__close"
          (click)="close.emit()"
          tsTooltip="Hide panel (⌘.)"
          aria-label="Hide details panel"
        >
          <lucide-icon name="x" [size]="15" />
        </button>
      </header>

      <div
        class="scroll"
        cdkDropList
        cdkDropListAutoScrollStep="18"
        (cdkDropListDropped)="onDrop($event)"
      >
        @for (c of cards(); track c.meta.id; let i = $index) {
          <!-- No custom placeholder: CDK's default is a clone of the dragged
               card, so the gap is always exactly the height of what is being
               moved. A fixed-height stand-in matched a COLLAPSED card and made
               every drop of an expanded one re-settle. -->
          <div class="drag" cdkDrag cdkDragPreviewContainer="parent" [cdkDragData]="c.meta.id">
          <app-info-card [title]="c.meta.symbol">
            <div card-actions class="hdr">
              <span
                class="chg ts-mono"
                [class.ts-up]="c.stats.changeAbs >= 0"
                [class.ts-down]="c.stats.changeAbs < 0"
                [tsTooltip]="fmt(c.stats.last) + ' ' + c.meta.unit"
              >
                <lucide-icon
                  [name]="c.stats.changeAbs >= 0 ? 'trending-up' : 'trending-down'"
                  [size]="13"
                />
                {{ signed(c.stats.changeAbs) }} ({{ pct(c.stats.changePct) }})
              </span>
              <button class="rm ts-icon-btn" (click)="sel.remove(c.meta.id)" tsTooltip="Remove series">
                <lucide-icon name="trash-2" [size]="14" />
              </button>
              <button
                class="grip ts-icon-btn"
                cdkDragHandle
                (keydown)="onGripKey($event, i)"
                tsTooltip="Drag to reorder, or Alt + ↑/↓ — also sets legend order and which line draws on top"
                [attr.aria-label]="'Reorder ' + c.meta.symbol + ', position ' + (i + 1) + ' of ' + cards().length"
              >
                <lucide-icon name="grip-vertical" [size]="14" />
              </button>
            </div>
            <div class="cardbody">
              <div class="cardbody__hero">
                <ts-glyph
                  class="dot"
                  [glyph]="colors.glyph(c.meta.id)"
                  [color]="c.meta.color"
                  [size]="9"
                />
                <span class="nm ts-truncate">{{ c.meta.name }}</span>
              </div>
              <dl class="kv">
                <dt>Source</dt><dd>{{ c.meta.source }}</dd>
                <dt>Frequency</dt><dd class="cap">{{ c.meta.frequency }}</dd>
                <dt>Unit</dt><dd class="ts-mono">{{ c.meta.unit }}</dd>
                @if (c.meta.currency) { <dt>Currency</dt><dd class="ts-mono">{{ c.meta.currency }}</dd> }
                <dt>Category</dt><dd>{{ c.meta.path.join(' › ') }}</dd>
                <dt>Range 2y</dt>
                <dd class="ts-mono">{{ fmt(c.stats.min) }} – {{ fmt(c.stats.max) }}</dd>
              </dl>
            </div>
          </app-info-card>
          </div>
        } @empty {
          <div class="ts-empty small">
            <img src="assets/placeholders/placeholder-quadrant.svg" alt="" />
            <div>
              <h3>Nothing selected</h3>
              <p>Pick one or more series from the left to see one info card each.</p>
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      :host,
      .panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .panel {
        background: var(--ts-bg-elevated);
      }
      .phead {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        height: var(--ts-tabbar-h);
        padding: 0 var(--ts-space-4);
        border-bottom: 1px solid var(--ts-border);
        font-size: var(--ts-fs-sm);
        font-weight: var(--ts-fw-semibold);
        color: var(--ts-text-bright);
      }
      .phead__spacer {
        flex: 1;
      }
      .phead__close {
        width: 26px;
        height: 26px;
        flex: none;
      }
      .hdr {
        display: inline-flex;
        align-items: center;
        gap: var(--ts-space-1);
      }
      .rm {
        width: 24px;
        height: 24px;
        flex: none;
      }
      .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: var(--ts-space-3);
        display: flex;
        flex-direction: column;
        gap: var(--ts-space-3);
      }
      /* The grip is the only affordance that is not always visible: a row of
         permanent drag handles reads as clutter in a panel you mostly read. */
      .grip {
        width: 22px;
        height: 22px;
        cursor: grab;
        opacity: 0;
        transition: opacity var(--ts-dur-1) var(--ts-ease);
      }
      .drag:hover .grip,
      .grip:focus-visible {
        opacity: 1;
      }
      .grip:active {
        cursor: grabbing;
      }
      /* Preview stays inside this component, or the emulated-encapsulation
         attribute stops matching once CDK reparents it to <body> and these
         styles silently do nothing. */
      .cdk-drag-preview {
        border-radius: var(--ts-radius-md);
        box-shadow: var(--ts-shadow-3);
      }
      /* The placeholder is a clone: hide its content, keep its box. */
      .cdk-drag-placeholder {
        position: relative;
      }
      .cdk-drag-placeholder > * {
        visibility: hidden;
      }
      .cdk-drag-placeholder::after {
        content: '';
        position: absolute;
        inset: 0;
        border: 1px dashed var(--ts-accent);
        border-radius: var(--ts-radius-md);
        background: var(--ts-accent-weak);
      }
      /* Rows must keep up with the pointer: a 180ms ease still reads as lag
         when you drag card 1 past nine others. */
      .cdk-drag-animating,
      .scroll.cdk-drop-list-dragging .drag:not(.cdk-drag-placeholder) {
        transition: transform var(--ts-dur-1) var(--ts-ease-out);
      }
      @media (prefers-reduced-motion: reduce) {
        .cdk-drag-animating,
        .scroll.cdk-drop-list-dragging .drag:not(.cdk-drag-placeholder) {
          transition: none;
        }
      }
      .cardbody {
        display: flex;
        flex-direction: column;
        gap: var(--ts-space-2);
        padding: var(--ts-space-3);
      }
      .cardbody__hero {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
      }
      .dot {
        width: 9px;
        height: 9px;
        border-radius: 3px;
        flex: none;
      }
      .nm {
        font-size: var(--ts-fs-sm);
        color: var(--ts-text-secondary);
        flex: 1;
      }
      .rm {
        width: 24px;
        height: 24px;
        flex: none;
      }
      .val {
        font-size: var(--ts-fs-xl);
        font-weight: var(--ts-fw-semibold);
        color: var(--ts-text-bright);
        line-height: 1.1;
      }
      .unit {
        font-size: var(--ts-fs-xs);
        color: var(--ts-text-muted);
        font-weight: var(--ts-fw-regular);
      }
      .chg {
        display: inline-flex;
        align-items: center;
        gap: var(--ts-space-1);
        font-size: var(--ts-fs-sm);
        font-weight: var(--ts-fw-medium);
        line-height: 1;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .kv {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--ts-space-1) var(--ts-space-3);
        margin: var(--ts-space-1) 0 0;
      }
      .kv dt {
        font-size: var(--ts-fs-xs);
        color: var(--ts-text-muted);
      }
      .kv dd {
        margin: 0;
        font-size: var(--ts-fs-xs);
        color: var(--ts-text-secondary);
        text-align: right;
      }
      .cap {
        text-transform: capitalize;
      }
      .ts-empty.small {
        gap: var(--ts-space-3);
        padding: var(--ts-space-6) var(--ts-space-4);
      }
      .ts-empty.small img {
        max-width: 150px;
      }
      .ts-empty.small h3 {
        font-size: var(--ts-fs-md);
      }
    `,
  ],
})
export class InfoPanelComponent {
  readonly colors = inject(SeriesColorService);

  /** Cards are ordered by `selectedIds`, so a drop is a selection reorder —
   *  which is also what re-orders the legend and the chart's draw order. */
  onDrop(e: CdkDragDrop<unknown>): void {
    this.sel.reorder(e.previousIndex, e.currentIndex);
  }

  /**
   * Keyboard reorder. CDK's drag has no keyboard mode, and a handle that only
   * answers a mouse is not a control — the panel resizer already sets this bar.
   * Alt is required so ↑/↓ still walk the panel for everyone else.
   */
  onGripKey(e: KeyboardEvent, index: number): void {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const to = index + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= this.cards().length) return;
    e.preventDefault();
    this.sel.reorder(index, to);
    // Focus rides with the card, which the @for track re-orders under us.
    const grips = (e.currentTarget as HTMLElement).closest('.scroll')?.querySelectorAll('.grip');
    queueMicrotask(() => (grips?.[to] as HTMLElement | undefined)?.focus());
  }

  readonly sel = inject(SelectionService);

  /** Emitted when the dock's own close control is used (rail mirrors this). */
  readonly close = output<void>();

  readonly cards = computed<SeriesCard[]>(() =>
    this.sel.selected().map((meta) => {
      const line =
        meta.chartKind === 'candlestick'
          ? generateOhlc(meta).map((p) => ({ time: p.time, value: p.close }))
          : generateLine(meta);
      return { meta, stats: computeStats(line) };
    }),
  );

  fmt = (v: number) => formatValue(v);
  signed = (v: number) => formatSigned(v);
  pct = (v: number) => formatPct(v);
}
