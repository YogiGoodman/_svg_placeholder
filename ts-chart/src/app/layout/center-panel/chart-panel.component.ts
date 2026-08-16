import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SelectionService, ASOF_MIN } from '../../core/selection.service';
import { ChartInteractionService } from '../../core/chart-interaction.service';
import { FullscreenService } from '../../core/fullscreen.service';
import { ScreenshotService } from '../../core/screenshot.service';
import {
  computeStats,
  DATA_MIN,
  generateLine,
  generateOhlc,
  IntervalKey,
  sliceInterval,
  sliceRange,
  TODAY,
} from '../../data/series-generator';
import { ChartLayout, ChartMode, ChartType } from '../../data/models';
import { MODE_META, TYPE_META, typeSupported, unsupportedReason } from '../../core/modes';
import { formatDate, formatPct, formatSigned, formatValue } from '../../core/format';
import { TooltipDirective } from '../../core/tooltip.directive';
import { ChartViewComponent } from './chart-view.component';
import { DataTableComponent } from './data-table.component';
import { EmptyStateComponent, EmptyKind } from './empty-state.component';

const INTERVALS: IntervalKey[] = ['1M', '3M', '6M', '1Y', 'ALL'];
const LAYOUTS: { id: ChartLayout; label: string; icon: string }[] = [
  { id: 'single', label: 'Single', icon: 'square' },
  { id: 'overlay', label: 'Overlay', icon: 'layers' },
  { id: 'split', label: 'Split', icon: 'columns-3' },
];

