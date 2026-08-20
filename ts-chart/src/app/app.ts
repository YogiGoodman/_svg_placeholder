import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
} from '@angular/core';
import { ThemeService } from './core/theme.service';
import { LayoutService } from './core/layout.service';
import { SelectionService } from './core/selection.service';
import { ToolbarComponent } from './layout/toolbar/toolbar.component';
import { WorkspaceComponent } from './layout/workspace/workspace.component';
import {
  CommandPaletteComponent,
  CommandPaletteService,
} from './layout/command-palette/command-palette.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToolbarComponent, WorkspaceComponent, CommandPaletteComponent],
  template: `
    <div class="shell">
      <app-toolbar />
      <main class="stage">
        <app-workspace />
      </main>
    </div>
    <app-command-palette />
  `,
  styleUrl: './app.scss',
})
export class App {
  private readonly layout = inject(LayoutService);
  // Instantiate ThemeService eagerly so <html> attributes are set on boot.
  private readonly theme = inject(ThemeService);
  private readonly selection = inject(SelectionService);
  private readonly palette = inject(CommandPaletteService);

  constructor() {
    // Optional deep-link (shareable): ?series=<id>[,<id>…]&mode=<mode>&layout=<layout>
    const params = new URLSearchParams(location.search);
    const raw = params.get('series');
    if (raw) {
      for (const id of raw.split(',').map((x) => x.trim()).filter(Boolean)) {
        this.selection.add(id);
      }
    }
    const mode = params.get('mode');
    if (mode) this.selection.setChartMode(mode as never);
    const layout = params.get('layout');
    if (layout === 'split' || layout === 'overlay') this.selection.setLayout(layout);
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const mod = e.metaKey || e.ctrlKey;
    // Bare "/" focuses search, but only when the user is not already typing —
    // stealing a slash mid-query would be worse than not having the shortcut.
    const el = e.target as HTMLElement | null;
    const typing =
      el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable === true;
    if (!mod && e.key === '/' && !typing) {
      e.preventDefault();
      document.querySelector<HTMLInputElement>('app-toolbar-search input')?.focus();
      return;
    }
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.palette.toggle();
    } else if (mod && e.key === '/') {
      e.preventDefault();
      this.layout.toggleLeft();
    } else if (mod && e.key === '.') {
      e.preventDefault();
      this.layout.toggleRight();
    }
  }
}
