import { Injectable, NgZone, inject, signal } from '@angular/core';

/**
 * Thin wrapper over the native Fullscreen API. Tracks the active state as a
 * signal so components can swap the enter/exit icon. ESC handled by the browser.
 */
@Injectable({ providedIn: 'root' })
export class FullscreenService {
  private readonly zone = inject(NgZone);
  readonly active = signal(false);

  constructor() {
    document.addEventListener('fullscreenchange', () => {
      this.zone.run(() => this.active.set(!!document.fullscreenElement));
    });
  }

  async toggle(el: HTMLElement): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // Fullscreen can be blocked (e.g. iframe policy) — fail silently.
    }
  }
}
