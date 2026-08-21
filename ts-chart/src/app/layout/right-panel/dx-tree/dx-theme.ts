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
    // Warm the sheet we are NOT currently using. `themes.current()` swaps the
    // active tag's href, so without this the first theme toggle waits on a
    // ~780kB download and DevExtreme surfaces flash unstyled. Prefetching here —
    // rather than with a <link rel="preload"> in index.html — means the cost is
    // paid only once a DevExtreme widget actually exists on screen, which keeps
    // the deferred POC genuinely lazy.
    //
    // Note on swatches: they are NOT the mechanism for a global light/dark
    // toggle. DevExpress scopes a swatch under `.dx-swatch-*` for mixing themes
    // across REGIONS of one page, and warns that more than one may cause
    // performance issues. Whole-stylesheet swapping is their documented answer
    // here, and it is what this service does.
    this.prefetchInactiveTheme();

    effect(() => {
      const next = this.theme.theme() === 'dark' ? 'generic.dark' : 'generic.light';
      if (dxThemes.current() !== next) dxThemes.current(next);
    });
  }

  /**
   * This service is instantiated by whichever component first renders a
   * DevExtreme widget. That coupling is deliberate (it keeps `devextreme/ui/themes`
   * out of the eager bundle) but it is load-bearing: a DevExtreme widget rendered
   * by a component that does NOT inject this service would boot with whatever
   * `index.html` marked `data-active` and never follow the app's theme signal.
   * If DevExtreme is ever used outside the POC panel, inject this there too.
   */
  private prefetchInactiveTheme(): void {
    const inactive = this.theme.theme() === 'dark' ? 'dx.light.css' : 'dx.dark.css';
    if (document.querySelector(`link[rel="prefetch"][href="${inactive}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'style';
    link.href = inactive;
    document.head.appendChild(link);
  }
}
