import { effect, Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';
export type Density = 'comfortable' | 'compact';

const THEME_KEY = 'tschart.theme';
const DENSITY_KEY = 'tschart.density';

/**
 * Owns theme + density. Writes `data-theme` / `data-density` on <html> and
 * persists to localStorage. Dark + comfortable are the defaults.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.read(THEME_KEY, 'dark') as Theme);
  readonly density = signal<Density>(this.read(DENSITY_KEY, 'comfortable') as Density);

  constructor() {
    effect(() => {
      const t = this.theme();
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem(THEME_KEY, t);
    });
    effect(() => {
      const d = this.density();
      document.documentElement.setAttribute('data-density', d);
      localStorage.setItem(DENSITY_KEY, d);
    });
  }

  toggleTheme(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  setDensity(d: Density): void {
    this.density.set(d);
  }

  private read(key: string, fallback: string): string {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }
}