@Component({
  selector: 'app-chart-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    TooltipDirective,
    ChartViewComponent,
    DataTableComponent,
    EmptyStateComponent,
  ],
  template: `
    <section #card class="card" [class.is-fs]="fs.active()">
      <!-- Chart toolbar — row 1: data scope (mode + as-of + range) -->
      <header class="bar">
        <div class="bar__row">
          <!-- View mode (what data) -->
          <div class="ts-segmented" [class.dim]="!ready()">
            @for (m of modes; track m.id) {
              <button
                [class.is-active]="sel.chartMode() === m.id"
                [disabled]="!ready() || !allowed().includes(m.id)"
                [tsTooltip]="modeTip(m.id)"
                (click)="sel.setChartMode(m.id)"
              >
                {{ m.label }}
              </button>
            }
          </div>

          <!-- As-of date (point-in-time modes) -->
          @if (showAsOf() && ready()) {
            <label class="asof" tsTooltip="Snapshot date — the market as known on this day">
              <lucide-icon name="calendar" [size]="13" />
              <input
                type="date"
                [min]="asofMin"
                [max]="today"
                [value]="sel.asOf()"
                (change)="onAsOf($event)"
              />
            </label>
          }

          <div class="sep"></div>

          <!-- Interval (shared date range) -->
          <div class="ts-segmented" [class.dim]="!ready() || !intervalApplies()">
            @for (iv of intervals; track iv) {
              <button
                [class.is-active]="sel.interval() === iv && !sel.customRange()"
                [disabled]="!ready() || !intervalApplies()"
                (click)="sel.setInterval(iv)"
              >
                {{ iv }}
              </button>
            }
          </div>

          <!-- Custom from–to window -->
          <div class="dd">
            <button
              class="ts-icon-btn dd__btn"
              [class.is-active]="rangeOpen() || !!sel.customRange()"
              [disabled]="!ready() || !intervalApplies()"
              (click)="rangeOpen.set(!rangeOpen()); typeOpen.set(false); compareOpen.set(false)"
              tsTooltip="Custom date range"
            >
              <lucide-icon name="calendar-range" [size]="15" />
            </button>
            @if (rangeOpen()) {
              <div class="dd__backdrop" (click)="rangeOpen.set(false)"></div>
              <div class="dd__pop dd__pop--range">
                <label class="range__field">
                  <span>From</span>
                  <input
                    type="date"
                    #rFrom
                    [min]="dataMin"
                    [max]="today"
                    [value]="sel.customRange()?.from ?? ''"
                  />
                </label>
                <label class="range__field">
                  <span>To</span>
                  <input
                    type="date"
                    #rTo
                    [min]="dataMin"
                    [max]="today"
                    [value]="sel.customRange()?.to ?? today"
                  />
                </label>
                <div class="range__row">
                  <button class="ts-btn" (click)="applyRange(rFrom.value, rTo.value)">Apply</button>
                  @if (sel.customRange()) {
                    <button class="ts-btn" (click)="sel.clearCustomRange(); rangeOpen.set(false)">
                      Clear
                    </button>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Provenance: the habit of saying where numbers come from -->
          @if (primary(); as p) {
            <span class="prov ts-mono">{{ p.source }} · as of {{ fmtD(today) }}</span>
          }
        </div>

        <!-- Row 2: primary-series stats strip + right-aligned actions -->
        <div class="bar__row">
          @if (strip(); as st) {
            <div class="strip ts-mono">
              <span class="strip__sym" [style.color]="st.color">{{ st.sym }}</span>
              <span class="strip__val">
                {{ fmtV(st.last) }}
                <span class="strip__unit">{{ st.unit }}</span>
              </span>
              @if (st.hoverDate) {
                <span class="strip__date">@ {{ fmtD(st.hoverDate) }}</span>
              }
              <span
                class="strip__chg"
                [class.ts-up]="st.delta >= 0"
                [class.ts-down]="st.delta < 0"
              >
                {{ fmtS(st.delta) }} ({{ fmtP(st.pct) }})
              </span>
              <span class="strip__range" tsTooltip="Low – high over the selected range">
                {{ fmtV(st.lo) }} – {{ fmtV(st.hi) }}
              </span>
            </div>
          }

          <div class="bar__actions">
          <!-- Chart type (line / area / candles) -->
          <div class="dd">
            <button
              class="ts-icon-btn dd__btn"
              [class.is-active]="typeOpen()"
              (click)="typeOpen.set(!typeOpen()); compareOpen.set(false)"
              [disabled]="!ready()"
              [tsTooltip]="'Chart type: ' + typeLabel()"
            >
            <lucide-icon [name]="typeIcon()" [size]="16" />
            <lucide-icon class="caret" name="chevron-down" [size]="12" />
          </button>
          @if (typeOpen()) {
            <div class="dd__backdrop" (click)="typeOpen.set(false)"></div>
            <div class="dd__pop">
              @for (t of types; track t.id) {
                <button
                  class="dd__row"
                  [class.on]="sel.chartType() === t.id"
                  [disabled]="!typeOk(t.id)"
                  [tsTooltip]="typeTip(t.id, t.hint)"
                  (click)="sel.setChartType(t.id); typeOpen.set(false)"
                >
                  <lucide-icon [name]="t.icon" [size]="15" />
                  {{ t.label }}
                  @if (sel.chartType() === t.id) {
                    <lucide-icon class="tick" name="check" [size]="14" />
                  }
                </button>
              }
            </div>
          }
        </div>

        <!-- Compare (2+ series): overlay or split panes -->
        @if (sel.canCompare()) {
          <div class="dd">
            <button
              class="ts-btn dd__btn dd__btn--wide"
              [class.is-active]="compareOpen() || sel.layout() !== 'overlay'"
              (click)="compareOpen.set(!compareOpen()); typeOpen.set(false)"
              tsTooltip="Compare — overlay or side-by-side (up to 3)"
            >
              <lucide-icon name="layers" [size]="14" />
              <span>Compare</span>
              <lucide-icon class="caret" name="chevron-down" [size]="12" />
            </button>
            @if (compareOpen()) {
                <div class="dd__backdrop" (click)="compareOpen.set(false)"></div>
                <div class="dd__pop dd__pop--wide">
                  <div class="cmp__sec">
                    <span class="cmp__label">Layout</span>
                    <div class="ts-segmented">
                      @for (l of layouts; track l.id) {
                        <button
                          [class.is-active]="sel.layout() === l.id"
                          (click)="sel.setLayout(l.id)"
                          [tsTooltip]="l.label"
                        >
                          <lucide-icon [name]="l.icon" [size]="13" /> {{ l.label }}
                        </button>
                      }
                    </div>
                  </div>
                  @if (sel.layout() === 'split') {
                    <div class="cmp__sec">
                      <span class="cmp__label">Split panes (max {{ sel.maxSplit }})</span>
                      <div class="cmp__list">
                        @for (s of sel.visible(); track s.id) {
                          <button
                            class="cmp__row"
                            [class.on]="sel.isComparing(s.id)"
                            [disabled]="lockedFromCompare(s.id)"
                            (click)="sel.toggleCompare(s.id)"
                          >
                            <span class="cmp__dot" [style.background]="s.color"></span>
                            <span class="cmp__name ts-truncate" [tsTooltip]="s.name">{{ s.symbol }}</span>
                            @if (sel.isComparing(s.id)) {
                              <lucide-icon name="check" [size]="13" />
                            }
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }

          <!-- Chart / Data toggle -->
          <div class="ts-segmented" [class.dim]="!ready()">
            <button
              [class.is-active]="sel.view() === 'chart'"
              [disabled]="!ready()"
              (click)="sel.setView('chart')"
              tsTooltip="Chart"
            >
              <lucide-icon name="chart-line" [size]="14" /> Chart
            </button>
            <button
              [class.is-active]="sel.view() === 'data'"
              [disabled]="!ready()"
              (click)="sel.setView('data')"
              tsTooltip="Data table"
            >
              <lucide-icon name="table" [size]="14" /> Data
            </button>
          </div>

          <div class="sep"></div>

          <button class="ts-icon-btn" [disabled]="!ready()" (click)="capture()" tsTooltip="Screenshot">
            <lucide-icon name="camera" [size]="16" />
          </button>
          <button
            class="ts-icon-btn"
            [class.is-active]="fs.active()"
            (click)="toggleFs()"
            [tsTooltip]="fs.active() ? 'Exit full screen (Esc)' : 'Full screen'"
          >
          <lucide-icon [name]="fs.active() ? 'minimize' : 'maximize'" [size]="16" />
          </button>
          </div>
        </div>
      </header>

      <!-- Body -->
      <div class="body">
        @if (loading()) {
          <div class="skeleton">
            <div class="ts-skeleton sk-legend"></div>
            <div class="ts-skeleton sk-chart"></div>
          </div>
        } @else if (errorKind()) {
          <app-empty-state [kind]="errorKind()!" (action)="onErrorAction()" />
        } @else if (primary()) {
          <!-- Both views stay mounted; toggling preserves zoom / scroll state -->
          <div class="view" [hidden]="sel.view() !== 'chart'">
            @if (isSplit()) {
              <div class="split">
                @for (pane of panes(); track pane[0].id; let i = $index) {
                  <div class="pane">
                    <app-chart-view
                      [series]="pane"
                      [paneId]="i"
                      [interval]="sel.interval()"
                      [range]="sel.customRange()"
                      [mode]="sel.chartMode()"
                      [type]="sel.chartType()"
                      [asOf]="sel.asOf()"
                    />
                  </div>
                }
              </div>
            } @else {
              <app-chart-view
                [series]="overlaySeries()"
                [interval]="sel.interval()"
                [range]="sel.customRange()"
                [mode]="sel.chartMode()"
                [type]="sel.chartType()"
                [asOf]="sel.asOf()"
              />
            }
          </div>
          <div class="view" [hidden]="sel.view() !== 'data'">
            <app-data-table
              [series]="sel.visible()"
              [interval]="sel.interval()"
              [range]="sel.customRange()"
              [mode]="sel.chartMode()"
              [asOf]="sel.asOf()"
            />
          </div>
        } @else {
          <app-empty-state kind="welcome" />
        }

        <div class="flash" [class.on]="flashOn()"></div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
        padding: var(--ts-space-3);
      }
      .card {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        background: var(--ts-bg-elevated);
        border: 1px solid var(--ts-border);
        border-radius: var(--ts-radius-lg);
        overflow: hidden;
      }
      .card.is-fs {
        border-radius: 0;
        border: none;
      }
      .bar {
        display: flex;
        flex-direction: column;
        gap: var(--ts-space-1);
        padding: var(--ts-space-2) var(--ts-space-3);
        border-bottom: 1px solid var(--ts-border);
        flex: none;
      }
      .bar__row {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        flex-wrap: wrap;
        min-height: 34px;
      }
      .bar .ts-segmented {
        height: 30px;
        align-items: center;
      }
      /* Row 2 must NEVER reflow while live values tick — no wrapping; the
         strip truncates and every numeric slot has a reserved width. */
      .bar__row:last-child {
        flex-wrap: nowrap;
      }
      .bar__actions {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        flex: none;
        margin-left: auto;
      }
      /* Bloomberg-style primary-series stats strip */
      .strip {
        display: flex;
        align-items: baseline;
        gap: var(--ts-space-3);
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        font-size: var(--ts-fs-sm);
        white-space: nowrap;
      }
      .strip__sym {
        font-weight: var(--ts-fw-bold);
        flex: none;
      }
      .strip__val {
        color: var(--ts-text-bright);
        font-variant-numeric: tabular-nums;
        min-width: 10ch;
        flex: none;
      }
      .strip__unit {
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-muted);
      }
      .strip__chg {
        font-size: var(--ts-fs-xs);
        font-variant-numeric: tabular-nums;
        min-width: 13ch;
        flex: none;
      }
      .strip__range {
        font-size: var(--ts-fs-xs);
        color: var(--ts-text-muted);
        font-variant-numeric: tabular-nums;
        min-width: 14ch;
      }
      .strip__date {
        font-size: var(--ts-fs-xs);
        color: var(--ts-highlight);
        font-variant-numeric: tabular-nums;
      }
      @media (max-width: 767px) {
        .strip {
          display: none;
        }
      }
      .sep {
        width: 1px;
        height: 20px;
        background: var(--ts-border);
      }
      .dim {
        opacity: 0.5;
        pointer-events: none;
      }
      /* dropdown (type + layout) */
      .dd {
        position: relative;
      }
      .dd__btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        width: auto;
        padding: 0 var(--ts-space-2);
      }
      .dd__btn--wide {
        height: 30px;
      }
      .dd__btn .caret {
        color: var(--ts-text-muted);
      }
      .dd__backdrop {
        position: fixed;
        inset: 0;
        z-index: 40;
      }
      .dd__pop {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 41;
        min-width: 140px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: var(--ts-space-1);
        background: var(--ts-bg-elevated);
        border: 1px solid var(--ts-border);
        border-radius: var(--ts-radius-md);
        box-shadow: var(--ts-shadow-3);
      }
      .dd__pop--wide {
        min-width: 240px;
        gap: var(--ts-space-3);
        padding: var(--ts-space-3);
      }
      .dd__row {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        padding: var(--ts-space-1) var(--ts-space-2);
        border-radius: var(--ts-radius-sm);
        color: var(--ts-text-secondary);
        font-size: var(--ts-fs-sm);
        cursor: pointer;
      }
      .dd__row:hover {
        background: var(--ts-bg-hover);
        color: var(--ts-text-bright);
      }
      .dd__row.on {
        color: var(--ts-text-bright);
      }
      .dd__row:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .dd__row .tick,
      .cmp__row lucide-icon {
        margin-left: auto;
        color: var(--ts-accent);
      }
      /* as-of date */
      .asof {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 30px;
        padding: 0 var(--ts-space-2);
        border: 1px solid var(--ts-border);
        border-radius: var(--ts-radius-sm);
        color: var(--ts-text-muted);
        background: var(--ts-bg-inset);
      }
      .dd__pop--range {
        left: 0;
        right: auto;
        min-width: 220px;
        gap: var(--ts-space-2);
        padding: var(--ts-space-3);
      }
      .range__field {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ts-space-2);
        font-size: var(--ts-fs-xs);
        color: var(--ts-text-muted);
      }
      .range__field input {
        border: 1px solid var(--ts-border);
        border-radius: var(--ts-radius-sm);
        background: var(--ts-bg-inset);
        color: var(--ts-text-bright);
        font-family: var(--ts-font-mono);
        font-size: var(--ts-fs-xs);
        padding: 3px var(--ts-space-2);
        color-scheme: dark light;
      }
      .range__field input:focus-within {
        border-color: var(--ts-accent);
      }
      .range__row {
        display: flex;
        gap: var(--ts-space-2);
        justify-content: flex-end;
      }
      .prov {
        margin-left: auto;
        font-size: var(--ts-fs-xs);
        color: var(--ts-text-muted);
        white-space: nowrap;
      }
      @media (max-width: 899px) {
        .prov {
          display: none;
        }
      }
      /* Fullscreen: same controls, tighter chrome — every pixel is chart. */
      .card.is-fs .bar {
        padding-block: var(--ts-space-1);
      }
      .card.is-fs .bar__row {
        min-height: 28px;
      }
      .asof:focus-within {
        border-color: var(--ts-accent);
        box-shadow: 0 0 0 3px var(--ts-accent-weak);
      }
      .asof input {
        border: none;
        background: transparent;
        color: var(--ts-text-bright);
        font-family: var(--ts-font-mono);
        font-size: var(--ts-fs-xs);
        color-scheme: dark light;
        outline: none;
      }
      /* compare popover sections */
      .cmp__sec {
        display: flex;
        flex-direction: column;
        gap: var(--ts-space-2);
      }
      .cmp__label {
        font-size: var(--ts-fs-xxs);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--ts-text-muted);
      }
      .cmp__list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 220px;
        overflow: auto;
      }
      .cmp__row {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        padding: var(--ts-space-1) var(--ts-space-2);
        border-radius: var(--ts-radius-sm);
        color: var(--ts-text-secondary);
        cursor: pointer;
      }
      .cmp__row:hover {
        background: var(--ts-bg-hover);
      }
      .cmp__row.on {
        color: var(--ts-text-bright);
        background: var(--ts-bg-active);
      }
      .cmp__row:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .cmp__dot {
        width: 8px;
        height: 8px;
        border-radius: 2px;
        flex: none;
      }
      .cmp__name {
        font-size: var(--ts-fs-xs);
      }
      .body {
        position: relative;
        flex: 1;
        min-height: 0;
      }
      .view {
        position: absolute;
        inset: 0;
      }
      .view[hidden] {
        display: none;
      }
      .split {
        display: flex;
        height: 100%;
        min-height: 0;
      }
      .pane {
        flex: 1;
        min-width: 0;
        position: relative;
        border-right: 1px solid var(--ts-border);
      }
      .pane:last-child {
        border-right: none;
      }
      .skeleton {
        position: absolute;
        inset: var(--ts-space-4);
        display: flex;
        flex-direction: column;
        gap: var(--ts-space-4);
      }
      .sk-legend {
        width: 200px;
        height: 54px;
      }
      .sk-chart {
        flex: 1;
      }
      .flash {
        position: absolute;
        inset: 0;
        background: #fff;
        opacity: 0;
        pointer-events: none;
      }
      .flash.on {
        animation: flash 320ms var(--ts-ease);
      }
      @keyframes flash {
        0% {
          opacity: 0;
        }
        12% {
          opacity: 0.55;
        }
        100% {
          opacity: 0;
        }
      }
      @media (max-width: 767px) {
        :host {
          padding: var(--ts-space-2);
        }
        .split {
          flex-direction: column;
        }
        .pane {
          border-right: none;
          border-bottom: 1px solid var(--ts-border);
        }
      }
    `,
  ],
})
export class ChartPanelComponent {
  readonly sel = inject(SelectionService);
  readonly fs = inject(FullscreenService);
  private readonly shot = inject(ScreenshotService);
  private readonly interaction = inject(ChartInteractionService);

