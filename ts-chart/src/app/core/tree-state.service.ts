import { Injectable, signal } from '@angular/core';
import { TREES } from '../data/series-catalog.data';

const CHILD_LIMIT_KEY = 'tschart.treeChildLimit';

/** "Show all" — no cap on how many children a node renders at once. */
export const CHILD_LIMIT_OFF = 0;

/**
 * Tree expansion state, held app-wide so switching tabs (which destroys and
 * recreates the node components) round-trips losslessly. Top-level categories
 * of every tab start expanded — the inviting first impression survives.
 *
 * Also owns `childLimit`: how many children a node renders before the rest are
 * folded behind a "show more" row. A production curve can carry fifty monthly
 * contracts; rendering all of them costs the operator the ability to scan the
 * tree at all, so the cap is a readability control, not a performance one.
 */
@Injectable({ providedIn: 'root' })
export class TreeStateService {
  private readonly expanded = signal<ReadonlySet<string>>(
    new Set(
      Object.values(TREES)
        .flat()
        .map((root) => root.id),
    ),
  );

  /** Children rendered per node before the rest fold away. 0 = show all. */
  readonly childLimit = signal<number>(this.readChildLimit());

  isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }

  toggle(id: string): void {
    this.expanded.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  setChildLimit(n: number): void {
    const clamped = n <= CHILD_LIMIT_OFF ? CHILD_LIMIT_OFF : Math.max(4, Math.min(100, Math.round(n)));
    this.childLimit.set(clamped);
    try {
      localStorage.setItem(CHILD_LIMIT_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  }

  /** Reactive read for computeds/templates. */
  readonly set = this.expanded.asReadonly();

  private readChildLimit(): number {
    try {
      const raw = localStorage.getItem(CHILD_LIMIT_KEY);
      if (raw !== null) {
        const n = Number(raw);
        if (Number.isFinite(n)) return n <= 0 ? CHILD_LIMIT_OFF : n;
      }
    } catch {
      /* ignore */
    }
    return 12;
  }
}
