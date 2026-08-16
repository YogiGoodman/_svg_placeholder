import { Injectable, signal } from '@angular/core';
import { TREES } from '../data/series-catalog.data';

/**
 * Tree expansion state, held app-wide so switching tabs (which destroys and
 * recreates the node components) round-trips losslessly. Top-level categories
 * of every tab start expanded — the inviting first impression survives.
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

  /** Reactive read for computeds/templates. */
  readonly set = this.expanded.asReadonly();
}
