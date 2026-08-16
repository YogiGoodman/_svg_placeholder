import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SelectionService } from '../../core/selection.service';
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
  imports: [LucideAngularModule, TooltipDirective, InfoCardComponent],
  template: `
    <section class="panel">
      <header class="phead">
        <span>Series Details</span>
        @if (sel.count() > 0) {
          <span class="ts-badge">{{ sel.count() }}</span>
        }
      </header>

      <div class="scroll">
        @for (c of cards(); track c.meta.id) {
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
            </div>
            <div class="cardbody">
              <div class="cardbody__hero">
                <span class="dot" [style.background]="c.meta.color"></span>
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
      .chg lucide-icon {
        display: inline-flex;
        flex: none;
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
  readonly sel = inject(SelectionService);

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
