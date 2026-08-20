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
import { sanitizePoints } from '../../data/sanitize';
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
import { LayoutService } from '../../core/layout.service';
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
  /** Series symbol — the authoritative identifier at high series counts. */
  label: string;
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
      (pointercancel)="onPointerUp()"
      (lostpointercapture)="onPointerUp()"
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
              <button
                class="lrow__label ts-truncate"
                (click)="openInspector()"
                tsTooltip="Series details"
              >
                {{ row.label }}
              </button>
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

      <!-- Right-edge per-series identity labels (symbol + value) — the
           authoritative way to tell many lines apart; solid lines don't scale
           on hue alone past the palette core. -->
      @for (tag of valueTags(); track $index) {
        <div class="lastval ts-mono" [style.top.px]="tag.y" [style.background]="tag.color">
          <span class="lastval__sym">{{ tag.label }}</span>
          <span class="lastval__val">{{ fmt(tag.value) }}</span>
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

      <!-- Crosshair-following tooltip (toggleable, off by default) -->
      @if (sel.hoverCard() && cursorPt(); as pt) {
        @if (hoverDate(); as hd) {
          <div class="hcard" [style.left.px]="hcardX()" [style.top.px]="hcardY()">
            <div class="hcard__date ts-mono">{{ hd }}</div>
            @for (row of cardRows(); track row.id) {
              <div class="hcard__row">
                <span class="hcard__dot" [style.background]="row.color"></span>
                <span class="hcard__sym ts-mono">{{ row.label }}</span>
                <span class="hcard__val ts-mono">{{ fmt(row.value) }}</span>
                <span class="hcard__unit">{{ row.unit }}</span>
              </div>
            }
          </div>
        }
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
        /* Every overlay in here (measure rect + label, right-edge value tags,
           today marker) is absolutely positioned against this box. In a split
           layout the panes are flex siblings separated only by a border, so
           without clipping those overlays paint straight over the neighbouring
           chart. Clip at the pane edge. */
        overflow: hidden;
      }
      .chart {
        position: absolute;
        inset: 0;
      }
      /* ONE fully-opaque container — never translucent, never bare text over
         lines. One border for the whole legend beats a border per row. */
      .legend {
        position: absolute;
        top: var(--ts-space-3);
        left: var(--ts-space-3);
        z-index: 5;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1px;
        padding: var(--ts-space-1);
        border-radius: var(--ts-radius-md);
        background: var(--ts-bg-elevated);
        border: 1px solid var(--ts-border-subtle);
        box-shadow: var(--ts-shadow-1);
        max-width: 320px;
        pointer-events: auto;
      }
      .legend__toggle {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 20px;
        padding: 0 var(--ts-space-2);
        border-radius: var(--ts-radius-xs);
        color: var(--ts-text-muted);
        cursor: pointer;
        flex: none;
      }
      .legend__toggle:hover {
        background: var(--ts-bg-hover);
        color: var(--ts-text-bright);
      }
      .legend__count {
        font-size: var(--ts-fs-xxs);
        font-variant-numeric: tabular-nums;
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
        padding: 2px 6px;
        border-radius: var(--ts-radius-xs);
      }
      .lrow:hover {
        background: var(--ts-bg-hover);
      }
      .lrow.is-hidden {
        opacity: 0.45;
      }
      .lrow--more {
        justify-content: flex-start;
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
        cursor: pointer;
      }
      .lrow__label:hover {
        color: var(--ts-text-bright);
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
      .hcard {
        position: absolute;
        z-index: 6;
        min-width: 150px;
        max-width: 240px;
        padding: var(--ts-space-2);
        border-radius: var(--ts-radius-md);
        background: var(--ts-bg-elevated);
        border: 1px solid var(--ts-border);
        box-shadow: var(--ts-shadow-2);
        pointer-events: none;
      }
      .hcard__date {
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-muted);
        margin-bottom: var(--ts-space-1);
      }
      .hcard__row {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        height: 18px;
      }
      .hcard__dot {
        width: 7px;
        height: 7px;
        border-radius: 2px;
        flex: none;
      }
      .hcard__sym {
        font-size: var(--ts-fs-xs);
        color: var(--ts-text-secondary);
        min-width: 44px;
      }
      .hcard__val {
        margin-left: auto;
        font-size: var(--ts-fs-xs);
        color: var(--ts-text-bright);
        font-variant-numeric: tabular-nums;
      }
      .hcard__unit {
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-muted);
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
        display: inline-flex;
        align-items: baseline;
        gap: var(--ts-space-1);
        max-width: 40%;
        transform: translateY(-50%);
        padding: 1px var(--ts-space-2);
        border-radius: var(--ts-radius-xs);
        color: var(--ts-accent-contrast);
        font-size: var(--ts-fs-xxs);
        font-weight: var(--ts-fw-bold);
        box-shadow: var(--ts-shadow-1);
        pointer-events: none;
      }
      .lastval__sym {
        font-weight: var(--ts-fw-bold);
        opacity: 0.85;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .lastval__val {
        font-variant-numeric: tabular-nums;
        flex: none;
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
      /* Bottom-LEFT, raised clear of the time axis: the right edge belongs to
         the price-axis values + per-series identity labels — controls must
         never occlude them (obs: fit button hid axis text). */
      .zoom {
        position: absolute;
        left: var(--ts-space-2);
        bottom: 30px;
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
  readonly sel = inject(SelectionService);
  private readonly interaction = inject(ChartInteractionService);
  private readonly layoutSvc = inject(LayoutService);

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

  /** Cursor position for the crosshair-following tooltip (host-relative px). */
  readonly cursorPt = signal<{ x: number; y: number } | null>(null);

  readonly cardRows = computed(() =>
    this.legendRows().filter((r) => !r.hidden && !r.unsupported && !r.broken && r.value != null),
  );

  /** Card position: offset from cursor, flipped near the right/bottom edges. */
  readonly hcardX = computed(() => {
    const pt = this.cursorPt();
    if (!pt) return 0;
    const w = this.host().nativeElement.clientWidth;
    return pt.x + 190 > w ? Math.max(4, pt.x - 190) : pt.x + 14;
  });
  readonly hcardY = computed(() => {
    const pt = this.cursorPt();
    if (!pt) return 0;
    const h = this.host().nativeElement.clientHeight;
    const est = 30 + this.cardRows().length * 18;
    return pt.y + 14 + est > h ? Math.max(4, pt.y - est - 10) : pt.y + 14;
  });

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
  /** Pointer id captured for the active measure drag, so it can be released. */
  private measurePointerId: number | null = null;
  /** The element holding that capture — the `.chart-host` wrapper the pointer
   *  listeners are bound to, NOT the inner `#host` chart mount. */
  private measureCaptureEl: HTMLElement | null = null;

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
    // While the crosshair is active, the readout must reflect the hovered
    // timestamp — a series with no point there shows "—", never a stale
    // carry-forward from lastVals (Bloomberg-grade: no phantom values).
    const hovering = this.hoverDate() !== null;
    return this.series().map((s) => {
      const value = hovering ? (hv[s.id] ?? null) : (this.lastVals[s.id] ?? null);
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
  /** Legend row label click → open the on-demand series inspector. */
  openInspector(): void {
    this.layoutSvc.openRight();
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
      // Wheel zoom anchors on the data point under the cursor (TradingView-style
      // ⌘/ctrl+wheel behaviour): the cursor's time stays fixed, only the range
      // around it expands/contracts. The +/− buttons zoom around centre.
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
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
      // Hygiene at the chart boundary: only clean, sorted, de-duped points
      // reach lightweight-charts (a real feed can carry null/NaN/gaps).
      const data = sanitizePoints(spec.data as readonly { time: string }[]);
      let a = existing.get(spec.key);
      if (!a) {
        const api = chart.addSeries(
          SERIES_DEF[spec.type],
          spec.options as never,
        ) as ISeriesApi<SeriesType>;
        api.setData(data as never);
        a = {
          key: spec.key,
          legendId: spec.legendId,
          api,
          kind: spec.type,
          color: spec.color,
          last: spec.last,
          track: spec.track,
          dataRef: data,
        };
        added = true;
      } else if (a.dataRef !== data) {
        a.api.setData(data as never);
        a.dataRef = data;
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
  private onCrosshair(param: {
    time?: Time;
    point?: { x: number; y: number };
    seriesData: Map<unknown, unknown>;
  }): void {
    if (!param.time) {
      this.hoverVals.set({});
      this.hoverDate.set(null);
      this.hoverOhlc.set(null);
      this.cursorPt.set(null);
      if (this.pointerInside) this.interaction.clear(this.paneId());
      return;
    }
    this.cursorPt.set(
      this.sel.hoverCard() && this.pointerInside && param.point
        ? { x: param.point.x, y: param.point.y }
        : null,
    );
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
    // A measure drag holds pointer capture, so the crosshair belongs to this
    // pane until the drag ends even if the cursor has left the pane box.
    if (this.measuring) return;
    this.interaction.clear(this.paneId());
  }

  /** Clamp a host-relative coordinate into the pane, so a drag that runs past
   *  the edge measures to the edge instead of into the neighbouring chart. */
  private clamp(v: number, max: number): number {
    return v < 0 ? 0 : v > max ? max : v;
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
      // The price scale is lightweight-charts' own drag target (axisPressedMouseMove).
      // Starting a measure there would freeze scaling for a gesture the user meant
      // for the axis, so leave that strip to the library.
      const plotW = r.width - this.chart.priceScale('right').width();
      if (e.clientX - r.left > plotW) return;

      this.measureHostW = r.width;
      const x = this.snapX(this.clamp(e.clientX - r.left, r.width));
      const y = this.clamp(e.clientY - r.top, r.height);
      this.measure.set({ x1: x, y1: y, x2: x, y2: y });
      this.measuring = true;
      // Capture the pointer so this pane still receives pointermove/up after the
      // cursor crosses into a sibling pane. Without it the drag's pointerup lands
      // on the neighbour, this pane never restores pan/zoom, and it stays dead.
      this.measurePointerId = e.pointerId;
      this.measureCaptureEl = e.currentTarget as HTMLElement | null;
      this.measureCaptureEl?.setPointerCapture?.(e.pointerId);
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
      m
        ? {
            ...m,
            x2: this.snapX(this.clamp(e.clientX - r.left, r.width)),
            y2: this.clamp(e.clientY - r.top, r.height),
          }
        : m,
    );
  }

  onPointerUp(): void {
    if (!this.measuring) return;
    this.measuring = false;
    this.releaseMeasurePointer();
    this.chart?.applyOptions({ handleScroll: true, handleScale: true });
    // Discard accidental zero-size measurements.
    const m = this.measure();
    if (m && Math.abs(m.x2 - m.x1) < 3 && Math.abs(m.y2 - m.y1) < 3) this.measure.set(null);
    if (!this.pointerInside) this.interaction.clear(this.paneId());
  }

  private releaseMeasurePointer(): void {
    const id = this.measurePointerId;
    const el = this.measureCaptureEl;
    this.measurePointerId = null;
    this.measureCaptureEl = null;
    if (id === null || !el) return;
    if (el.hasPointerCapture?.(id)) el.releasePointerCapture(id);
  }

  onDblClick(): void {
    if (this.measure()) return;
    this.fitAll();
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.measure()) {
      this.measuring = false;
      this.releaseMeasurePointer();
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
    const symOf = new Map(this.series().map((s) => [s.id, s.symbol]));
    const tags: ValueTag[] = [];
    for (const a of this.active) {
      if (!a.track) continue;
      const y = a.api.priceToCoordinate(a.last);
      if (y !== null) {
        tags.push({
          y: Math.round(y),
          value: a.last,
          color: a.color,
          label: symOf.get(a.legendId) ?? '',
        });
      }
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
