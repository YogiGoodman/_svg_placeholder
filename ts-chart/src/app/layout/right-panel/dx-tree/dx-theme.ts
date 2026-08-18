import { effect, inject, Injectable } from '@angular/core';
import dxThemes from 'devextreme/ui/themes';
import { ThemeService } from '../../../core/theme.service';

/**
 * Keeps DevExtreme's theme in step with the app's own light/dark signal.
 *
 * DevExtreme does not read CSS custom properties — each of its themes is a
 * separate compiled stylesheet, so dark mode means *loading a different file*,
 * not re-tokenising the one that is loaded. Overriding a light-theme stylesheet
 * with dark colors is the wrong shape: every DX surface you forget stays light,
 * and they only surface later on widgets you add next.
 *
 * The mechanism (DevExtreme's own, unchanged):
 *  1. `index.html` declares both stylesheets as `<link rel="dx-theme" …>`.
 *  2. At startup DevExtreme removes those tags and inserts one active `<link>`.
 *  3. `themes.current(name)` swaps that link's href.
 *
 * Widgets already on screen re-read theme constants on the next repaint, so the
 * swap is applied to live widgets rather than only to ones created afterwards.
 */
@Injectable({ providedIn: 'root' })
export class DxThemeService {
  private readonly theme = inject(ThemeService);

  constructor() {
    effect(() => {
      const next = this.theme.theme() === 'dark' ? 'generic.dark' : 'generic.light';
      if (dxThemes.current() !== next) dxThemes.current(next);
    });
  }
}
