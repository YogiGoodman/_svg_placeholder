import { Injectable, signal } from '@angular/core';

const KEY = 'tschart.recentq';
const MAX = 8;
/** Long enough to be a real query, short enough that a stray paste is dropped. */
const MAX_LEN = 64;

/**
 * Recently *searched text* — distinct from `SelectionService.recentIds`, which
 * is recently *charted series*. A trader repeats a query ("ttf cal-26") far more
 * often than they re-pick one specific id from it, and re-typing it is the cost
 * this removes.
 *
 * Committed on a successful pick, never per keystroke: mid-typing prefixes are
 * not queries, and recording them would fill the list with "t", "tt", "ttf".
 */
@Injectable({ providedIn: 'root' })
export class RecentQueriesService {
  readonly queries = signal<readonly string[]>(this.read());

  /** Record a query the user actually got a result from. */
  push(raw: string): void {
    const q = raw.trim().slice(0, MAX_LEN);
    if (!q) return;
    this.queries.update((list) => {
      const next = [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX);
      this.write(next);
      return next;
    });
  }

  remove(q: string): void {
    this.queries.update((list) => {
      const next = list.filter((x) => x !== q);
      this.write(next);
      return next;
    });
  }

  clear(): void {
    this.queries.set([]);
    this.write([]);
  }

  private read(): readonly string[] {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
      if (!Array.isArray(raw)) return [];
      return raw.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, MAX);
    } catch {
      return [];
    }
  }

  private write(list: readonly string[]): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }
}
