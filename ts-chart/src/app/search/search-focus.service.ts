import { Injectable, signal } from '@angular/core';

/**
 * The `/` shortcut lives on the app root; the search box lives three components
 * down. This is the seam between them — the alternative was
 * `document.querySelector('app-toolbar-search input')`, which is a reach across
 * component boundaries that breaks silently the day the markup changes.
 *
 * A counter, not a boolean: focusing twice in a row is a real request both times.
 */
@Injectable({ providedIn: 'root' })
export class SearchFocusService {
  readonly requests = signal(0);

  focusToolbar(): void {
    this.requests.update((n) => n + 1);
  }
}
