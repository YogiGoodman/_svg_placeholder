import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { LayoutService } from '../../core/layout.service';
import { TooltipDirective } from '../../core/tooltip.directive';
import { LeftPanelComponent } from '../left-panel/left-panel.component';
import { ChartPanelComponent } from '../center-panel/chart-panel.component';
import { InfoPanelComponent } from '../right-panel/info-panel.component';

/**
 * Chart-first shell: a slim icon rail + docked chrome + the chart card. The tree
 * is a PERSISTENT left dock (open by default — a primary driver); series details
 * are a non-modal right dock. Docks sit in normal flow so the chart flexes beside
 * them and is NEVER veiled — no scrim, no blur (fails trading-desk review). On
 * small screens docks collapse to fixed overlays. Rail owns toggling; each dock
 * also carries its own close control.
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
      <!-- Icon rail: single toggle owner for both docks (⌘K is the fast path) -->
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

      <!-- Left dock: tree + search (persistent, in-flow) -->
      @if (!layout.leftCollapsed()) {
        <aside class="dock dock--left">
          <app-left-panel (close)="layout.toggleLeft()" />
        </aside>
      }

      <div class="center">
        <app-chart-panel />
      </div>

      <!-- Right dock: series inspector (non-modal, in-flow) -->
      @if (!layout.rightCollapsed()) {
        <aside class="dock dock--right">
          <app-info-panel (close)="layout.toggleRight()" />
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
      /* In-flow docks: the chart flexes beside them, never under them. */
      .dock {
        flex: none;
        width: min(340px, 32vw);
        min-height: 0;
        background: var(--ts-bg-elevated);
        overflow: hidden;
      }
      .dock--left {
        border-right: 1px solid var(--ts-border);
        animation: slideL var(--ts-dur-2) var(--ts-ease-out);
      }
      .dock--right {
        border-left: 1px solid var(--ts-border);
        animation: slideR var(--ts-dur-2) var(--ts-ease-out);
      }
      /* Small screens: docks collapse to fixed overlays (no scrim, no blur). */
      @media (max-width: 767px) {
        .dock {
          position: fixed;
          top: var(--ts-toolbar-h);
          bottom: 0;
          z-index: calc(var(--ts-z-drawer) + 1);
          width: min(86vw, 340px);
          box-shadow: var(--ts-shadow-3);
        }
        .dock--left {
          left: 48px;
        }
        .dock--right {
          right: 0;
        }
      }
      @keyframes slideL {
        from {
          transform: translateX(-12px);
          opacity: 0;
        }
      }
      @keyframes slideR {
        from {
          transform: translateX(12px);
          opacity: 0;
        }
      }
    `,
  ],
})
export class WorkspaceComponent {
  readonly layout = inject(LayoutService);

  @HostListener('window:keydown.escape')
  onEscape(): void {
    // Progressive dismiss: transient inspector first, then the tree dock.
    if (!this.layout.rightCollapsed()) {
      this.layout.toggleRight();
    } else if (!this.layout.leftCollapsed()) {
      this.layout.toggleLeft();
    }
  }
}
