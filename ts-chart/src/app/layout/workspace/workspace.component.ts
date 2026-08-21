import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { LayoutService } from '../../core/layout.service';
import { TooltipDirective } from '../../core/tooltip.directive';
import { LeftPanelComponent } from '../left-panel/left-panel.component';
import { ChartPanelComponent } from '../center-panel/chart-panel.component';
import { InfoPanelComponent } from '../right-panel/info-panel.component';
import { DxBrowsePanelComponent } from '../right-panel/dx-tree/dx-browse-panel.component';

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
    DxBrowsePanelComponent,
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
          [class.is-active]="!layout.rightCollapsed() && layout.rightView() === 'details'"
          (click)="layout.showRight('details')"
          tsTooltip="Series details (⌘.)"
          [attr.aria-expanded]="!layout.rightCollapsed() && layout.rightView() === 'details'"
        >
          <lucide-icon name="info" [size]="18" />
        </button>
        <button
          class="rail__btn"
          [class.is-active]="!layout.rightCollapsed() && layout.rightView() === 'dxTree'"
          (click)="layout.showRight('dxTree')"
          tsTooltip="DevExtreme tree (POC)"
          [attr.aria-expanded]="!layout.rightCollapsed() && layout.rightView() === 'dxTree'"
        >
          <lucide-icon name="list-tree" [size]="18" />
        </button>
      </nav>

      <!-- Left dock: tree + search (persistent, in-flow) -->
      @if (!layout.leftCollapsed()) {
        <aside class="dock dock--left" [style.width.px]="layout.leftWidth()">
          <app-left-panel (close)="layout.toggleLeft()" />
        </aside>
        <!-- Resizer. Occupies ZERO layout width — its hit area and its visible
             line are both absolutely positioned, straddling the dock border — so
             adding it moves nothing. It stays invisible until you hover it: a
             permanently-drawn gutter is chrome competing with the chart for
             attention, and this is a control you reach for rarely. -->
        <div
          class="resizer"
          [class.is-dragging]="resizing()"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize browse panel"
          [attr.aria-valuenow]="layout.leftWidth()"
          aria-valuemin="240"
          aria-valuemax="520"
          tabindex="0"
          (pointerdown)="onResizeStart($event)"
          (pointermove)="onResizeMove($event)"
          (pointerup)="onResizeEnd($event)"
          (pointercancel)="onResizeEnd($event)"
          (lostpointercapture)="onResizeEnd($event)"
          (dblclick)="layout.resetSizes()"
          (keydown)="onResizeKey($event)"
        ></div>
      }

      <div class="center">
        <app-chart-panel />
      </div>

      <!-- Right dock: series inspector or DX tree (non-modal, in-flow) -->
      @if (!layout.rightCollapsed()) {
        <aside class="dock dock--right">
          @switch (layout.rightView()) {
            @case ('details') {
              <app-info-panel (close)="layout.toggleRight()" />
            }
            @case ('dxTree') {
              <!-- DevExtreme is ~1.5MB of JS+CSS and this POC is the app's ONLY
                   consumer of it. Deferring keeps it out of the eager bundle so
                   the initial chunk stays honest for the traders who never open
                   it. If DevExtreme is ever adopted outside this panel, revisit
                   this and the Angular budgets together. -->
              @defer (on immediate) {
                <app-dx-browse-panel (close)="layout.toggleRight()" />
              } @placeholder {
                <div class="dock__loading"></div>
              }
            }
          }
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
      .dock__loading {
        height: 100%;
        background: var(--ts-bg-elevated);
      }
      .dock--left {
        border-right: 1px solid var(--ts-border);
        animation: slideL var(--ts-dur-2) var(--ts-ease-out);
      }
      /* Zero-width flex child: everything visible is in the pseudo-elements. */
      .resizer {
        flex: none;
        width: 0;
        position: relative;
        z-index: 2;
      }
      /* Hit area straddles the border — comfortably grabbable without stealing
         a pixel of layout from either side. */
      .resizer::before {
        content: '';
        position: absolute;
        inset-block: 0;
        left: -3px;
        width: 7px;
        cursor: col-resize;
      }
      /* The visible line. Delayed so a pointer merely crossing the border on its
         way to the chart never flashes it. */
      .resizer::after {
        content: '';
        position: absolute;
        inset-block: 0;
        left: -1px;
        width: 2px;
        background: var(--ts-accent);
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--ts-dur-1) var(--ts-ease) 120ms;
      }
      .resizer:hover::after,
      .resizer.is-dragging::after {
        opacity: 1;
        transition-delay: 0ms;
      }
      .resizer:focus-visible {
        outline: none;
      }
      .resizer:focus-visible::after {
        opacity: 1;
        transition-delay: 0ms;
      }
      /* Small screens turn docks into fixed overlays — a resizer there would
         drag against the viewport edge, so it is simply not offered. */
      @media (max-width: 767px) {
        .resizer {
          display: none;
        }
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

  /** Pointer id + starting geometry for an active resize drag. */
  private drag: { id: number; startX: number; startW: number } | null = null;
  /** Drives `.is-dragging` so the line stays lit for the whole gesture, even
   *  once the pointer has travelled well away from the 7px hit area. */
  readonly resizing = signal(false);

  onResizeStart(e: PointerEvent): void {
    const el = e.currentTarget as HTMLElement;
    this.drag = { id: e.pointerId, startX: e.clientX, startW: this.layout.leftWidth() };
    // Capture keeps the drag alive once the pointer leaves the 7px hit area.
    // Guarded: it throws NotFoundError for a pointer the browser no longer
    // tracks, and losing capture must not also cost us the cursor and
    // text-selection lock set up below.
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
      /* drag still works via the document-level listeners on this element */
    }
    this.resizing.set(true);
    // Without this the drag selects text across the tree and the chart labels.
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  }

  onResizeMove(e: PointerEvent): void {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    this.layout.setLeftWidth(this.drag.startW + (e.clientX - this.drag.startX));
  }

  onResizeEnd(e: PointerEvent): void {
    if (!this.drag) return;
    const el = e.currentTarget as HTMLElement;
    try {
      if (el.hasPointerCapture?.(this.drag.id)) el.releasePointerCapture(this.drag.id);
    } catch {
      /* already released */
    }
    this.resizing.set(false);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    this.drag = null;
  }

  /** Keyboard resize — a drag handle that only responds to a mouse is not a
   *  control, it is decoration. */
  onResizeKey(e: KeyboardEvent): void {
    const step = e.shiftKey ? 64 : 16;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.layout.setLeftWidth(this.layout.leftWidth() - step);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.layout.setLeftWidth(this.layout.leftWidth() + step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.layout.resetSizes();
    }
  }

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
