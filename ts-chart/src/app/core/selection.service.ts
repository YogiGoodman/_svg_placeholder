import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { ChartedSeries, ChartLayout, ChartMode, ChartType, SeriesMeta } from '../data/models';
import { SERIES } from '../data/series-catalog.data';
import { typeSupported, unionModes } from './modes';
import { SeriesColorService } from './series-color.service';
import { IntervalKey, TODAY } from '../data/series-generator';

const RECENT_KEY = 'tschart.recent';
const MAX_RECENT = 8;
const MAXSERIES_KEY = 'tschart.maxseries';
const DEFAULT_MAX = 8;
const MAX_SPLIT = 3;
const WORKSPACE_KEY = 'tschart.workspace';
/** Earliest selectable as-of date (prototype history is ~2 years). */
export const ASOF_MIN = '2024-09-01';

export type CenterView = 'chart' | 'data';

/** Explicit charted window (overrides the preset interval while set). */
export interface CustomRange {
  from: string;
  to: string;
}

/** Everything needed to restore the screen exactly as the user left it. */
interface WorkspaceState {
  v: 1;
  selectedIds: string[];
  hiddenIds: string[];
  compareIds: string[];
  view: CenterView;
  chartMode: ChartMode;
  chartType: ChartType;
  layout: ChartLayout;
  interval: IntervalKey;
  customRange: CustomRange | null;
  asOf: string;
  /** Crosshair-following tooltip (optional — older payloads lack it). */
  hoverCard?: boolean;
}

/**
 * Multi-series selection state, plus the center-panel view (chart vs data),
 * chart render mode, and compare layout. Series are an ordered list capped at
 * `maxSeries` (configurable from the user menu, default 8).
 */
@Injectable({ providedIn: 'root' })
export class SelectionService {
  private readonly colors = inject(SeriesColorService);
  /** Workspace snapshot restored from localStorage (silent — screen looks as left). */
  private readonly ws = this.readWorkspace();

  /** Ordered list of selected series ids (oldest first). */
  readonly selectedIds = signal<string[]>(this.ws?.selectedIds ?? []);
  /** Series toggled hidden from the chart (still in the list / info panel). */
  readonly hiddenIds = signal<string[]>(this.ws?.hiddenIds ?? []);
  /** Max series that can be selected at once. */
  readonly maxSeries = signal<number>(this.readMax());

  readonly view = signal<CenterView>(this.ws?.view ?? 'chart');
  readonly chartMode = signal<ChartMode>(this.ws?.chartMode ?? 'latest');
  /** How series are drawn (line/area/candles) — orthogonal to the view mode. */
  readonly chartType = signal<ChartType>(this.ws?.chartType ?? 'line');
  readonly layout = signal<ChartLayout>(this.ws?.layout ?? 'overlay');
  readonly recentIds = signal<string[]>(this.readRecent());

  /** Shared date-range interval — one signal drives every pane/panel. */
  readonly interval = signal<IntervalKey>(this.ws?.interval ?? '6M');
  /** Explicit from–to window; overrides the preset while set. */
  readonly customRange = signal<CustomRange | null>(this.ws?.customRange ?? null);
  /** Shared as-of date (drives `asof` + `forward` snapshots). */
  readonly asOf = signal<string>(this.ws?.asOf ?? TODAY);
  /** Crosshair-following tooltip on the chart — OFF by default. */
  readonly hoverCard = signal<boolean>(this.ws?.hoverCard ?? false);

  /**
   * Compare set: the ≤3 series actually charted. Empty → default to the first
   * `MAX_SPLIT` selected. Selection itself can hold up to `maxSeries` (8).
   */
  readonly compareIds = signal<string[]>(this.ws?.compareIds ?? []);

  /** Cap on panes in split/compare layout. */
  readonly maxSplit = MAX_SPLIT;

  /** Selected series decorated with their assigned (theme-aware) colors. */
  readonly selected = computed<ChartedSeries[]>(() => {
    const colors = this.colors.colorMap();
    return this.selectedIds()
      .map((id) => SERIES[id])
      .filter(Boolean)
      .map((meta) => ({ ...meta, color: colors.get(meta.id) ?? this.colors.color(meta.id) }));
  });

  readonly primary = computed<ChartedSeries | null>(() => this.selected()[0] ?? null);
  readonly primaryId = computed<string | null>(() => this.selectedIds()[0] ?? null);
  readonly count = computed(() => this.selectedIds().length);

  /** Selected series that are not hidden — what the chart actually draws. */
  readonly visible = computed<ChartedSeries[]>(() =>
    this.selected().filter((s) => !this.hiddenIds().includes(s.id)),
  );