  private readonly card = viewChild.required<ElementRef<HTMLElement>>('card');

  readonly intervals = INTERVALS;
  readonly modes = MODE_META;
  readonly types = TYPE_META;
  readonly layouts = LAYOUTS;
  readonly asofMin = ASOF_MIN;
  readonly today = TODAY;
  readonly loading = signal(false);
  readonly compareOpen = signal(false);
  readonly typeOpen = signal(false);
  readonly rangeOpen = signal(false);
  readonly dataMin = DATA_MIN;

  readonly primary = this.sel.primary;
  readonly allowed = this.sel.allowedModes;

  readonly isSplit = computed(
    () => this.sel.layout() === 'split' && this.sel.compareSet().length > 1,
  );
  readonly panes = computed(() => this.sel.compareSet().map((s) => [s]));
  /**
   * Overlay gets ALL selected series (visible + hidden): chart-view dims hidden
   * legend rows and skips drawing them — passing only `visible()` here made the
   * eye toggle look like a delete (the row vanished with the series).
   */
  readonly overlaySeries = computed(() =>
    this.sel.layout() === 'single' ? this.sel.visible().slice(0, 1) : this.sel.selected(),
  );

  readonly typeIcon = computed(
    () => TYPE_META.find((t) => t.id === this.sel.chartType())?.icon ?? 'chart-line',
  );
  readonly typeLabel = computed(
    () => TYPE_META.find((t) => t.id === this.sel.chartType())?.label ?? 'Line',
  );

