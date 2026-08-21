import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injectable,
  signal,
  TemplateRef,
  untracked,
  ViewContainerRef,
  viewChild,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { LucideAngularModule } from 'lucide-angular';
import { SelectionService } from '../../core/selection.service';
import { SeriesColorService } from '../../core/series-color.service';
import { ThemeService } from '../../core/theme.service';
import { LayoutService } from '../../core/layout.service';
import { HistoryService } from '../../core/history.service';
import { CardActionsService } from '../../core/card-actions.service';
import { SearchService } from '../../search/search.service';
import { SeriesHit } from '../../search/search.types';
import { RecentQueriesService } from '../../search/recent-queries.service';
import { SearchResultsComponent } from '../../search/search-results.component';

/** Opens/closes the ⌘K palette (toggled from the global key handler). */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  readonly open = signal(false);
  toggle(): void {
    this.open.update((v) => !v);
  }
  close(): void {
    this.open.set(false);
  }
}

interface Cmd {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  run: () => void;
}

/**
 * ⌘K command palette — Bloomberg-style type-ticker-to-chart, plus recent queries
 * and the handful of actions worth a keyboard-only path. Series selection keeps
 * the palette open (rapid multi-add); the input clears after each pick so the
 * next ticker types straight in.
 *
 * It is a finder first. Layout, mode and panel commands used to live here and
 * were removed: every one of them is a visible one-click control on the card
 * header or the rail, and a palette that lists the settings menu stops being a
 * place you type a ticker.
 *
 * It renders through the CDK overlay rather than a fixed div. Two reasons, both
 * bugs that were live: a hand-rolled `z-index: 91` sat BELOW the CDK overlay
 * container (1000), so the user menu painted over the palette; and without a
 * focus trap Tab walked straight out of an open dialog into the app behind it.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [A11yModule, LucideAngularModule, SearchResultsComponent],
  template: `
    <!-- No scrim. This is the surface a trader opens WHILE watching the tape;
         a veil over live data failed desk review, and blur reads as a smudge.
         Separation is elevation and shadow. Outside click closes it. -->
    <ng-template #panelTpl>
      <div
        class="panel"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div class="inputrow">
          <lucide-icon name="search" [size]="16" />
          <input
            #box
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-controls="ts-palette"
            [attr.aria-expanded]="true"
            [attr.aria-activedescendant]="activeId()"
            aria-label="Search series and commands"
            placeholder="Type a ticker or command…"
            [value]="query()"
            (input)="onInput(box.value)"
            (keydown)="onKey($event)"
            spellcheck="false"
            autocomplete="off"
          />
          <span class="kbd">esc</span>
        </div>

        <!-- ONE listbox over every section. The sections are groups inside it,
             not separate widgets: aria-activedescendant has to be able to name
             whatever the arrow keys just landed on, and it cannot name a row
             that lives outside the listbox it points at. -->
        <div class="list" role="listbox" id="ts-palette" aria-label="Results">
          @if (recentQueries().length) {
            <div class="group" id="ts-palette-g-recent">Recent searches</div>
            <div role="group" aria-labelledby="ts-palette-g-recent">
              @for (q of recentQueries(); track q; let i = $index) {
                <div
                  class="row"
                  role="option"
                  [attr.id]="'ts-palette-opt-' + i"
                  [class.is-active]="active() === i"
                  [attr.aria-selected]="active() === i"
                  (mousedown)="$event.preventDefault()"
                  (mouseenter)="active.set(i)"
                  (click)="pick(i)"
                >
                  <lucide-icon class="cmdic" name="clock" [size]="15" />
                  <span class="name">{{ q }}</span>
                  <button
                    class="drop"
                    (click)="forgetQuery(q, $event)"
                    aria-label="Remove from recent searches"
                  >
                    <lucide-icon name="x" [size]="12" />
                  </button>
                </div>
              }
            </div>
          }

          @if (hits().length) {
            <div class="group">{{ query() ? 'Series' : 'Recently charted' }}</div>
            <ts-search-results
              listboxId="ts-palette"
              [embedded]="true"
              [groupLabel]="query() ? 'Series' : 'Recently charted'"
              [indexOffset]="seriesOffset()"
              [hits]="hits()"
              [active]="active()"
              (hover)="active.set($event)"
              (pick)="pick($event)"
            />
          }

          @if (commandResults().length) {
            <div class="group" id="ts-palette-g-actions">Actions</div>
            <div role="group" aria-labelledby="ts-palette-g-actions">
              @for (c of commandResults(); track c.id; let i = $index) {
                <div
                  class="row"
                  role="option"
                  [attr.id]="'ts-palette-opt-' + (actionOffset() + i)"
                  [class.is-active]="active() === actionOffset() + i"
                  [attr.aria-selected]="active() === actionOffset() + i"
                  (mousedown)="$event.preventDefault()"
                  (mouseenter)="active.set(actionOffset() + i)"
                  (click)="pick(actionOffset() + i)"
                >
                  <lucide-icon class="cmdic" [name]="c.icon" [size]="15" />
                  <span class="name">{{ c.label }}</span>
                  @if (c.shortcut) {
                    <span class="kbd">{{ c.shortcut }}</span>
                  }
                </div>
              }
            </div>
          }

          @if (!total()) {
            <div class="empty">No matches for “{{ query() }}”</div>
          }
        </div>

        @if (evicted(); as ev) {
          <div class="evict" role="status">
            <span>{{ ev.symbol }} dropped (cap {{ sel.maxSeries() }})</span>
            <button class="evict__btn" (click)="undoEvict()">Undo</button>
            <button class="evict__btn" (click)="raiseCap()">Raise cap</button>
          </div>
        }

        <div class="foot">
          <span><span class="kbd">↑↓</span> navigate</span>
          <span><span class="kbd">↵</span> add</span>
          <span><span class="kbd">⌘↵</span> only this</span>
          <span class="foot__spacer"></span>
          <span class="foot__count" role="status" aria-live="polite">{{ countLabel() }}</span>
        </div>
      </div>
    </ng-template>
  `,
  styles: [
    `
      /* Position comes from the CDK overlay (global strategy, 18vh from the
         top), so the panel itself only describes its own box. */
      .panel {
        width: min(560px, calc(100vw - 32px));
        display: flex;
        flex-direction: column;
        background: var(--ts-bg-elevated);
        border: 1px solid var(--ts-border);
        border-radius: var(--ts-radius-lg);
        box-shadow: var(--ts-shadow-3);
        overflow: hidden;
      }
      .inputrow {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        padding: var(--ts-space-3) var(--ts-space-4);
        border-bottom: 1px solid var(--ts-border);
        color: var(--ts-text-muted);
      }
      .inputrow input {
        flex: 1;
        border: none;
        background: transparent;
        color: var(--ts-text-bright);
        font-size: var(--ts-fs-md);
        outline: none;
      }
      .inputrow input::placeholder {
        color: var(--ts-text-faint);
      }
      .list {
        max-height: 320px;
        overflow-y: auto;
        padding: var(--ts-space-2);
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .group {
        padding: var(--ts-space-2) var(--ts-space-2) var(--ts-space-1);
        font-size: var(--ts-fs-xxs);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--ts-text-muted);
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
        box-shadow: inset 2px 0 0 transparent;
      }
      .row.is-active {
        background: var(--ts-bg-active);
        color: var(--ts-text-bright);
        box-shadow: inset 2px 0 0 var(--ts-accent-strong);
      }
      .name {
        font-size: var(--ts-fs-sm);
        min-width: 0;
        flex: 1;
      }
      /* Only shown on the row you are on: a column of ✕ in a list you mostly
         read is noise, and a recent query is removed rarely. */
      .drop {
        display: flex;
        align-items: center;
        padding: 2px;
        border-radius: var(--ts-radius-xs);
        color: var(--ts-text-faint);
        cursor: pointer;
        opacity: 0;
      }
      .row:hover .drop,
      .row.is-active .drop,
      .drop:focus-visible {
        opacity: 1;
      }
      .drop:hover {
        color: var(--ts-text-bright);
        background: var(--ts-bg-inset);
      }
      .evict {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        padding: var(--ts-space-2) var(--ts-space-4);
        border-top: 1px solid var(--ts-border);
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-secondary);
      }
      .evict__btn {
        color: var(--ts-accent-strong);
        cursor: pointer;
        font-size: var(--ts-fs-xxs);
        font-weight: var(--ts-fw-semibold);
      }
      .foot__spacer {
        flex: 1;
      }
      .foot__count {
        color: var(--ts-text-muted);
        font-variant-numeric: tabular-nums;
      }
      .cmdic {
        color: var(--ts-text-muted);
        flex: none;
      }
      .kbd {
        padding: 1px 5px;
        border-radius: var(--ts-radius-xs);
        border: 1px solid var(--ts-border);
        background: var(--ts-bg-inset);
        color: var(--ts-text-muted);
        font-size: var(--ts-fs-xxs);
        font-family: var(--ts-font-mono);
        white-space: nowrap;
      }
      .empty {
        padding: var(--ts-space-4);
        text-align: center;
        color: var(--ts-text-muted);
        font-size: var(--ts-fs-sm);
      }
      .foot {
        display: flex;
        gap: var(--ts-space-4);
        padding: var(--ts-space-2) var(--ts-space-4);
        border-top: 1px solid var(--ts-border);
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-muted);
      }
    `,
  ],
})
export class CommandPaletteComponent {
  readonly svc = inject(CommandPaletteService);
  readonly sel = inject(SelectionService);
  readonly colors = inject(SeriesColorService);
  private readonly theme = inject(ThemeService);
  private readonly layout = inject(LayoutService);
  private readonly history = inject(HistoryService);
  private readonly cardActions = inject(CardActionsService);
  private readonly recentQ = inject(RecentQueriesService);
  private readonly overlay = inject(Overlay);
  private readonly vcr = inject(ViewContainerRef);

  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');
  private readonly panelTpl = viewChild.required<TemplateRef<unknown>>('panelTpl');
  private overlayRef: OverlayRef | null = null;
  /** Where focus came from, so closing puts it back rather than on <body>. */
  private returnFocusTo: HTMLElement | null = null;

  private readonly search = inject(SearchService);
  /** This surface's own session — the toolbar has a separate one so the two
   *  never overwrite each other's query, but both share provider and cache. */
  private readonly session = this.search.createSession({
    pageSize: 8,
    boostIds: () => this.sel.recentIds(),
  });

  readonly query = signal('');
  readonly active = signal(0);
  /** Reported so the user can undo an eviction they did not ask for. */
  readonly evicted = signal<{ id: string; symbol: string; added: string } | null>(null);
  /** Recently charted series, resolved through the provider (never the catalog). */
  private readonly recentHits = signal<readonly SeriesHit[]>([]);

  /** Recent QUERIES — text, not ids. Only useful before you start typing. */
  readonly recentQueries = computed(() =>
    this.query().trim() ? [] : this.recentQ.queries().slice(0, 5),
  );

  /** Empty query shows recently charted series; otherwise ranked provider hits. */
  readonly hits = computed(() =>
    this.query().trim() ? this.session.hits().slice(0, 8) : this.recentHits().slice(0, 6),
  );

  // One flat index space across the three groups, derived in one place — the
  // arithmetic used to be inlined at four call sites and drifted.
  readonly seriesOffset = computed(() => this.recentQueries().length);
  readonly actionOffset = computed(() => this.seriesOffset() + this.hits().length);
  readonly total = computed(() => this.actionOffset() + this.commandResults().length);

  readonly activeId = computed(() =>
    this.active() < this.total() ? `ts-palette-opt-${this.active()}` : null,
  );

  readonly countLabel = computed(() => {
    if (!this.query().trim()) return '';
    const total = this.session.total();
    const shown = this.hits().length;
    return total ? `${shown} of ${total} · ${this.session.took()} ms` : 'no matches';
  });

  /**
   * Actions, not settings. What earns a row here: it is destructive (and so
   * wants a keyboard path with a name attached), it exports, or it has no other
   * always-visible control. Layout/mode/panel toggles have one and were dropped.
   */
  private readonly commands = computed<Cmd[]>(() => {
    const cmds: Cmd[] = [];
    if (this.history.canUndo()) {
      cmds.push({
        id: 'undo',
        label: `Undo ${this.history.undoLabel()}`,
        icon: 'undo-2',
        shortcut: '⌘Z',
        run: () => this.history.undo(),
      });
    }
    if (this.history.canRedo()) {
      cmds.push({
        id: 'redo',
        label: `Redo ${this.history.redoLabel()}`,
        icon: 'redo-2',
        shortcut: '⌘⇧Z',
        run: () => this.history.redo(),
      });
    }
    if (this.sel.count()) {
      cmds.push({
        id: 'clear',
        label: `Clear selection (${this.sel.count()})`,
        icon: 'trash-2',
        run: () => this.sel.clear(),
      });
    }
    cmds.push(
      {
        id: 'csv',
        label: 'Download CSV',
        icon: 'download',
        run: () => {
          this.sel.setView('data');
          this.cardActions.withTable((t) => t.downloadCsv());
        },
      },
      {
        id: 'copy',
        label: 'Copy for Excel',
        icon: 'copy',
        run: () => {
          this.sel.setView('data');
          this.cardActions.withTable((t) => t.copyTable());
        },
      },
      {
        id: 'shot',
        label: 'Screenshot chart',
        icon: 'camera',
        run: () => {
          this.sel.setView('chart');
          this.cardActions.screenshot();
        },
      },
      {
        id: 'theme',
        label: this.theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        icon: this.theme.theme() === 'dark' ? 'sun' : 'moon',
        run: () => this.theme.toggleTheme(),
      },
      {
        id: 'reset',
        label: 'Reset panel layout',
        icon: 'refresh-cw',
        run: () => {
          this.layout.resetSizes();
          this.layout.closeDrawers();
        },
      },
    );
    return cmds;
  });

  readonly commandResults = computed<Cmd[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.commands();
    return q ? all.filter((c) => c.label.toLowerCase().includes(q)) : all;
  });

  constructor() {
    // Open/close drives the overlay. The body MUST be untracked: it writes the
    // signals the session reads, and a tracked write here re-ran the effect on
    // every keystroke and reset `query` straight back to empty.
    effect(() => {
      const open = this.svc.open();
      untracked(() => (open ? this.attach() : this.detach()));
    });

    // Recents are ids; rows need hits. Resolve through the provider so this
    // surface never reads the local catalog.
    effect(() => {
      const ids = this.sel.recentIds().slice(0, 6);
      untracked(() => {
        void this.search.lookup(ids).then((hits) => this.recentHits.set(hits));
      });
    });

    // Keep the highlighted row on screen — the list scrolls at ~8 rows and the
    // arrow keys used to walk the highlight straight out of view.
    effect(() => {
      const id = this.activeId();
      if (!id) return;
      untracked(() => {
        queueMicrotask(() =>
          document.getElementById(id)?.scrollIntoView({ block: 'nearest' }),
        );
      });
    });

    inject(DestroyRef).onDestroy(() => this.detach());
  }

  private attach(): void {
    if (this.overlayRef) return;
    this.returnFocusTo = document.activeElement as HTMLElement | null;
    this.query.set('');
    this.session.setQuery('');
    this.active.set(0);
    this.evicted.set(null);

    const ref = this.overlay.create({
      positionStrategy: this.overlay.position().global().centerHorizontally().top('18vh'),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: false,
      panelClass: 'ts-palette-pane',
    });
    ref.attach(new TemplatePortal(this.panelTpl(), this.vcr));
    // No backdrop element to click, so listen for pointer events that landed
    // outside — the panel still never covers the chart with a veil.
    ref.outsidePointerEvents().subscribe(() => this.svc.close());
    ref.keydownEvents().subscribe((e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // Stop here: the workspace's own Escape handler dismisses docks, and
        // closing the palette must not also close the tree behind it.
        e.stopPropagation();
        this.svc.close();
      }
    });
    this.overlayRef = ref;
    queueMicrotask(() => this.box()?.nativeElement.focus());
  }

  private detach(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.returnFocusTo?.focus?.();
    this.returnFocusTo = null;
  }

  onInput(v: string): void {
    this.query.set(v);
    this.session.setQuery(v);
    this.active.set(0);
  }

  forgetQuery(q: string, e: Event): void {
    e.stopPropagation();
    this.recentQ.remove(q);
  }

  undoEvict(): void {
    const ev = this.evicted();
    if (!ev) return;
    this.sel.restoreEvicted(ev.id, ev.added);
    this.evicted.set(null);
  }

  raiseCap(): void {
    this.sel.setMax(this.sel.maxSeries() + 2);
    const ev = this.evicted();
    if (ev) this.sel.add(ev.id);
    this.evicted.set(null);
  }

  onKey(e: KeyboardEvent): void {
    const total = this.total();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.active.update((a) => (total ? (a + 1) % total : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active.update((a) => (total ? (a - 1 + total) % total : 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.active.set(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      this.active.set(Math.max(0, total - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Cmd/Ctrl+Enter is the Bloomberg "GO" semantic: chart only this one.
      this.pick(this.active(), e.metaKey || e.ctrlKey);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.svc.close();
    }
  }

  pick(index: number, only = false): void {
    const queries = this.recentQueries();
    if (index < queries.length) {
      // Re-run the query rather than jumping to a result: the same words can
      // mean a different set today, and that is usually the point of repeating.
      this.onInput(queries[index]);
      const el = this.box()?.nativeElement;
      if (el) {
        el.value = queries[index];
        el.focus();
      }
      return;
    }

    const series = this.hits();
    const seriesIndex = index - this.seriesOffset();
    if (seriesIndex >= 0 && seriesIndex < series.length) {
      const hit = series[seriesIndex];
      if (hit.status && hit.status !== 'ok') return; // blocked rows explain themselves
      // A pick is the only honest "this query worked" signal — recording on
      // keystroke would fill the list with "t", "tt", "ttf".
      this.recentQ.push(this.query());
      if (only) {
        this.sel.select(hit.id);
        this.svc.close();
        return;
      }
      // Toggle + stay open: type the next ticker straight away. This conveyor
      // behaviour is what makes rapid multi-add work; do not "fix" it into a
      // dialog that closes on pick.
      const { evicted } = this.sel.toggle(hit.id);
      this.evicted.set(
        evicted ? { id: evicted, symbol: this.sel.symbolOf(evicted), added: hit.id } : null,
      );
      this.query.set('');
      this.session.setQuery('');
      this.active.set(0);
      const el = this.box()?.nativeElement;
      if (el) {
        el.value = '';
        el.focus();
      }
      return;
    }

    const cmd = this.commandResults()[index - this.actionOffset()];
    if (cmd) {
      cmd.run();
      this.svc.close();
    }
  }
}
