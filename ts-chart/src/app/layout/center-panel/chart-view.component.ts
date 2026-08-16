import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LineStyle,
  LineType,
  SeriesDefinition,
  Time,
} from 'lightweight-charts';
import { ChartedSeries, ChartMode, ChartType } from '../../data/models';
import {
  CurvePoint,
  generateAsOf,
  generateForwardCurve,
  generateLine,
  generateOhlc,
  generateStrip,
  IntervalKey,
  sliceInterval,
  sliceRange,
  TODAY,
} from '../../data/series-generator';
import { modeSupported } from '../../core/modes';
import { ThemeService } from '../../core/theme.service';
import { CustomRange, SelectionService } from '../../core/selection.service';
import { ChartInteractionService } from '../../core/chart-interaction.service';
import { TooltipDirective } from '../../core/tooltip.directive';
import { formatPct, formatSigned, formatValue } from '../../core/format';

/** Modes where a point-over-point delta is meaningful. */
const DELTA_MODES = new Set<ChartMode>(['latest', 'asof']);

interface LegendRow {
  id: string;
  label: string;
  unit: string;
  color: string;
  value: number | null;
  delta: number | null;
  deltaPct: number | null;
  hidden: boolean;
  /** Series does not support the active chart mode — dimmed, not drawn. */
  unsupported: boolean;
  /** Simulated availability problem — dimmed with an icon, not drawn. */
  broken: 'forbidden' | 'missing' | null;
}
interface ValueTag {
  y: number;
  value: number;
  color: string;
}

type Point = { time: string; value: number };
type SeriesType = 'Line' | 'Area' | 'Candlestick';

/** A declarative description of one drawable series for the current render. */
interface SeriesSpec {
  key: string; // stable identity for reconciliation
  legendId: string; // series id this maps to (live values / tags)
  type: SeriesType;
  options: Record<string, unknown>;
  data: readonly unknown[];
  color: string;
  last: number;
  prev: number;
  track: boolean; // contributes last/prev + value tag
}

interface OhlcHover {
  o: number;
  h: number;
  l: number;
  c: number;
}

interface ActiveSeries {
  key: string;
  legendId: string;
  api: ISeriesApi<SeriesType>;
  kind: SeriesType;
  color: string;
  last: number;
  track: boolean;
  dataRef: readonly unknown[];
  /** Lazy time -> value index for crosshair sync (invalidated with dataRef). */
  timeMap?: Map<string, number>;
  timeMapRef?: readonly unknown[];
}

const SERIES_DEF: Record<SeriesType, SeriesDefinition<SeriesType>> = {
  Line: LineSeries as SeriesDefinition<SeriesType>,
  Area: AreaSeries as SeriesDefinition<SeriesType>,
  Candlestick: CandlestickSeries as SeriesDefinition<SeriesType>,
};

