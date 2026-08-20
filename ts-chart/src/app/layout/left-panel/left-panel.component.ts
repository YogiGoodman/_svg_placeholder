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
import { SERIES, TAB_ICONS, TAB_LABELS, TREES } from '../../data/series-catalog.data';
import { SearchService } from '../../search/search.service';
import { SelectionService } from '../../core/selection.service';
import { SeriesColorService } from '../../core/series-color.service';
import { TooltipDirective } from '../../core/tooltip.directive';
import { TreeNodeComponent } from './tree-node.component';
import { BROWSE_CHROME_STYLES } from './browse-chrome.styles';

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
          (input)="onQuery(box.value)"
          spellcheck="false"
          autocomplete="off"
        />
        @if (query()) {
          <button
            class="ts-icon-btn search__clear"
            (click)="onQuery(''); box.value = ''"
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
                {{ total() }} match{{ total() === 1 ? '' : 'es' }}
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
  styles: [BROWSE_CHROME_STYLES],
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

  private readonly search = inject(SearchService);
  /** This dock's own session. Same provider and cache as the palette and the
   *  toolbar, separate query — the three surfaces must not overwrite each other. */
  private readonly session = this.search.createSession({
    pageSize: 100,
    boostIds: () => this.selection.recentIds(),
  });

  readonly activeTab = signal<TabId>('forecast');
  readonly query = signal('');

  readonly roots = computed(() => TREES[this.activeTab()]);
  /** Ranked, and later server-backed, but the dock's own UX is unchanged:
   *  results only while the query is non-empty, and picking does NOT clear it. */
  readonly results = computed(() => this.session.hits());
  readonly total = computed(() => this.session.total());

  onQuery(v: string): void {
    this.query.set(v);
    this.session.setQuery(v);
  }

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
