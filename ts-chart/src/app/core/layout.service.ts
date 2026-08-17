import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

const SIZES_KEY = 'tschart.panelSizes';

export type Viewport = 'large' | 'medium' | 'small';

interface PanelSizes {
  left: number;
  center: number;
  right: number;
}

const DEFAULT_SIZES: PanelSizes = { left: 22, center: 56, right: 22 };

/**
 * Layout state: panel collapse, panel sizes (persisted), responsive viewport,
 * and chart data/chart toggle. All signal-based so the shell reacts instantly.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly bp = inject(BreakpointObserver);

  /**
   * Chart-first layout: both side surfaces are transient overlays, CLOSED by
   * default. "Collapsed" = drawer closed. Left = browse drawer (tree/search),
   * right = series inspector.
   */
  readonly leftCollapsed = signal(true);
  readonly rightCollapsed = signal(true);
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
}
