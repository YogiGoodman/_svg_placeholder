import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TooltipDirective } from '../../core/tooltip.directive';
import { Density, ThemeService } from '../../core/theme.service';
import { MarkerMode, SeriesColorService } from '../../core/series-color.service';
import { PALETTE_LIST } from '../../core/series-palettes';
import { LayoutService } from '../../core/layout.service';
import { SelectionService } from '../../core/selection.service';
import { TreeStateService } from '../../core/tree-state.service';
import { ExportService } from '../../core/export.service';

/** Popover surface: identity, version, and quick preferences. */
@Component({
  selector: 'app-user-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, TooltipDirective],
  template: `
    <div class="menu ts-panel" role="menu">
      <!-- Identity -->
      <div class="identity">
        <span class="avatar">U</span>
        <div class="identity__text">
          <span class="name ts-truncate">User</span>
        </div>
      </div>

      <hr class="ts-divider" />

      <!-- Preferences (theme lives in the toolbar toggle — not duplicated here) -->
      <div class="group">
        <span class="group__label">Appearance</span>

        <div class="pref">
          <span class="pref__label">
            <lucide-icon name="layout-grid" [size]="15" /> Density
          </span>
          <div class="ts-segmented">
            <button
              [class.is-active]="theme.density() === 'comfortable'"
              (click)="setDensity('comfortable')"
            >
              Cozy
            </button>
            <button
              [class.is-active]="theme.density() === 'compact'"
              (click)="setDensity('compact')"
            >
              Compact
            </button>
          </div>
        </div>
      </div>

      <hr class="ts-divider" />

      <div class="group">
        <span class="group__label">Accessibility</span>

        <div class="pref pref--col">
          <span class="pref__label">
            <lucide-icon name="accessibility" [size]="15" /> Series colors
          </span>
          <div class="palettes">
            @for (p of palettes; track p.id) {
              <button
                class="pal"
                [class.is-active]="colors.palette() === p.id"
                (click)="colors.setPalette(p.id)"
                [tsTooltip]="p.hint"
              >
                <span class="pal__name">{{ p.label }}</span>
                <!-- Live preview: choosing a palette for a condition you have
                     is a judgement you can only make by looking at it. -->
                <span class="pal__swatches">
                  @for (e of p.entries; track $index) {
                    <span class="pal__sw" [style.background]="theme.theme() === 'dark' ? e.dark : e.light"></span>
                  }
                </span>
              </button>
            }
          </div>
        </div>

        <div class="pref">
          <span class="pref__label">
            <lucide-icon name="crosshair" [size]="15" /> Line markers
          </span>
          <div class="ts-segmented">
            @for (m of markerModes; track m.id) {
              <button
                [class.is-active]="colors.markerMode() === m.id"
                (click)="colors.setMarkerMode(m.id)"
                [tsTooltip]="m.hint"
              >
                {{ m.label }}
              </button>
            }
          </div>
        </div>
      </div>

      <div class="group">
        <span class="group__label">Chart</span>
        <div class="pref pref--col">
          <span class="pref__label">
            <lucide-icon name="layers" [size]="15" /> Max series on chart
          </span>
          <div class="ts-segmented">
            @for (n of maxOptions; track n) {
              <button
                [class.is-active]="sel.maxSeries() === n"
                (click)="sel.setMax(n)"
              >
                {{ n }}
              </button>
            }
          </div>
        </div>
        <div class="pref">
          <span class="pref__label">
            <lucide-icon name="crosshair" [size]="15" /> Crosshair tooltip
          </span>
          <div class="ts-segmented">
            <button [class.is-active]="!sel.hoverCard()" (click)="sel.hoverCard.set(false)">
              Off
            </button>
            <button [class.is-active]="sel.hoverCard()" (click)="sel.hoverCard.set(true)">
              On
            </button>
          </div>
        </div>
      </div>

      <hr class="ts-divider" />

      <div class="group">
        <span class="group__label">Tree</span>
        <div class="pref pref--col">
          <span class="pref__label">
            <lucide-icon name="list-tree" [size]="15" /> Children before "show more"
          </span>
          <div class="ts-segmented">
            @for (n of childLimitOptions; track n) {
              <button
                [class.is-active]="tree.childLimit() === n"
                (click)="tree.setChildLimit(n)"
              >
                {{ n === 0 ? 'All' : n }}
              </button>
            }
          </div>
        </div>
      </div>

      <hr class="ts-divider" />

      <div class="group">
        <span class="group__label">Workspace</span>
        <button class="row" (click)="resetLayout()">
          <lucide-icon name="refresh-cw" [size]="15" />
          Reset panel layout
        </button>
        <button class="row" [disabled]="exporting()" (click)="exportKit()">
          <lucide-icon name="download" [size]="15" />
          {{ exporting() ? 'Preparing…' : 'Export design kit' }}
          <span class="row__hint">.zip</span>
        </button>
      </div>

      <hr class="ts-divider" />

      <!-- Footer -->
      <div class="footer">
        <span class="ts-mono">TS Chart</span>
        <span class="ts-badge ts-badge--accent">v{{ version }}</span>
      </div>
    </div>
  `,
  styles: [
    `
      .menu {
        width: 288px;
        padding: var(--ts-space-3);
        box-shadow: var(--ts-shadow-3);
        animation: pop var(--ts-dur-2) var(--ts-ease-out);
      }
      @keyframes pop {
        from {
          opacity: 0;
          transform: translateY(-6px) scale(0.98);
        }
      }
      .identity {
        display: flex;
        align-items: center;
        gap: var(--ts-space-3);
        padding: var(--ts-space-1) var(--ts-space-1) var(--ts-space-2);
      }
      .avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        flex: none;
        border-radius: var(--ts-radius-pill);
        background: var(--ts-bg-active);
        border: 1px solid var(--ts-border-strong);
        color: var(--ts-text-bright);
        font-weight: var(--ts-fw-bold);
        font-size: var(--ts-fs-lg);
      }
      .identity__text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .name {
        font-weight: var(--ts-fw-semibold);
        color: var(--ts-text-bright);
        font-size: var(--ts-fs-md);
      }
      .email {
        font-size: var(--ts-fs-xs);
        color: var(--ts-text-muted);
      }
      .group {
        display: flex;
        flex-direction: column;
        gap: var(--ts-space-2);
        padding: var(--ts-space-1);
      }
      .palettes {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .pal {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ts-space-2);
        padding: var(--ts-space-1) var(--ts-space-2);
        border-radius: var(--ts-radius-sm);
        color: var(--ts-text-secondary);
        font-size: var(--ts-fs-xs);
        cursor: pointer;
        text-align: left;
      }
      .pal:hover {
        background: var(--ts-bg-hover);
        color: var(--ts-text-bright);
      }
      /* Active state is a border plus a tint, never a tint alone — this is the
         one menu a color-blind user is most likely to be reading. */
      .pal.is-active {
        background: var(--ts-accent-weak);
        color: var(--ts-text-bright);
        box-shadow: inset 2px 0 0 var(--ts-accent-strong);
      }
      .pal__name {
        white-space: nowrap;
      }
      .pal__swatches {
        display: inline-flex;
        gap: 2px;
        flex: none;
      }
      .pal__sw {
        width: 7px;
        height: 12px;
        border-radius: 1px;
      }
      .group__label {
        font-size: var(--ts-fs-xxs);
        font-weight: var(--ts-fw-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ts-text-muted);
      }
      .pref {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ts-space-2);
      }
      .pref--col {
        flex-direction: column;
        align-items: stretch;
        gap: var(--ts-space-2);
      }
      .pref--col .ts-segmented {
        justify-content: space-between;
      }
      .pref--col .ts-segmented button {
        flex: 1;
        justify-content: center;
      }
      .pref__label {
        display: inline-flex;
        align-items: center;
        gap: var(--ts-space-2);
        font-size: var(--ts-fs-sm);
        color: var(--ts-text-secondary);
      }
      .pref__label lucide-icon {
        color: var(--ts-text-muted);
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        width: 100%;
        padding: var(--ts-space-2);
        border-radius: var(--ts-radius-sm);
        font-size: var(--ts-fs-sm);
        color: var(--ts-text-secondary);
        cursor: pointer;
        transition: background var(--ts-dur-1) var(--ts-ease);
      }
      .row:hover {
        background: var(--ts-bg-hover);
        color: var(--ts-text-bright);
      }
      .row:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .row__hint {
        margin-left: auto;
        font-family: var(--ts-font-mono);
        font-size: var(--ts-fs-xxs);
        color: var(--ts-text-faint);
      }
      .footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--ts-space-1) var(--ts-space-1) 0;
        font-size: var(--ts-fs-xs);
        color: var(--ts-text-muted);
      }
    `,
  ],
})
export class UserMenuComponent {
  @Input() version = '0.0.0';
  @Output() close = new EventEmitter<void>();