@Component({
  selector: 'app-chart-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, TooltipDirective],
  template: `
    <div
      class="chart-host"
      (pointerenter)="pointerInside = true"
      (pointerleave)="onPointerLeave()"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp()"
      (dblclick)="onDblClick()"
    >
      <!-- Fixed left legend: rows only, capital.com-minimal. No header — the
           first row carries identity, the toolbar carries the mode. -->
      @if (series().length > 0) {
      <div class="legend" [class.is-collapsed]="collapsed()">
        @if (!collapsed()) {
        <div class="legend__rows">
          @for (row of visibleRows(); track row.id) {
            <div class="lrow" [class.is-hidden]="row.hidden || row.unsupported || !!row.broken">
              <span class="lrow__dot" [style.background]="row.color"></span>
              <span class="lrow__label ts-truncate" [tsTooltip]="row.label">{{ row.label }}</span>
              @if (row.broken) {
                <lucide-icon
                  class="lrow__stat"
                  [name]="row.broken === 'forbidden' ? 'lock' : 'triangle-alert'"
                  [size]="12"
                  [tsTooltip]="
                    row.broken === 'forbidden'
                      ? 'Restricted — entitlement required'
                      : 'No data available'
                  "
                />
              } @else if (row.unsupported) {
                <span class="lrow__na" tsTooltip="Not available in this chart mode">n/a</span>
              } @else if (ohlcRow(); as oc) {
                <span class="lrow__ohlc ts-mono">
                  <i>O</i>{{ fmt(oc.o) }} <i>H</i>{{ fmt(oc.h) }} <i>L</i>{{ fmt(oc.l) }} <i>C</i
                  ><span [class.ts-up]="oc.c >= oc.o" [class.ts-down]="oc.c < oc.o">{{
                    fmt(oc.c)
                  }}</span>
                </span>
              } @else {
                <span class="lrow__num">
                  <span class="lrow__val ts-mono">{{ fmt(row.value) }}</span>
                  <span class="lrow__unit">{{ row.unit }}</span>
                </span>
                @if (row.delta !== null) {
                  <span
                    class="lrow__delta ts-mono"
                    [class.ts-up]="row.delta >= 0"
                    [class.ts-down]="row.delta < 0"
                  >
                    {{ signed(row.delta) }}
                  </span>
                }
              }
              <button
                class="lrow__btn"
                (click)="toggleHidden(row.id)"
                [disabled]="row.unsupported || !!row.broken"
                [tsTooltip]="row.hidden ? 'Show series' : 'Hide series'"
              >
                <lucide-icon [name]="row.hidden ? 'eye-off' : 'eye'" [size]="13" />
              </button>
              <button class="lrow__btn danger" (click)="remove(row.id)" tsTooltip="Remove series">
                <lucide-icon name="trash-2" [size]="13" />
              </button>
            </div>
          }
          @if (moreCount() > 0) {
            <button class="lrow lrow--more" (click)="showAllRows.set(!showAllRows())">
              {{ showAllRows() ? 'Show less' : '+' + moreCount() + ' more' }}
            </button>
          }
        </div>
        }
        <!-- Collapse control lives BELOW the rows; collapsed = icon + count only -->
        <button
          class="legend__toggle"
          (click)="toggleCollapsed()"
          [tsTooltip]="collapsed() ? 'Expand legend' : 'Collapse legend'"
          [attr.aria-expanded]="!collapsed()"
        >
          <lucide-icon [name]="collapsed() ? 'chevron-right' : 'chevron-up'" [size]="13" />
          @if (collapsed()) {
            <span class="legend__count ts-mono">{{ series().length }}</span>
          }
        </button>
      </div>
      }

      <!-- Right-edge per-series value tags -->
      @for (tag of valueTags(); track $index) {
        <div class="lastval ts-mono" [style.top.px]="tag.y" [style.background]="tag.color">
          {{ fmt(tag.value) }}
        </div>
      }

      <!-- Vertical marker (today / as-of) -->
      <div class="today" [style.left.px]="markerX()" [class.hide]="markerX() === null">
        <span class="today__pill">{{ markerLabel() }}</span>
      </div>

      <!-- Measure overlay (Shift+drag) -->
      @if (measure(); as m) {
        <div
          class="measure"
          [style.left.px]="mLeft()"
          [style.top.px]="mTop()"
          [style.width.px]="mW()"
          [style.height.px]="mH()"
        ></div>
        @if (measureInfo(); as mi) {
          <div
            class="measure__label ts-mono"
            [class.ts-up]="mi.dv >= 0"
            [class.ts-down]="mi.dv < 0"
            [style.left.px]="mLabelLeft()"
            [style.top.px]="mLabelTop()"
          >
            {{ signed(mi.dv) }} ({{ pct(mi.pct) }})@if (mi.days !== null) { · {{ mi.days }}d}
          </div>
        }
      }

      <!-- Zoom controls (reveal on chart hover) -->
      @if (series().length > 0) {
        <div class="zoom">
          <button class="zoom__btn" (click)="zoomBy(-1)" tsTooltip="Zoom out">
            <lucide-icon name="minus" [size]="14" />
          </button>
          <button class="zoom__btn" (click)="zoomBy(1)" tsTooltip="Zoom in">
            <lucide-icon name="plus" [size]="14" />
          </button>
          <button class="zoom__btn" (click)="fitAll()" tsTooltip="Fit all data">
            <lucide-icon name="unfold-horizontal" [size]="14" />
          </button>
        </div>
      }

      <!-- Nothing drawable in this mode — explicit notice, never a silent blank -->
      @if (series().length > 0 && drawnCount() === 0) {
        <div class="nodraw">
          <span class="nodraw__title">Nothing to chart in this mode</span>
          <span class="nodraw__hint">Selected series are n/a here — pick another mode above.</span>
        </div>
      }

      <!-- Chart mount -->
      <div #host class="chart"></div>
    </div>
  `,
  styles: [
    `
      :host,
      .chart-host {
        display: block;
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 0;
      }
      .chart {
        position: absolute;
        inset: 0;
      }
      /* Near-transparent so price action stays visible underneath; the blur
         alone keeps text legible over busy lines (capital.com pattern). */
      .legend {
        position: absolute;
        top: var(--ts-space-3);
        left: var(--ts-space-3);
        z-index: 5;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--ts-space-1);
        padding: var(--ts-space-1) var(--ts-space-2);
        border-radius: var(--ts-radius-md);
        background: color-mix(in srgb, var(--ts-bg-elevated) 55%, transparent);
        backdrop-filter: blur(6px);
        max-width: 320px;
        pointer-events: auto;
      }
      .legend__toggle {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 20px;
        padding: 0 var(--ts-space-1);
        border-radius: var(--ts-radius-xs);
        color: var(--ts-text-muted);
        cursor: pointer;
        flex: none;
      }
      .legend__toggle:hover {
        background: var(--ts-bg-active);
        color: var(--ts-text-bright);
      }
      .legend__count {
        font-size: var(--ts-fs-xxs);
        font-variant-numeric: tabular-nums;
      }
      .legend.is-collapsed {
        padding: 2px;
      }
      .legend__rows {
        display: flex;
        flex-direction: column;
        gap: 1px;
        align-self: stretch;
      }
      .lrow {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        padding: 2px var(--ts-space-1);
        border-radius: var(--ts-radius-xs);
      }
      .lrow:hover {
        background: var(--ts-bg-hover);
      }
      .lrow.is-hidden {
        opacity: 0.45;
      }
      .lrow--more {
        justify-content: center;
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-muted);
        cursor: pointer;
      }
      .lrow--more:hover {
        color: var(--ts-text-bright);
      }
      .lrow__ohlc {
        margin-left: auto;
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        font-size: var(--ts-fs-xs);
        color: var(--ts-text-bright);
        font-variant-numeric: tabular-nums;
      }
      .lrow__ohlc i {
        font-style: normal;
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-muted);
        margin-right: 1px;
      }
      .lrow__dot {
        width: 8px;
        height: 8px;
        border-radius: 2px;
        flex: none;
      }
      .lrow__label {
        font-size: var(--ts-fs-xs);
        color: var(--ts-text-secondary);
        min-width: 48px;
        max-width: 84px;
        text-align: left;
      }
      .lrow__num {
        display: inline-flex;
        align-items: baseline;
        gap: 3px;
        margin-left: auto;
      }
      .lrow__val {
        font-size: var(--ts-fs-sm);
        color: var(--ts-text-bright);
        font-variant-numeric: tabular-nums;
      }
      .lrow__unit {
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-muted);
        white-space: nowrap;
      }
      .lrow__delta {
        font-size: var(--ts-fs-xxs);
        min-width: 42px;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      /* Row actions reveal on hover/focus only (TradingView pattern); buttons
         keep their width so nothing shifts. */
      .lrow__btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: var(--ts-radius-xs);
        color: var(--ts-text-muted);
        cursor: pointer;
        flex: none;
        opacity: 0;
        pointer-events: none;
        transition:
          background var(--ts-dur-1) var(--ts-ease),
          color var(--ts-dur-1) var(--ts-ease),
          opacity var(--ts-dur-1) var(--ts-ease);
      }
      .lrow:hover .lrow__btn,
      .lrow__btn:focus-visible {
        opacity: 1;
        pointer-events: auto;
      }
      .lrow__btn:disabled {
        opacity: 0;
        pointer-events: none;
      }
      .lrow__na {
        margin-left: auto;
        font-size: var(--ts-fs-xxs);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--ts-text-faint);
      }
      .lrow__stat {
        margin-left: auto;
        color: var(--ts-warn);
        flex: none;
      }
      .nodraw {
        position: absolute;
        inset: 0;
        z-index: 3;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--ts-space-2);
        pointer-events: none;
      }
      .nodraw__title {
        font-size: var(--ts-fs-md);
        font-weight: var(--ts-fw-semibold);
        color: var(--ts-text-secondary);
      }
      .nodraw__hint {
        font-size: var(--ts-fs-sm);
        color: var(--ts-text-muted);
      }
      .lrow__btn:hover {
        background: var(--ts-bg-active);
        color: var(--ts-text-bright);
      }
      .lrow__btn.danger:hover {
        color: var(--ts-down);
      }
      .lastval {
        position: absolute;
        right: 2px;
        z-index: 5;
        transform: translateY(-50%);
        padding: 1px var(--ts-space-2);
        border-radius: var(--ts-radius-xs);
        color: var(--ts-accent-contrast);
        font-size: var(--ts-fs-xxs);
        font-weight: var(--ts-fw-bold);
        box-shadow: var(--ts-shadow-1);
        pointer-events: none;
      }
      .today {
        position: absolute;
        top: 0;
        bottom: 26px;
        width: 0;
        z-index: 4;
        border-left: 1px dashed color-mix(in srgb, var(--ts-highlight) 60%, transparent);
        pointer-events: none;
      }
      .today__pill {
        position: absolute;
        top: var(--ts-space-2);
        left: 50%;
        transform: translateX(-50%);
        padding: 1px 6px;
        border-radius: var(--ts-radius-pill);
        background: color-mix(in srgb, var(--ts-highlight) 18%, var(--ts-bg-elevated));
        color: var(--ts-highlight);
        font-size: 9px;
        font-weight: var(--ts-fw-bold);
        letter-spacing: 0.06em;
        white-space: nowrap;
      }
      .hide {
        display: none;
      }
      .measure {
        position: absolute;
        z-index: 4;
        background: color-mix(in srgb, var(--ts-accent) 10%, transparent);
        border: 1px solid var(--ts-accent);
        border-radius: var(--ts-radius-xs);
        pointer-events: none;
      }
      .measure__label {
        position: absolute;
        z-index: 6;
        padding: 2px var(--ts-space-2);
        border-radius: var(--ts-radius-xs);
        background: var(--ts-bg-elevated);
        border: 1px solid var(--ts-border);
        box-shadow: var(--ts-shadow-2);
        font-size: var(--ts-fs-xs);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        pointer-events: none;
      }
      .zoom {
        position: absolute;
        right: var(--ts-space-2);
        bottom: 34px;
        z-index: 5;
        display: inline-flex;
        gap: 1px;
        padding: 2px;
        border-radius: var(--ts-radius-md);
        background: color-mix(in srgb, var(--ts-bg-elevated) 84%, transparent);
        border: 1px solid var(--ts-border-subtle);
        backdrop-filter: blur(6px);
      }
      .zoom__btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 24px;
        border-radius: var(--ts-radius-sm);
        color: var(--ts-text-muted);
        cursor: pointer;
      }
      .zoom__btn:hover {
        background: var(--ts-bg-active);
        color: var(--ts-text-bright);
      }
    `,
  ],
})
export class ChartViewComponent implements OnDestroy {
  /** All selected series for this pane (visible + hidden). */
  readonly series = input.required<ChartedSeries[]>();
  readonly interval = input<IntervalKey>('6M');
  readonly mode = input<ChartMode>('latest');
  /** How to draw the series (line/area/candles). */
  readonly type = input<ChartType>('area');
  /** As-of date (drives `asof` + `forward` snapshots). */
  readonly asOf = input<string>(TODAY);
  /** Pane identity for cross-pane crosshair sync (0 = overlay / first pane). */
  readonly paneId = input(0);
  /** Explicit from–to window; overrides `interval` while set. */
  readonly range = input<CustomRange | null>(null);

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly theme = inject(ThemeService);
  private readonly sel = inject(SelectionService);
  private readonly interaction = inject(ChartInteractionService);