  /**
   * The ≤3 series the **Split** layout shows (overlay/single ignore this).
   * Explicit `compareIds` win; otherwise the first `maxSplit` visible series.
   */
  readonly compareSet = computed<ChartedSeries[]>(() => {
    const vis = this.visible();
    const ids = this.compareIds().filter((id) => vis.some((s) => s.id === id));
    const chosen = ids.length ? ids : vis.map((s) => s.id);
    return chosen
      .map((id) => vis.find((s) => s.id === id))
      .filter((s): s is ChartedSeries => !!s)
      .slice(0, this.maxSplit);
  });

  /** Compare/split is offered once 2+ series are visible. */
  readonly canCompare = computed(() => this.visible().length >= 2);

  /**
   * Modes supported by ANY charted series (union) — incompatible series are
   * dimmed on the chart for that mode rather than blocking the mode bar.
   */
  readonly allowedModes = computed(() => unionModes(this.visible()));

  readonly recent = computed<SeriesMeta[]>(() =>
    this.recentIds()
      .map((id) => SERIES[id])
      .filter(Boolean),
  );

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }
  isHidden(id: string): boolean {
    return this.hiddenIds().includes(id);
  }

  /** Toggle a series in/out of the selection (tree + search rows use this). */
  toggle(id: string): { evicted: string | null } {
    if (!SERIES[id]) return { evicted: null };
    if (this.selectedIds().includes(id)) {
      this.remove(id);
      return { evicted: null };
    }
    return this.add(id);
  }

  /** Symbol of the series that would be evicted next at the cap. */
  readonly oldestSymbol = computed(() => {
    const id = this.selectedIds()[0];
    return id ? SERIES[id]?.symbol : undefined;
  });

  /**
   * Add a series, reporting what it displaced.
   *
   * At the cap this silently `shift()`ed the oldest, and `colors.sync()` then
   * handed the newcomer the freed slot — so a line vanished and the chart
   * appeared to recolor with nothing on screen explaining why. The eviction is
   * still the right behaviour (blocking mid-flow is worse), but callers can now
   * say what happened and offer an undo. Existing callers that ignore the
   * return value are unaffected.
   */
  add(id: string): { evicted: string | null } {
    if (!SERIES[id]) return { evicted: null };
    let evicted: string | null = null;
    this.selectedIds.update((list) => {
      if (list.includes(id)) return list;
      const next = [...list, id];
      while (next.length > this.maxSeries()) {
        const dropped = next.shift();
        if (dropped) evicted = dropped;
      }
      return next;
    });
    this.colors.sync(this.selectedIds());
    this.pushRecent(id);
    return { evicted };
  }

  /** Undo an eviction: put the dropped series back and remove what replaced it. */
  restoreEvicted(evicted: string, added: string): void {
    this.selectedIds.update((list) => [evicted, ...list.filter((x) => x !== added)]);
    this.colors.sync(this.selectedIds());
  }

  /** Replace the whole selection with a single series (deep-link / single pick). */
  select(id: string): void {
    if (!SERIES[id]) return;
    this.selectedIds.set([id]);
    this.colors.sync(this.selectedIds());
    this.hiddenIds.set([]);
    this.pushRecent(id);
  }

  constructor() {
    // Restored selection needs its color slots before first render.
    this.colors.sync(this.selectedIds());

    // Persist the workspace on every relevant change (cheap, synchronous).
    effect(() => {
      const state: WorkspaceState = {
        v: 1,
        selectedIds: this.selectedIds(),
        hiddenIds: this.hiddenIds(),
        compareIds: this.compareIds(),
        view: this.view(),
        chartMode: this.chartMode(),
        chartType: this.chartType(),
        layout: this.layout(),
        interval: this.interval(),
        customRange: this.customRange(),
        asOf: this.asOf(),
        hoverCard: this.hoverCard(),
      };
      try {
        localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state));
      } catch {
        /* ignore */
      }
    });

    // Keep the active mode valid as the charted set changes (mix & match).
    effect(() => {
      const allowed = this.allowedModes();
      if (!allowed.includes(this.chartMode())) {
        this.chartMode.set(allowed[0] ?? 'latest');
      }
    });
    // Keep the chart type valid (candles/area have per-set constraints).
    effect(() => {
      const t = this.chartType();
      if (!typeSupported(t, this.primary(), this.chartMode(), this.visible().length)) {
        this.chartType.set('line');
      }
    });
  }

  remove(id: string): void {
    this.selectedIds.update((list) => list.filter((x) => x !== id));
    this.colors.sync(this.selectedIds());
    this.hiddenIds.update((list) => list.filter((x) => x !== id));
    this.compareIds.update((list) => list.filter((x) => x !== id));
  }

  /**
   * Move a selected series to a new position. Order is meaningful in three
   * places at once: the inspector card list, the legend rows, and the chart's
   * draw order (later = on top). Reordering deliberately does NOT recolor —
   * `SeriesColorService.sync()` keys slots by id, so a series keeps its color
   * for its whole lifetime on the chart no matter where it sits in the list.
   */
  reorder(from: number, to: number): void {
    this.selectedIds.update((list) => {
      if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    this.colors.sync(this.selectedIds());
  }

  clear(): void {
    this.selectedIds.set([]);
    this.colors.sync([]);
    this.hiddenIds.set([]);
    this.compareIds.set([]);
  }

  /** Toggle a series into/out of the ≤3 compare set (must be selected). */
  toggleCompare(id: string): void {
    if (!this.selectedIds().includes(id)) return;
    this.compareIds.update((list) => {
      if (list.includes(id)) return list.filter((x) => x !== id);
      if (list.length >= this.maxSplit) return list; // capped
      return [...list, id];
    });
  }

  setCompare(ids: string[]): void {
    this.compareIds.set(ids.filter((id) => this.selectedIds().includes(id)).slice(0, this.maxSplit));
  }

  isComparing(id: string): boolean {
    return this.compareSet().some((s) => s.id === id);
  }

  setInterval(iv: IntervalKey): void {
    this.interval.set(iv);
    this.customRange.set(null); // presets and custom windows are exclusive
  }

  setCustomRange(from: string, to: string): void {
    if (!from || !to) return;
    const [a, b] = from <= to ? [from, to] : [to, from];
    this.customRange.set({ from: a, to: b });
  }

  clearCustomRange(): void {
    this.customRange.set(null);
  }

  toggleHoverCard(): void {
    this.hoverCard.update((v) => !v);
  }

  setAsOf(date: string): void {
    const clamped = date < ASOF_MIN ? ASOF_MIN : date > TODAY ? TODAY : date;
    this.asOf.set(clamped);
  }

  toggleHidden(id: string): void {
    this.hiddenIds.update((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
  }

  setMax(n: number): void {
    const clamped = Math.max(2, Math.min(12, Math.round(n)));
    this.maxSeries.set(clamped);
    try {
      localStorage.setItem(MAXSERIES_KEY, String(clamped));
    } catch {
      /* ignore */
    }
    // Trim to the most-recent `clamped` if the list is now too long.
    this.selectedIds.update((list) =>
      list.length > clamped ? list.slice(list.length - clamped) : list,
    );
    this.colors.sync(this.selectedIds());
  }

  setView(v: CenterView): void {
    this.view.set(v);
  }
  toggleView(): void {
    this.view.update((v) => (v === 'chart' ? 'data' : 'chart'));
  }
  setChartMode(m: ChartMode): void {
    this.chartMode.set(m);
  }
  setChartType(t: ChartType): void {
    this.chartType.set(t);
  }
  setLayout(l: ChartLayout): void {
    this.layout.set(l);
  }

  private pushRecent(id: string): void {
    this.recentIds.update((list) => {
      const next = [id, ...list.filter((x) => x !== id)].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  private readRecent(): string[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      return raw ? (JSON.parse(raw) as string[]).filter((id) => SERIES[id]) : [];
    } catch {
      return [];
    }
  }

  private readWorkspace(): WorkspaceState | null {
    try {
      const raw = localStorage.getItem(WORKSPACE_KEY);
      if (!raw) return null;
      const w = JSON.parse(raw) as WorkspaceState;
      if (w.v !== 1) return null;
      // Ids must still exist in the catalog; everything else falls back per-field.
      w.selectedIds = (w.selectedIds ?? []).filter((id) => SERIES[id]);
      w.hiddenIds = (w.hiddenIds ?? []).filter((id) => w.selectedIds.includes(id));
      w.compareIds = (w.compareIds ?? []).filter((id) => w.selectedIds.includes(id));
      return w;
    } catch {
      return null;
    }
  }

  private readMax(): number {
    try {
      const raw = localStorage.getItem(MAXSERIES_KEY);
      const n = raw ? parseInt(raw, 10) : DEFAULT_MAX;
      return isFinite(n) ? Math.max(2, Math.min(12, n)) : DEFAULT_MAX;
    } catch {
      return DEFAULT_MAX;
    }
  }
}
