import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import {
  SplitComponent,
  SplitAreaComponent,
  SplitGutterInteractionEvent,
} from 'angular-split';
import { LayoutService } from '../../core/layout.service';
import { LeftPanelComponent } from '../left-panel/left-panel.component';
import { ChartPanelComponent } from '../center-panel/chart-panel.component';
import { InfoPanelComponent } from '../right-panel/info-panel.component';

@Component({
  selector: 'app-workspace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SplitComponent,
    SplitAreaComponent,
    LeftPanelComponent,
    ChartPanelComponent,
    InfoPanelComponent,
  ],
  template: `
    @if (layout.isSmall()) {
      <!-- Mobile: center fills; side panels become slide-over drawers -->
      <div class="mobile">
        <app-chart-panel />

        @if (!layout.leftCollapsed()) {
          <div class="scrim" (click)="layout.toggleLeft()"></div>
          <aside class="drawer drawer--left">
            <app-left-panel />
          </aside>
        }
        @if (!layout.rightCollapsed()) {
          <div class="scrim" (click)="layout.toggleRight()"></div>
          <aside class="drawer drawer--right">
            <app-info-panel />
          </aside>
        }
      </div>
    } @else {
      <as-split
        unit="percent"
        direction="horizontal"
        [gutterSize]="8"
        (dragEnd)="onDragEnd($event)"
      >
        <as-split-area
          [visible]="!layout.leftCollapsed()"
          [size]="layout.sizes().left"
          [minSize]="15"
          [maxSize]="38"
        >
          <app-left-panel />
        </as-split-area>

        <as-split-area size="*">
          <app-chart-panel />
        </as-split-area>

        <as-split-area
          [visible]="!layout.rightCollapsed()"
          [size]="layout.sizes().right"
          [minSize]="16"
          [maxSize]="40"
        >
          <app-info-panel />
        </as-split-area>
      </as-split>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
        background: var(--ts-bg);
      }
      as-split {
        height: 100%;
      }
      as-split-area {
        overflow: hidden;
      }
      /* Mobile */
      .mobile {
        position: relative;
        height: 100%;
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
        left: 0;
        border-right: 1px solid var(--ts-border);
        animation: slideL var(--ts-dur-3) var(--ts-ease-out);
      }
      .drawer--right {
        right: 0;
        border-left: 1px solid var(--ts-border);
        animation: slideR var(--ts-dur-3) var(--ts-ease-out);
      }
      @keyframes fade {
        from { opacity: 0; }
      }
      @keyframes slideL {
        from { transform: translateX(-100%); }
      }
      @keyframes slideR {
        from { transform: translateX(100%); }
      }
    `,
  ],
})
export class WorkspaceComponent {
  readonly layout = inject(LayoutService);

  onDragEnd(e: SplitGutterInteractionEvent): void {
    // Persist only when both side panels are visible (3 sizes present).
    const s = e.sizes;
    if (s.length !== 3) return;
    const [left, center, right] = s.map((v) => (v === '*' ? 0 : (v as number)));
    this.layout.setSizes({ left, center, right });
  }
}
