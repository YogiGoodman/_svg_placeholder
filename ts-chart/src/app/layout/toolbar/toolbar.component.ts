import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { LucideAngularModule } from 'lucide-angular';
import { ThemeService } from '../../core/theme.service';
import { TooltipDirective } from '../../core/tooltip.directive';
import { UserMenuComponent } from './user-menu.component';
import { ToolbarSearchComponent } from './toolbar-search.component';

export const APP_VERSION = '0.1.0';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    OverlayModule,
    LucideAngularModule,
    TooltipDirective,
    UserMenuComponent,
    ToolbarSearchComponent,
  ],
  template: `
    <header class="toolbar">
      <!-- Left cluster — panel toggles live on the rail, not here (no duplication) -->
      <div class="cluster">
        <div class="brand" aria-label="TS Chart">
          <span class="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <rect x="1.5" y="1.5" width="21" height="21" rx="6"
                    stroke="url(#lg)" stroke-width="1.5" />
              <path d="M4.5 15.5 L9 11 L12.5 13.5 L19.5 6.5"
                    stroke="url(#lg)" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="19.5" cy="6.5" r="2" fill="var(--ts-highlight)" />
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="24" y2="24">
                  <stop stop-color="var(--ts-accent-strong)" />
                  <stop offset="1" stop-color="var(--ts-accent)" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          <span class="wordmark">TS Chart</span>
        </div>

        <!-- Search lives in the toolbar because it is a primary action, not a
             panel toggle and not a preference — the two things doctrine keeps
             out of here. Anchored LEFT at a fixed width, terminal-style: the
             command line is a target you hit without looking, which a box that
             changes width with the window is not. -->
        <app-toolbar-search />
      </div>

      <span class="spacer"></span>

      <!-- Right cluster -->
      <div class="cluster">
        <button
          class="ts-icon-btn"
          (click)="theme.toggleTheme()"
          [tsTooltip]="theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        >
          <lucide-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="17" />
        </button>

        <div class="sep"></div>

        <!-- User menu trigger -->
        <button
          #trigger="cdkOverlayOrigin"
          cdkOverlayOrigin
          class="avatar"
          (click)="menuOpen = !menuOpen"
          [attr.aria-expanded]="menuOpen"
          tsTooltip="Account & preferences"
        >
          <span class="avatar__initial">U</span>
        </button>

        <ng-template
          cdkConnectedOverlay
          [cdkConnectedOverlayOrigin]="trigger"
          [cdkConnectedOverlayOpen]="menuOpen"
          [cdkConnectedOverlayHasBackdrop]="true"
          cdkConnectedOverlayBackdropClass="ts-backdrop"
          [cdkConnectedOverlayPositions]="positions"
          (backdropClick)="menuOpen = false"
          (detach)="menuOpen = false"
        >
          <app-user-menu [version]="version" (close)="menuOpen = false" />
        </ng-template>
      </div>
    </header>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        height: var(--ts-toolbar-h);
        padding: 0 var(--ts-space-3);
        background: var(--ts-bg-elevated);
        border-bottom: 1px solid var(--ts-border);
        z-index: var(--ts-z-toolbar);
      }
      .cluster {
        display: flex;
        align-items: center;
        gap: var(--ts-space-1);
      }
      app-toolbar-search {
        margin-left: var(--ts-space-4);
      }
      .spacer {
        flex: 1 1 auto;
        min-width: var(--ts-space-4);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        padding-left: var(--ts-space-2);
      }
      .logo {
        display: inline-flex;
      }
      .wordmark {
        font-size: var(--ts-fs-lg);
        font-weight: var(--ts-fw-semibold);
        letter-spacing: -0.01em;
        color: var(--ts-text-bright);
      }
      .sep {
        width: 1px;
        height: 20px;
        background: var(--ts-border);
        margin: 0 var(--ts-space-1);
      }
      /* Neutral — accent blue is reserved for interactive signal, not decor. */
      .avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: var(--ts-radius-pill);
        background: var(--ts-bg-active);
        border: 1px solid var(--ts-border-strong);
        color: var(--ts-text-bright);
        cursor: pointer;
        transition: transform var(--ts-dur-1) var(--ts-ease),
          box-shadow var(--ts-dur-1) var(--ts-ease);
      }
      .avatar:hover {
        transform: translateY(-1px);
        box-shadow: 0 0 0 3px var(--ts-accent-weak);
      }
      .avatar__initial {
        font-size: var(--ts-fs-md);
        font-weight: var(--ts-fw-bold);
      }
      @media (max-width: 767px) {
        .ts-badge {
          display: none;
        }
      }
    `,
  ],
})
export class ToolbarComponent {
  readonly theme = inject(ThemeService);
  readonly version = APP_VERSION;
  menuOpen = false;

  // Anchor menu to bottom-right of the avatar.
  readonly positions = [
    {
      originX: 'end' as const,
      originY: 'bottom' as const,
      overlayX: 'end' as const,
      overlayY: 'top' as const,
      offsetY: 8,
    },
  ];
}
