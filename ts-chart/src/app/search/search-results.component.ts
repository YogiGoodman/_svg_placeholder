import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SelectionService } from '../core/selection.service';
import { SeriesColorService } from '../core/series-color.service';
import { SeriesGlyphComponent } from '../core/series-glyph.component';
import { TooltipDirective } from '../core/tooltip.directive';
import { parseFragment } from './highlight';
import { SeriesHit } from './search.types';

export interface ResultRow {
  hit: SeriesHit;
  selected: boolean;
  color: string;
  glyph: ReturnType<SeriesColorService['glyph']>;
  symbolParts: readonly { text: string; hit: boolean }[];
  nameParts: readonly { text: string; hit: boolean }[];
  /** Set when picking this row would evict another series at the cap. */
  replaces: string | null;
  blocked: 'forbidden' | 'missing' | null;
}

/**
 * The one result list. Rendered by the ⌘K palette, the toolbar dropdown and the
 * browse dock, so there is a single row template, a single keyboard model and a
 * single place for a bug to live.
 *
 * Rows are `role="option"` divs rather than buttons: a <button> inside a
 * listbox breaks option counting in NVDA and JAWS. The consequence is that
 * mousedown must be prevented, or the input blurs and the surface closes before
 * the click lands.
 */
@Component({
  selector: 'ts-search-results',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, TooltipDirective, SeriesGlyphComponent],
  template: `
    <div
      class="list"
      role="listbox"
      [attr.id]="listboxId()"
      [attr.aria-label]="'Series results'"
    >
      @for (r of rows(); track r.hit.id; let i = $index) {
        <div
          class="row"
          role="option"
          [attr.id]="listboxId() + '-opt-' + i"
          [class.is-active]="active() === i"
          [class.is-blocked]="!!r.blocked"
          [attr.aria-selected]="active() === i"
          [attr.aria-disabled]="!!r.blocked"
          (mousedown)="$event.preventDefault()"
          (mouseenter)="hover.emit(i)"
          (click)="pick.emit(i)"
        >
          <ts-glyph
            [glyph]="r.glyph"
            [color]="r.selected ? r.color : 'transparent'"
            [size]="8"
          />
          <span class="sym ts-mono">
            @for (p of r.symbolParts; track $index) {
              <span [class.hl]="p.hit">{{ p.text }}</span>
            }
          </span>
          <span class="name ts-truncate">
            @for (p of r.nameParts; track $index) {
              <span [class.hl]="p.hit">{{ p.text }}</span>
            }
          </span>
          <span class="path ts-truncate">{{ r.hit.path.join(' › ') }}</span>

          @if (r.blocked) {
            <lucide-icon
              class="warn"
              [name]="r.blocked === 'forbidden' ? 'lock' : 'triangle-alert'"
              [size]="13"
              [tsTooltip]="
                r.blocked === 'forbidden'
                  ? 'Restricted — entitlement required'
                  : 'No data available'
              "
            />
          } @else if (r.replaces) {
            <!-- The consequence is attached to the row you are about to press
                 Enter on, not discovered afterwards when a line vanishes. -->
            <span class="repl" [tsTooltip]="'At the ' + max() + '-series cap'">
              replaces {{ r.replaces }}
            </span>
          }
          @if (r.selected) {
            <lucide-icon class="on" name="check" [size]="14" />
            <span class="ts-sr-only">on chart</span>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .list {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        padding: var(--ts-space-2);
        border-radius: var(--ts-radius-sm);
        color: var(--ts-text-secondary);
        cursor: pointer;
        text-align: left;
        /* Active state carries a border as well as a tint. A color-blind user
           picking out "the active row" from a blue wash alone is the same
           failure the palette work exists to fix. */
        box-shadow: inset 2px 0 0 transparent;
      }
      .row.is-active {
        background: var(--ts-bg-active);
        color: var(--ts-text-bright);
        box-shadow: inset 2px 0 0 var(--ts-accent-strong);
      }
      .row.is-blocked {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .sym {
        font-size: var(--ts-fs-sm);
        font-weight: var(--ts-fw-bold);
        color: var(--ts-text-bright);
        flex: none;
        min-width: 64px;
      }
      .name {
        font-size: var(--ts-fs-sm);
        min-width: 0;
        flex: 1;
      }
      .path {
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-muted);
        max-width: 40%;
      }
      /* Accent-weak, never amber: --ts-highlight is reserved for "now". */
      .hl {
        color: var(--ts-text-bright);
        font-weight: var(--ts-fw-semibold);
        background: var(--ts-accent-weak);
        border-radius: 2px;
      }
      .on {
        color: var(--ts-accent-strong);
        flex: none;
      }
      .warn {
        color: var(--ts-text-muted);
        flex: none;
      }
      .repl {
        flex: none;
        font-size: var(--ts-fs-xxs);
        color: var(--ts-warn, var(--ts-text-muted));
        white-space: nowrap;
      }
    `,
  ],
})
export class SearchResultsComponent {
  private readonly sel = inject(SelectionService);
  private readonly colors = inject(SeriesColorService);

  readonly hits = input.required<readonly SeriesHit[]>();
  readonly active = input.required<number>();
  readonly listboxId = input<string>('ts-search');
  readonly pick = output<number>();
  readonly hover = output<number>();

  readonly max = computed(() => this.sel.maxSeries());

  readonly rows = computed<ResultRow[]>(() => {
    const selected = this.sel.selectedIds();
    const atCap = selected.length >= this.sel.maxSeries();
    return this.hits().map((hit) => {
      const isSel = selected.includes(hit.id);
      const sym = hit.highlights?.find((h) => h.field === 'symbol')?.fragment ?? hit.symbol;
      const name = hit.highlights?.find((h) => h.field === 'name')?.fragment ?? hit.name;
      return {
        hit,
        selected: isSel,
        color: this.colors.color(hit.id),
        glyph: this.colors.glyph(hit.id),
        symbolParts: parseFragment(sym),
        nameParts: parseFragment(name),
        replaces: !isSel && atCap ? (this.sel.oldestSymbol() ?? null) : null,
        blocked: hit.status && hit.status !== 'ok' ? hit.status : null,
      };
    });
  });
}
