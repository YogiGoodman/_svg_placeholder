import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { LayoutService } from '../../core/layout.service';
import { TooltipDirective } from '../../core/tooltip.directive';
import { LeftPanelComponent } from '../left-panel/left-panel.component';
import { ChartPanelComponent } from '../center-panel/chart-panel.component';
import { InfoPanelComponent } from '../right-panel/info-panel.component';

/**
 * Chart-first shell: a slim icon rail + the chart card. Selection (tree/search)
 * and series details are TRANSIENT overlays, not permanent panels — the chart
 * owns the pixels; chrome appears on demand and leaves on Esc/scrim.
 */
@Component({
  selector: 'app-workspace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    TooltipDirective,
    LeftPanelComponent,
    ChartPanelComponent,
    InfoPanelComponent,
  ],
  template: `
    <div class="shell">
      <!-- Icon rail: the browse entry point (⌘K is the fast path) -->
      <nav class="rail">
        <button
          class="rail__btn"
          [class.is-active]="!layout.leftCollapsed()"
          (click)="layout.toggleLeft()"
          tsTooltip="Browse series (⌘/)"
          [attr.aria-expanded]="!layout.leftCollapsed()"
        >
          <lucide-icon name="search" [size]="18" />
        </button>
        <button
          class="rail__btn"
          [class.is-active]="!layout.rightCollapsed()"
          (click)="layout.toggleRight()"
          tsTooltip="Series details (⌘.)"
          [attr.aria-expanded]="!layout.rightCollapsed()"
        >
          <lucide-icon name="info" [size]="18" />
        </button>
      </nav>

      <div class="center">
        <app-chart-panel />
      </div>

      <!-- Browse drawer (tree + search) -->
      @if (!layout.leftCollapsed()) {
        <div class="scrim" (click)="layout.toggleLeft()"></div>
        <aside class="drawer drawer--left">
          <app-left-panel />
        </aside>
      }

      <!-- Series inspector -->
      @if (!layout.rightCollapsed()) {
        <div class="scrim" (click)="layout.toggleRight()"></div>
        <aside class="drawer drawer--right">
          <app-info-panel />
        </aside>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
        background: var(--ts-bg);
      }
      .shell {
        position: relative;
        display: flex;
        height: 100%;
        min-height: 0;
      }
      .rail {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--ts-space-2);
        width: 48px;
        flex: none;
        padding: var(--ts-space-3) 0;
        background: var(--ts-bg-elevated);
        border-right: 1px solid var(--ts-border);
      }
      .rail__btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: var(--ts-radius-sm);
        color: var(--ts-text-muted);
        cursor: pointer;
        transition:
          background var(--ts-dur-1) var(--ts-ease),
          color var(--ts-dur-1) var(--ts-ease);
      }
      .rail__btn:hover {
        background: var(--ts-bg-hover);
        color: var(--ts-text-bright);
      }
      .rail__btn.is-active {
        background: var(--ts-accent-weak);
        color: var(--ts-accent-strong);
      }
      .center {
        flex: 1;
        min-width: 0;
        min-height: 0;
      }
      .scrim {
        position: fixed;
        inset: var(--ts-toolbar-h) 0 0 0;
        z-index: var(--ts-z-drawer);
        background: var(--ts-bg-scrim);
        backdrop-filter: blur(2px);
        animation: fade var(--ts-dur-2) var(--ts-ease);
      }
      .drawer {
        position: fixed;
        top: var(--ts-toolbar-h);
        bottom: 0;
        z-index: calc(var(--ts-z-drawer) + 1);
        width: min(86vw, 340px);
        background: var(--ts-bg-elevated);
        box-shadow: var(--ts-shadow-3);
      }
      .drawer--left {
        left: 48px;
        border-right: 1px solid var(--ts-border);
        animation: slideL var(--ts-dur-3) var(--ts-ease-out);
      }
      .drawer--right {
        right: 0;
        border-left: 1px solid var(--ts-border);
        animation: slideR var(--ts-dur-3) var(--ts-ease-out);
      }
      @media (max-width: 767px) {
        .drawer--left {
          left: 0;
        }
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
      @keyframes slideL {
        from {
          transform: translateX(-100%);
        }
      }
      @keyframes slideR {
        from {
          transform: translateX(100%);
        }
      }
    `,
  ],
})
export class WorkspaceComponent {
  readonly layout = inject(LayoutService);

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (!this.layout.leftCollapsed() || !this.layout.rightCollapsed()) {
      this.layout.closeDrawers();
    }
  }
}
