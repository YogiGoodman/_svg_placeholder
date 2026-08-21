import { computed, Injectable, signal } from '@angular/core';

export interface TableActions {
  downloadCsv(): void;
  copyTable(): void;
}
export interface ChartActions {
  screenshot(): void;
}

/**
 * Lets a keyboard-only surface (⌘K) run the card's own actions without owning
 * them. Export lives where the data is — the CSV comes from the table's rendered
 * columns, the screenshot from the chart element — so the palette asks rather
 * than reimplements.
 *
 * `withTable` queues when the table is not mounted, because the honest command
 * is "export the data", and in chart view that means switching first. The queued
 * call flushes on the next registration rather than being dropped.
 */
@Injectable({ providedIn: 'root' })
export class CardActionsService {
  private readonly table = signal<TableActions | null>(null);
  private readonly chart = signal<ChartActions | null>(null);
  private pendingTable: ((t: TableActions) => void) | null = null;

  readonly canScreenshot = computed(() => !!this.chart());

  registerTable(t: TableActions): void {
    this.table.set(t);
    const pending = this.pendingTable;
    this.pendingTable = null;
    if (pending) queueMicrotask(() => pending(t));
  }
  unregisterTable(t: TableActions): void {
    if (this.table() === t) this.table.set(null);
  }

  registerChart(c: ChartActions): void {
    this.chart.set(c);
  }
  unregisterChart(c: ChartActions): void {
    if (this.chart() === c) this.chart.set(null);
  }

  withTable(fn: (t: TableActions) => void): void {
    const t = this.table();
    if (t) fn(t);
    else this.pendingTable = fn;
  }

  screenshot(): void {
    this.chart()?.screenshot();
  }
}
