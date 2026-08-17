import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

const SIZES_KEY = 'tschart.panelSizes';
const DOCK_KEY = 'tschart.dock';

export type Viewport = 'large' | 'medium' | 'small';

interface PanelSizes {
  left: number;
  center: number;
  right: number;
}

interface DockState {
  /** Left dock (tree/search). Persisted; OPEN by default — the tree is a primary driver. */
  leftCollapsed: boolean;
  /** Right inspector. Persisted; CLOSED by default. */
  rightCollapsed: boolean;
}

const DEFAULT_SIZES: PanelSizes = { left: 22, center: 56, right: 22 };
const DEFAULT_DOCK: DockState = { leftCollapsed: false, rightCollapsed: true };

/**
 * Layout state: panel collapse, panel sizes (persisted), responsive viewport,
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
  readonly sizes = signal<PanelSizes>(this.readSizes());

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
      localStorage.setItem(SIZES_KEY, JSON.stringify(this.sizes()));
    });
    effect(() => {
      const dock: DockState = {
        leftCollapsed: this.leftCollapsed(),
        rightCollapsed: this.rightCollapsed(),
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
    this.rightCollapsed.set(false);
  }
  closeDrawers(): void {
    this.leftCollapsed.set(true);
    this.rightCollapsed.set(true);
  }

  setSizes(next: PanelSizes): void {
    this.sizes.set(next);
  }

  resetSizes(): void {
    this.sizes.set({ ...DEFAULT_SIZES });
  }

  private readSizes(): PanelSizes {
    try {
      const raw = localStorage.getItem(SIZES_KEY);
      if (raw) return { ...DEFAULT_SIZES, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_SIZES };
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