  /**
   * Row-2 stats strip for the primary charted series (last · Δ1d · range).
   * Time-axis modes only — curve modes have no meaningful "last vs previous".
   */
  readonly strip = computed(() => {
    // First healthy visible series — broken ones never drive the strip.
    const s = this.sel.visible().find((x) => !x.status || x.status === 'ok') ?? null;
    const m = this.sel.chartMode();
    if (!s || !this.ready() || (m !== 'latest' && m !== 'asof')) return null;
    const line =
      s.chartKind === 'candlestick'
        ? generateOhlc(s).map((p) => ({ time: p.time, value: p.close }))
        : generateLine(s);
    const cr = this.sel.customRange();
    const pts = cr ? sliceRange(line, cr.from, cr.to) : sliceInterval(line, this.sel.interval());
    if (!pts.length) return null;
    const st = computeStats(pts);
    // Crosshair-tracked: while hovering any pane, show the hovered value+date.
    const hover = this.interaction.hover();
    const hv = hover?.time != null ? hover.vals[s.id] : undefined;
    return {
      sym: s.symbol,
      color: s.color,
      unit: s.unit,
      last: hv ?? st.last,
      hoverDate: hv !== undefined ? hover!.time : null,
      delta: st.changeAbs,
      pct: st.changePct,
      lo: st.min,
      hi: st.max,
    };
  });
  readonly showAsOf = computed(() => {
    const m = this.sel.chartMode();
    return m === 'asof' || m === 'forward';
  });
  readonly intervalApplies = computed(() => {
    const m = this.sel.chartMode();
    return m === 'latest' || m === 'asof';
  });

