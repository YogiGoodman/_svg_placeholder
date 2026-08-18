import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injectable,
  signal,
  viewChild,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SelectionService } from '../../core/selection.service';
import { SeriesColorService } from '../../core/series-color.service';
import { ThemeService } from '../../core/theme.service';
import { LayoutService } from '../../core/layout.service';
import { MODE_META } from '../../core/modes';
import { searchSeries } from '../../data/series-catalog.data';
import { SeriesMeta } from '../../data/models';

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
  imports: [LucideAngularModule],
  template: `
    @if (svc.open()) {
      <div class="scrim" (click)="svc.close()"></div>
      <div class="panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="inputrow">
          <lucide-icon name="search" [size]="16" />
          <input
            #box
            type="text"
            placeholder="Type a ticker or command…"
            [value]="query()"
            (input)="query.set(box.value); active.set(0)"
            (keydown)="onKey($event)"
            spellcheck="false"
            autocomplete="off"
          />
          <span class="kbd">esc</span>
        </div>

        <div class="list">
          @if (seriesResults().length) {
            <div class="group">{{ query() ? 'Series' : 'Recent' }}</div>
            @for (s of seriesResults(); track s.id; let i = $index) {
              <button
                class="row"
                [class.is-active]="active() === i"
                (mouseenter)="active.set(i)"
                (click)="pick(i)"
              >
                <span
                  class="dot"
                  [style.background]="sel.isSelected(s.id) ? colors.color(s.id) : 'transparent'"
                ></span>
                <span class="sym ts-mono">{{ s.symbol }}</span>
                <span class="name ts-truncate">{{ s.name }}</span>
                <span class="path ts-truncate">{{ s.path.join(' › ') }}</span>
                @if (sel.isSelected(s.id)) {
                  <lucide-icon class="on" name="check" [size]="14" />
                }
              </button>
            }
          }
          @if (commandResults().length) {
            <div class="group">Commands</div>
            @for (c of commandResults(); track c.id; let i = $index) {
              <button
                class="row"
                [class.is-active]="active() === seriesResults().length + i"
                (mouseenter)="active.set(seriesResults().length + i)"
                (click)="pick(seriesResults().length + i)"
              >
                <lucide-icon class="cmdic" [name]="c.icon" [size]="15" />
                <span class="name">{{ c.label }}</span>
                @if (c.shortcut) {
                  <span class="kbd">{{ c.shortcut }}</span>
                }
              </button>
            }
          }
          @if (!seriesResults().length && !commandResults().length) {
            <div class="empty">No matches for “{{ query() }}”</div>
          }
        </div>

        <div class="foot">
          <span><span class="kbd">↑↓</span> navigate</span>
          <span><span class="kbd">↵</span> select</span>
          <span><span class="kbd">esc</span> close</span>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 90;
        background: color-mix(in srgb, var(--ts-bg) 55%, transparent);
        backdrop-filter: blur(2px);
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
      }
      .row.is-active {
        background: var(--ts-bg-active);
        color: var(--ts-text-bright);
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex: none;
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
      .on {
        color: var(--ts-accent-strong);
        flex: none;
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

  readonly query = signal('');
  readonly active = signal(0);

  readonly seriesResults = computed<SeriesMeta[]>(() => {
    const q = this.query().trim();
    return q ? searchSeries(q).slice(0, 8) : this.sel.recent().slice(0, 6);
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
    // Focus the input every time the palette opens; reset state on close.
    effect(() => {
      if (this.svc.open()) {
        this.query.set('');
        this.active.set(0);
        queueMicrotask(() => this.box()?.nativeElement.focus());
      }
    });
  }

  onKey(e: KeyboardEvent): void {
    const total = this.seriesResults().length + this.commandResults().length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.active.update((a) => (total ? (a + 1) % total : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active.update((a) => (total ? (a - 1 + total) % total : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.pick(this.active());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.svc.close();
    }
  }

  pick(index: number): void {
    const series = this.seriesResults();
    if (index < series.length) {
      // Toggle + stay open: type the next ticker straight away.
      this.sel.toggle(series[index].id);
      this.query.set('');
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
