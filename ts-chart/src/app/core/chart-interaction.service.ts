import { Injectable, signal } from '@angular/core';

/** Crosshair hover snapshot published by whichever chart pane owns the cursor. */
export interface HoverState {
  /** Pane that produced the event (0 = overlay / first split pane). */
  paneId: number;
  /** Hovered bar time ('YYYY-MM-DD'), null when the cursor leaves the chart. */
  time: string | null;
  /** Per-series values under the crosshair (series id -> value). */
  vals: Record<string, number>;
}

/**
 * Bridge between chart panes and the rest of the UI:
 *  - split panes subscribe and mirror the crosshair (`setCrosshairPosition`);
 *  - the toolbar stats strip tracks the hovered value/date live.
 * One writer at a time (the pane under the cursor); everyone else reads.
 */
@Injectable({ providedIn: 'root' })
export class ChartInteractionService {
  readonly hover = signal<HoverState | null>(null);

  /**
   * The one series currently showing its individual observations (id, or null).
   * Lives here rather than in a pane so split panes agree — two panes drawing
   * point markers for different series is the same misread as two panes at
   * different zooms.
   */
  readonly focusedId = signal<string | null>(null);

  toggleFocus(id: string): void {
    this.focusedId.update((v) => (v === id ? null : id));
  }

  clearFocus(): void {
    this.focusedId.set(null);
  }

  publish(state: HoverState): void {
    this.hover.set(state);
  }

  clear(paneId: number): void {
    // Only the pane that owns the current hover may clear it.
    if (this.hover()?.paneId === paneId) this.hover.set(null);
  }
}
