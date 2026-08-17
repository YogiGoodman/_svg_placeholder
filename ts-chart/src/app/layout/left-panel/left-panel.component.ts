import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TabId } from '../../data/models';
import {
  SERIES,
  TAB_ICONS,
  TAB_LABELS,
  TREES,
  searchSeries,
} from '../../data/series-catalog.data';
import { SelectionService } from '../../core/selection.service';
import { SeriesColorService } from '../../core/series-color.service';
import { TooltipDirective } from '../../core/tooltip.directive';
import { TreeNodeComponent } from './tree-node.component';

/** Short tab captions (full names live in the tooltip). */
const TAB_SHORT: Record<TabId, string> = {
  forecast: 'Forecast',
  contracts: 'Contracts',
  regions: 'Regions',
};

@Component({
  selector: 'app-left-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, TooltipDirective, TreeNodeComponent],
  template: `
    <section class="panel">
      <!-- Dock header: title + own dismiss (mirrors the rail toggle) -->
      <header class="phead">
        <span>Browse</span>
        <button
          class="ts-icon-btn phead__close"
          (click)="close.emit()"
          tsTooltip="Hide panel (⌘/)"
          aria-label="Hide browse panel"
        >
          <lucide-icon name="x" [size]="15" />
        </button>
      </header>

      <!-- Tab bar -->
      <div class="tabs" role="tablist">
        @for (t of tabs; track t) {
          <button
            class="tab"
            role="tab"
            [class.is-active]="activeTab() === t"
            [attr.aria-selected]="activeTab() === t"
            (click)="activeTab.set(t)"
            [tsTooltip]="labels[t]"
          >
            <lucide-icon [name]="icons[t]" [size]="15" />
            <span class="tab__label ts-truncate">{{ short[t] }}</span>
          </button>
        }
      </div>

      <!-- Search -->
      <div class="search">
        <lucide-icon name="search" [size]="15" class="search__ico" />
        <input
          #box
          type="text"
          placeholder="Search series, symbol, tag…"
          [value]="query()"
          (input)="query.set(box.value)"
          spellcheck="false"
          autocomplete="off"
        />
        @if (query()) {
          <button
            class="ts-icon-btn search__clear"
            (click)="query.set(''); box.value = ''"
            tsTooltip="Clear search"
          >
            <lucide-icon name="x" [size]="14" />
          </button>
        }
      </div>

      <!-- Body -->
      <div class="body">
        @if (query()) {
          @if (results().length) {
            <div class="results">
              <span class="results__meta">
                {{ results().length }} match{{ results().length === 1 ? '' : 'es' }}
              </span>
              @for (s of results(); track s.id) {
                <button
                  class="result"
                  [class.is-selected]="selection.selectedIds().includes(s.id)"
                  (click)="selection.toggle(s.id)"
                >
                  <span
                    class="dot"
                    [style.background]="
                      selection.isSelected(s.id) ? colors.color(s.id) : 'transparent'
                    "
                  ></span>
                  <span class="result__main">
                    <span class="result__name ts-truncate">{{ s.name }}</span>
                    <span class="result__path ts-truncate">{{ s.path.join(' › ') }}</span>
                  </span>
                  <span class="result__sym ts-mono">{{ s.symbol }}</span>
                </button>
              }
            </div>
          } @else {
            <div class="ts-empty small">
              <img src="assets/placeholders/placeholder-points.svg" alt="" />
              <div>
                <h3>No matches</h3>
                <p>Nothing found for “{{ query() }}”. Try a symbol or tag.</p>
              </div>
            </div>
          }
        } @else {
          <div class="tree" role="tree" (keydown)="onTreeKey($event)">
            @for (root of roots(); track root.id) {
              <app-tree-node [node]="root" [depth]="0" />
            }
          </div>
        }
      </div>

      <!-- Footer meta -->
      <div class="foot">
        <span class="ts-mono">{{ totalCount }} series</span>
        @if (selection.count() > 0) {
          <button class="clear-all" (click)="selection.clear()" tsTooltip="Clear all selected series">
            <lucide-icon name="trash-2" [size]="13" />
            Clear {{ selection.count() }}
          </button>
        }
      </div>
    </section>
  `,
  styles: [
    `
      :host,
      .panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .panel {
        background: var(--ts-bg-elevated);
      }
      /* Dock header */
      .phead {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: var(--ts-tabbar-h);
        padding: 0 var(--ts-space-2) 0 var(--ts-space-4);
        border-bottom: 1px solid var(--ts-border);
        font-size: var(--ts-fs-sm);
        font-weight: var(--ts-fw-semibold);
        color: var(--ts-text-bright);
      }
      .phead__close {
        width: 26px;
        height: 26px;
        flex: none;
      }
      /* Tabs */
      .tabs {
        display: flex;
        height: var(--ts-tabbar-h);
        padding: 0 var(--ts-space-2);
        gap: 2px;
        border-bottom: 1px solid var(--ts-border);
      }
      .tab {
        display: inline-flex;
        align-items: center;
        gap: var(--ts-space-2);
        padding: 0 var(--ts-space-2);
        flex: 1;
        justify-content: center;
        font-size: var(--ts-fs-xs);
        font-weight: var(--ts-fw-medium);
        color: var(--ts-text-muted);
        border-bottom: 2px solid transparent;
        cursor: pointer;
        transition: color var(--ts-dur-1) var(--ts-ease),
          border-color var(--ts-dur-1) var(--ts-ease);
      }
      .tab:hover {
        color: var(--ts-text-bright);
      }
      .tab.is-active {
        color: var(--ts-accent-strong);
        border-bottom-color: var(--ts-accent);
      }
      .tab__label {
        white-space: nowrap;
      }
      /* Search */
      .search {
        position: relative;
        display: flex;
        align-items: center;
        margin: var(--ts-space-2);
      }
      .search__ico {
        position: absolute;
        left: var(--ts-space-2);
        color: var(--ts-text-muted);
        pointer-events: none;
      }
      .search input {
        width: 100%;
        height: 32px;
        padding: 0 var(--ts-space-2) 0 30px;
        border-radius: var(--ts-radius-md);
        border: 1px solid var(--ts-border);
        background: var(--ts-bg-inset);
        color: var(--ts-text-bright);
        font-size: var(--ts-fs-sm);
        transition: border-color var(--ts-dur-1) var(--ts-ease),
          box-shadow var(--ts-dur-1) var(--ts-ease);
      }
      .search input::placeholder {
        color: var(--ts-text-faint);
      }
      .search input:focus {
        outline: none;
        border-color: var(--ts-accent);
        box-shadow: 0 0 0 3px var(--ts-accent-weak);
      }
      .search__clear {
        position: absolute;
        right: 2px;
        width: 26px;
        height: 26px;
      }
      /* Body */
      .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: var(--ts-space-1) var(--ts-space-2) var(--ts-space-3);
      }
      .tree {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      /* Search results */
      .results {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .results__meta {
        display: block;
        padding: var(--ts-space-2) var(--ts-space-2) var(--ts-space-1);
        font-size: var(--ts-fs-xxs);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--ts-text-muted);
      }
      .result {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        padding: var(--ts-space-2);
        border-radius: var(--ts-radius-sm);
        cursor: pointer;
        transition: background var(--ts-dur-1) var(--ts-ease);
      }
      .result:hover {
        background: var(--ts-bg-hover);
      }
      .result.is-selected {
        background: var(--ts-accent-weak);
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex: none;
      }
      .result__main {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
      }
      .result__name {
        font-size: var(--ts-fs-sm);
        color: var(--ts-text-bright);
      }
      .result__path {
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-muted);
      }
      .result__sym {
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-secondary);
        flex: none;
      }
      .ts-empty.small {
        gap: var(--ts-space-3);
        padding: var(--ts-space-6) var(--ts-space-4);
      }
      .ts-empty.small img {
        max-width: 140px;
      }
      .ts-empty.small h3 {
        font-size: var(--ts-fs-md);
      }
      /* Footer */
      .foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--ts-space-2) var(--ts-space-3);
        border-top: 1px solid var(--ts-border);
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-muted);
      }
      .clear-all {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px var(--ts-space-2);
        border-radius: var(--ts-radius-sm);
        color: var(--ts-text-muted);
        cursor: pointer;
        transition:
          background var(--ts-dur-1) var(--ts-ease),
          color var(--ts-dur-1) var(--ts-ease);
      }
      .clear-all:hover {
        background: color-mix(in srgb, var(--ts-down) 14%, transparent);
        color: var(--ts-down);
      }
    `,
  ],
})
export class LeftPanelComponent {
  readonly selection = inject(SelectionService);
  readonly colors = inject(SeriesColorService);

