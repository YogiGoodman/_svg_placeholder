import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

export type EmptyKind = 'welcome' | 'forbidden' | 'missing';

const CONFIG: Record<
  EmptyKind,
  { img: string; title: string; body: string; cta?: string }
> = {
  welcome: {
    img: 'assets/placeholders/placeholder-hero-dock.svg',
    title: 'Select a series from the tree to begin',
    body: 'Forecasts, contracts and regional markets — pick any series on the left to chart it.',
  },
  forbidden: {
    img: 'assets/placeholders/error-403-forbidden.svg',
    title: 'This series is restricted',
    body: 'Access to this dataset requires an entitlement that isn’t part of the free tier. Choose another series to continue.',
    cta: 'Pick another series',
  },
  missing: {
    img: 'assets/placeholders/error-404-path.svg',
    title: 'No data available',
    body: 'We couldn’t find a timeseries for this contract. It may not have started trading yet.',
    cta: 'Retry',
  },
};

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="ts-empty">
      <img [src]="cfg.img" alt="" draggable="false" />
      <div class="text">
        <h3>{{ cfg.title }}</h3>
        <p>{{ cfg.body }}</p>
      </div>
      @if (cfg.cta) {
        <button class="ts-btn" (click)="action.emit()">
          @if (kind() === 'missing') {
            <lucide-icon name="refresh-cw" [size]="14" />
          }
          {{ cfg.cta }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
      .text {
        display: flex;
        flex-direction: column;
        gap: var(--ts-space-2);
      }
      img {
        animation: rise var(--ts-dur-3) var(--ts-ease-out);
      }
      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly kind = input<EmptyKind>('welcome');
  readonly action = output<void>();

  get cfg() {
    return CONFIG[this.kind()];
  }
}
