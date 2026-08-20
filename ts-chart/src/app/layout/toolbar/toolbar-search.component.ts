import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { LucideAngularModule } from 'lucide-angular';
import { SelectionService } from '../../core/selection.service';
import { LayoutService } from '../../core/layout.service';
import { SearchResultsComponent } from '../../search/search-results.component';
import { SearchService } from '../../search/search.service';
import { toHit } from '../../search/search.types';
import { SERIES } from '../../data/series-catalog.data';
import { CommandPaletteService } from '../command-palette/command-palette.component';

/**
 * Always-visible search in the top chrome.
 *
 * Every trading terminal keeps search one keystroke away and permanently
 * visible — Bloomberg's command line, Eikon's top bar, TradingView's box next
 * to the main menu. ⌘K is a power-user shortcut, never the only door: a hidden
 * palette is invisible to someone who has not been told it exists.
 *
 * The dropdown is a CDK connected overlay with NO backdrop, matching the user
 * menu three lines away in the toolbar, so nothing is ever painted over the
 * chart. On medium and small screens this collapses to an icon that opens the
 * centred palette instead, because the toolbar has no room to spare.
 */
@Component({
  selector: 'app-toolbar-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayModule, LucideAngularModule, SearchResultsComponent],
  template: `
    @if (layout.viewport() === 'large') {
      <div class="wrap" cdkOverlayOrigin #origin="cdkOverlayOrigin">
        <lucide-icon class="ico" name="search" [size]="15" />
        <input
          #box
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls="ts-toolbar-search"
          [attr.aria-expanded]="open()"
          [attr.aria-activedescendant]="activeId()"
          aria-label="Search series"
          placeholder="Search series, symbol, tag…"
          [value]="query()"
          (input)="onInput(box.value)"
          (focus)="open.set(true)"
          (keydown)="onKey($event)"
          spellcheck="false"
          autocomplete="off"
        />
        <span class="kbd">/</span>
      </div>

      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="origin"
        [cdkConnectedOverlayOpen]="open() && !!query().trim()"
        [cdkConnectedOverlayHasBackdrop]="false"
        [cdkConnectedOverlayWidth]="480"
        [cdkConnectedOverlayPositions]="positions"
        (overlayOutsideClick)="open.set(false)"
        (detach)="open.set(false)"
      >
        <div class="pop ts-panel">
          @if (hits().length) {
            <ts-search-results
              listboxId="ts-toolbar-search"
              [hits]="hits()"
              [active]="active()"
              (hover)="active.set($event)"
              (pick)="pick($event)"
            />
          } @else {
            <div class="empty">No matches for “{{ query() }}”</div>
          }
          <div class="foot">
            <span><span class="kbd">↵</span> add</span>
            <span><span class="kbd">⌘↵</span> only this</span>
            <span class="foot__spacer"></span>
            <span role="status" aria-live="polite">{{ countLabel() }}</span>
          </div>
        </div>
      </ng-template>
    } @else {
      <button class="ts-icon-btn" (click)="palette.toggle()" aria-label="Search (⌘K)">
        <lucide-icon name="search" [size]="17" />
      </button>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex: 0 1 420px;
        min-width: 0;
        justify-content: center;
      }
      .wrap {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        width: 100%;
        height: 30px;
        padding: 0 var(--ts-space-2);
        border: 1px solid var(--ts-border);
        border-radius: var(--ts-radius-sm);
        background: var(--ts-bg-inset);
        color: var(--ts-text-muted);
      }
      .wrap:focus-within {
        border-color: var(--ts-accent);
        box-shadow: 0 0 0 3px var(--ts-accent-weak);
      }
      .wrap input {
        flex: 1;
        min-width: 0;
        border: none;
        background: transparent;
        color: var(--ts-text-bright);
        font-size: var(--ts-fs-sm);
        outline: none;
      }
      .wrap input::placeholder {
        color: var(--ts-text-faint);
      }
      .kbd {
        padding: 1px 5px;
        border-radius: var(--ts-radius-xs);
        border: 1px solid var(--ts-border);
        background: var(--ts-bg-elevated);
        color: var(--ts-text-muted);
        font-size: var(--ts-fs-xxs);
        font-family: var(--ts-font-mono);
        white-space: nowrap;
      }
      .pop {
        margin-top: 6px;
        padding: var(--ts-space-2);
        box-shadow: var(--ts-shadow-3);
        max-height: 60vh;
        overflow-y: auto;
      }
      .empty {
        padding: var(--ts-space-4);
        text-align: center;
        color: var(--ts-text-muted);
        font-size: var(--ts-fs-sm);
      }
      .foot {
        display: flex;
        align-items: center;
        gap: var(--ts-space-3);
        padding: var(--ts-space-2);
        border-top: 1px solid var(--ts-border);
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-muted);
      }
      .foot__spacer {
        flex: 1;
      }
    `,
  ],
})
export class ToolbarSearchComponent {
  readonly layout = inject(LayoutService);
  readonly palette = inject(CommandPaletteService);
  private readonly sel = inject(SelectionService);
  private readonly search = inject(SearchService);
  private readonly session = this.search.createSession({
    pageSize: 8,
    boostIds: () => this.sel.recentIds(),
  });

  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');

  readonly query = signal('');
  readonly active = signal(0);
  readonly open = signal(false);

  readonly hits = computed(() => this.session.hits().slice(0, 8));
  readonly activeId = computed(() =>
    this.active() < this.hits().length ? `ts-toolbar-search-opt-${this.active()}` : null,
  );
  readonly countLabel = computed(() => {
    const t = this.session.total();
    return t ? `${this.hits().length} of ${t} · ${this.session.took()} ms` : '';
  });

  readonly positions = [
    { originX: 'start' as const, originY: 'bottom' as const, overlayX: 'start' as const, overlayY: 'top' as const },
    { originX: 'start' as const, originY: 'top' as const, overlayX: 'start' as const, overlayY: 'bottom' as const },
  ];

  /** Focus target for the global `/` shortcut. */
  focusInput(): void {
    this.box()?.nativeElement.focus();
  }

  onInput(v: string): void {
    this.query.set(v);
    this.session.setQuery(v);
    this.active.set(0);
    this.open.set(true);
  }

  onKey(e: KeyboardEvent): void {
    const n = this.hits().length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.active.update((a) => (n ? (a + 1) % n : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active.update((a) => (n ? (a - 1 + n) % n : 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.active.set(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      this.active.set(Math.max(0, n - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.pick(this.active(), e.metaKey || e.ctrlKey);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.open.set(false);
      this.box()?.nativeElement.blur();
    }
  }

  pick(index: number, only = false): void {
    const hit = this.hits()[index];
    if (!hit) return;
    if (hit.status && hit.status !== 'ok') return;
    if (only) {
      this.sel.select(hit.id);
      this.open.set(false);
      return;
    }
    // Same conveyor semantics as the palette: toggle, stay open, clear, refocus.
    this.sel.toggle(hit.id);
    this.query.set('');
    this.session.setQuery('');
    this.active.set(0);
    const el = this.box()?.nativeElement;
    if (el) {
      el.value = '';
      el.focus();
    }
  }
}
