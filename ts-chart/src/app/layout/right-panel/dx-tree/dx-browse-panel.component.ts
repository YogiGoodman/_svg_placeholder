import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TabId } from '../../../data/models';
import {
  SERIES,
  TAB_ICONS,
  TAB_LABELS,
  TREES,
} from '../../../data/series-catalog.data';
import { SelectionService } from '../../../core/selection.service';
import { SearchService } from '../../../search/search.service';
import { SeriesColorService } from '../../../core/series-color.service';
import { TooltipDirective } from '../../../core/tooltip.directive';
import { BROWSE_CHROME_STYLES } from '../../left-panel/browse-chrome.styles';
import { DxThemeService } from './dx-theme';
import { DxTreeListComponent } from './dx-tree-list.component';

const TAB_SHORT: Record<TabId, string> = {
  forecast: 'Forecast',
  contracts: 'Contracts',
  regions: 'Regions',
};

@Component({
  selector: 'app-dx-browse-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, TooltipDirective, DxTreeListComponent],
  template: `
    <section class="panel">
      <header class="phead">
        <span>Browse (DevExtreme)</span>
        <button
          class="ts-icon-btn phead__close"
          (click)="close.emit()"
          tsTooltip="Hide panel"
          aria-label="Hide DevExtreme tree panel"
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
                <p>Nothing found for "{{ query() }}". Try a symbol or tag.</p>
              </div>
            </div>
          }
        } @else {
          <app-dx-tree-list [roots]="roots()" />
        }
      </div>

      <!-- Footer -->
      <div class="foot">
        <span class="ts-mono">{{ totalCount }} series</span>
      </div>
    </section>
  `,
  styles: [BROWSE_CHROME_STYLES],
})
export class DxBrowsePanelComponent {
  /** Injected for its effect: keeps DevExtreme's stylesheet on the app's theme. */
  private readonly dxTheme = inject(DxThemeService);

  readonly selection = inject(SelectionService);
  readonly colors = inject(SeriesColorService);

  readonly close = output<void>();

  readonly tabs: TabId[] = ['forecast', 'contracts', 'regions'];
  readonly labels = TAB_LABELS;
  readonly short = TAB_SHORT;
  readonly icons = TAB_ICONS;
  readonly totalCount = Object.keys(SERIES).length;

  private readonly search = inject(SearchService);
  private readonly session = this.search.createSession({ pageSize: 100 });

  readonly activeTab = signal<TabId>('forecast');
  readonly query = signal('');

  readonly roots = computed(() => TREES[this.activeTab()]);
  readonly results = computed(() => this.session.hits());
  readonly total = computed(() => this.session.total());

  onQuery(v: string): void {
    this.query.set(v);
    this.session.setQuery(v);
  }
}
