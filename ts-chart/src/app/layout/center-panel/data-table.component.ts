import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { LucideAngularModule } from 'lucide-angular';
import { ChartedSeries, ChartMode, SeriesMeta } from '../../data/models';
import {
  computeStats,
  generateAsOf,
  generateForwardCurve,
  generateLine,
  generateStrip,
  IntervalKey,
  sliceInterval,
  sliceRange,
} from '../../data/series-generator';
import { CustomRange } from '../../core/selection.service';
import { TooltipDirective } from '../../core/tooltip.directive';
import { formatDate, formatSigned, formatValue } from '../../core/format';

type Pt = { time: string; value: number };

const DELTA_MODES = new Set<ChartMode>(['latest', 'asof']);

interface MatrixRow {
  time: string;
  vals: (number | null)[];
  delta: number | null;
}

/**
 * Multi-series data view as a **date-aligned matrix**: one row per date, one
 * value column per selected (compared) series, so values line up across series
 * even when units differ. A single-series view adds a Δ column. Footer shows
 * per-column min/avg/max (full detail in the themed tooltip).
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollingModule, LucideAngularModule, TooltipDirective],
  template: `
    <div class="wrap">
      <div class="thead" [style.grid-template-columns]="gridCols()">
        <button class="th th--date" (click)="toggleSort()">
          Date
          <lucide-icon [name]="desc() ? 'chevron-down' : 'chevron-right'" [size]="13" />
        </button>
        @for (s of cols(); track s.id) {
          <span class="th num" [tsTooltip]="s.name">
            <span class="th__dot" [style.background]="s.color"></span>
            {{ s.symbol }}<span class="th__unit">{{ s.unit }}</span>
          </span>
        }
        @if (showDelta()) {
          <span class="th num">Δ 1d</span>
        }
      </div>

      <cdk-virtual-scroll-viewport itemSize="30" class="vp">
        <div
          *cdkVirtualFor="let r of rows(); let i = index; templateCacheSize: 0"
          class="tr"
          [class.alt]="i % 2 === 1"
          [style.grid-template-columns]="gridCols()"
        >
          <span class="td td--date ts-mono">{{ date(r.time) }}</span>
          @for (v of r.vals; track $index) {
            <span class="td num ts-mono">{{ v === null ? '—' : fmt(v) }}</span>
          }
          @if (showDelta()) {
            <span
              class="td num ts-mono"
              [class.ts-up]="(r.delta ?? 0) >= 0"
              [class.ts-down]="(r.delta ?? 0) < 0"
              >{{ r.delta === null ? '—' : signed(r.delta) }}</span
            >
          }
        </div>
      </cdk-virtual-scroll-viewport>

      <div class="tfoot" [style.grid-template-columns]="gridCols()">
        <span class="tfoot__lead">
          {{ rows().length }} rows
          <button class="ts-icon-btn xbtn" (click)="downloadCsv()" tsTooltip="Download CSV">
            <lucide-icon name="download" [size]="13" />
          </button>
          <button
            class="ts-icon-btn xbtn"
            (click)="copyTable()"
            [tsTooltip]="copied() ? 'Copied' : 'Copy for Excel'"
          >
            <lucide-icon [name]="copied() ? 'check' : 'copy'" [size]="13" />
          </button>
        </span>
        @for (st of stats(); track $index) {
          <span
            class="num ts-mono"
            [tsTooltip]="'min ' + fmt(st.min) + ' · max ' + fmt(st.max)"
            >avg {{ fmt(st.avg) }}</span
          >
        }
        @if (showDelta()) {
          <span></span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host,
      .wrap {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .thead,
      .tr,
      .tfoot {
        display: grid;
        align-items: center;
        gap: var(--ts-space-2);
      }
      .thead {
        height: 32px;
        padding: 0 var(--ts-space-4);
        border-bottom: 1px solid var(--ts-border);
        background: var(--ts-bg-elevated);
      }
      .th {
        font-size: var(--ts-fs-xxs);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--ts-text-muted);
        font-weight: var(--ts-fw-semibold);
      }
      .th.num {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
      }
      .th__dot {
        width: 7px;
        height: 7px;
        border-radius: 2px;
      }
      .th__unit {
        margin-left: 3px;
        text-transform: none;
        letter-spacing: 0;
        color: var(--ts-text-faint);
      }
      .th--date {
        display: inline-flex;
        align-items: center;
        gap: var(--ts-space-1);
        cursor: pointer;
      }
      .th--date:hover {
        color: var(--ts-text-bright);
      }
      .num {
        text-align: right;
        justify-content: flex-end;
      }
      .vp {
        flex: 1;
        min-height: 0;
      }
      .tr {
        height: 30px;
        padding: 0 var(--ts-space-4);
      }
      .tr.alt {
        background: color-mix(in srgb, var(--ts-bg-inset) 45%, transparent);
      }
      .tr:hover {
        background: var(--ts-bg-hover);
      }
      .td {
        font-size: var(--ts-fs-sm);
        color: var(--ts-text-secondary);
      }
      .td--date {
        color: var(--ts-text-bright);
      }
      .td.num {
        text-align: right;
      }
      .tfoot {
        padding: var(--ts-space-2) var(--ts-space-4);
        border-top: 1px solid var(--ts-border);
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-muted);
      }
      .tfoot__lead {
        display: inline-flex;
        align-items: center;
        gap: var(--ts-space-1);
      }
      .xbtn {
        width: 22px;
        height: 22px;
      }
    `,
  ],
})
export class DataTableComponent {
  readonly series = input.required<ChartedSeries[]>();
  readonly interval = input<IntervalKey>('6M');
  readonly range = input<CustomRange | null>(null);
  readonly mode = input<ChartMode>('latest');
  readonly asOf = input<string>('');

  readonly desc = signal(true);
  readonly copied = signal(false);

  readonly cols = computed(() => this.series());
  readonly showDelta = computed(() => this.cols().length === 1 && DELTA_MODES.has(this.mode()));

  readonly gridCols = computed(() => {
    const n = this.cols().length + (this.showDelta() ? 1 : 0);
    return `minmax(96px, 1.3fr) ${'minmax(64px, 1fr) '.repeat(n).trim()}`;
  });

  private readonly points = computed<Pt[][]>(() =>
    this.cols().map((s) =>
      seriesPoints(s, this.mode(), this.interval(), this.asOf(), this.range()),
    ),
  );

  readonly rows = computed<MatrixRow[]>(() => {
    const cols = this.points();
    const maps = cols.map((pts) => new Map(pts.map((p) => [p.time, p.value])));
    const times = [...new Set(cols.flatMap((pts) => pts.map((p) => p.time)))].sort();

    // Single-series Δ computed on ascending order.
    let deltas: Map<string, number> | null = null;
    if (this.showDelta() && cols[0]) {
      deltas = new Map();
      const p = cols[0];
      for (let i = 1; i < p.length; i++) deltas.set(p[i].time, p[i].value - p[i - 1].value);
    }

    const ordered = this.desc() ? times.slice().reverse() : times;
    return ordered.map((t) => ({
      time: t,
      vals: maps.map((m) => (m.has(t) ? m.get(t)! : null)),
      delta: deltas ? (deltas.get(t) ?? null) : null,
    }));
  });

  readonly stats = computed(() =>
    this.points().map((pts) => computeStats(pts.length ? pts : [{ time: '', value: 0 }])),
  );

  fmt = (v: number) => formatValue(v);
  signed = (v: number) => formatSigned(v);
  date = (t: string) => formatDate(t);

  toggleSort(): void {
    this.desc.update((v) => !v);
  }

  /** Rows in current sort order as delimiter-separated text. */
  private tableText(sep: string): string {
    const header = [
      'Date',
      ...this.cols().map((s) => `${s.symbol} (${s.unit})`),
      ...(this.showDelta() ? ['Delta 1d'] : []),
    ].join(sep);
    const lines = this.rows().map((r) =>
      [
        r.time,
        ...r.vals.map((v) => (v === null ? '' : String(v))),
        ...(this.showDelta() ? [r.delta === null ? '' : String(r.delta)] : []),
      ].join(sep),
    );
    return [header, ...lines].join('\n');
  }

  downloadCsv(): void {
    const blob = new Blob([this.tableText(',')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const syms = this.cols()
      .map((s) => s.symbol.replace(/\s+/g, ''))
      .join('-');
    a.href = url;
    a.download = `tschart-${syms || 'data'}-${this.mode()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async copyTable(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.tableText('\t'));
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1200);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }
}

function seriesPoints(
  meta: SeriesMeta,
  mode: ChartMode,
  iv: IntervalKey,
  asOf: string,
  range: CustomRange | null,
): Pt[] {
  const slice = (data: Pt[]) =>
    range ? sliceRange(data, range.from, range.to) : sliceInterval(data, iv);
  switch (mode) {
    case 'asof':
      return slice(generateAsOf(meta, asOf));
    case 'forward':
      return generateForwardCurve(meta, asOf).map((p) => ({ time: p.time, value: p.value }));
    case 'strip':
      return generateStrip(meta, asOf).map((p) => ({ time: p.time, value: p.value }));
    case 'seasonal':
    case 'latest':
    default:
      return slice(generateLine(meta));
  }
}
