import { Injectable, signal } from '@angular/core';
import { toBlob } from 'html-to-image';

/**
 * Captures a DOM node to PNG using html-to-image. Downloads the file and, when
 * supported, also copies it to the clipboard. Exposes a transient `flash`
 * signal the UI can use to animate a shutter effect.
 */
@Injectable({ providedIn: 'root' })
export class ScreenshotService {
  readonly busy = signal(false);
  readonly flash = signal(0);

  async capture(node: HTMLElement, filename = 'ts-chart'): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.flash.update((n) => n + 1);
    try {
      const bg =
        getComputedStyle(document.documentElement)
          .getPropertyValue('--ts-bg-elevated')
          .trim() || '#0e1420';
      const blob = await toBlob(node, {
        pixelRatio: 2,
        backgroundColor: bg,
        cacheBust: true,
      });
      if (!blob) return;

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}-${stamp()}.png`;
      a.click();
      URL.revokeObjectURL(url);

      // Clipboard (best-effort)
      try {
        if (navigator.clipboard && 'write' in navigator.clipboard) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
        }
      } catch {
        /* clipboard unavailable — download already succeeded */
      }
    } finally {
      this.busy.set(false);
    }
  }
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