  private chart?: IChartApi;
  private active: ActiveSeries[] = [];
  private ro?: ResizeObserver;
  private markerTime: string = TODAY;

  /** Cached generated data keyed by spec-key + render signature (stable refs
   *  across re-renders so unchanged survivors are never re-`setData`'d). */
  private dataCache = new Map<string, readonly unknown[]>();
  private lastSig = '';

  readonly collapsed = signal(readLegendCollapsed());
  /** Number of series actually drawn last render (drives the empty notice). */
  readonly drawnCount = signal(0);
  /** Legend rows are capped at 6 by default (occlusion control). */
  readonly showAllRows = signal(false);
  /** OHLC under the crosshair (candles only); falls back to the last bar. */
  readonly hoverOhlc = signal<OhlcHover | null>(null);
  readonly lastOhlc = signal<OhlcHover | null>(null);
  readonly ohlcRow = computed(() => this.hoverOhlc() ?? this.lastOhlc());

  readonly visibleRows = computed(() => {
    const rows = this.legendRows();
    return this.showAllRows() ? rows : rows.slice(0, 6);
  });
  readonly moreCount = computed(() => Math.max(0, this.legendRows().length - 6));

  toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
    try {
      localStorage.setItem('tschart.legend', this.collapsed() ? '1' : '0');
    } catch {
      /* ignore */
    }
  }
  readonly hoverVals = signal<Record<string, number | null>>({});
  readonly hoverDate = signal<string | null>(null);
  readonly markerX = signal<number | null>(null);
  readonly markerLabel = signal<string>('TODAY');
  readonly valueTags = signal<ValueTag[]>([]);

  /** True while the pointer is physically over this pane — the only pane
   *  allowed to publish crosshair state (loop-proof sync). */
  pointerInside = false;

  /** Shift+drag measurement rect in host-relative px. */
  readonly measure = signal<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  private measuring = false;

  readonly mLeft = computed(() => Math.min(this.measure()!.x1, this.measure()!.x2));
  readonly mTop = computed(() => Math.min(this.measure()!.y1, this.measure()!.y2));
  readonly mW = computed(() => Math.abs(this.measure()!.x2 - this.measure()!.x1));
  readonly mH = computed(() => Math.abs(this.measure()!.y2 - this.measure()!.y1));
  /** Label clamped inside the host (top edge + right edge). */
  readonly mLabelTop = computed(() => Math.max(4, this.mTop() - 26));
  readonly mLabelLeft = computed(() => Math.max(4, Math.min(this.mLeft(), this.measureHostW - 170)));
  private measureHostW = 0;

  /** Δvalue / Δ% / Δdays between the measure anchor and current corner. */
  readonly measureInfo = computed(() => {
    const m = this.measure();
    const chart = this.chart;
    if (!m || !chart) return null;
    const a = this.active.find((x) => x.track);
    if (!a) return null;
    const v1 = a.api.coordinateToPrice(m.y1);
    const v2 = a.api.coordinateToPrice(m.y2);
    if (v1 == null || v2 == null) return null;
    const t1 = chart.timeScale().coordinateToTime(m.x1);
    const t2 = chart.timeScale().coordinateToTime(m.x2);
    const dv = (v2 as number) - (v1 as number);
    const pctV = v1 ? (dv / Math.abs(v1 as number)) * 100 : 0;
    const days =
      t1 && t2
        ? Math.round(
            Math.abs(new Date(String(t2)).getTime() - new Date(String(t1)).getTime()) / 86400000,
          )
        : null;
    return { dv, pct: pctV, days };
  });

  private lastVals: Record<string, number> = {};
  private prevVals: Record<string, number> = {};


  readonly legendRows = computed<LegendRow[]>(() => {
    const hv = this.hoverVals();
    const showDelta = DELTA_MODES.has(this.mode());
    // touch signals that change row values so the computed re-runs
    this.valueTags();
    const mode = this.mode();
    return this.series().map((s) => {
      const value = hv[s.id] ?? this.lastVals[s.id] ?? null;
      const prev = this.prevVals[s.id];
      const delta = showDelta && value != null && prev != null ? value - prev : null;
      return {
        id: s.id,
        label: s.symbol,
        unit: s.unit,
        color: s.color,
        value,
        delta,
        deltaPct: delta != null && prev ? (delta / prev) * 100 : null,
        hidden: this.sel.isHidden(s.id),
        unsupported: !modeSupported(s, mode),
        broken: s.status && s.status !== 'ok' ? s.status : null,
      };
    });
  });

  constructor() {
    afterNextRender(() => {
      this.buildChart();
      this.render();
      this.ro = new ResizeObserver(() => this.updateOverlays());
      this.ro.observe(this.host().nativeElement);
    });

    // Re-render when inputs (series list, interval, mode, as-of) or hidden set change.
    effect(() => {
      this.series();
      this.interval();
      this.range();
      this.mode();
      this.type();
      this.asOf();
      this.sel.hiddenIds();
      if (this.chart) this.render();
    });

    // Theme change: recolor options + recreate series (gradients/up-down refresh).
    effect(() => {
      this.theme.theme();
      if (this.chart) this.applyTheme();
    });

    // Cross-pane crosshair sync: mirror the hover published by another pane.
    effect(() => {
      const h = this.interaction.hover();
      const chart = this.chart;
      if (!chart) return;
      if (h && h.paneId === this.paneId()) return; // own hover, natively drawn
      if (!h || h.time === null) {
        if (!this.pointerInside) chart.clearCrosshairPosition();
        return;
      }
      const a = this.active.find((x) => x.track);
      const v = a ? this.timeMapOf(a).get(h.time) : undefined;
      if (a && v !== undefined) {
        chart.setCrosshairPosition(v, h.time as Time, a.api);
      } else {
        chart.clearCrosshairPosition();
      }
    });
  }

  /** Lazy time->value index per drawn series (rebuilt when its data changes). */
  private timeMapOf(a: ActiveSeries): Map<string, number> {
    if (!a.timeMap || a.timeMapRef !== a.dataRef) {
      const m = new Map<string, number>();
      for (const p of a.dataRef as { time: string; value?: number; close?: number }[]) {
        const v = p.value ?? p.close;
        if (v != null) m.set(p.time, v);
      }
      a.timeMap = m;
      a.timeMapRef = a.dataRef;
    }
    return a.timeMap;
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    this.chart?.remove();
  }

  fmt = (v: number | null) => formatValue(v);
  signed = (v: number) => formatSigned(v);
  pct = (v: number) => formatPct(v);

  toggleHidden(id: string): void {
    this.sel.toggleHidden(id);
  }
  remove(id: string): void {
    this.sel.remove(id);
  }

  /** Zoom the time axis ±25% around the center of the visible range. */
  zoomBy(dir: 1 | -1): void {
    const ts = this.chart?.timeScale();
    const r = ts?.getVisibleLogicalRange();
    if (!ts || !r) return;
    const span = r.to - r.from;
    const step = span * 0.25 * dir; // dir=1 zooms in (shrinks the span)
    const from = r.from + step / 2;
    const to = r.to - step / 2;
    if (to - from < 5) return; // keep a sane minimum window
    ts.setVisibleLogicalRange({ from, to });
  }

  fitAll(): void {
    this.chart?.timeScale().fitContent();
  }

  // --- chart lifecycle -------------------------------------------------------
  private cssVar(name: string): string {
    return getComputedStyle(this.host().nativeElement).getPropertyValue(name).trim();
  }

  private buildChart(): void {
    const el = this.host().nativeElement;
    this.chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: this.cssVar('--ts-text-muted'),
        fontFamily: this.cssVar('--ts-font-mono') || 'monospace',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: this.cssVar('--ts-grid-weak') },
        horzLines: { color: this.cssVar('--ts-grid-strong') },
      },
      rightPriceScale: {
        borderColor: this.cssVar('--ts-border'),
        scaleMargins: { top: 0.14, bottom: 0.1 },
      },
      timeScale: {
        borderColor: this.cssVar('--ts-border'),
        rightOffset: 4,
        fixLeftEdge: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: this.cssVar('--ts-text-muted'),
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: this.cssVar('--ts-bg-active'),
        },
        horzLine: {
          color: this.cssVar('--ts-text-muted'),
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: this.cssVar('--ts-bg-active'),
        },
      },
    });

    this.chart.subscribeCrosshairMove((param) => this.onCrosshair(param));
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => this.updateOverlays());
  }

  private clearSeries(): void {
    const chart = this.chart!;
    for (const a of this.active) chart.removeSeries(a.api);
    this.active = [];
  }

  /**
   * Reconcile the drawn series against the desired spec set. Only added/removed
   * series touch the chart; survivors keep their data (no flicker, stable zoom).
   * `force` recreates everything (theme change).
   */
  private render(force = false): void {
    const chart = this.chart;
    if (!chart) return;

    const mode = this.mode();
    const iv = this.interval();
    const asOf = this.asOf();
    const r = this.range();
    const sig = `${mode}|${iv}|${asOf}|${r ? `${r.from}:${r.to}` : ''}`;
    if (sig !== this.lastSig) {
      this.dataCache.clear(); // inputs that change data shape → invalidate cache
      this.lastSig = sig;
    }

    if (force) this.clearSeries();

    const specs = this.buildSpecs(mode, iv, asOf);
    const desired = new Set(specs.map((s) => s.key));

    // Remove series no longer desired (e.g. one legend row removed).
    const survivors: ActiveSeries[] = [];
    for (const a of this.active) {
      if (desired.has(a.key)) survivors.push(a);
      else chart.removeSeries(a.api);
    }
    const existing = new Map(survivors.map((a) => [a.key, a]));

    this.lastVals = {};
    this.prevVals = {};
    const next: ActiveSeries[] = [];
    let added = false;
    for (const spec of specs) {
      let a = existing.get(spec.key);
      if (!a) {
        const api = chart.addSeries(
          SERIES_DEF[spec.type],
          spec.options as never,
        ) as ISeriesApi<SeriesType>;
        api.setData(spec.data as never);
        a = {
          key: spec.key,
          legendId: spec.legendId,
          api,
          kind: spec.type,
          color: spec.color,
          last: spec.last,
          track: spec.track,
          dataRef: spec.data,
        };
        added = true;
      } else if (a.dataRef !== spec.data) {
        a.api.setData(spec.data as never);
        a.dataRef = spec.data;
      }
      // Recolor survivors in place (theme toggle / slot reassignment).
      if (a.color !== spec.color) a.api.applyOptions(spec.options as never);
      a.last = spec.last;
      a.color = spec.color;
      a.track = spec.track;
      if (spec.track) {
        this.lastVals[spec.legendId] = spec.last;
        this.prevVals[spec.legendId] = spec.prev;
      }
      next.push(a);
    }
    this.active = next;

    // Reset hover snapshot only on a structural change (not on a plain removal).
    this.hoverVals.set({});
    this.hoverDate.set(null);

    // Only refit when the data window actually changed, or on a fresh/forced
    // build — removing a series must NOT snap the user's zoom.
    if (force || added || sig !== this.lastSigApplied) {
      chart.timeScale().fitContent();
      this.lastSigApplied = sig;
    }
    this.drawnCount.set(specs.length);
    if (specs.length === 0) {
      this.valueTags.set([]);
      this.markerX.set(null);
    }
    queueMicrotask(() => this.updateOverlays());
  }

  private lastSigApplied = '';

  // --- spec builders (declarative; no direct chart mutation) -----------------
  /** Resolve the drawable type: candles only single+time-mode; area only single. */
  private effType(mode: ChartMode, visLen: number): ChartType {
    const t = this.type();
    if (t === 'candles') {
      return visLen === 1 && (mode === 'latest' || mode === 'asof') ? 'candles' : 'line';
    }
    if (t === 'area' && visLen > 1) return 'line'; // overlapping area fills = mud
    return t;
  }

  private buildSpecs(mode: ChartMode, iv: IntervalKey, asOf: string): SeriesSpec[] {
    // Draw only series that are shown, healthy AND support the active mode —
    // the rest stay in the legend, dimmed (union mode-gating / status policy).
    this.lastOhlc.set(null); // set again below only by the candle builder
    const vis = this.series().filter(
      (s) =>
        !this.sel.isHidden(s.id) &&
        modeSupported(s, mode) &&
        (!s.status || s.status === 'ok'),
    );
    if (vis.length === 0) return [];
    const et = this.effType(mode, vis.length);

    switch (mode) {
      case 'seasonal':
        this.setMarker(null);
        return this.seasonalSpecs(vis[0]);
      case 'forward':
        this.setMarker(null);
        return this.curveSpecs(vis[0], asOf, 'forward');
      case 'strip':
        this.setMarker(null);
        return this.curveSpecs(vis[0], asOf, 'strip');
      case 'asof':
        this.setMarker(null); // set inside spec builders below
        return et === 'candles'
          ? this.candleSpecs(vis[0], iv, 'AS OF', asOf)
          : this.asOfSpecs(vis[0], iv, asOf, et);
      default:
        this.setMarker(TODAY, 'TODAY');
        return et === 'candles' ? this.candleSpecs(vis[0], iv, 'TODAY') : this.latestSpecs(vis, iv, et);
    }
  }

  /** Interval slice, or the explicit custom window when one is set. */
  private sliceData<T extends { time: string }>(data: T[], iv: IntervalKey): T[] {
    const r = this.range();
    return r ? sliceRange(data, r.from, r.to) : sliceInterval(data, iv);
  }

  private cache<T extends readonly unknown[]>(key: string, make: () => T): T {
    const hit = this.dataCache.get(key);
    if (hit) return hit as T;
    const made = make();
    this.dataCache.set(key, made);
    return made;
  }

  private latestSpecs(vis: ChartedSeries[], iv: IntervalKey, type: ChartType): SeriesSpec[] {
    return vis.map((meta) => {
      const data = this.cache(`latest:${meta.id}`, () =>
        this.sliceData(generateLine(meta), iv),
      ) as Point[];
      const area = type === 'area';
      const options = area
        ? {
            lineColor: meta.color,
            lineWidth: 2,
            topColor: hexA(meta.color, 0.28),
            bottomColor: hexA(meta.color, 0.02),
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerBorderColor: this.cssVar('--ts-bg'),
            crosshairMarkerBackgroundColor: meta.color,
          }
        : {
            color: meta.color,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerBorderColor: this.cssVar('--ts-bg'),
            crosshairMarkerBackgroundColor: meta.color,
          };
      return this.lineSpec(meta, `latest#${meta.id}#${area ? 'a' : 'l'}`, area ? 'Area' : 'Line', options, data);
    });
  }

  private candleSpecs(
    meta: ChartedSeries,
    iv: IntervalKey,
    markerLabel: string,
    cutoff?: string,
  ): SeriesSpec[] {
    const up = this.cssVar('--ts-up');
    const down = this.cssVar('--ts-down');
    const ohlc = this.cache(`candles:${meta.id}`, () => {
      const full = generateOhlc(meta);
      // As-of: no future leakage — truncate at the snapshot date.
      const cut = cutoff ? full.filter((p) => p.time <= cutoff) : full;
      return this.sliceData(cut.length ? cut : full.slice(0, 1), iv);
    }) as { time: string; open: number; high: number; low: number; close: number }[];
    const last = ohlc[ohlc.length - 1];
    if (!last) return [];
    this.setMarker(last.time, markerLabel);
    this.lastOhlc.set({ o: last.open, h: last.high, l: last.low, c: last.close });
    return [
      {
        key: `candles#${meta.id}`,
        legendId: meta.id,
        type: 'Candlestick',
        options: {
          upColor: up,
          downColor: down,
          borderVisible: false,
          wickUpColor: up,
          wickDownColor: down,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        data: ohlc,
        color: meta.color,
        last: last.close,
        prev: ohlc[ohlc.length - 2]?.close ?? last.close,
        track: true,
      },
    ];
  }

  private seasonalSpecs(meta: ChartedSeries): SeriesSpec[] {
    const years = this.cache(`seasonal:${meta.id}`, () => seasonalByYear(generateLine(meta))) as {
      year: number;
      data: Point[];
    }[];
    return years.map(({ year, data }, i) => {
      const recent = i === years.length - 1;
      const last = data[data.length - 1];
      return {
        key: `seasonal#${meta.id}#${year}`,
        legendId: meta.id,
        type: 'Line' as SeriesType,
        options: {
          color: recent ? meta.color : hexA(meta.color, 0.28 + i * 0.14),
          lineWidth: recent ? 2 : 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: recent,
        },
        data,
        color: meta.color,
        last: last.value,
        prev: data[data.length - 2]?.value ?? last.value,
        track: recent, // only the current year drives the legend value
      };
    });
  }

  private curveSpecs(meta: ChartedSeries, asOf: string, kind: 'forward' | 'strip'): SeriesSpec[] {
    const curve = this.cache(`${kind}:${meta.id}`, () =>
      kind === 'forward' ? generateForwardCurve(meta, asOf) : generateStrip(meta, asOf),
    ) as CurvePoint[];
    const data: Point[] = curve.map((p) => ({ time: p.time, value: p.value }));
    const last = data[data.length - 1];
    return [
      {
        key: `${kind}#${meta.id}`,
        legendId: meta.id,
        type: 'Line',
        options: {
          color: meta.color,
          lineWidth: 2,
          lineType: kind === 'strip' ? LineType.WithSteps : LineType.Simple,
          pointMarkersVisible: kind === 'forward',
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerBackgroundColor: meta.color,
          crosshairMarkerBorderColor: this.cssVar('--ts-bg'),
        },
        data,
        color: meta.color,
        last: last?.value ?? 0,
        prev: last?.value ?? 0,
        track: true,
      },
    ];
  }

  private asOfSpecs(meta: ChartedSeries, iv: IntervalKey, asOf: string, type: ChartType): SeriesSpec[] {
    const data = this.cache(`asof:${meta.id}`, () =>
      this.sliceData(generateAsOf(meta, asOf), iv),
    ) as Point[];
    this.setMarker(data.length ? data[data.length - 1].time : asOf, 'AS OF');
    const last = data[data.length - 1];
    const area = type === 'area';
    const options = area
      ? {
          lineColor: meta.color,
          lineWidth: 2,
          topColor: hexA(meta.color, 0.28),
          bottomColor: hexA(meta.color, 0.02),
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerBackgroundColor: meta.color,
          crosshairMarkerBorderColor: this.cssVar('--ts-bg'),
        }
      : {
          color: meta.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerBackgroundColor: meta.color,
          crosshairMarkerBorderColor: this.cssVar('--ts-bg'),
        };
    return [this.lineSpec(meta, `asof#${meta.id}#${area ? 'a' : 'l'}`, area ? 'Area' : 'Line', options, data, last)];
  }

  private lineSpec(
    meta: ChartedSeries,
    key: string,
    type: SeriesType,
    options: Record<string, unknown>,
    data: Point[],
    lastPoint?: Point,
  ): SeriesSpec {
    const last = lastPoint ?? data[data.length - 1];
    return {
      key,
      legendId: meta.id,
      type,
      options,
      data,
      color: meta.color,
      last: last?.value ?? 0,
      prev: data[data.length - 2]?.value ?? last?.value ?? 0,
      track: true,
    };
  }

  private setMarker(time: string | null, label = 'TODAY'): void {
    if (time === null) {
      this.markerX.set(null);
    } else {
      this.markerTime = time;
      this.markerLabel.set(label);
    }
  }

  // --- live values + overlays ------------------------------------------------
  private onCrosshair(param: { time?: Time; seriesData: Map<unknown, unknown> }): void {
    if (!param.time) {
      this.hoverVals.set({});
      this.hoverDate.set(null);
      this.hoverOhlc.set(null);
      if (this.pointerInside) this.interaction.clear(this.paneId());
      return;
    }
    const next: Record<string, number | null> = {};
    let ohlc: OhlcHover | null = null;
    for (const a of this.active) {
      if (!a.track) continue;
      const md = param.seriesData.get(a.api) as
        | { value?: number; open?: number; high?: number; low?: number; close?: number }
        | undefined;
      const v = md?.value ?? md?.close ?? null;
      if (v != null) next[a.legendId] = v;
      if (a.kind === 'Candlestick' && md?.open != null) {
        ohlc = { o: md.open, h: md.high!, l: md.low!, c: md.close! };
      }
    }
    this.hoverOhlc.set(ohlc);
    this.hoverVals.set(next);
    this.hoverDate.set(String(param.time));
    // Only the pane physically under the pointer broadcasts (loop-proof).
    if (this.pointerInside) {
      const vals: Record<string, number> = {};
      for (const [id, v] of Object.entries(next)) if (v != null) vals[id] = v;
      this.interaction.publish({ paneId: this.paneId(), time: String(param.time), vals });
    }
  }

  // --- pointer interactions: measure (Shift+drag), dblclick fit --------------
  onPointerLeave(): void {
    this.pointerInside = false;
    this.interaction.clear(this.paneId());
  }

  /** Snap x to the nearest bar center (round-trip through the time scale). */
  private snapX(x: number): number {
    const ts = this.chart?.timeScale();
    if (!ts) return x;
    const t = ts.coordinateToTime(x);
    if (t == null) return x;
    const sx = ts.timeToCoordinate(t);
    return sx == null ? x : sx;
  }

  onPointerDown(e: PointerEvent): void {
    if (e.shiftKey && this.chart) {
      const r = this.host().nativeElement.getBoundingClientRect();
      this.measureHostW = r.width;
      const x = this.snapX(e.clientX - r.left);
      const y = e.clientY - r.top;
      this.measure.set({ x1: x, y1: y, x2: x, y2: y });
      this.measuring = true;
      // Freeze pan/zoom while measuring so the drag draws instead of scrolling.
      this.chart.applyOptions({ handleScroll: false, handleScale: false });
      e.preventDefault();
    } else if (this.measure()) {
      this.measure.set(null); // plain click dismisses a finished measurement
    }
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.measuring) return;
    const r = this.host().nativeElement.getBoundingClientRect();
    this.measure.update((m) =>
      m ? { ...m, x2: this.snapX(e.clientX - r.left), y2: e.clientY - r.top } : m,
    );
  }

  onPointerUp(): void {
    if (!this.measuring) return;
    this.measuring = false;
    this.chart?.applyOptions({ handleScroll: true, handleScale: true });
    // Discard accidental zero-size measurements.
    const m = this.measure();
    if (m && Math.abs(m.x2 - m.x1) < 3 && Math.abs(m.y2 - m.y1) < 3) this.measure.set(null);
  }

  onDblClick(): void {
    if (this.measure()) return;
    this.fitAll();
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.measure()) {
      this.measuring = false;
      this.chart?.applyOptions({ handleScroll: true, handleScale: true });
      this.measure.set(null);
    }
  }

  private updateOverlays(): void {
    const chart = this.chart;
    if (!chart) return;
    const mode = this.mode();
    if (mode === 'seasonal' || mode === 'forward' || mode === 'strip') {
      this.markerX.set(null);
    } else {
      const x = chart.timeScale().timeToCoordinate(this.markerTime as Time);
      this.markerX.set(x === null ? null : Math.round(x));
    }
    const tags: ValueTag[] = [];
    for (const a of this.active) {
      if (!a.track) continue;
      const y = a.api.priceToCoordinate(a.last);
      if (y !== null) tags.push({ y: Math.round(y), value: a.last, color: a.color });
    }
    // De-overlap: sweep down enforcing a 16px gap, then clamp to the host so
    // near-equal last values (spread trades!) stay individually legible.
    tags.sort((a, b) => a.y - b.y);
    for (let i = 1; i < tags.length; i++) {
      if (tags[i].y - tags[i - 1].y < 16) tags[i].y = tags[i - 1].y + 16;
    }
    const hostH = this.host().nativeElement.clientHeight;
    for (let i = tags.length - 1; i >= 0; i--) {
      const maxY = hostH - 34 - (tags.length - 1 - i) * 16;
      if (tags[i].y > maxY) tags[i].y = maxY;
    }
    this.valueTags.set(tags);
  }

  private applyTheme(): void {
    const chart = this.chart;
    if (!chart) return;
    chart.applyOptions({
      layout: {
        textColor: this.cssVar('--ts-text-muted'),
        fontFamily: this.cssVar('--ts-font-mono') || 'monospace',
      },
      grid: {
        vertLines: { color: this.cssVar('--ts-grid-weak') },
        horzLines: { color: this.cssVar('--ts-grid-strong') },
      },
      rightPriceScale: { borderColor: this.cssVar('--ts-border') },
      timeScale: { borderColor: this.cssVar('--ts-border') },
      crosshair: {
        vertLine: {
          color: this.cssVar('--ts-text-muted'),
          labelBackgroundColor: this.cssVar('--ts-bg-active'),
        },
        horzLine: {
          color: this.cssVar('--ts-text-muted'),
          labelBackgroundColor: this.cssVar('--ts-bg-active'),
        },
      },
    });
    this.render(true); // recreate series so gradients/up-down recolor cleanly
  }
}

