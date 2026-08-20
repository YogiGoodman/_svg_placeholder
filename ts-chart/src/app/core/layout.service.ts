import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

const DOCK_KEY = 'tschart.dock';
const WIDTH_KEY = 'tschart.dockWidth';

export type Viewport = 'large' | 'medium' | 'small';
export type RightView = 'details' | 'dxTree';

interface DockState {
  /** Left dock (tree/search). Persisted; OPEN by default — the tree is a primary driver. */
  leftCollapsed: boolean;
  /** Right inspector. Persisted; CLOSED by default. */
  rightCollapsed: boolean;
  /** Which view the right dock shows. */
  rightView: RightView;
}

const DEFAULT_DOCK: DockState = { leftCollapsed: false, rightCollapsed: true, rightView: 'details' };

/** Left dock width in px. Bounds keep the tree usable at one end and the chart
 *  dominant at the other — the chart always owns the majority of the shell. */
const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 240;
const MAX_WIDTH = 520;

/**
 * Layout state: dock collapse, dock width (persisted), responsive viewport,
 * and chart data/chart toggle. All signal-based so the shell reacts instantly.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly bp = inject(BreakpointObserver);

  /**
   * Chart-first layout with persistent chrome: the left tree is a DOCK (in-flow,
   * open by default — a primary driver of the app), the right inspector is a
   * non-modal dock (closed by default). Neither veils the chart; "collapsed" =
   * dock hidden. State persists across reloads.
   */
  private readonly dock0 = this.readDock();
  readonly leftCollapsed = signal(this.dock0.leftCollapsed);
  readonly rightCollapsed = signal(this.dock0.rightCollapsed);
  readonly rightView = signal<RightView>(this.dock0.rightView);
  /** Draggable width of the left dock, persisted. */
  readonly leftWidth = signal<number>(this.readWidth());

  /** Responsive viewport bucket derived from CDK BreakpointObserver. */
  readonly viewport = toSignal(
    this.bp.observe(['(max-width: 767px)', '(max-width: 1279px)']).pipe(
      map((s): Viewport => {
        if (s.breakpoints['(max-width: 767px)']) return 'small';
        if (s.breakpoints['(max-width: 1279px)']) return 'medium';
        return 'large';
      }),
    ),
    { initialValue: 'large' as Viewport },
  );

  readonly isSmall = computed(() => this.viewport() === 'small');
  readonly isMedium = computed(() => this.viewport() === 'medium');

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(WIDTH_KEY, String(this.leftWidth()));
      } catch {
        /* ignore */
      }
    });
    effect(() => {
      const dock: DockState = {
        leftCollapsed: this.leftCollapsed(),
        rightCollapsed: this.rightCollapsed(),
        rightView: this.rightView(),
      };
      localStorage.setItem(DOCK_KEY, JSON.stringify(dock));
    });
  }

  toggleLeft(): void {
    this.leftCollapsed.update((v) => !v);
  }
  toggleRight(): void {
    this.rightCollapsed.update((v) => !v);
  }
  /** Open the series inspector (e.g. from a legend row click). */
  openRight(): void {
    this.rightView.set('details');
    this.rightCollapsed.set(false);
  }
  /** Rail semantics: open with this view, or close if already showing it. */
  showRight(view: RightView): void {
    if (!this.rightCollapsed() && this.rightView() === view) {
      this.rightCollapsed.set(true);
    } else {
      this.rightView.set(view);
      this.rightCollapsed.set(false);
    }
  }
  closeDrawers(): void {
    this.leftCollapsed.set(true);
    this.rightCollapsed.set(true);
  }

  /** Clamped so a drag can never make the tree unusable or starve the chart. */
  setLeftWidth(px: number): void {
    this.leftWidth.set(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(px))));
  }

  resetSizes(): void {
    this.leftWidth.set(DEFAULT_WIDTH);
  }

  private readWidth(): number {
    try {
      // `tschart.panelSizes` drove a percentage split that no longer renders
      // anything. Drop it on read so it does not sit in storage forever.
      localStorage.removeItem('tschart.panelSizes');
      const n = parseInt(localStorage.getItem(WIDTH_KEY) ?? '', 10);
      if (Number.isFinite(n)) return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n));
    } catch {
      /* ignore */
    }
    return DEFAULT_WIDTH;
  }

  private readDock(): DockState {
    try {
      const raw = localStorage.getItem(DOCK_KEY);
      if (raw) return { ...DEFAULT_DOCK, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_DOCK };
  }
}
