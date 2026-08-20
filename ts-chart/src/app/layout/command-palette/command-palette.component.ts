import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injectable,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SelectionService } from '../../core/selection.service';
import { SeriesColorService } from '../../core/series-color.service';
import { ThemeService } from '../../core/theme.service';
import { LayoutService } from '../../core/layout.service';
import { MODE_META } from '../../core/modes';
import { SearchService } from '../../search/search.service';
import { toHit } from '../../search/search.types';
import { SERIES } from '../../data/series-catalog.data';
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
 * ⌘K command palette — Bloomberg-style type-ticker-to-chart plus core app
 * commands. Series selection keeps the palette open (rapid multi-add); the
 * input clears after each pick so the next ticker types straight in.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, SearchResultsComponent],
  template: `
    @if (svc.open()) {
      <!-- No scrim. This is the surface a trader opens WHILE watching the tape;
           a veil over live data failed desk review, and blur reads as a smudge.
           Separation is elevation and shadow. Outside click closes it. -->
      <div class="catcher" (click)="svc.close()"></div>
      <div class="panel" role="dialog" aria-label="Command palette">
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

        <div class="list">
          @if (hits().length) {
            <div class="group">{{ query() ? 'Series' : 'Recent' }}</div>
            <ts-search-results
              listboxId="ts-palette"
              [hits]="hits()"
              [active]="active()"
              (hover)="active.set($event)"
              (pick)="pick($event)"
            />
          }
          @if (commandResults().length) {
            <div class="group">Commands</div>
            @for (c of commandResults(); track c.id; let i = $index) {
              <button
                class="row"
                [class.is-active]="active() === hits().length + i"
                (mouseenter)="active.set(hits().length + i)"
                (click)="pick(hits().length + i)"
              >
                <lucide-icon class="cmdic" [name]="c.icon" [size]="15" />
                <span class="name">{{ c.label }}</span>
                @if (c.shortcut) {
                  <span class="kbd">{{ c.shortcut }}</span>
                }
              </button>
            }
          }
          @if (!hits().length && !commandResults().length) {
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
    }
  `,
  styles: [
    `
      /* Invisible click-catcher, not a veil: it closes the panel on an outside
         click without putting anything between the trader and the chart. */
      .catcher {
        position: fixed;
        inset: 0;
        z-index: 90;
      }
      .panel {
        position: fixed;
        top: 18vh;
        left: 50%;
        transform: translateX(-50%);
        z-index: 91;
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

  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');

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

  /** Empty query shows recents; otherwise ranked provider hits. */
  readonly hits = computed(() =>
    this.query().trim()
      ? this.session.hits().slice(0, 8)
      : this.sel.recent().slice(0, 6).map((m) => toHit(m)),
  );

  readonly activeId = computed(() =>
    this.active() < this.hits().length ? `ts-palette-opt-${this.active()}` : null,
  );

  readonly countLabel = computed(() => {
    if (!this.query().trim()) return '';
    const total = this.session.total();
    const shown = this.hits().length;
    return total ? `${shown} of ${total} · ${this.session.took()} ms` : 'no matches';
  });

  private readonly commands = computed<Cmd[]>(() => {
    const cmds: Cmd[] = [
      {
        id: 'theme',
        label: this.theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        icon: this.theme.theme() === 'dark' ? 'sun' : 'moon',
        run: () => this.theme.toggleTheme(),
      },
      {
        id: 'view',
        label: this.sel.view() === 'chart' ? 'Show data table' : 'Show chart',
        icon: this.sel.view() === 'chart' ? 'table' : 'chart-line',
        run: () => this.sel.toggleView(),
      },
      {
        id: 'layout-overlay',
        label: 'Layout: Overlay',
        icon: 'layers',
        run: () => this.sel.setLayout('overlay'),
      },
      {
        id: 'layout-split',
        label: 'Layout: Split panes',
        icon: 'columns-3',
        run: () => this.sel.setLayout('split'),
      },
      {
        id: 'layout-single',
        label: 'Layout: Single',
        icon: 'square',
        run: () => this.sel.setLayout('single'),
      },
      ...MODE_META.filter((m) => this.sel.allowedModes().includes(m.id)).map((m) => ({
        id: `mode-${m.id}`,
        label: `Mode: ${m.label}`,
        icon: 'chart-line',
        run: () => this.sel.setChartMode(m.id),
      })),
      {
        id: 'nav',
        label: 'Toggle navigation panel',
        icon: 'panel-left',
        shortcut: '⌘/',
        run: () => this.layout.toggleLeft(),
      },
      {
        id: 'details',
        label: 'Toggle details panel',
        icon: 'panel-right',
        shortcut: '⌘.',
        run: () => this.layout.showRight('details'),
      },
      {
        id: 'dxtree',
        label: 'Toggle DevExtreme tree (POC)',
        icon: 'list-tree',
        run: () => this.layout.showRight('dxTree'),
      },
      {
        id: 'clear',
        label: `Clear selection${this.sel.count() ? ` (${this.sel.count()})` : ''}`,
        icon: 'trash-2',
        run: () => this.sel.clear(),
      },
    ];
    return cmds;
  });

  readonly commandResults = computed<Cmd[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.commands();
    return q ? all.filter((c) => c.label.toLowerCase().includes(q)) : all;
  });

  constructor() {
    // Focus the input every time the palette opens, and reset state.
    //
    // The body MUST be untracked. `session.setQuery()` reads the session's own
    // signals on the way through, which would register them as dependencies of
    // this effect — and since the effect also writes them, every keystroke
    // re-ran it and reset `query` straight back to empty. The only dependency
    // this effect should have is `svc.open()`.
    effect(() => {
      const open = this.svc.open();
      untracked(() => {
        if (!open) return;
        this.query.set('');
        this.session.setQuery('');
        this.active.set(0);
        this.evicted.set(null);
        queueMicrotask(() => this.box()?.nativeElement.focus());
      });
    });
  }

  onInput(v: string): void {
    this.query.set(v);
    this.session.setQuery(v);
    this.active.set(0);
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
    const total = this.hits().length + this.commandResults().length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.active.update((a) => (total ? (a + 1) % total : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active.update((a) => (total ? (a - 1 + total) % total : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Cmd/Ctrl+Enter is the Bloomberg "GO" semantic: chart only this one.
      this.pick(this.active(), e.metaKey || e.ctrlKey);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.svc.close();
    }
  }

  pick(index: number, only = false): void {
    const series = this.hits();
    if (index < series.length) {
      const hit = series[index];
      if (hit.status && hit.status !== 'ok') return; // blocked rows explain themselves
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
        evicted ? { id: evicted, symbol: SERIES[evicted]?.symbol ?? evicted, added: hit.id } : null,
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
    const cmd = this.commandResults()[index - series.length];
    if (cmd) {
      cmd.run();
      this.svc.close();
    }
  }
}
