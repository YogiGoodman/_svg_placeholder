import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** Reusable collapsible info card. Header toggles a smoothly-animated body. */
@Component({
  selector: 'app-info-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="card">
      <div class="head">
        <button class="head__main" (click)="open.set(!open())" [attr.aria-expanded]="open()">
          @if (icon()) {
            <lucide-icon class="ico" [name]="icon()!" [size]="15" />
          }
          <span class="title ts-mono">{{ title() }}</span>
        </button>
        <span class="head__actions">
          <ng-content select="[card-actions]" />
        </span>
        <button
          class="head__twist"
          (click)="open.set(!open())"
          [attr.aria-expanded]="open()"
          [attr.aria-label]="open() ? 'Collapse' : 'Expand'"
        >
          <lucide-icon class="twist" [class.open]="open()" name="chevron-down" [size]="15" />
        </button>
      </div>
      <div class="body" [class.open]="open()">
        <div class="body__inner">
          <ng-content />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .card {
        border: 1px solid var(--ts-border);
        border-radius: var(--ts-radius-md);
        background: var(--ts-bg-elevated);
        overflow: hidden;
      }
      /* Single 40px row, everything center-aligned:
         [title] ......... [actions] [chevron] */
      .head {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        width: 100%;
        height: 40px;
        padding: 0 var(--ts-space-2) 0 var(--ts-space-3);
      }
      .head__main {
        display: flex;
        align-items: center;
        gap: var(--ts-space-2);
        flex: 1;
        min-width: 0;
        align-self: stretch;
        cursor: pointer;
      }
      .head:hover {
        background: var(--ts-bg-hover);
      }
      .head__actions {
        display: inline-flex;
        align-items: center;
        gap: var(--ts-space-1);
        flex: none;
      }
      .ico {
        color: var(--ts-text-muted);
        flex: none;
      }
      .title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: left;
        font-size: var(--ts-fs-sm);
        font-weight: var(--ts-fw-semibold);
        line-height: 1;
        color: var(--ts-text-bright);
      }
      .head__twist {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        flex: none;
        border-radius: var(--ts-radius-xs);
        cursor: pointer;
      }
      .head__twist:hover {
        background: var(--ts-bg-active);
      }
      .twist {
        display: block;
        color: var(--ts-text-muted);
        transition: transform var(--ts-dur-2) var(--ts-ease);
      }
      .twist.open {
        transform: rotate(180deg);
      }
      .body {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows var(--ts-dur-3) var(--ts-ease);
      }
      .body.open {
        grid-template-rows: 1fr;
      }
      .body__inner {
        overflow: hidden;
      }
      .body.open .body__inner {
        border-top: 1px solid var(--ts-border-subtle);
      }
    `,
  ],
})
export class InfoCardComponent {
  readonly title = input.required<string>();
  readonly icon = input<string>();
  readonly startOpen = input(true);

  readonly open = signal(true);

  constructor() {
    queueMicrotask(() => this.open.set(this.startOpen()));
  }
}