// --- helpers -----------------------------------------------------------------
/** Group a daily line by calendar year, remapped onto a base year (Jan–Dec). */
function seasonalByYear(line: Point[]): { year: number; data: Point[] }[] {
  const byYear = new Map<number, Point[]>();
  for (const p of line) {
    const y = +p.time.slice(0, 4);
    const arr = byYear.get(y) ?? [];
    arr.push({ time: `2000${p.time.slice(4)}`, value: p.value });
    byYear.set(y, arr);
  }
  return [...byYear.keys()]
    .sort((a, b) => a - b)
    .map((year) => ({ year, data: dedupeByTime(byYear.get(year)!) }));
}

/** Collapse duplicate times (Feb 29 remap etc.) keeping the last value. */
function dedupeByTime(data: Point[]): Point[] {
  const m = new Map<string, number>();
  for (const p of data) m.set(p.time, p.value);
  return [...m.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([time, value]) => ({ time, value }));
}

/** Persisted legend collapse preference. */
function readLegendCollapsed(): boolean {
  try {
    return localStorage.getItem('tschart.legend') === '1';
  } catch {
    return false;
  }
}

/** Hex (#rrggbb) + alpha -> rgba() string. Passthrough for non-hex. */
function hexA(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.min(alpha, 1)})`;
}