  /**
   * Full-panel error ONLY when every selected series is broken — a single
   * restricted/missing series must never blank a chart that has healthy ones
   * (those render; broken rows dim in the legend instead).
   */
  readonly errorKind = computed<EmptyKind | null>(() => {
    const list = this.sel.selected();
    if (!list.length) return null;
    if (list.some((s) => !s.status || s.status === 'ok')) return null;
    return list[0].status === 'forbidden' ? 'forbidden' : 'missing';
  });

  readonly ready = computed(() => !!this.primary() && !this.loading() && !this.errorKind());
  readonly flashOn = computed(() => this.shot.flash() > 0);

  fmtV = (v: number) => formatValue(v);
  fmtS = (v: number) => formatSigned(v);
  fmtP = (v: number) => formatPct(v);
  fmtD = (t: string) => formatDate(t);

  typeOk(t: ChartType): boolean {
    return typeSupported(t, this.primary(), this.sel.chartMode(), this.sel.visible().length);
  }

  typeTip(t: ChartType, hint: string): string {
    if (this.typeOk(t)) return hint;
    return t === 'area'
      ? 'Area needs a single series — overlapping fills reduce readability'
      : 'Candles need one OHLC series on Latest/As-of';
  }

  modeTip(id: string): string {
    const meta = MODE_META.find((m) => m.id === id);
    const reason = unsupportedReason(this.sel.visible(), id as never);
    if (!reason) return meta?.hint ?? '';
    // Mode still enabled (union gating): warn which series will be dimmed.
    if (this.allowed().includes(id as ChartMode)) {
      return `${reason.replace('Not available', 'Not shown')} in this mode`;
    }
    return `${meta?.label}: ${reason}`;
  }

  lockedFromCompare(id: string): boolean {
    const set = this.sel.compareSet();
    const on = this.sel.isComparing(id);
    if (on) return set.length <= 1;
    return set.length >= this.sel.maxSplit;
  }

  onAsOf(e: Event): void {
    this.sel.setAsOf((e.target as HTMLInputElement).value);
  }

  applyRange(from: string, to: string): void {
    if (!from || !to) return;
    this.sel.setCustomRange(from, to);
    this.rangeOpen.set(false);
  }

  toggleFs(): void {
    this.fs.toggle(this.card().nativeElement);
  }

  async capture(): Promise<void> {
    const s = this.primary();
    await this.shot.capture(this.card().nativeElement, s ? `tschart-${s.id}` : 'tschart');
  }

  onErrorAction(): void {
    if (this.errorKind() === 'missing') {
      this.loading.set(true);
      setTimeout(() => this.loading.set(false), 380);
    } else {
      const p = this.sel.primaryId();
      if (p) this.sel.remove(p);
    }
  }
}