  readonly theme = inject(ThemeService);
  readonly sel = inject(SelectionService);
  readonly tree = inject(TreeStateService);
  private readonly layout = inject(LayoutService);
  readonly colors = inject(SeriesColorService);

  readonly palettes = PALETTE_LIST;
  readonly markerModes: { id: MarkerMode; label: string; hint: string }[] = [
    { id: 'auto', label: 'Auto', hint: 'On for palettes that need shape to tell series apart' },
    { id: 'always', label: 'On', hint: 'Always mark lines with their identity shape' },
    { id: 'never', label: 'Off', hint: 'Color and the right-edge label only' },
  ];
  private readonly exportSvc = inject(ExportService);

  readonly maxOptions = [4, 6, 8, 10, 12];
  /** 0 = no cap. A long curve is unreadable long before it is slow. */
  readonly childLimitOptions = [8, 12, 20, 0];
  readonly exporting = signal(false);

  setDensity(d: Density): void {
    this.theme.setDensity(d);
  }

  async exportKit(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      await this.exportSvc.downloadDesignKit();
    } finally {
      this.exporting.set(false);
    }
  }

  resetLayout(): void {
    this.layout.resetSizes();
    this.layout.closeDrawers(); // chart-first default: overlays closed
    this.close.emit();
  }
}