  /** Emitted when the dock's own close control is used (rail mirrors this). */
  readonly close = output<void>();

  readonly tabs: TabId[] = ['forecast', 'contracts', 'regions'];
  readonly labels = TAB_LABELS;
  readonly short = TAB_SHORT;
  readonly icons = TAB_ICONS;
  readonly totalCount = Object.keys(SERIES).length;

  readonly activeTab = signal<TabId>('forecast');
  readonly query = signal('');

  readonly roots = computed(() => TREES[this.activeTab()]);
  readonly results = computed(() => searchSeries(this.query()));

  /** Arrow-key navigation: Up/Down walk visible rows, Right/Left expand/collapse. */
  onTreeKey(e: KeyboardEvent): void {
    const tree = e.currentTarget as HTMLElement;
    const rows = Array.from(tree.querySelectorAll<HTMLButtonElement>('button.row'));
    const idx = rows.indexOf(document.activeElement as HTMLButtonElement);
    const focus = (i: number) => rows[Math.max(0, Math.min(rows.length - 1, i))]?.focus();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focus(idx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focus(idx - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const el = document.activeElement as HTMLButtonElement | null;
      if (!el?.classList.contains('parent')) return;
      const open = el.getAttribute('aria-expanded') === 'true';
      if (e.key === 'ArrowRight' && !open) {
        e.preventDefault();
        el.click();
      } else if (e.key === 'ArrowRight' && open) {
        e.preventDefault();
        focus(idx + 1); // into first child
      } else if (e.key === 'ArrowLeft' && open) {
        e.preventDefault();
        el.click();
      }
    }
  }
}
